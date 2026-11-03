from test_tier0_tenant_audit import run_app_script


def test_private_crm_records_do_not_leak_to_organization_members_or_platform_owner():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        first = c.post('/api/auth/signup', json={
            'organization_name': 'Private Workspace',
            'name': 'User A', 'username': 'user.a',
            'email': 'user.a@example.com', 'password': 'strong-password-123'
        })
        out['first_signup'] = first.status_code
        invitation = c.post('/api/organization/invitations', json={
            'email': 'user.b@example.com'
        })
        token = invitation.json()['invitation_token']
        record = c.post('/api/leads', json={'name': 'User A private lead'})
        out['create'] = record.status_code
        lead_id = record.json()['id']
        out['owner_can_read'] = c.get(f'/api/leads/{lead_id}').status_code
        c.post('/api/auth/logout')
        second = c.post('/api/auth/signup', json={
            'organization_name': 'Private Workspace',
            'name': 'User B', 'username': 'user.b',
            'email': 'user.b@example.com', 'password': 'strong-password-123',
            'invitation_token': token
        })
        out['second_signup'] = second.status_code
        out['other_get'] = c.get(f'/api/leads/{lead_id}').status_code
        out['other_patch'] = c.patch(f'/api/leads/{lead_id}', json={'name':'stolen'}).status_code
        out['other_list'] = [r['id'] for r in c.get('/api/leads').json()['items']]
        c.post('/api/auth/logout')
        c.post('/api/auth/login', json={
            'identifier': 'platform.owner', 'password': 'supersecretpass123'
        })
        out['platform_owner_get'] = c.get(f'/api/leads/{lead_id}').status_code
        out['platform_owner_list'] = [r['id'] for r in c.get('/api/leads').json()['items']]
        out['private_id'] = lead_id
    """)
    assert out['first_signup'] == 201
    assert out['second_signup'] == 201
    assert out['create'] in (200, 201)
    assert out['owner_can_read'] == 200
    assert out['other_get'] == 404
    assert out['other_patch'] == 403
    assert out['private_id'] not in out['other_list']
    assert out['platform_owner_get'] == 404
    assert out['private_id'] not in out['platform_owner_list']


def test_legacy_owned_lead_without_org_renders_safe_timeline():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        c.post('/api/auth/signup', json={
            'organization_name': 'Legacy Timeline Workspace',
            'name': 'Legacy Owner', 'username': 'legacy.owner',
            'email': 'legacy.owner@example.com',
            'password': 'strong-password-123'
        })
        lead = c.post('/api/leads', json={'name': 'Legacy lead'}).json()
        lead_id = lead['id']
        with main.SessionLocal() as db:
            row = db.get(main.Lead, lead_id)
            row.organization_id = None
            db.commit()
        out['detail_status'] = c.get(f'/api/leads/{lead_id}').status_code
        timeline_response = c.get(f'/api/leads/{lead_id}/timeline')
        out['timeline_status'] = timeline_response.status_code
        out['timeline'] = timeline_response.json()
        c.post('/api/auth/logout')
        c.post('/api/auth/signup', json={
            'organization_name': 'Another Legacy Workspace',
            'name': 'Other User', 'username': 'legacy.other',
            'email': 'legacy.other@example.com',
            'password': 'strong-password-123'
        })
        out['other_detail'] = c.get(f'/api/leads/{lead_id}').status_code
        out['other_timeline'] = c.get(f'/api/leads/{lead_id}/timeline').status_code
    """)
    assert out['detail_status'] == 200
    assert out['timeline_status'] == 200
    assert out['timeline']['items'] == []
    assert out['timeline']['blueprint_enabled'] is False
    assert out['other_detail'] == 404
    assert out['other_timeline'] == 404
