"""Chromium end-to-end Account → Deal → Quote actions on actual CRM screens."""
from __future__ import annotations

import re
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import pytest

pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def test_account_detail_and_selection_create_deal_then_create_quote():
    sock=socket.socket()
    sock.bind(("127.0.0.1",0))
    port=sock.getsockname()[1]
    sock.close()
    base=f"http://127.0.0.1:{port}"
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=os.name == "nt", dir=ROOT) as temporary:
        env=os.environ.copy()
        env.update({
            "APP_ENV":"development", "DATABASE_URL":f"sqlite:///{temporary}/quote-ui.db",
            "ENABLE_AUTH":"true", "APP_USERNAME":"admin",
            "APP_PASSWORD":"supersecretpass123",
            "ADMIN_EMAIL":"admin@example.com", "SEED_DEMO_DATA":"false",
            "PYTHONPATH":str(ROOT),
        })
        server=subprocess.Popen(
            [sys.executable,"-m","uvicorn","app.main:app","--host","127.0.0.1","--port",str(port)],
            cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT,
        )
        try:
            import urllib.request
            for _ in range(120):
                try:
                    with urllib.request.urlopen(base+"/health",timeout=1):
                        break
                except Exception:
                    time.sleep(.2)
            else:
                raise AssertionError("CRM browser server did not start")
            with sync_playwright() as playwright:
                browser=playwright.chromium.launch(headless=True)
                page=browser.new_page(viewport={"width":1440,"height":950})
                errors=[]
                page.on("pageerror",lambda error: errors.append(str(error)))
                page.goto(base+"/signup")
                page.fill("#name","Quote Account Browser")
                page.fill("#organization-name","Context Action Browser Workspace")
                page.fill("#username","quote.account.browser")
                page.fill("#signup-email","quote.browser@example.test")
                page.fill("#password","quote-browser-password-123")
                page.fill("#confirm-password","quote-browser-password-123")
                page.click("#submit-button")
                page.wait_for_url("**/dashboard",timeout=15000)
                # Fixture-only entitlement. Production upgrades require the billing flow.
                import sqlite3
                with sqlite3.connect(f"{temporary}/quote-ui.db") as connection:
                    connection.execute(
                        "UPDATE organization_subscriptions SET plan_id="
                        "(SELECT id FROM plans WHERE code='professional')"
                    )
                    connection.commit()

                page.goto(base+"/accounts")
                try:
                    page.locator('[data-create="accounts"]').first.wait_for(timeout=9000)
                except Exception as error:
                    raise AssertionError(
                        "Accounts screen missing Create button; page="
                        +page.locator("#app-content").inner_text()[:1800]
                        +" | browser errors="+str(errors)
                        +" | current URL="+page.url
                    ) from error
                page.locator('[data-create="accounts"]').first.click()
                page.locator('#modal-body [name="name"]').fill("Browser Quote Account")
                page.locator("#modal-submit").click()
                page.locator("#modal-backdrop").wait_for(state="hidden",timeout=15000)
                page.wait_for_url(re.compile(r".*/accounts/\d+$"),timeout=12000)
                account_id=int(page.url.rsplit("/",1)[-1])
                assert page.locator('[data-create-account-deal]').count()==0
                page.goto(base+"/accounts")
                checkbox=page.locator('[data-select-record="accounts"]').first
                checkbox.wait_for()
                checkbox.check()
                page.locator("[data-selected-account-deal]:not([disabled])").click()
                account_link=page.locator('#modal-body [name="account_id"]')
                account_link.wait_for()
                assert account_link.input_value()==str(account_id)
                page.locator('#modal-body [name="name"]').fill("Browser Opportunity")
                page.locator('#modal-body [name="amount"]').fill("14800")
                page.locator("#modal-submit").click()
                page.wait_for_url(re.compile(r".*/deals/\d+$"),timeout=15000)
                deal_id=int(page.url.rsplit("/",1)[-1])
                assert page.locator('[data-create-deal-quote]').count()==0
                deal_result=page.evaluate(
                    "(id)=>fetch('/api/deals/'+id).then(r=>r.json())",deal_id
                )
                assert deal_result["account_id"]==account_id,deal_result
                assert deal_result["amount"]==14800,deal_result

                # Product selection is a dropdown in the current quote editor.
                product = page.evaluate("""async () => {
                    const response = await fetch('/api/products', {
                        method:'POST', headers:{'Content-Type':'application/json'},
                        body:JSON.stringify({name:'Implementation',sku:'IMP-01',unit_price:14800,stock_quantity:1})
                    });
                    return {status:response.status,body:await response.json()};
                }""")
                assert product["status"] in (200,201), product
                page.goto(base+"/quotes")
                page.locator('[data-platform-create="quotes"]').first.click()
                quote_deal=page.locator('#modal-body [name="deal_id"]')
                quote_deal.wait_for()
                quote_deal.select_option(str(deal_id))
                page.locator('#modal-body [name="name"]').fill("Browser Quote")
                page.locator('[data-quote-key="product_id"]').first.select_option(str(product["body"]["id"]))
                page.locator('[data-quote-key="quantity"]').first.fill("1")
                page.locator('[data-quote-key="unit_price"]').first.fill("14800")
                page.locator('#modal-body [name="terms"]').fill("Net 30 days")
                page.locator("#modal-submit").click()
                try:
                    page.locator("#modal-backdrop").wait_for(state="hidden",timeout=15000)
                except Exception as exc:
                    raise AssertionError("Quote failed to save: "+page.locator("body").inner_text()[-1200:]) from exc
                quotes=page.evaluate("()=>fetch('/api/platform/quotes').then(r=>r.json())")
                quote=next(item for item in quotes['items'] if item.get('deal_id')==deal_id)
                assert quote["account_id"]==account_id,quote
                assert quote["amount"]==14800,quote
                assert quote["terms"]=="Net 30 days",quote
                assert quote["status"]=="Draft",quote
                assert quote["quote_number"].startswith("QT"),quote

                assert not errors,errors
                browser.close()
        finally:
            server.terminate()
            try:
                server.wait(timeout=8)
            except subprocess.TimeoutExpired:
                server.kill()
