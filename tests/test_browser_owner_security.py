"""Owner-console interactions must work with the application's real CSP header."""

from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

import pytest
from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OWNER_USERNAME = "owner_browser_admin"
OWNER_PASSWORD = "Local-owner-browser-password-123!"


@pytest.fixture(scope="module")
def owner_server():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    base_url = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryDirectory(prefix="owner-browser-", dir=ROOT, ignore_cleanup_errors=os.name == "nt") as directory:
        env = os.environ.copy()
        for key in tuple(env):
            if key.startswith(("SMTP_", "TWILIO_")):
                env.pop(key)
        env.update({
            "APP_ENV": "development",
            "ENABLE_AUTH": "true",
            "DATABASE_URL": f"sqlite:///{Path(directory).as_posix()}/owner.db",
            "APP_USERNAME": OWNER_USERNAME,
            "APP_PASSWORD": OWNER_PASSWORD,
            "ADMIN_NAME": "Browser Owner",
            "ADMIN_EMAIL": "owner-browser@example.test",
            "APP_PUBLIC_URL": base_url,
            "ALLOWED_HOSTS": "127.0.0.1,localhost",
            "CORS_ORIGINS": "",
            "SEED_DEMO_DATA": "false",
            "PYTHONDONTWRITEBYTECODE": "1",
        })
        server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=ROOT,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        try:
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                assert server.poll() is None, "Owner browser server exited during startup"
                try:
                    with urlopen(base_url + "/health", timeout=1) as response:
                        if response.status == 200:
                            break
                except (URLError, TimeoutError):
                    time.sleep(0.2)
            else:
                pytest.fail("Owner browser server did not become healthy")
            customers = []
            for suffix in ("alpha", "beta"):
                payload = {
                    "name": f"Owner CSP Customer {suffix.title()}",
                    "organization_name": f"Browser Organization {suffix.title()}",
                    "username": f"ownercsp{suffix}",
                    "email": f"ownercsp{suffix}@example.test",
                    "password": "Local-customer-browser-password-123!",
                }
                request = Request(
                    base_url + "/api/auth/signup",
                    data=json.dumps(payload).encode(),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(request, timeout=20) as response:
                    assert response.status == 201
                    customers.append(json.load(response)["user"])
            yield base_url, customers
        finally:
            server.terminate()
            try:
                server.wait(timeout=15)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=10)


def test_owner_console_actions_work_under_strict_csp(owner_server):
    base_url, customers = owner_server
    violations = []
    page_errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(service_workers="block")
        page = context.new_page()
        page.expose_function("reportOwnerCspViolation", lambda violation: violations.append(violation))
        page.add_init_script("""
            document.addEventListener("securitypolicyviolation", event => {
                window.reportOwnerCspViolation({
                    directive: event.effectiveDirective,
                    blocked: event.blockedURI,
                    source: event.sourceFile,
                });
            });
        """)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        try:
            page.goto(base_url + "/login?next=/owner")
            page.locator("#identifier").fill(OWNER_USERNAME)
            page.locator("#password").fill(OWNER_PASSWORD)
            with page.expect_response(base_url + "/owner") as owner_response:
                page.get_by_role("button", name="Sign in to CONVOSIS CRM").click()
            policy = owner_response.value.headers["content-security-policy"]
            script_policy = next(part.strip() for part in policy.split(";") if part.strip().startswith("script-src "))
            assert "'sha256-" in script_policy
            assert "'unsafe-inline'" not in script_policy
            assert "'unsafe-hashes'" not in script_policy
            expect(page.locator("#page-title")).to_have_text("Owner Overview")
            expect(page.locator("#m-total")).not_to_have_text("—")

            page.get_by_role("button", name="Customers", exact=True).click()
            first, second = customers
            opener = page.get_by_role("button", name=first["name"], exact=True)
            expect(opener).to_be_visible()
            opener.focus()
            with page.expect_response(base_url + f"/api/owner/users/{first['id']}") as detail:
                page.keyboard.press("Enter")
            assert detail.value.json()["user"]["id"] == first["id"]
            expect(page.locator("#drawer")).to_have_attribute("aria-hidden", "false")
            expect(page.locator("#drawer-name")).to_have_text(first["name"])
            expect(page.locator("#drawer-email")).to_have_text(first["email"])
            close = page.get_by_role("button", name="Close", exact=True)
            expect(close).to_be_focused()
            # A late list response can replace the original opener while the
            # drawer is open. Return focus must follow customer identity, not
            # a detached DOM node.
            page.evaluate("loadUsers()")
            expect(close).to_be_focused()
            close.click()
            expect(page.locator("#drawer")).to_have_attribute("aria-hidden", "true")
            expect(opener).to_be_focused()
            # A subsequent list refresh must preserve keyboard position too.
            page.evaluate("loadUsers()")
            expect(opener).to_be_focused()

            # Clicking any part of a customer row remains supported as well.
            row = page.locator(f'#users-body tr[data-user-id="{second["id"]}"]')
            with page.expect_response(base_url + f"/api/owner/users/{second['id']}") as second_detail:
                row.locator("td").nth(1).click()
            assert second_detail.value.json()["user"]["id"] == second["id"]
            expect(page.locator("#drawer-name")).to_have_text(second["name"])
            expect(page.locator("#drawer-email")).to_have_text(second["email"])
            page.keyboard.press("Escape")
            expect(page.locator("#drawer")).to_have_attribute("aria-hidden", "true")

            with page.expect_response(base_url + "/api/owner/overview") as refreshed:
                page.get_by_role("button", name="Refresh", exact=True).click()
            assert refreshed.value.status == 200
            expect(page.get_by_role("button", name=first["name"], exact=True)).to_be_visible()
            page.get_by_role("button", name="Login History", exact=True).click()
            expect(page.locator("#page-title")).to_have_text("Login History")
            expect(page.locator("#logins-body tr").first).to_be_visible()
            page.get_by_role("button", name="Plans & Subscriptions", exact=True).click()
            expect(page.locator("#plans-body .plan").first).to_be_visible()
            page.get_by_role("button", name="Overview", exact=True).click()
            expect(page.locator("#view-overview")).to_be_visible()
            page.get_by_role("button", name="CRM Settings", exact=True).click()
            page.wait_for_url(base_url + "/settings")
            page.goto(base_url + "/owner")
            page.get_by_role("button", name="Back to CRM", exact=True).click()
            page.wait_for_url(base_url + "/dashboard")
            assert not violations, violations
            assert not page_errors, page_errors
        finally:
            context.close()
            browser.close()
