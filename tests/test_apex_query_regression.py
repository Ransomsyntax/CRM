"""Exercise user wording and automation boundaries against a disposable CRM."""
from test_ai_routes_auth import run_app_script


def test_search_wording_ranking_operands_and_contact_history():
    out = run_app_script('''
        from datetime import date, datetime, timedelta
        with TestClient(main.app) as c:
            auth = basic('admin', 'supersecretpass123')
            def post(path, body):
                r = c.post(path, headers=auth, json=body)
                assert r.status_code in (200, 201), r.text
                return r.json()
            small = post('/api/deals', {'name':'Apex Small', 'amount':1000, 'status':'Open'})
            big = post('/api/deals', {'name':'Apex Large', 'amount':700000, 'status':'Open', 'expected_close_date':date.today().isoformat()})
            def ask(q):
                return post('/api/ai/assistant', {'question':q})['result']
            plain, all_rows = ask('Show deals'), ask('Show all deals')
            out['same_records'] = {r['id'] for r in plain['results']} == {r['id'] for r in all_rows['results']}
            out['count'] = all_rows['total']
            high = ask('Which deal has the highest revenue?')
            out['highest'] = high['results'][0]['id'] == big['id']
            out['revenue_caveat'] = 'not collected revenue' in high['uncertainty']
            out['lowest'] = ask('Show the lowest value deal')['results'][0]['id'] == small['id']
            out['top_two'] = len(ask('Show top 2 deals')['results'])
            amount = ask('Show deals above ₹5 lakh closing this month')
            out['amount'] = [r['id'] for r in amount['results']] == [big['id']]
            out['named'] = [r['id'] for r in ask('Find deals Apex Large')['results']] == [big['id']]
            recent = post('/api/leads', {'name':'Apex Recently Emailed','status':'New'})
            idle = post('/api/leads', {'name':'Apex Idle','status':'New'})
            with main.SessionLocal() as db:
                for lead_id in (recent['id'], idle['id']):
                    db.get(main.Lead, lead_id).created_at = datetime.utcnow() - timedelta(days=8)
                db.commit()
            post('/api/emails', {'subject':'Apex contact', 'status':'Sent', 'related_type':'leads', 'related_id':recent['id']})
            unmatched = ask('Which leads have not been contacted for 7 days?')
            ids = {r['id'] for r in unmatched['results']}
            out['uncontacted'] = idle['id'] in ids and recent['id'] not in ids
            out['contact_status'] = unmatched['filters']['statuses']
            out['stale_cutoff'] = ask('Show stale deals')['filters']['cutoff'] is not None
            out['resource'] = main._apex_resource('Show uncontacted prospects')
            out['bad_amount'] = main._apex_amount('Show deals above ....') is None
    ''')
    assert out == {'same_records': True, 'count': 2, 'highest': True,
                   'revenue_caveat': True, 'lowest': True, 'top_two': 2,
                   'amount': True, 'named': True, 'uncontacted': True,
                   'contact_status': [], 'stale_cutoff': True,
                   'resource': 'leads', 'bad_amount': True}


def test_404_diagnostic_is_actionable_and_never_echoes_provider_secrets():
    out = run_app_script('''
        code, message = main._public_ai_error(RuntimeError('Cloud AI returned HTTP 404: secret-token'))
        out = {'code':code, 'actionable':'base URL and model' in message, 'safe':'secret-token' not in message}
    ''')
    assert out == {'code':'AI_ENDPOINT_OR_MODEL_NOT_FOUND', 'actionable': True, 'safe': True}


def test_gemini_native_endpoint_is_diagnosed_without_rerouting_credentials():
    out = run_app_script('''
        main.AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
        out = {'error':main.ai_config_error(), 'unchanged':main.AI_BASE_URL.endswith('/v1beta')}
    ''')
    assert '/v1beta/openai' in out['error']
    assert out['unchanged'] is True


def test_task_requires_approval_and_rejects_stale_source():
    out = run_app_script('''
        from datetime import date, timedelta
        def fake_cloud(body):
            data = json.loads(body['messages'][1]['content'])
            return {'choices':[{'message':{'content':json.dumps({'ranked':[
                {'ref':item['ref'], 'rationale':'Confirm validity.', 'description':'Follow up the source quote.', 'intent':'quote_follow_up'}
                for item in data['EXCEPTIONS']]})}}]}
        main._cloud_ai_json = fake_cloud
        with TestClient(main.app) as c:
            auth = basic('admin', 'supersecretpass123')
            me = c.get('/api/auth/session', headers=auth).json()
            with main.SessionLocal() as db:
                owner = db.scalar(main.select(main.User).where(main.User.email == 'admin@yashcrm.local'))
                if owner is None:
                    owner = db.scalar(main.select(main.User).order_by(main.User.id))
                org_id = main._organization_id_for_user(db, owner.id)
                quote = main.PlatformRecord(resource='quotes', title='Apex approval guard', status='Sent', owner_id=owner.id,
                    organization_id=org_id, amount=1000, version=1, data={'valid_until':(date.today()+timedelta(days=1)).isoformat(), 'currency':'INR'})
                db.add(quote); db.commit(); quote_id = quote.id
            items = c.get('/api/ai/exceptions', headers=auth).json()['items']
            occurrence = next(item for item in items if item['source_id'] == quote_id)
            csrf = c.get('/api/ai/status', headers=auth).json()['csrf_token']
            headers = {**auth, 'X-Yash-CSRF':csrf}
            ranked = c.post('/api/ai/exceptions/rank', headers=headers, json={'occurrence_ids':[occurrence['id']]})
            assert ranked.status_code == 200, ranked.text
            proposal_id = ranked.json()['items'][0]['proposal']['id']
            with main.SessionLocal() as db:
                out['before_approval'] = db.scalar(main.select(main.func.count()).select_from(main.Activity).where(main.Activity.related_type=='quotes', main.Activity.related_id==quote_id))
                db.get(main.PlatformRecord, quote_id).version += 1
                db.commit()
            stale = c.post('/api/ai/proposals/'+proposal_id+'/approve', headers=headers, json={})
            out['stale'] = stale.status_code
            out['stale_code'] = stale.json()['detail']['code']
            with main.SessionLocal() as db:
                out['after_rejection'] = db.scalar(main.select(main.func.count()).select_from(main.Activity).where(main.Activity.related_type=='quotes', main.Activity.related_id==quote_id))
    ''', YASHCRM_AI_API_KEY='isolated-test-key', YASHCRM_AI_EXCEPTIONS_ENABLED='true')
    assert out == {'before_approval':0, 'stale':409, 'stale_code':'PROPOSAL_STALE', 'after_rejection':0}
