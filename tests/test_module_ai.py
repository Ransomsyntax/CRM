"""Exercise the module agent through authenticated routes and its durable worker."""
import textwrap
from test_ai_routes_auth import run_app_script


def test_full_scan_grounded_actions_execution_and_cooldown():
    out = run_app_script('''
        from app.services import module_ai as agent
        from app.services.module_ai_models import ModuleAIJob, ModuleAIOperation
        captured = []
        def cloud(body):
            request = json.loads(body['messages'][1]['content'])
            context = request['CRM_CONTEXT']
            captured.extend(context['records'])
            rows = context['records']
            actions = [{'kind':'task','resource':'leads','record_id':rows[0]['id'],
                        'values':{'subject':'Call prospect','priority':'High'},'reason':'Arrange a next step'}] if rows else []
            return {'choices':[{'message':{'content':json.dumps({'answer':'Reviewed visible leads','opportunities':['Follow up'],'risks':[],'actions':actions})}}]}
        agent.N['_cloud_ai_json'] = cloud
        agent.N['ai_config_error'] = lambda: None
        with TestClient(main.app) as c:
            auth = basic('admin','supersecretpass123')
            auth['X-Yash-CSRF'] = main.AI_CSRF_TOKEN
            for n in range(35):
                response = c.post('/api/leads', headers=auth, json={'name':f'Visible lead {n}','email':f'lead{n}@example.test'})
                assert response.status_code in (200,201), response.text
            modules = c.get('/api/ai/modules',headers=auth)
            assert modules.status_code == 200, modules.text
            out['catalog'] = all(k in modules.json()['modules'] for k in ('leads','cases','reports','invoices','roles'))
            out['mail_ready'] = modules.json()['email_ready']
            response = c.post('/api/ai/modules/leads/jobs',headers=auth,json={'question':'Review every lead and create follow-up tasks'})
            assert response.status_code == 202, response.text
            jid = response.json()['id']
            agent.tick()
            result = c.get(f'/api/ai/modules/jobs/{jid}',headers=auth)
            assert result.status_code == 200, result.text
            result = result.json()
            assert result['status'] == 'completed', result
            out['coverage'] = result['result']['coverage']['leads']
            out['read_count'] = len(captured)
            out['private_internal'] = not any(k.startswith('_') for k in result['result'])
            out['created_before_approval'] = c.get('/api/activities',headers=auth).json()['total']
            operation = result['actions'][0]['id']
            done = c.post(f'/api/ai/modules/actions/{operation}/execute',headers=auth,json={})
            assert done.status_code == 200, done.text
            out['executed'] = done.json()['status']
            repeat = c.post(f'/api/ai/modules/actions/{operation}/execute',headers=auth,json={})
            out['repeat'] = repeat.json()['status']
            out['created_after_approval'] = c.get('/api/activities',headers=auth).json()['total']
            csrf = c.post('/api/ai/modules/leads/jobs',headers=basic('admin','supersecretpass123'),json={'question':'Find next steps'})
            out['csrf'] = csrf.status_code
    ''')
    assert out['catalog'] and not out['mail_ready']
    assert out['coverage'] == {'records_read': 35, 'pages_analyzed': 2, 'complete': True}
    assert out['read_count'] == 35 and out['private_internal']
    assert out['created_before_approval'] == 0
    assert out['executed'] == out['repeat'] == 'completed'
    assert out['created_after_approval'] == 1
    assert out['csrf'] == 403


def test_provider_failure_keeps_partial_coverage_and_reserves_usage():
    out = run_app_script('''
        from app.services import module_ai as agent
        from app.services.module_ai_models import ModuleAIJob
        calls = [0]
        def cloud(body):
            calls[0] += 1
            if calls[0] > 1:
                raise RuntimeError('private-provider-token')
            return {'choices':[{'message':{'content':json.dumps({'answer':'Page one read','opportunities':[],'risks':[],'actions':[]})}}]}
        agent.N['_cloud_ai_json'] = cloud
        agent.N['ai_config_error'] = lambda: None
        with TestClient(main.app) as c:
            auth = {**basic('admin','supersecretpass123'),'X-Yash-CSRF':main.AI_CSRF_TOKEN}
            for n in range(31):
                c.post('/api/leads',headers=auth,json={'name':f'Lead {n}'})
            job = c.post('/api/ai/modules/leads/jobs',headers=auth,json={'question':'Review leads'}).json()
            agent.tick()
            result = c.get(f"/api/ai/modules/jobs/{job['id']}",headers=auth).json()
            out['failed'] = result['status']
            out['partial'] = result['result']['coverage']['leads']
            out['safe'] = 'private-provider-token' not in json.dumps(result)
            with main.SessionLocal() as db:
                out['reserved'] = db.scalar(main.select(main.func.count()).select_from(main.ApexAssistantRun).where(main.ApexAssistantRun.intent=='module_agent'))
    ''')
    assert out == {'failed':'failed','partial':{'records_read':30,'pages_analyzed':1,'complete':False},'safe':True,'reserved':2}


def test_private_records_hidden_fields_profile_denials_and_revocation():
    from test_sharing_security_regressions import SCENARIO
    from test_tier0_tenant_audit import run_app_script as run_tenant
    out = run_tenant(textwrap.dedent('''
    from app.services import module_ai as agent
    captured = []
    def cloud(body):
        context = json.loads(body['messages'][1]['content'])['CRM_CONTEXT']
        captured.extend(context['records'])
        target = context['records'][0]
        return {'choices':[{'message':{'content':json.dumps({'answer':'Reviewed this user records','actions':[
            {'kind':'task','resource':'leads','record_id':target['id'],'values':{'subject':'Forbidden task'},'reason':'Test profile restriction'},
            {'kind':'update','resource':'leads','record_id':target['id'],'values':{'owner_id':1},'reason':'Forbidden ownership change'}]})}}]}
    agent.N['_cloud_ai_json'] = cloud
    agent.N['ai_config_error'] = lambda: None
    ''') + SCENARIO + '''
    owned = c.post('/api/leads',json={'name':'Reader owned lead','notes':'HIDDEN FIELD CONTENT','email':'reader-customer@example.test'}).json()
    with main.SessionLocal() as db:
        reader = db.get(main.User,reader_id)
        sub = main._ensure_organization_subscription(db,reader)
        sub.plan_id = db.scalar(main.select(main.Plan.id).where(main.Plan.code=='enterprise'))
        org = sub.organization_id
        module = main.MetadataModule(api_name='leads',label='Leads',plural_label='Leads',organization_id=org,owner_id=owner_id)
        db.add(module);db.flush()
        field = main.MetadataField(module_id=module.id,api_name='notes',label='Notes',field_type='text',visibility={'Reader':'Hidden'},permissions={'Reader':{'write':False}})
        db.add(field)
        db.add(main.PlatformRecord(resource='module_permission_matrix',organization_id=org,owner_id=owner_id,title='Reader',data={'profile':'Reader','modules':{'ai':{'read':True,'create':True,'update':True,'delete':True},'leads':{'read':True,'create':True,'update':True},'activities':{'read':True,'create':False}},'setup':{}}))
        db.commit()
    headers={'X-Yash-CSRF':main.AI_CSRF_TOKEN}
    submitted=c.post('/api/ai/modules/leads/jobs',headers=headers,json={'question':'Review my leads and prepare tasks'})
    assert submitted.status_code==202,submitted.text
    jid=submitted.json()['id']
    agent.tick()
    job=c.get(f'/api/ai/modules/jobs/{jid}').json()
    assert job['status']=='completed',job
    out['only_owned']=[r['id'] for r in captured]==[owned['id']]
    out['hidden_field']='HIDDEN FIELD CONTENT' not in json.dumps(captured)
    out['actions_blocked']=len(job['actions'])==0 and len(job['result']['blocked_actions'])==2
    login('qa.owner')
    out['other_user_job']=c.get(f'/api/ai/modules/jobs/{jid}').status_code
    login('qa.reader')
    with main.SessionLocal() as db:
        reader=db.get(main.User,reader_id)
        reader.profile_name='Changed'
        db.commit()
    out['revoked_history']=c.get(f'/api/ai/modules/jobs/{jid}').status_code
    with main.SessionLocal() as db:
        sub=db.scalar(main.select(main.OrganizationSubscription).where(main.OrganizationSubscription.organization_id==org))
        sub.plan_id=db.scalar(main.select(main.Plan.id).where(main.Plan.code=='free'))
        db.commit()
    out['plan_denied']=c.post('/api/ai/modules/leads/jobs',headers=headers,json={'question':'Review leads'}).status_code
    ''')
    assert out == {'only_owned': True, 'hidden_field': True, 'actions_blocked': True,
                   'other_user_job': 404, 'revoked_history':403, 'plan_denied':403}


def test_email_delivery_is_truthful_permission_bound_and_never_replayed():
    out = run_app_script('''
        from app.services import module_ai as agent
        import os
        sent = []
        def cloud(body):
            row=json.loads(body['messages'][1]['content'])['CRM_CONTEXT']['records'][0]
            return {'choices':[{'message':{'content':json.dumps({'answer':'Prepared customer follow-up','actions':[
                {'kind':kind,'resource':'leads','record_id':row['id'],'values':{'subject':'Your next step','body':'Hello, when can we talk?'},'reason':'Requested follow-up'} for kind in ('draft_email','send_email')]})}}]}
        agent.N['_cloud_ai_json']=cloud
        agent.N['ai_config_error']=lambda:None
        agent.N['_send_email_message']=lambda to,subject,body: sent.append(to) or True
        with TestClient(main.app) as c:
            auth={**basic('admin','supersecretpass123'),'X-Yash-CSRF':main.AI_CSRF_TOKEN}
            lead=c.post('/api/leads',headers=auth,json={'name':'Mail customer','email':'customer@example.test'}).json()
            jid=c.post('/api/ai/modules/leads/jobs',headers=auth,json={'question':'Draft and send follow-up email','record_id':lead['id']}).json()['id']
            agent.tick()
            job=c.get(f'/api/ai/modules/jobs/{jid}',headers=auth).json()
            assert job['status']=='completed',job
            draft,send=[x['id'] for x in job['actions']]
            out['draft']=c.post(f'/api/ai/modules/actions/{draft}/execute',headers=auth,json={}).json()['result']['status']
            out['no_smtp']=c.post(f'/api/ai/modules/actions/{send}/execute',headers=auth,json={}).status_code
            os.environ['SMTP_HOST']='configured.example.test'
            os.environ['SMTP_FROM']='sales@example.test'
            result=c.post(f'/api/ai/modules/actions/{send}/execute',headers=auth,json={})
            assert result.status_code==200,result.text
            out['send']=result.json()['result']['status']
            c.post(f'/api/ai/modules/actions/{send}/execute',headers=auth,json={})
            out['delivered_once']=sent==['customer@example.test']
            with main.SessionLocal() as db:
                owner=db.scalar(main.select(main.User).where(main.User.username=='admin'))
                row=db.get(main.Lead,lead['id'])
                check=agent.Action(kind='send_email',resource='leads',record_id=row.id,values={'subject':'Test','body':'Test'},reason='Test')
                original=agent.N['_profile_action_allowed']
                agent.N['_profile_action_allowed']=lambda db,actor,resource,action: False if action=='send_email' else original(db,actor,resource,action)
                try:
                    agent.validate_action(db,owner,check,{f'leads:{row.id}':agent.stamp(row)})
                    out['denied']=False
                except main.HTTPException as e:
                    out['denied']=e.status_code==403
    ''')
    assert out == {'draft':'Draft','no_smtp':503,'send':'Sent','delivered_once':True,'denied':True}


def test_custom_modules_reports_and_existing_module_updates():
    out = run_app_script('''
        from app.services import module_ai as agent
        def cloud(body):
            context=json.loads(body['messages'][1]['content'])['CRM_CONTEXT']
            resource=context['module'];row=context['records'][0]
            if resource=='reports':
                out['report_grounded']=row['report_output']['rows'][0]['amount']==400
                action={'kind':'run_report','resource':resource,'record_id':row['id'],'values':{},'reason':'Run requested report'}
            else:
                action={'kind':'update','resource':resource,'record_id':row['id'],'values':{'name':'Reviewed by APEX'},'reason':'Requested record update'}
            return {'choices':[{'message':{'content':json.dumps({'answer':'Module reviewed','actions':[action]})}}]}
        agent.N['_cloud_ai_json']=cloud
        agent.N['ai_config_error']=lambda:None
        with TestClient(main.app) as c:
            auth={**basic('admin','supersecretpass123'),'X-Yash-CSRF':main.AI_CSRF_TOKEN}
            case=c.post('/api/platform/cases',headers=auth,json={'name':'Customer issue'}).json()
            deal=c.post('/api/deals',headers=auth,json={'name':'Report deal','amount':400}).json()
            report=c.post('/api/platform/reports',headers=auth,json={'name':'Pipeline','module':'deals','columns':['name','amount']}).json()
            with main.SessionLocal() as db:
                owner=db.scalar(main.select(main.User).where(main.User.username=='admin'))
                org=main._organization_id_required(db,owner)
                module=main.MetadataModule(api_name='renewals',label='Renewal',plural_label='Renewals',owner_id=owner.id,organization_id=org)
                db.add(module);db.flush()
                db.add(main.MetadataField(module_id=module.id,api_name='name',label='Name',field_type='text',required=True))
                db.commit()
            custom=c.post('/api/custom/renewals',headers=auth,json={'name':'Renewal'}).json()
            for resource,record in [('cases',case),('renewals',custom),('reports',report)]:
                response=c.post(f'/api/ai/modules/{resource}/jobs',headers=auth,json={'question':'Review and prepare this module action','record_id':record['id']})
                assert response.status_code==202,response.text
                jid=response.json()['id'];agent.tick()
                result=c.get(f'/api/ai/modules/jobs/{jid}',headers=auth).json()
                assert result['status']=='completed',result
                op=result['actions'][0]['id']
                execute=c.post(f'/api/ai/modules/actions/{op}/execute',headers=auth,json={})
                assert execute.status_code==200,execute.text
                out[resource]=execute.json()['status']
            out['case_saved']=c.get(f"/api/platform/cases/{case['id']}",headers=auth).json()['name']=='Reviewed by APEX'
            out['custom_saved']=c.get(f"/api/custom/renewals/{custom['id']}",headers=auth).json()['name']=='Reviewed by APEX'
    ''')
    assert out == {'report_grounded': True, 'cases':'completed','renewals':'completed','reports':'completed',
                   'case_saved':True,'custom_saved':True}


def test_recurring_runs_execute_only_explicit_types_and_pause():
    out = run_app_script('''
        from datetime import datetime
        from app.services import module_ai as agent
        from app.services.module_ai_models import ModuleAIAutomation,ModuleAIJob,ModuleAIOperation
        def cloud(body):
            row=json.loads(body['messages'][1]['content'])['CRM_CONTEXT']['records'][0]
            return {'choices':[{'message':{'content':json.dumps({'answer':'Recurring review','actions':[
                {'kind':'task','resource':'leads','record_id':row['id'],'values':{'subject':'Recurring follow-up'},'reason':'Requested task'},
                {'kind':'update','resource':'leads','record_id':row['id'],'values':{'name':'Should remain a proposal'},'reason':'Possible update'}]})}}]}
        agent.N['_cloud_ai_json']=cloud
        agent.N['ai_config_error']=lambda:None
        with TestClient(main.app) as c:
            auth={**basic('admin','supersecretpass123'),'X-Yash-CSRF':main.AI_CSRF_TOKEN}
            lead=c.post('/api/leads',headers=auth,json={'name':'Recurring customer'}).json()
            response=c.post('/api/ai/modules/leads/automations',headers=auth,json={'question':'Review leads and create follow-up tasks','interval_minutes':60,'allowed_actions':['task']})
            assert response.status_code==201,response.text
            policy_id=response.json()['id']
            agent.tick();agent.tick()
            jobs=c.get('/api/ai/modules/leads/history',headers=auth).json()['items']
            job=c.get(f"/api/ai/modules/jobs/{jobs[0]['id']}",headers=auth).json()
            out['first']=[a['status'] for a in job['actions']]
            out['unchanged']=c.get(f"/api/leads/{lead['id']}",headers=auth).json()['name']=='Recurring customer'
            with main.SessionLocal() as db:
                db.get(ModuleAIAutomation,policy_id).next_run_at=datetime.utcnow()
                db.commit()
            agent.tick();agent.tick()
            jobs=c.get('/api/ai/modules/leads/history',headers=auth).json()['items']
            job=c.get(f"/api/ai/modules/jobs/{jobs[0]['id']}",headers=auth).json()
            out['cooldown']=job['actions'][0]['status']
            paused=c.request('DELETE',f'/api/ai/modules/automations/{policy_id}',headers=auth,json={})
            assert paused.status_code==200,paused.text
            out['paused']=paused.json()['enabled'] is False
            out['task_count']=c.get('/api/activities',headers=auth).json()['total']
    ''')
    assert out == {'first':['completed','proposed'],'unchanged':True,'cooldown':'skipped','paused':True,'task_count':1}


def test_standard_analysis_professional_execution_and_revoked_action_replay():
    from test_tier0_tenant_audit import run_app_script as run_tenant
    out = run_tenant('''
        from app.services import module_ai as agent
        def cloud(body):
            row=json.loads(body['messages'][1]['content'])['CRM_CONTEXT']['records'][0]
            return {'choices':[{'message':{'content':json.dumps({'answer':'Review complete','actions':[
                {'kind':'task','resource':'leads','record_id':row['id'],'values':{'subject':'Plan checked follow-up'},'reason':'Requested follow-up'}]})}}]}
        agent.N['_cloud_ai_json']=cloud
        agent.N['ai_config_error']=lambda:None
        with TestClient(main.app) as c:
            response=c.post('/api/auth/signup',json={'organization_name':'Agent Plan Test','name':'Agent User','username':'agent.user','email':'agent.user@example.test','password':'strong-password-123'})
            assert response.status_code==201,response.text
            with main.SessionLocal() as db:
                user=db.scalar(main.select(main.User).where(main.User.username=='agent.user'))
                sub=main._ensure_organization_subscription(db,user)
                sub.plan_id=db.scalar(main.select(main.Plan.id).where(main.Plan.code=='standard'))
                uid,sid=user.id,sub.id
                db.commit()
            auth={'X-Yash-CSRF':main.AI_CSRF_TOKEN}
            lead=c.post('/api/leads',json={'name':'Plan customer'}).json()
            out['analysis_only']=c.get('/api/ai/modules').json()['actions_enabled'] is False
            jid=c.post('/api/ai/modules/leads/jobs',headers=auth,json={'question':'Prepare a follow-up task','record_id':lead['id']}).json()['id']
            agent.tick()
            result=c.get(f'/api/ai/modules/jobs/{jid}').json()
            assert result['status']=='completed',result
            op=result['actions'][0]['id']
            out['standard_execution']=c.post(f'/api/ai/modules/actions/{op}/execute',headers=auth,json={}).status_code
            out['standard_schedule']=c.post('/api/ai/modules/leads/automations',headers=auth,json={'question':'Review leads'}).status_code
            with main.SessionLocal() as db:
                db.get(main.OrganizationSubscription,sid).plan_id=db.scalar(main.select(main.Plan.id).where(main.Plan.code=='professional'))
                db.commit()
            approved=c.post(f'/api/ai/modules/actions/{op}/execute',headers=auth,json={})
            assert approved.status_code==200,approved.text
            out['professional_execution']=approved.json()['status']
            with main.SessionLocal() as db:
                other=main.User(name='Different owner',email='other-owner@example.test',role='Sales Representative',status='Active')
                db.add(other);db.flush()
                db.get(main.Lead,lead['id']).owner_id=other.id
                db.commit()
            out['revoked_replay']=c.post(f'/api/ai/modules/actions/{op}/execute',headers=auth,json={}).status_code
            out['revoked_result']=c.get(f'/api/ai/modules/jobs/{jid}').status_code
    ''')
    assert out == {'analysis_only':True,'standard_execution':403,'standard_schedule':403,
                   'professional_execution':'completed','revoked_replay':404,'revoked_result':404}


def test_delete_preview_bulk_permission_and_recycle_bin():
    out = run_app_script('''
        from app.services import module_ai as agent
        def cloud(body):
            rows = json.loads(body['messages'][1]['content'])['CRM_CONTEXT']['records']
            return {'choices':[{'message':{'content':json.dumps({'answer':'Review these records before deletion','actions':[
                {'kind':'delete','resource':'leads','record_id':r['id'],'values':{},'reason':'Requested cleanup'} for r in rows]})}}]}
        agent.N['_cloud_ai_json'] = cloud
        agent.N['ai_config_error'] = lambda: None
        with TestClient(main.app) as c:
            auth = {**basic('admin','supersecretpass123'),'X-Yash-CSRF':main.AI_CSRF_TOKEN}
            for n in range(3):
                assert c.post('/api/leads',headers=auth,json={'name':f'Cleanup lead {n}'}).status_code == 200
            job = c.post('/api/ai/modules/leads/jobs',headers=auth,json={'question':'Delete cleanup leads after review'}).json()
            agent.tick()
            result = c.get(f"/api/ai/modules/jobs/{job['id']}",headers=auth)
            assert result.status_code == 200, result.text
            ops = result.json()['actions']
            assert len(ops) == 3, result.text
            out['before'] = c.get('/api/leads',headers=auth).json()['total']
            original = agent.N['_profile_action_allowed']
            agent.N['_profile_action_allowed'] = lambda db,actor,resource,action: False if action == 'mass_delete' else original(db,actor,resource,action)
            denied = c.post('/api/ai/modules/actions/delete-selected',headers=auth,json={'ids':[o['id'] for o in ops[1:]]})
            out['bulk_denied'] = denied.status_code
            agent.N['_profile_action_allowed'] = original
            original_access = agent.N['can_access_record']
            agent.N['can_access_record'] = lambda db,resource,row,actor,access='read': False if access == 'delete' else original_access(db,resource,row,actor,access)
            out['single_denied'] = c.post(f"/api/ai/modules/actions/{ops[0]['id']}/execute",headers=auth,json={}).status_code
            agent.N['can_access_record'] = original_access
            single = c.post(f"/api/ai/modules/actions/{ops[0]['id']}/execute",headers=auth,json={})
            assert single.status_code == 200, single.text
            out['single'] = single.json()['status']
            bulk = c.post('/api/ai/modules/actions/delete-selected',headers=auth,json={'ids':[o['id'] for o in ops[1:]]})
            assert bulk.status_code == 200, bulk.text
            out['bulk'] = [r['status'] for r in bulk.json()['items']]
            out['after'] = c.get('/api/leads',headers=auth).json()['total']
            history = c.get(f"/api/ai/modules/jobs/{job['id']}",headers=auth)
            assert history.status_code == 200, history.text
            out['history'] = len(history.json()['actions'])
            replay = c.post(f"/api/ai/modules/actions/{ops[0]['id']}/execute",headers=auth,json={})
            assert replay.status_code == 200, replay.text
            out['replay'] = replay.json()['status']
            with main.SessionLocal() as db:
                out['archived'] = db.scalar(main.select(main.func.count()).select_from(main.Lead).where(main.Lead.archived == True))
    ''')
    assert out.pop('before') - out.pop('after') == 3
    assert out == {'bulk_denied':403,'single_denied':404,'single':'completed',
                   'bulk':['completed','completed'],'history':3,'replay':'completed','archived':3}


def test_selected_lead_cross_module_followups_and_linked_mutations():
    out = run_app_script('''
        from app.services import module_ai as agent
        seen=[]
        phase=['create']
        def cloud(body):
            ctx=json.loads(body['messages'][1]['content'])['CRM_CONTEXT']
            seen.extend(ctx['records'])
            assert 'site_visits' in ctx['available_modules']
            assert 'visit_date' in ctx['available_modules']['site_visits']['writable_fields']
            source=ctx['records'][0]
            if phase[0]=='create':
                actions=[{'kind':kind,'resource':'leads','record_id':source['id'],'reason':'Requested follow-up',
                    'values':{'subject':f'Follow up {kind}',**({'visit_date':'2099-12-01','location':'Customer site'} if kind=='site_visit' else {'start_at':'2099-12-01T10:00:00','due_at':'2099-12-01T11:00:00'})}} for kind in ('task','call','meeting','site_visit')]
            elif phase[0]=='edit':
                links=source['linked_context']
                visit=next(item['record'] for item in links['related_modules'] if item['module']=='site_visits')
                call=next(item for item in links['recent_activities'] if item['activity_type']=='Call')
                actions=[{'kind':'update','resource':'activities','record_id':call['id'],'reason':'Requested edit','values':{'subject':'Updated linked call'}},
                    {'kind':'delete','resource':'site_visits','record_id':visit['id'],'reason':'Requested cancellation','values':{}},
                    {'kind':'create','resource':'contacts','record_id':None,'reason':'Requested contact','values':{'first_name':'Created','last_name':'from lead','email':'created@example.test'}}]
            else:
                contact=next(item['record'] for item in ctx['previous_action_records'] if item['module']=='contacts')
                actions=[{'kind':'update','resource':'contacts','record_id':contact['id'],'reason':'Follow-on requested edit','values':{'job_title':'Purchasing manager'}}]
            return {'choices':[{'message':{'content':json.dumps({'answer':'Prepared linked actions','actions':actions})}}]}
        agent.N['_cloud_ai_json']=cloud
        agent.N['ai_config_error']=lambda:None
        with TestClient(main.app) as c:
            auth={**basic('admin','supersecretpass123'),'X-Yash-CSRF':main.AI_CSRF_TOKEN}
            lead=c.post('/api/leads',headers=auth,json={'name':'Selected customer'}).json()['id']
            c.post('/api/leads',headers=auth,json={'name':'Unselected customer'})
            response=c.post('/api/ai/modules/leads/jobs',headers=auth,json={'question':'Create a task, call, meeting and site visit for this lead','record_ids':[lead]})
            assert response.status_code==202,response.text
            jid=response.json()['id'];agent.tick()
            job=c.get(f'/api/ai/modules/jobs/{jid}',headers=auth).json()
            assert job['status']=='completed',job
            assert len(job['actions'])==4,job
            out['selected_only']=[row['id'] for row in seen]==[lead]
            original=agent.N['_profile_action_allowed']
            agent.N['_profile_action_allowed']=lambda db,actor,resource,action: False if resource=='activities' and action=='create' else original(db,actor,resource,action)
            out['destination_denied']=c.post(f"/api/ai/modules/actions/{job['actions'][0]['id']}/execute",headers=auth,json={}).status_code
            agent.N['_profile_action_allowed']=original
            created=[]
            for op in job['actions']:
                result=c.post(f"/api/ai/modules/actions/{op['id']}/execute",headers=auth,json={})
                assert result.status_code==200,result.text
                assert result.json()['status']=='completed',result.text
                created.append((op['action']['target_resource'],result.json()['result']['id']))
            for resource,rid in created:
                path=f'/api/platform/{resource}/{rid}' if resource=='site_visits' else f'/api/{resource}/{rid}'
                record=c.get(path,headers=auth).json()
                if resource=='activities':
                    assert record['related_type']=='leads' and record['related_id']==lead,record
                else:
                    assert record['lead_id']==lead,record
            out['types']=sorted(r['activity_type'] for r in c.get('/api/activities',headers=auth).json()['items'])
            phase[0]='edit'
            jid=c.post('/api/ai/modules/leads/jobs',headers=auth,json={'question':'Update my linked call, delete my site visit and create a contact','record_id':lead}).json()['id'];agent.tick()
            job=c.get(f'/api/ai/modules/jobs/{jid}',headers=auth).json()
            assert len(job['actions'])==3,job
            for op in job['actions']:
                result=c.post(f"/api/ai/modules/actions/{op['id']}/execute",headers=auth,json={})
                assert result.status_code==200,result.text
                assert result.json()['status']=='completed',result.text
            out['edited']=any(r['subject']=='Updated linked call' for r in c.get('/api/activities',headers=auth).json()['items'])
            out['contact']=any(r.get('first_name')=='Created' and r.get('last_name')=='from lead' for r in c.get('/api/contacts',headers=auth).json()['items'])
            with main.SessionLocal() as db:
                visit=db.get(main.PlatformRecord,next(rid for resource,rid in created if resource=='site_visits'))
                out['deleted_visit']=visit.archived
            previous=jid
            phase[0]='continue'
            request=c.post('/api/ai/modules/leads/jobs',headers=auth,json={'question':'Set the contact you just created as Purchasing manager','record_id':lead,'context_job_id':previous})
            assert request.status_code==202,request.text
            jid=request.json()['id'];agent.tick()
            followon=c.get(f'/api/ai/modules/jobs/{jid}',headers=auth).json()
            assert len(followon['actions'])==1,followon
            op=followon['actions'][0]
            result=c.post(f"/api/ai/modules/actions/{op['id']}/execute",headers=auth,json={})
            assert result.json()['status']=='completed',result.text
            out['continued']=c.get(f"/api/contacts/{op['action']['record_id']}",headers=auth).json()['job_title']
            out['invalid_selection']=c.post('/api/ai/modules/leads/jobs',headers=auth,json={'question':'Review selection','record_ids':[999999]}).status_code
    ''')
    assert out=={'selected_only':True,'types':['Call','Meeting','Task'],'edited':True,'contact':True,'deleted_visit':True,'invalid_selection':404,'destination_denied':403,'continued':'Purchasing manager'}
