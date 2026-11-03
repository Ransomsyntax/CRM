"""Sharing must grant record access without bypassing module capabilities."""
from test_tier0_tenant_audit import run_app_script


SCENARIO = """
with TestClient(main.app, follow_redirects=False) as c:
    c.post('/api/auth/signup', json={'organization_name':'Sharing Regression',
        'name':'Owner','username':'qa.owner','email':'qa.owner@example.com','password':'test-password-123'})
    token = c.post('/api/organization/invitations', json={'email':'qa.reader@example.com'}).json()['invitation_token']
    lead = c.post('/api/leads', json={'name':'Qualified lead','status':'Qualified'}).json()
    with main.SessionLocal() as db:
        owner = db.scalar(main.select(main.User).where(main.User.username == 'qa.owner'))
        owner.role = 'Administrator'
        owner_id = owner.id
        sub = main._ensure_organization_subscription(db, owner)
        sub.plan_id = db.scalar(main.select(main.Plan.id).where(main.Plan.code == 'enterprise'))
        db.commit()
    def login(name):
        c.post('/api/auth/logout')
        return c.post('/api/auth/login', json={'identifier':name,'password':'test-password-123'})
    base = '/api/admin/security/role-hierarchy'
    c.post(base, json={'name':'Administrator'})
    c.post(base, json={'name':'Reader'})
    c.post('/api/auth/logout')
    c.post('/api/auth/signup', json={'organization_name':'Sharing Regression',
        'name':'Reader','username':'qa.reader','email':'qa.reader@example.com',
        'password':'test-password-123','invitation_token':token})
    with main.SessionLocal() as db:
        reader = db.scalar(main.select(main.User).where(main.User.username == 'qa.reader'))
        reader.role = 'Reader'
        reader.profile_name = 'Reader'
        reader_id = reader.id
        db.commit()
    login('qa.reader')
    path = '/api/leads/' + str(lead['id'])
    shares = '/api/security/records/leads/' + str(lead['id']) + '/shares'
"""


def test_read_write_sharing_does_not_grant_single_or_bulk_deletion():
    out = run_app_script(SCENARIO + """
    login('qa.owner')
    c.put('/api/admin/security/data-sharing/leads', json={'access':'Public Read/Write'})
    login('qa.reader')
    out['read'] = c.get(path).status_code
    out['edit'] = c.patch(path, json={'name':'Allowed edit'}).status_code
    out['delete'] = c.delete(path).status_code
    out['bulk'] = c.post('/api/administration/bulk-delete', json={'resource':'leads','ids':[lead['id']]}).status_code
    login('qa.owner')
    c.put('/api/admin/security/data-sharing/leads', json={'access':'Public Read/Write/Delete'})
    c.put('/api/admin/security/module-permissions', json={'profile':'Reader','modules':{'leads':{'read':True,'update':True,'delete':True}}})
    login('qa.reader')
    out['explicit_delete'] = c.delete(path).status_code
    """)
    assert out == {'read': 200, 'edit': 200, 'delete': 403, 'bulk': 403, 'explicit_delete': 200}


def test_criteria_grants_apply_only_to_matching_records_and_respect_profile_denials():
    out = run_app_script(SCENARIO + """
    login('qa.owner')
    other = c.post('/api/leads', json={'name':'New lead','status':'New'}).json()
    rule = c.post('/api/admin/security/data-sharing/rules', json={
        'module':'leads','kind':'criteria','source_role':'Administrator',
        'target_type':'role','target':'Reader','grant':'Read Only',
        'criteria':{'field':'status','operator':'equals','value':'Qualified'}})
    out['created'] = rule.status_code
    login('qa.reader')
    out['matching'] = c.get(path).status_code
    out['other'] = c.get('/api/leads/' + str(other['id'])).status_code
    out['write'] = c.patch(path, json={'name':'Forbidden'}).status_code
    login('qa.owner')
    c.put('/api/admin/security/module-permissions', json={'profile':'Reader','modules':{'leads':{'read':False}}})
    login('qa.reader')
    out['profile_denied'] = c.get(path).status_code
    login('qa.owner')
    c.delete('/api/admin/security/data-sharing/rules/' + str(rule.json()['id']))
    c.put('/api/admin/security/module-permissions', json={'profile':'Reader','modules':{'leads':{'read':True}}})
    login('qa.reader')
    out['revoked'] = c.get(path).status_code
    """)
    assert out == {'created': 201, 'matching': 200, 'other': 404, 'write': 403, 'profile_denied': 403, 'revoked': 404}


def test_direct_share_requires_share_capability_and_panel_targets_are_scoped():
    out = run_app_script(SCENARIO + """
    owned = c.post('/api/leads', json={'name':'Reader owned'}).json()
    own_shares = '/api/security/records/leads/' + str(owned['id']) + '/shares'
    login('qa.owner')
    matrix = {'read':True,'create':True,'update':True,'share':False}
    c.put('/api/admin/security/module-permissions', json={'profile':'Reader','modules':{'leads':matrix}})
    login('qa.reader')
    out['hidden'] = c.get(own_shares).json()['can_manage']
    out['denied'] = c.post(own_shares, json={'target_type':'user','target':str(owner_id),'grant':'Read Only'}).status_code
    login('qa.owner')
    matrix['share'] = True
    c.put('/api/admin/security/module-permissions', json={'profile':'Reader','modules':{'leads':matrix}})
    login('qa.reader')
    panel = c.get(own_shares).json()
    out['allowed'] = panel['can_manage']
    out['target_ids'] = sorted(int(t['value']) for t in panel['targets'] if t['type'] == 'user') == sorted([owner_id, reader_id])
    response = c.post(own_shares, json={'target_type':'user','target':str(owner_id),'grant':'Read Only'})
    out['created'] = response.status_code
    out['revoked'] = c.delete(own_shares + '/' + str(response.json()['id'])).status_code
    """)
    assert out == {'hidden': False, 'denied': 403, 'allowed': True, 'target_ids': True, 'created': 201, 'revoked': 200}

