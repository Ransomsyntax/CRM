"""Real browser guards for related rails, viewport sizing and route cleanup."""
import os
import socket
import sqlite3
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
CORE = ("leads", "contacts", "accounts", "deals", "products", "activities")


@pytest.fixture(scope="module")
def workspace(tmp_path_factory):
    directory = tmp_path_factory.mktemp("detail-geometry")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    env = {**os.environ, "APP_ENV": "development", "ENABLE_AUTH": "false",
           "DATABASE_URL": f"sqlite:///{directory}/crm.db", "APP_USERNAME": "admin",
           "APP_PASSWORD": "local-layout-test-password", "ADMIN_EMAIL": "qa@example.test",
           "PYTHONPATH": str(ROOT)}
    with (directory / "server.log").open("w") as log:
        server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app",
            "--host", "127.0.0.1", "--port", str(port)], cwd=ROOT, env=env, stdout=log, stderr=log)
        try:
            for _ in range(150):
                try:
                    urllib.request.urlopen(base + "/health", timeout=1).close()
                    break
                except Exception:
                    time.sleep(.2)
            else:
                pytest.fail((directory / "server.log").read_text())
            # Exercise every form in this disposable local workspace, including
            # paid document modules, without changing any real subscription.
            with sqlite3.connect(directory / 'crm.db') as db:
                db.execute("UPDATE organization_subscriptions SET plan_id=(SELECT id FROM plans WHERE code='professional')")
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                yield base, browser, directory
                browser.close()
        finally:
            server.terminate()
            server.wait(timeout=10)


def open_page(page, url):
    page.goto(url)
    expect(page.locator("#app-content")).not_to_have_attribute("aria-busy", "true")
    expect(page.locator("#app-content")).not_to_contain_text("Loading page")
    expect(page.locator(".apex-boot-screen")).to_have_count(0)


def geometry(page):
    return page.evaluate("""() => {
        const rect = s => {const r=document.querySelector(s).getBoundingClientRect();
            return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
        return {rail:rect('.detail-related-nav'),heading:rect('.detail-page-shell > .page-heading'),
            body:rect('.detail-body-scroll'),topbar:rect('.topbar'),
            viewport:{width:innerWidth,height:innerHeight},
            pageWidth:document.documentElement.scrollWidth,
            railPosition:getComputedStyle(document.querySelector('.detail-related-nav')).position};
    }""")


@pytest.mark.parametrize("width", [1440, 1280, 1024, 900, 768, 701, 700, 390, 320])
@pytest.mark.parametrize("theme", ["light", "dark"])
def test_core_detail_geometry(workspace, width, theme):
    base, browser, directory = workspace
    page = browser.new_page(viewport={"width": width, "height": 760})
    page.add_init_script(f"localStorage.setItem('crm-account-theme', '{theme}')")
    try:
        for resource in CORE:
            response = page.request.get(base + f"/api/{resource}?limit=1")
            records = response.json()["items"]
            assert records, resource
            open_page(page, base + f"/{resource}/{records[0]['id']}")
            expect(page.locator(".detail-page-shell")).to_be_visible()
            expect(page.locator('html')).to_have_attribute('data-crm-theme', theme)
            # Also check after entrance animations finish: a retained transform
            # must not turn a viewport rail into a descendant-positioned overlay.
            page.wait_for_timeout(600)
            g = geometry(page)
            assert g["pageWidth"] <= width + 1, (resource, g)
            assert g["railPosition"] == "static", (resource, g)
            if width > 700:
                assert g["rail"]["right"] <= g["heading"]["left"] + 1, (resource, g)
                assert g["rail"]["right"] <= g["body"]["left"] + 1, (resource, g)
                assert abs(g["rail"]["top"] - g["topbar"]["bottom"]) <= 1, (resource, g)
                assert abs(g["body"]["bottom"] - 760) <= 1, (resource, g)
                assert g["body"]["top"] >= g["heading"]["bottom"] - 1, (resource, g)
                page.locator('.detail-body-scroll').evaluate("e => e.scrollTop=e.scrollHeight")
                expect(page.locator('#detail-section-emails')).to_be_in_viewport()
                after = geometry(page)
                assert all(abs(after[key][axis] - g[key][axis]) <= 1
                           for key in ("rail", "heading") for axis in ("top", "bottom", "left", "right"))
            else:
                assert g["rail"]["top"] >= g["heading"]["bottom"] - 1, (resource, g)
                assert g["body"]["top"] >= g["rail"]["bottom"] - 1, (resource, g)
            if width == 1280 and resource == "activities":
                page.locator('.detail-body-scroll').evaluate("e => e.scrollTop=0")
                page.screenshot(path=str(directory / f"activity-{theme}.png"), full_page=True)
        open_page(page, base + "/dashboard")
        assert not page.locator("body").evaluate("e=>e.classList.contains('record-detail-page')")
    finally:
        page.close()


def test_sidebar_changes_and_related_navigation(workspace):
    base, browser, _ = workspace
    page = browser.new_page(viewport={"width": 1280, "height": 694})
    try:
        activity = page.request.get(base + "/api/activities?limit=1").json()["items"][0]
        open_page(page, base + f"/activities/{activity['id']}")
        page.wait_for_timeout(600)
        # A transformed ancestor reproduced the old fixed-position offset.
        page.locator('.detail-page-shell').evaluate("e=>e.style.transform='translateY(0)'")
        page.locator('[data-detail-target="detail-section-emails"]').click()
        expect(page.locator('#detail-section-emails')).to_be_in_viewport()
        page.locator('#sidebar-visibility-toggle').click()
        page.wait_for_timeout(650)
        g = geometry(page)
        sidebar = page.locator('#sidebar').bounding_box()
        assert abs(g['rail']['left'] - sidebar['x'] - sidebar['width']) <= 1, g
        assert g['rail']['right'] <= g['heading']['left'] + 1, g
        assert g['body']['bottom'] <= 695, g
    finally:
        page.close()


@pytest.mark.parametrize("width", [1280, 390])
def test_document_details_and_full_page_forms(workspace, width):
    base, browser, directory = workspace
    page = browser.new_page(viewport={"width": width, "height": 800})
    resources = [*CORE, 'price_books', 'vendors', 'quotes', 'sales_orders',
                 'purchase_orders', 'invoices', 'payments', 'campaigns', 'cases',
                 'solutions', 'documents', 'site_visits']
    try:
        for resource in resources:
            if resource not in CORE:
                records = page.request.get(base + f'/api/platform/{resource}?limit=1').json()['items']
                if not records:
                    deal = page.request.get(base + '/api/deals?limit=1').json()['items'][0]
                    config = page.request.get(base + '/api/platform/catalog').json()['resources'][resource]
                    allowed = {field['key'] for field in config['fields']}
                    values = {'name': 'Layout check ' + resource, 'deal_id': deal['id'],
                              'amount': 100, 'currency': 'INR', 'payment_date': '2026-10-28',
                              'visit_date': '2026-10-28', 'content': 'Layout verification content'}
                    if resource == 'payments':
                        values['invoice_id'] = page.request.get(base + '/api/platform/invoices?limit=1').json()['items'][0]['id']
                    created = page.request.post(base + f'/api/platform/{resource}',
                        data={key: value for key, value in values.items() if key in allowed})
                    assert created.status == 201, (resource, created.text())
                    records = [created.json()]
                open_page(page, base + f'/{resource}/{records[0]["id"]}')
                page.wait_for_timeout(400)
                assert page.evaluate('document.documentElement.scrollWidth') <= width + 1, (resource, width, 'detail')
                if resource == 'quotes':
                    # Column widths must include gaps and tolerate long values.
                    assert page.locator('.qpair').evaluate_all('''rows=>rows.every(row=>
                        row.lastElementChild.getBoundingClientRect().right <= row.getBoundingClientRect().right+1)''')
                    page.screenshot(path=str(directory / f'quote-{width}.png'), full_page=True)
            open_page(page, base + f'/{resource}/create')
            page.wait_for_timeout(400)
            expect(page.locator('#app-content form')).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth') <= width + 1, (resource, width, 'form')
            assert not page.locator('body').evaluate("e=>e.classList.contains('record-detail-page')")
            if width <= 700:
                title = page.locator('#app-content .page-heading').first
                if title.count():
                    assert title.bounding_box()['height'] < 220, (resource, title.bounding_box())
    finally:
        page.close()


@pytest.mark.parametrize("width", [1280, 768, 390])
def test_module_surfaces_do_not_overflow(workspace, width):
    base, browser, _ = workspace
    page = browser.new_page(viewport={"width": width, "height": 800})
    routes = ["dashboard", *CORE, "price_books", "vendors", "quotes", "sales_orders",
              "purchase_orders", "invoices", "payments", "campaigns", "cases", "solutions",
              "documents", "site_visits", "forecasts", "reports", "sales_targets", "ai",
              "setup", "settings/general", "settings/my-profile", "settings/organization"]
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        for route in routes:
            open_page(page, base + "/" + route)
            expect(page.locator('#app-content')).not_to_contain_text('Something went wrong')
            page.wait_for_timeout(400)
            size = page.evaluate("""() => ({viewport:innerWidth,
                document:document.documentElement.scrollWidth,
                content:document.querySelector('#app-content').getBoundingClientRect().right})""")
            assert size['document'] <= width + 1, (route, width, size)
            assert size['content'] <= width + 1, (route, width, size)
            heading = page.locator('#app-content > .page-heading')
            if heading.count():
                assert heading.bounding_box()['width'] <= width + 1, route
        assert not errors, errors
    finally:
        page.close()
