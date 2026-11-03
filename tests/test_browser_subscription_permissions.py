import json
"""Exercise profile creation and the full-page invitation form in Chromium."""
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest


def test_profile_and_invitation_journey(tmp_path):
    playwright=pytest.importorskip('playwright.sync_api')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0))
        port=sock.getsockname()[1]
    base=f'http://127.0.0.1:{port}'
    env={**os.environ,'APP_ENV':'development','ENABLE_AUTH':'true','SEED_DEMO_DATA':'false',
         'DATABASE_URL':f'sqlite:///{tmp_path}/browser.db','APP_USERNAME':'browser.owner',
         'APP_PASSWORD':'browser-test-password-123','ADMIN_EMAIL':'browser.owner@example.test'}
    with (tmp_path/'server.log').open('w+') as log:
        server=subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(port)],
            env=env,cwd=Path(__file__).resolve().parents[1],stdout=log,stderr=log)
        try:
            for _ in range(150):
                try:
                    urllib.request.urlopen(base+'/health',timeout=1)
                    break
                except Exception:
                    time.sleep(.1)
            with playwright.sync_playwright() as p:
                browser=p.chromium.launch(headless=True, executable_path=os.getenv('CRM_TEST_CHROMIUM_PATH') or None, args=json.loads(os.getenv('CRM_TEST_CHROMIUM_ARGS','[]')))
                page=browser.new_page(viewport={'width':1440,'height':1000})
                errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                assert page.request.post(base+'/api/auth/signup',data={'name':'Browser Admin',
                    'organization_name':'Browser Permissions','username':'browser.admin',
                    'email':'browser.admin@example.test','password':'browser-test-password-123'}).status==201
                page.goto(base+'/setup/profiles',wait_until='domcontentloaded')
                if page.get_by_role('button',name='Done',exact=True).count():
                    page.get_by_role('button',name='Done',exact=True).click()
                page.get_by_role('button',name='New Profile',exact=True).click()
                page.locator('[data-profile-new] input[name="name"]').fill('Browser Sales')
                page.get_by_role('button',name='Create profile',exact=True).click()
                playwright.expect(page.locator('[data-editing-profile="Browser Sales"]')).to_be_visible(timeout=15000)
                assert page.locator('[data-feature-permission]:disabled').count()>0
                read=page.locator('[data-permission-module="leads"][data-permission-action="read"]')
                read.locator('xpath=ancestor::details').locator('summary').click()
                read.check()
                page.get_by_role('button',name='Save Permissions',exact=True).click()
                playwright.expect(page.get_by_text('Profile saved',exact=True)).to_be_visible(timeout=10000)
                page.goto(base+'/setup/users',wait_until='domcontentloaded')
                page.get_by_role('button',name='＋ Add user',exact=True).click()
                playwright.expect(page).to_have_url(base+'/users/create')
                playwright.expect(page.locator('#crm-fullpage-form-host')).to_be_visible()
                page.locator('#modal-body [name="name"]').fill('Browser Teammate')
                page.locator('#modal-body [name="email"]').fill('browser.teammate@example.test')
                page.locator('#modal-body [name="profile_name"]').select_option('Browser Sales')
                page.get_by_role('button',name='Send invitation',exact=True).click()
                playwright.expect(page.get_by_role('textbox',name='Invitation link',exact=True)).to_be_visible(timeout=15000)
                assert not errors,errors
                browser.close()
        finally:
            server.terminate()
            server.wait(timeout=10)
