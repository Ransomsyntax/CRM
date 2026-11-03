"""Platform administration and plan bypass do not expose tenant CRM records."""
from test_tier0_tenant_audit import run_app_script


def test_owner_cannot_read_mutate_search_or_export_customer_records():
    out = run_app_script('''
    with TestClient(main.app, follow_redirects=False) as c:
        c.post('/api/auth/login', json={'identifier':'platform.owner','password':'supersecretpass123'})
        out['baseline_ai_leads'] = next(row['count'] for row in c.get('/api/ai/dashboard').json()['journey'] if row['key']=='leads')
        c.post('/api/auth/logout')
        signup = c.post('/api/auth/signup', json={
            'organization_name':'Private Customer Workspace', 'name':'Private Customer',
            'username':'private.customer', 'email':'private.customer@example.test',
            'password':'strong-password-123'})
        assert signup.status_code == 201, signup.text
        customer_id = c.get('/api/settings/profile').json()['id']
        with main.SessionLocal() as db:
            customer = db.get(main.User, customer_id)
            subscription = main._ensure_organization_subscription(db, customer)
            subscription.plan_id = db.scalar(main.select(main.Plan.id).where(main.Plan.code == 'enterprise'))
            subscription.status = 'Active'
            db.commit()
        sentinel = 'PRIVATE-CUSTOMER-RECORD-ONLY'
        records = {}
        for resource, path in [('leads','/api/leads'), ('products','/api/products'), ('quotes','/api/platform/quotes')]:
            response = c.post(path, json={'name':sentinel + '-' + resource})
            assert response.status_code in (200, 201), response.text
            records[resource] = (path, response.json()['id'])
        c.post('/api/auth/logout')
        login = c.post('/api/auth/login', json={'identifier':'platform.owner','password':'supersecretpass123'})
        assert login.status_code == 200, login.text
        out['records'] = {}
        for resource, (path, record_id) in records.items():
            item = f'{path}/{record_id}'
            out['records'][resource] = {
                'read': c.get(item).status_code,
                'list_private': sentinel in c.get(path).text,
                'update': c.patch(item, json={'name':'Owner must not change this'}).status_code,
                'delete': c.delete(item).status_code,
            }
        lead_id = records['leads'][1]
        out['v1_read'] = c.get(f'/api/v1/leads/{lead_id}').status_code
        out['export_private'] = sentinel in c.get('/api/export/leads.csv').text
        out['search_private'] = sentinel in c.get('/api/search', params={'q':sentinel}).text
        out['customer_export_allowed'] = c.get(f'/api/owner/users/{customer_id}').json()['can_export_crm_records']
        out['owner_export'] = c.get(f'/api/owner/users/{customer_id}/export').status_code
        out['ai_private'] = sentinel in c.get('/api/ai/dashboard').text
        out['ai_lead_count'] = next(row['count'] for row in c.get('/api/ai/dashboard').json()['journey'] if row['key']=='leads')
        out['admin'] = {path:c.get(path).status_code for path in ['/api/owner/overview','/api/owner/plans','/api/owner/users','/api/owner/plan-requests']}
        own = c.post('/api/leads', json={'name':'Owner own workspace record'})
        out['own_create'] = own.status_code
        out['own_read'] = c.get('/api/leads/' + str(own.json()['id'])).status_code
        c.post('/api/auth/logout')
        c.post('/api/auth/login', json={'identifier':'private.customer','password':'strong-password-123'})
        out['customer_unchanged'] = {resource:c.get(f'{path}/{record_id}').json().get('name') for resource,(path,record_id) in records.items()}
    ''')
    for resource, result in out['records'].items():
        assert result['read'] == 404, (resource, result)
        assert not result['list_private'], (resource, result)
        assert result['update'] in (403, 404), (resource, result)
        assert result['delete'] in (403, 404), (resource, result)
    assert out['v1_read'] == 404, out
    assert not out['export_private'] and not out['search_private'], out
    assert out['owner_export'] == 403 and out['customer_export_allowed'] is False, out
    assert not out['ai_private'] and out['ai_lead_count'] == out['baseline_ai_leads'], out
    assert all(status == 200 for status in out['admin'].values()), out
    assert out['own_create'] in (200, 201) and out['own_read'] == 200, out
    assert all(name == 'PRIVATE-CUSTOMER-RECORD-ONLY-' + resource for resource,name in out['customer_unchanged'].items()), out
