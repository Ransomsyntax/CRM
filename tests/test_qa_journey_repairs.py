"""Data integrity regressions from the 14 October user journey audit."""
from test_workflow_rule_builder import app_scenario


def test_campaign_validation_and_case_lifecycle_and_deal_boundaries():
    result = app_scenario('''
    with TestClient(main.app) as client:
        signup = client.post('/api/auth/signup', json={
            'name':'Journey Tester', 'organization_name':'Journey QA',
            'username':'journey.qa', 'email':'journey.qa@example.test',
            'password':'journey-password-123'})
        assert signup.status_code == 201, signup.text
        invalid = [
            {'name':'Negative budget','budget':-100},
            {'name':'Reversed dates','start_date':'2026-10-30','end_date':'2026-10-01'},
            {'name':'Bad date','start_date':'not-a-date'},
        ]
        for payload in invalid:
            response = client.post('/api/platform/campaigns', json=payload)
            assert response.status_code == 422, response.text
        assert client.get('/api/platform/campaigns').json()['total'] == 0
        campaign = client.post('/api/platform/campaigns', json={
            'name':'Valid campaign','budget':0,'start_date':'2026-10-30','end_date':'2026-10-30'})
        assert campaign.status_code == 201, campaign.text
        cid = campaign.json()['id']
        assert client.patch(f'/api/platform/campaigns/{cid}', json={'end_date':'2026-10-29'}).status_code == 422
        assert client.patch(f'/api/platform/campaigns/{cid}', json={'budget':-1}).status_code == 422
        assert client.get(f'/api/platform/campaigns/{cid}').json()['budget'] == 0
        case = client.post('/api/platform/cases', json={'name':'New case','status':''})
        assert case.status_code == 201, case.text
        case_id = case.json()['id']
        assert case.json()['status'] == 'New', case.text
        assert client.patch(f'/api/platform/cases/{case_id}',json={'status':'Active'}).status_code == 422
        assert client.patch(f'/api/platform/cases/{case_id}',json={'status':'Resolved'}).json()['status'] == 'Resolved'
        for amount in (1000000,2500000,2600000):
            response = client.post('/api/deals',json={'name':f'Deal {amount}','amount':amount})
            assert response.status_code in (200,201), response.text
        filtered = client.get('/api/deals?min_amount=2600000').json()
        assert filtered['total'] == 1 and filtered['items'][0]['amount'] == 2600000
        assert client.get('/api/deals?min_amount=2600001').json()['total'] == 0
        assert client.get('/api/deals').json()['total'] == 13
        assert client.get('/api/platform/quotes?limit=1').status_code == 403
        assert client.post('/api/platform/quotes',json={'name':'Blocked quote'}).status_code == 403
        out['passed'] = True
    ''')
    assert result['passed']
