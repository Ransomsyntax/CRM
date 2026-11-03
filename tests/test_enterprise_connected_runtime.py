"""Runtime boundaries: protected storage, provider sync, and isolated promotion."""
from test_tier0_organization_billing import run_app_script

SETUP = '''
import os
from cryptography.fernet import Fernet
os.environ['CRM_ENCRYPTION_KEYS']=Fernet.generate_key().decode()
with TestClient(main.app,follow_redirects=False) as c:
    assert c.post('/api/auth/signup',json={'name':'Runtime Owner','organization_name':'Runtime Test','username':'runtime.owner','email':'runtime@example.test','password':'strong-password-123'}).status_code==201
    uid=c.get('/api/settings/profile').json()['id']
    with main.SessionLocal() as db:
        sub=main._ensure_organization_subscription(db,db.get(main.User,uid))
        sub.plan_id=db.scalar(main.select(main.Plan.id).where(main.Plan.code=='enterprise'))
        org=sub.organization_id
        db.commit()
'''


def test_provider_credentials_sync_and_selected_import_are_isolated():
    out=run_app_script(SETUP+'''
    import app.routes.enterprise_runtime as runtime
    runtime.fetch_batch=lambda *args: ([{'id':'remote-1','title':'Provider subject','from':'sender@example.test','to':'runtime@example.test','body':'A synced preview'}],None)
    connected=c.post('/api/runtime/integrations',json={'name':'Work Gmail','provider':'gmail','credentials':{'access_token':'secret-access-token'}})
    out['connect']=connected.status_code
    cid=connected.json()['id']
    out['response_has_secret']='secret-access-token' in connected.text
    with main.SessionLocal() as db:
        from app.models import RuntimeConnection
        row=db.get(RuntimeConnection,cid)
        out['stored_encrypted']='secret-access-token' not in json.dumps(row.credentials)
    out['sync1']=c.post(f'/api/runtime/integrations/{cid}/sync').status_code
    out['sync2']=c.post(f'/api/runtime/integrations/{cid}/sync').status_code
    items=c.get(f'/api/runtime/integrations/{cid}/items').json()['items']
    out['deduped']=len(items)
    item_id=items[0]['id']
    imported=c.post(f'/api/runtime/integrations/{cid}/items/{item_id}/import').json()
    again=c.post(f'/api/runtime/integrations/{cid}/items/{item_id}/import').json()
    out['imported']=imported['id']==again['id'] and again['already_imported']
    c.post('/api/auth/logout')
    c.post('/api/auth/signup',json={'name':'Other','organization_name':'Other Tenant','username':'other.runtime','email':'other.runtime@example.test','password':'strong-password-123'})
    out['cross_tenant']=c.get(f'/api/runtime/integrations/{cid}/items').status_code
    ''')
    assert out=={'connect':201,'response_has_secret':False,'stored_encrypted':True,'sync1':200,'sync2':200,'deduped':1,'imported':True,'cross_tenant':404}


def test_custom_field_encryption_masks_reads_and_preserves_edits():
    out=run_app_script(SETUP+'''
    module=c.post('/api/admin/metadata/modules',json={'api_name':'secure_records','label':'Secure Records','plural_label':'Secure Records'}).json()
    field=c.post(f"/api/admin/metadata/modules/{module['id']}/fields",json={'api_name':'private_value','label':'Private value','field_type':'text'}).json()
    fid=field['id']
    record=c.post('/api/custom/secure_records',json={'name':'Protected customer','private_value':'very-private-value'}).json()
    rid=record['id']
    enabled=c.put(f'/api/runtime/encrypted-fields/{fid}',json={'encrypted':True})
    out['enabled']=enabled.status_code
    out['admin_read']=c.get(f'/api/custom/secure_records/{rid}').json().get('private_value')
    with main.SessionLocal() as db:
        stored=db.get(main.PlatformRecord,rid)
        out['storage_encrypted']='very-private-value' not in json.dumps(stored.data)
        audits=db.scalars(main.select(main.AuditEvent).where(main.AuditEvent.organization_id==org)).all()
        out['audit_scrubbed']='very-private-value' not in json.dumps([{'before':a.before,'after':a.after} for a in audits],default=str)
    out['update']=c.patch(f'/api/custom/secure_records/{rid}',json={'name':'Updated customer'}).status_code
    out['after_update']=c.get(f'/api/custom/secure_records/{rid}').json().get('private_value')
    assert c.put('/api/admin/security/module-permissions',json={'profile':'Administrator','modules':{module['storage_api_name']:{'read':True,'update':True}}}).status_code==200
    out['masked']=c.get(f'/api/custom/secure_records/{rid}').json().get('private_value')
    ''')
    assert out=={'enabled':200,'admin_read':'very-private-value','storage_encrypted':True,'audit_scrubbed':True,'update':200,'after_update':'very-private-value','masked':'[Encrypted]'}


def test_sandbox_has_no_production_effect_until_validated_promotion():
    out=run_app_script(SETUP+'''
    created=c.post('/api/runtime/sandboxes',json={'name':'Workflow test'})
    out['created']=created.status_code
    sid=created.json()['id']
    draft=c.get(f'/api/runtime/sandboxes/{sid}').json()
    entries=[{'source_id':None,'resource':'email_templates','values':{'name':'Sandbox only template','subject':'Hello','content':'A sandbox draft','status':'Active'}}]
    saved=c.put(f'/api/runtime/sandboxes/{sid}',json={'revision':draft['revision'],'components':entries})
    out['saved']=saved.status_code
    with main.SessionLocal() as db:
        out['no_live_draft']=db.scalar(main.select(main.PlatformRecord.id).where(main.PlatformRecord.title=='Sandbox only template')) is None
    test=c.post(f'/api/runtime/sandboxes/{sid}/test',json={'module':'leads','values':{'status':'New'}})
    out['test']=test.status_code
    out['no_actions']=test.json().get('side_effects') is False
    out['stale_revision']=c.post(f'/api/runtime/sandboxes/{sid}/promote',json={'revision':draft['revision']}).status_code
    promoted=c.post(f'/api/runtime/sandboxes/{sid}/promote',json={'revision':saved.json()['revision']})
    out['promoted']=promoted.status_code
    with main.SessionLocal() as db:
        out['live_after']=db.scalar(main.select(main.PlatformRecord.id).where(main.PlatformRecord.title=='Sandbox only template')) is not None
    ''')
    assert out=={'created':201,'saved':200,'no_live_draft':True,'test':200,'no_actions':True,'stale_revision':409,'promoted':200,'live_after':True}


def test_runtime_features_are_plan_gated_and_missing_key_fails_closed():
    out=run_app_script(SETUP+'''
    os.environ.pop('CRM_ENCRYPTION_KEYS')
    out['missing_key']=c.post('/api/runtime/integrations',json={'provider':'gmail','credentials':{'access_token':'secret'}}).status_code
    with main.SessionLocal() as db:
        sub=main._ensure_organization_subscription(db,db.get(main.User,uid))
        sub.plan_id=main._default_plan(db).id
        db.commit()
    out['sandbox']=c.get('/api/runtime/sandboxes').status_code
    out['encryption']=c.get('/api/runtime/encrypted-fields').status_code
    out['provider']=c.post('/api/runtime/integrations',json={'provider':'gmail','credentials':{'access_token':'secret'}}).status_code
    ''')
    assert out=={'missing_key':503,'sandbox':403,'encryption':403,'provider':403}


def test_external_actions_require_confirmation_and_do_not_repeat_requests():
    out=run_app_script(SETUP+'''
    import app.routes.enterprise_runtime as runtime
    calls=[]
    def dispatch(*args,**kwargs):
        calls.append(args[0]);return {'id':'sent-123'}
    runtime.request_json=dispatch
    cid=c.post('/api/runtime/integrations',json={'provider':'gmail','credentials':{'access_token':'secret'}}).json()['id']
    body={'request_key':'request-12345678','values':{'from':'sender@example.test','to':'customer@example.test','subject':'Requested follow up','body':'A confirmed email'}}
    out['unconfirmed']=c.post(f'/api/runtime/integrations/{cid}/action',json=body).status_code
    body['confirmed']=True
    out['accepted']=c.post(f'/api/runtime/integrations/{cid}/action',json=body).json()['accepted']
    out['repeated']=c.post(f'/api/runtime/integrations/{cid}/action',json=body).json()['already_submitted']
    out['calls']=len(calls)
    body['values']['body']='Different content'
    out['changed']=c.post(f'/api/runtime/integrations/{cid}/action',json=body).status_code
    ''')
    assert out=={'unconfirmed':422,'accepted':True,'repeated':True,'calls':1,'changed':409}


def test_uncertain_external_action_is_not_automatically_retried():
    out=run_app_script(SETUP+'''
    import app.routes.enterprise_runtime as runtime
    calls=[]
    def dispatch(*args,**kwargs):
        calls.append(args[0]);raise main.HTTPException(502,'Provider timed out')
    runtime.request_json=dispatch
    cid=c.post('/api/runtime/integrations',json={'provider':'slack','credentials':{'access_token':'secret'}}).json()['id']
    body={'request_key':'uncertain-12345678','confirmed':True,'values':{'channel':'C123','body':'Message'}}
    out['first']=c.post(f'/api/runtime/integrations/{cid}/action',json=body).status_code
    out['second']=c.post(f'/api/runtime/integrations/{cid}/action',json=body).status_code
    out['calls']=len(calls)
    ''')
    assert out=={'first':409,'second':409,'calls':1}


def test_sandbox_blocks_stale_production_and_foreign_sources():
    out=run_app_script(SETUP+'''
    sid=c.post('/api/runtime/sandboxes',json={'name':'Stale draft'}).json()['id']
    draft=c.get(f'/api/runtime/sandboxes/{sid}').json()
    with main.SessionLocal() as db:
        db.add(main.PlatformRecord(organization_id=org,owner_id=uid,resource='email_templates',title='Concurrent template',status='Active',data={'name':'Concurrent template','subject':'Hello','content':'Production edit','status':'Active'}))
        db.commit()
    out['stale']=c.post(f'/api/runtime/sandboxes/{sid}/promote',json={'revision':draft['revision']}).status_code
    sid=c.post('/api/runtime/sandboxes',json={'name':'Bad source'}).json()['id']
    draft=c.get(f'/api/runtime/sandboxes/{sid}').json()
    entries=[{'source_id':999999,'resource':'email_templates','values':{'name':'Foreign','subject':'Hello','content':'Forbidden'}}]
    saved=c.put(f'/api/runtime/sandboxes/{sid}',json={'revision':draft['revision'],'components':entries}).json()
    out['foreign']=c.post(f'/api/runtime/sandboxes/{sid}/promote',json={'revision':saved['revision']}).status_code
    ''')
    assert out=={'stale':409,'foreign':422}
