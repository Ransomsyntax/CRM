from __future__ import annotations

import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import quote

import pytest

pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
AUTH_MODES = (
    ("/login", "Sign in", "login", ("identifier", "password")),
    ("/signup", "Create account", "signup", ("name", "organization-name", "username", "signup-email", "password", "confirm-password")),
    ("/forgot-password", "Reset password", "forgot-password", ("identifier",)),
    ("/reset-password?token=test-only-token", "Choose a new password", "reset-password", ("password", "confirm-password")),
)
FIELD_VALUES = {
    "name": "Browser Auth Test",
    "organization-name": "Browser Auth Organization",
    "username": "browser.auth.test",
    "signup-email": "browser.auth@example.test",
    "identifier": "browser.auth@example.test",
    "password": "browser-auth-password-123",
    "confirm-password": "browser-auth-password-123",
}


@pytest.fixture(scope="module")
def auth_browser():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryDirectory(dir=ROOT, ignore_cleanup_errors=os.name == "nt") as temp:
        env = {
            **os.environ,
            "APP_ENV": "development",
            "DATABASE_URL": f"sqlite:///{temp}/auth-accessibility.db",
            "ENABLE_AUTH": "true",
            "APP_USERNAME": "admin",
            "APP_PASSWORD": "supersecretpass123",
            "ADMIN_EMAIL": "admin@example.com",
            "ADMIN_NAME": "Administrator",
            "SEED_DEMO_DATA": "false",
            "PYTHONPATH": str(ROOT),
        }
        server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
        )
        try:
            deadline = time.monotonic() + 40
            while time.monotonic() < deadline:
                if server.poll() is not None:
                    raise AssertionError(f"Auth test server exited with {server.returncode}")
                try:
                    with urlopen(base + "/health", timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.2)
            else:
                raise AssertionError("Auth test server did not become healthy")
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                try:
                    yield base, browser
                finally:
                    browser.close()
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)


@pytest.mark.parametrize("path,heading,endpoint,required", AUTH_MODES)
def test_auth_modes_have_usable_mobile_fields_and_password_controls(auth_browser, path, heading, endpoint, required):
    base, browser = auth_browser
    context = browser.new_context(viewport={"width": 375, "height": 812})
    page = context.new_page()
    script_errors = []
    posts = []
    page.on("pageerror", lambda error: script_errors.append(str(error)))
    page.on("request", lambda request: posts.append(request.url) if request.method == "POST" else None)
    try:
        page.goto(base + path)
        page.get_by_role("heading", name=heading, exact=True).wait_for(state="visible")
        assert page.locator("form").get_attribute("action") == "/api/auth/" + endpoint
        assert page.locator("form").get_attribute("method") == "post"
        assert page.locator("form input[required]").evaluate_all("inputs => inputs.map(input => input.id).sort()") == sorted(required)
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

        # Native validation must block empty input without sending an API request.
        page.locator("#submit-button").click()
        assert not posts
        assert not page.locator("form").evaluate("form => form.checkValidity()")
        for field in required:
            assert page.locator("#" + field).is_visible()
            page.locator("#" + field).fill(FIELD_VALUES[field])
        assert page.locator("form").evaluate("form => form.checkValidity()")

        # Show/hide changes both visibility and the accessible button state;
        # a visibility button must never submit the authentication form.
        for field in ("password", "confirm-password"):
            if field not in required:
                continue
            password = page.locator("#" + field)
            toggle = page.locator(f'[data-password-toggle="{field}"]')
            label = "confirmation password" if field == "confirm-password" else "password"
            assert password.get_attribute("autocomplete") == ("current-password" if endpoint == "login" else "new-password")
            toggle.click()
            assert password.get_attribute("type") == "text"
            assert password.input_value() == FIELD_VALUES[field]
            assert toggle.get_attribute("aria-pressed") == "true"
            assert toggle.get_attribute("aria-label") == "Hide " + label
            toggle.click()
            assert password.get_attribute("type") == "password"
            assert toggle.get_attribute("aria-pressed") == "false"
            assert toggle.get_attribute("aria-label") == "Show " + label
        assert not posts
        assert not script_errors, script_errors
    finally:
        context.close()


@pytest.mark.parametrize("path", [mode[0] for mode in AUTH_MODES])
def test_auth_without_javascript_keeps_credentials_out_of_urls(auth_browser, path):
    base, browser = auth_browser
    context = browser.new_context(java_script_enabled=False)
    page = context.new_page()
    try:
        page.goto(base + path)
        page.locator("#identifier").fill("no-js-auth@example.test")
        page.locator("#password").fill("no-js-secret-password-123")
        with page.expect_request(lambda request: request.is_navigation_request() and request.method == "POST") as submitted:
            page.locator("#password").press("Enter")
        request = submitted.value
        page.wait_for_url("**/api/auth/login")
        assert request.url == base + "/api/auth/login"
        assert "identifier=no-js-auth%40example.test" in request.post_data
        assert "password=no-js-secret-password-123" in request.post_data
        assert page.url == base + "/api/auth/login"
        # The backend accepts JSON, so a native form may safely fail with 422.
        # This contract is credential transport safety, not JavaScript-free login.
        assert "no-js-secret-password-123" not in request.url
    finally:
        context.close()


def test_login_return_path_cannot_redirect_to_another_origin(auth_browser):
    base, browser = auth_browser
    context = browser.new_context()
    page = context.new_page()
    navigations = []
    page.on("request", lambda request: navigations.append(request.url) if request.is_navigation_request() else None)
    try:
        # Browsers normalize a slash followed by a backslash into a network URL.
        destination = "/" + chr(92) + "external.example"
        page.goto(base + "/login?next=" + quote(destination, safe=""))
        page.locator("#identifier").fill("admin")
        page.locator("#password").fill("supersecretpass123")
        page.locator("#submit-button").click()
        page.wait_for_url(base + "/dashboard", wait_until="commit", timeout=30000)
        assert all(url.startswith(base + "/") for url in navigations), navigations
    finally:
        context.close()
