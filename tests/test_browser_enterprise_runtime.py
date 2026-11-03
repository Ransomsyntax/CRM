import json
import os
import socket
import sqlite3
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import pytest
from cryptography.fernet import Fernet


def test_connected_runtime_settings_journey(tmp_path):
    playwright=pytest.importorskip('playwright.sync_api')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    base=f'http://127.0.0.1:{port}'
    database=tmp_path/'runtime-browser.db'
    env={**os.environ,'APP_ENV':'development','ENABLE_AUTH':'true','SEED_DEMO_DATA':'false',
         'DATABASE_URL':f'sqlite:///{database}','APP_USERNAME':'browser.platform',
         'APP_PASSWORD':'browser-test-password-123','ADMIN_EMAIL':'browser.platform@example.test',
         'CRM_ENCRYPTION_KEYS':Fernet.generate_key().decode(),'SMTP_HOST':''}
    with (tmp_path/'server.log').open('w+') as log:
        server=subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(port)],env=env,
            cwd=Path(__file__).resolve().parents[1],stdout=log,stderr=log)
        try:
            for _ in range(150):
                try:urllib.request.urlopen(base+'/health',timeout=1);break
                except Exception:time.sleep(.1)
            with playwright.sync_playwright() as p:
                browser=p.chromium.launch(headless=True, executable_path=os.getenv('CRM_TEST_CHROMIUM_PATH') or None, args=json.loads(os.getenv('CRM_TEST_CHROMIUM_ARGS','[]')))
                page=browser.new_page(viewport={'width':1440,'height':1000})
                errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
                assert page.request.post(base+'/api/auth/signup',data={'name':'Runtime Browser','organization_name':'Runtime Browser Org',
                    'username':'runtime.browser','email':'runtime.browser@example.test','password':'browser-test-password-123'}).status==201
                uid=page.request.get(base+'/api/settings/profile').json()['id']
                with sqlite3.connect(database) as db:
                    db.execute("UPDATE organization_subscriptions SET plan_id=(SELECT id FROM plans WHERE code='enterprise') WHERE organization_id=(SELECT organization_id FROM organization_members WHERE user_id=?)",(uid,))
                module=page.request.post(base+'/api/admin/metadata/modules',data={'api_name':'secure_browser','label':'Secure Browser'}).json()
                field=page.request.post(base+f"/api/admin/metadata/modules/{module['id']}/fields",data={'api_name':'confidential','label':'Confidential','field_type':'text'}).json()
                page.request.post(base+'/api/custom/secure_browser',data={'name':'Customer','confidential':'browser-secret-value'})
                page.goto(base+'/setup/protected_fields',wait_until='networkidle')
                if page.get_by_role('button',name='Done',exact=True).count():page.get_by_role('button',name='Done',exact=True).click()
                page.locator(f'[data-runtime-field="{field["id"]}"]').click()
                page.get_by_role('button',name='Confirm',exact=True).click()
                playwright.expect(page.get_by_role('button',name='Remove encryption',exact=True)).to_be_visible(timeout=15000)
                page.goto(base+'/setup/connections/new',wait_until='networkidle')
                page.locator('[data-runtime-connect] [name="name"]').fill('Browser Gmail')
                page.locator('[data-runtime-connect] [name="provider"]').select_option('gmail')
                page.locator('[data-runtime-connect] [name="access_token"]').fill('browser-token-not-a-real-provider-token')
                page.get_by_role('button',name='Save connection',exact=True).click()
                playwright.expect(page.get_by_role('heading',name='Browser Gmail',exact=True)).to_be_visible(timeout=15000)
                assert 'browser-token-not-a-real-provider-token' not in page.locator('body').inner_text()
                page.goto(base+'/setup/sandboxes',wait_until='networkidle')
                page.locator('[data-runtime-sandbox-new] [name="name"]').fill('Browser Sandbox')
                page.get_by_role('button',name='Create sandbox',exact=True).click()
                playwright.expect(page.locator('[data-runtime-sandbox-save]')).to_be_visible(timeout=15000)
                entries=[{'source_id':None,'resource':'email_templates','values':{'name':'Browser sandbox template','subject':'Hello','content':'A saved draft','status':'Active'}}]
                page.locator('[data-runtime-sandbox-save] textarea').fill(json.dumps(entries,indent=2))
                page.get_by_role('button',name='Save draft',exact=True).click()
                playwright.expect(page.get_by_text('Sandbox saved',exact=True)).to_be_visible(timeout=15000)
                assert not page.get_by_text('You have unsaved changes',exact=False).count()
                page.get_by_role('button',name='Run test without actions',exact=True).click()
                playwright.expect(page.locator('[data-runtime-test-result]')).to_contain_text('"side_effects": false')
                page.get_by_role('button',name='Publish to production',exact=True).click()
                page.get_by_role('button',name='Confirm',exact=True).click()
                playwright.expect(page.locator('[data-runtime-sandbox-save]')).to_have_attribute('data-revision','3',timeout=15000)
                with sqlite3.connect(database) as db:
                    assert db.execute("SELECT COUNT(*) FROM platform_records WHERE title='Browser sandbox template'").fetchone()[0]==1
                    raw=db.execute("SELECT data FROM platform_records WHERE resource=?",(module['storage_api_name'],)).fetchone()[0]
                    assert 'browser-secret-value' not in raw
                assert not errors,errors
                browser.close()
        finally:
            server.terminate();server.wait(timeout=10)
