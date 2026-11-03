"""Plan gates apply to customer admins, alternate APIs, and derived data."""
from test_tier0_organization_billing import run_app_script
from app.access_policy import request_entitlement_feature


def test_alternate_routes_share_plan_gates():
    for path in ('/api/products', '/api/v1/products', '/api/import/products', '/api/import-wizard/products/preview', '/api/export/products.csv', '/api/admin/standard-layout/products'):
        assert request_entitlement_feature(path) == 'inventory_management', path
    assert request_entitlement_feature('/api/custom/example') == 'custom_modules'


def test_every_plan_enforces_features_and_owner_bypasses_without_subscription():
    out = run_app_script('''
    with TestClient(main.app, follow_redirects=False) as c:
        c.post('/api/auth/signup',json={'name':'Plan Admin','organization_name':'Plan Matrix','username':'plan.matrix','email':'matrix@example.test','password':'strong-password-123'})
        with main.SessionLocal() as db:
            user=db.scalar(main.select(main.User).where(main.User.username=='plan.matrix'))
            user.role='Administrator'
            sub=main._ensure_organization_subscription(db,user)
            uid=user.id
            sid=sub.id
            db.commit()
        out['plans']={}
        for code in ('free','bigin_express','standard','professional','enterprise'):
            with main.SessionLocal() as db:
                sub=db.get(main.OrganizationSubscription,sid)
                sub.plan_id=db.scalar(main.select(main.Plan.id).where(main.Plan.code==code))
                sub.status='Active'
                db.commit()
            out['plans'][code]={path:c.get(path).status_code for path in ('/api/products','/api/v1/products','/api/platform/forecasts','/api/platform/quotes','/api/platform/functions')}
            profile=c.get('/api/settings/profile').json()
            out['plans'][code]['active']=profile['subscription']['access_active']
        with main.SessionLocal() as db:
            sub=db.get(main.OrganizationSubscription,sid)
            sub.status='Cancelled'
            db.commit()
        out['inactive']=c.get('/api/leads').status_code
        out['recovery']=c.get('/api/plans').status_code
        with main.SessionLocal() as db:
            from app.services import security
            owner=db.scalar(main.select(main.User).where(main.User.username=='platform.owner'))
            owner_sub=security._ensure_organization_subscription(db,owner)
            owner_sub.status='Cancelled'
            owner_sub.plan_id=main._default_plan(db).id
            db.commit()
            out['owner']=security._active_plan(db,owner) is None
            for feature in ('inventory_management','apex','custom_functions','developer_sandbox'):
                security._enforce_plan_feature(db,owner,feature)
            db.delete(owner_sub)
            db.commit()
            out['owner_without_subscription']=security._active_plan(db,owner) is None
        out['catalog']=[plan['code'] for plan in c.get('/api/plans').json()['items']]
    ''')
    for code, results in out['plans'].items():
        assert results['active']
        inventory = 200 if code in {'professional', 'enterprise'} else 403
        assert results['/api/products'] == results['/api/v1/products'] == inventory, (code, results)
        assert results['/api/platform/quotes'] == inventory, (code, results)
        assert results['/api/platform/forecasts'] == (200 if code in {'standard','professional','enterprise'} else 403)
        assert results['/api/platform/functions'] == (200 if code == 'enterprise' else 403)
    assert out['inactive'] == 403
    assert out['recovery'] == 200
    assert out['owner'] and out['owner_without_subscription']
    assert out['catalog'] == ['free','bigin_express','standard','professional','enterprise']


def test_retired_plus_migrates_and_downgrade_blocks_search_and_reports():
    out=run_app_script('''
    with TestClient(main.app,follow_redirects=False) as c:
        c.post('/api/auth/signup',json={'name':'Downgrade Admin','organization_name':'Downgrade Matrix','username':'plan.downgrade','email':'downgrade@example.test','password':'strong-password-123'})
        with main.SessionLocal() as db:
            user=db.scalar(main.select(main.User).where(main.User.username=='plan.downgrade'))
            user.role='Administrator'
            sub=main._ensure_organization_subscription(db,user)
            plus=main.Plan(code='crm_plus',name='CRM Plus',active=True,features={'apex':True})
            db.add(plus);db.flush();sub.plan_id=plus.id;db.flush()
            main._ensure_plan_catalog(db)
            db.commit()
            out['migrated']=db.get(main.Plan,sub.plan_id).code
            sid=sub.id
        product=c.post('/api/products',json={'name':'Restricted inventory search'}).json()
        out['created']=bool(product.get('id'))
        with main.SessionLocal() as db:
            sub=db.get(main.OrganizationSubscription,sid)
            sub.plan_id=main._default_plan(db).id;db.commit()
        out['search']=c.get('/api/search',params={'q':'Restricted inventory search'}).json()
        with main.SessionLocal() as db:
            user=db.scalar(main.select(main.User).where(main.User.username=='plan.downgrade'))
            try:
                main._report_rows(db,'products',user)
                out['report_status']=200
            except main.HTTPException as error:
                out['report_status']=error.status_code
    ''')
    assert out['migrated']=='enterprise'
    assert out['created']
    assert not out['search']['results']
    assert out['report_status']==403


def test_record_quota_blocks_csv_and_expired_trial_blocks_data():
    out=run_app_script('''
    from datetime import datetime,timedelta
    with TestClient(main.app,follow_redirects=False) as c:
        c.post('/api/auth/signup',json={'name':'Quota Admin','organization_name':'Quota Matrix','username':'plan.quota','email':'quota@example.test','password':'strong-password-123'})
        with main.SessionLocal() as db:
            user=db.scalar(main.select(main.User).where(main.User.username=='plan.quota'))
            user.role='Administrator'
            sub=main._ensure_organization_subscription(db,user)
            sid=sub.id
            plan=db.get(main.Plan,sub.plan_id)
            plan.max_records=main._organization_record_count(db,user)+1
            db.commit()
        out['first']=c.post('/api/leads',json={'name':'First quota lead'}).status_code
        out['second']=c.post('/api/accounts',json={'name':'Second quota record'}).status_code
        response=c.post('/api/import/leads',files={'file':('leads.csv',b'name\\nCSV quota bypass\\n','text/csv')})
        out['import']=response.json()
        with main.SessionLocal() as db:
            sub=db.get(main.OrganizationSubscription,sid)
            sub.status='Trialing'
            sub.trial_ends_at=datetime.utcnow()-timedelta(seconds=1)
            db.commit()
        out['expired']=c.get('/api/leads').status_code
        out['expired_profile']=c.get('/api/settings/profile').json()['subscription']['access_active']
        out['billing']=c.get('/api/plans').status_code
    ''')
    assert out['first']==200
    assert out['second']==403
    assert out['import'].get('imported',out['import'].get('created'))==0, out
    assert out['expired']==403 and not out['expired_profile']
    assert out['billing']==200
