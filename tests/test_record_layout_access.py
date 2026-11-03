"""Record form metadata and values must not require layout administration."""
from test_tier0_tenant_audit import run_app_script


def test_member_form_metadata_uses_module_access_and_keeps_layout_edits_denied():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        c.post('/api/auth/signup', json={'organization_name':'Layout Access',
            'name':'Owner','username':'layout.owner','email':'owner@layout.example','password':'strong-password-123'})
        token = c.post('/api/organization/invitations', json={'email':'member@layout.example'}).json()['invitation_token']
        c.post('/api/auth/logout')
        c.post('/api/auth/signup', json={'name':'Member','username':'layout.member',
            'email':'member@layout.example','password':'strong-password-123','invitation_token':token})
        lead = c.post('/api/leads', json={'name':'Member lead'}).json()
        root = '/api/admin/standard-layout/leads'
        out['metadata'] = c.get(root).status_code
        out['values_read'] = c.get(root + '/records/' + str(lead['id'])).status_code
        out['values_write'] = c.put(root + '/records/' + str(lead['id']), json={'values':{}}).status_code
        out['layout_edit'] = c.put(root + '/order', json={'order':[]}).status_code
        with main.SessionLocal() as db:
            member = db.scalar(main.select(main.User).where(main.User.username=='layout.member'))
            db.add(main.PlatformRecord(resource='module_permission_matrix', title='No lead read',
                organization_id=main._organization_id_for_user(db, member.id), data={'profile':member.profile_name or member.role,
                'modules':{'leads':{'read':False}},'setup':{}}))
            db.commit()
        out['module_denied'] = c.get(root).status_code
    """)
    assert out == {'metadata':200,'values_read':200,'values_write':200,'layout_edit':403,'module_denied':403}
