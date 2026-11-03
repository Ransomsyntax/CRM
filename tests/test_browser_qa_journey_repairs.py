"""End-to-end checks for the audit's concrete user journeys."""
import os
import re
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def test_audit_journeys():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0))
        port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    with tempfile.TemporaryDirectory() as directory:
        database = f'{directory}/qa.db'
        env = {**os.environ,'APP_ENV':'development','DATABASE_URL':f'sqlite:///{database}',
               'ENABLE_AUTH':'true','APP_USERNAME':'admin','APP_PASSWORD':'supersecretpass123',
               'ADMIN_EMAIL':'admin@example.com','SEED_DEMO_DATA':'false','PYTHONPATH':str(ROOT)}
        server = subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port',str(port)],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                try:
                    urllib.request.urlopen(base+'/health',timeout=1).close()
                    break
                except Exception:
                    time.sleep(.2)
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                page = browser.new_page(viewport={'width':1363,'height':936})
                errors, dialogs = [], []
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.on('dialog',lambda dialog:(dialogs.append(dialog.message),dialog.dismiss()))
                page.goto(base+'/signup')
                for selector,value in {'#name':'Journey Browser','#organization-name':'Journey Browser QA','#username':'journey.browser','#signup-email':'journey.browser@example.test','#password':'journey-password-123','#confirm-password':'journey-password-123'}.items():
                    page.fill(selector,value)
                page.click('#submit-button')
                page.wait_for_url('**/dashboard')
                def post(path,payload):
                    result=page.evaluate('''async ([path,payload]) => {const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return {status:r.status,data:await r.json()}}''',[path,payload])
                    assert result['status'] in (200,201),result
                    return result['data']
                account=post('/api/accounts',{'name':'Journey Company'})
                contact=post('/api/contacts',{'first_name':'Journey','last_name':'Contact','account_id':account['id']})
                deal=post('/api/deals',{'name':'Journey 250000','amount':250000,'expected_close_date':'2026-10-30'})
                post('/api/deals',{'name':'Journey 1000','amount':1000})
                page.goto(base+'/deals')
                page.locator('[data-deal-filter="min_amount"]').fill('260000')
                expect(page.locator('.module-toolbar')).to_contain_text('0 records')
                page.locator('[data-clear-filters]').click()
                expect(page.locator('.module-toolbar')).to_contain_text('12 records')
                page.locator('[data-deal-filter="min_amount"]').fill('250000')
                expect(page.locator('.module-toolbar')).to_contain_text('1 record')
                page.locator('[data-clear-filters]').click()
                page.locator('[data-toggle-view="grid"]').click()
                card=page.locator('.record-grid-card').filter(has_text='Journey 250000')
                expect(card).to_contain_text('Qualification')
                expect(card).to_contain_text('2,50,000')
                expect(card).to_contain_text('20%')
                expect(card).to_contain_text('30 Oct 2026')
                card.focus()
                page.keyboard.press('Enter')
                page.wait_for_url(base+f'/deals/{deal["id"]}')
                page.locator('[data-related-quick-add="quotes"]').first.click()
                expect(page.get_by_role('heading',name='Plan access required',exact=True)).to_be_visible()
                assert page.locator('#modal-body [name="name"]:visible').count()==0
                page.goto(base+'/campaigns/create')
                page.locator('#modal-body [name="name"]').fill('Invalid campaign')
                page.locator('#modal-body [name="budget"]').fill('-100')
                page.locator('#modal-body [name="start_date"]').fill('2026-10-30')
                page.locator('#modal-body [name="end_date"]').fill('2026-10-01')
                assert not page.locator('#modal-body [name="budget"]').evaluate('(input)=>input.checkValidity()')
                assert not page.locator('#modal-body [name="end_date"]').evaluate('(input)=>input.checkValidity()')
                page.locator('#modal-body [name="budget"]').fill('0')
                page.locator('#modal-body [name="end_date"]').fill('2026-10-30')
                assert page.locator('#modal-body [name="end_date"]').evaluate('(input)=>input.checkValidity()')
                page.locator('#modal-submit').click()
                page.wait_for_url(re.compile(r'.*/campaigns/\d+$'))
                page.goto(base+'/cases/create')
                expect(page.locator('[aria-label="Select record layout"]')).to_have_count(1)
                expect(page.locator('[aria-label="Record layout"]')).to_have_count(0)
                expect(page.locator('#modal-body [name="status"]')).to_have_value('New')
                case=post('/api/platform/cases',{'name':'Journey Case','account_id':account['id'],'contact_id':contact['id']})
                page.goto(base+f'/cases/{case["id"]}')
                expect(page.locator('.meta-value a[href="/accounts/'+str(account['id'])+'"]')).to_have_text('Journey Company')
                expect(page.locator('.meta-value a[href="/contacts/'+str(contact['id'])+'"]')).to_have_text('Journey Contact')
                lead=post('/api/leads',{'name':'Conversion Journey','company':'Journey Company','status':'Qualified'})
                page.goto(base+f'/leads/{lead["id"]}/convert')
                page.locator('#convert-deal').check()
                page.locator('#convert-date').fill('2026-10-30')
                page.locator('#convert-submit').click()
                page.wait_for_url(base+f'/leads/{lead["id"]}/converted')
                assert dialogs==[],dialogs
                with sqlite3.connect(database) as db:
                    db.execute("UPDATE organization_subscriptions SET plan_id=(SELECT id FROM plans WHERE code='professional')")
                product=post('/api/products',{'name':'Implementation Sprint','unit_price':125000})
                page.goto(base+'/quotes/create')
                expect(page.locator('[aria-label="Select record layout"]')).to_have_count(1)
                expect(page.locator('[aria-label="Record layout"]')).to_have_count(0)
                page.locator('[data-qfield="product_id"]').first.select_option(str(product['id']))
                page.get_by_role('spinbutton',name='Quantity for line 1',exact=True).fill('2')
                page.get_by_role('spinbutton',name='Discount percentage for line 1',exact=True).fill('10')
                page.get_by_role('spinbutton',name='Tax percentage for line 1',exact=True).fill('18')
                page.locator('#modal-body [name="adjustment"]').fill('500')
                totals=page.locator('[data-quote-totals]')
                for amount in ('2,50,000','25,000','40,500','2,66,000'):
                    expect(totals).to_contain_text(amount)
                expect(page.get_by_role('button',name='Remove line item 1',exact=True)).to_have_count(1)
                assert not errors,errors
                browser.close()
        finally:
            server.terminate()
            server.wait(timeout=10)
