"""Regression tests for itemized quotes, PDF export and tenant safety."""
from test_workflow_rule_builder import app_scenario


def test_quote_lines_totals_pdf_and_validation():
    result = app_scenario("""
    with TestClient(main.app, follow_redirects=False) as client:
        signup = client.post('/api/auth/signup', json={
            'name': 'Quote Tester', 'organization_name': 'Quote PDF Workspace',
            'username': 'quote.pdf.owner', 'email': 'quote.pdf@example.test',
            'password': 'strong-password-123',
        })
        assert signup.status_code == 201, signup.text
        with main.SessionLocal() as db:
            user = db.scalar(main.select(main.User).where(main.User.email == 'quote.pdf@example.test'))
            subscription = main._ensure_organization_subscription(db, user)
            plan = db.scalar(main.select(main.Plan).where(main.Plan.code == 'professional'))
            subscription.plan_id = plan.id
            subscription.status = 'Active'
            db.commit()
        account = client.post('/api/accounts', json={'name': 'Quote Customer'}).json()
        contact = client.post('/api/contacts', json={
            'first_name': 'Test', 'last_name': 'Contact', 'account_id': account['id']
        }).json()
        deal = client.post('/api/deals', json={
            'name': 'Quote Deal', 'account_id': account['id'],
            'contact_id': contact['id'], 'stage': 'Qualification'
        }).json()
        quote_response = client.post('/api/platform/quotes', json={
            'name': 'Quote with lines', 'deal_id': deal['id'],
            'currency': 'INR', 'status': 'Draft',
            'line_items': [
                {'name': 'Service A', 'quantity': 2, 'unit_price': 100,
                 'discount_percent': 10, 'tax_percent': 10},
                {'name': 'Service B', 'quantity': 1, 'unit_price': 50,
                 'discount_percent': 0, 'tax_percent': 0},
            ],
            'discount_percent': 0, 'tax_percent': 0,
        })
        assert quote_response.status_code == 201, quote_response.text
        quote = quote_response.json()
        out['total'] = quote['amount']
        out['account_id'] = quote['account_id']
        out['contact_id'] = quote['contact_id']
        out['expected_account'] = account['id']
        out['expected_contact'] = contact['id']
        out['line_total'] = quote['line_items'][0]['total']
        pdf = client.get('/api/quotes/' + str(quote['id']) + '/pdf')
        out['pdf_status'] = pdf.status_code
        out['pdf_magic'] = pdf.content[:5].decode('ascii') if pdf.status_code == 200 else pdf.text[:100]
        out['pdf_type'] = pdf.headers.get('content-type')
        bad = client.post('/api/platform/quotes', json={
            'name': 'Invalid line', 'deal_id': deal['id'],
            'line_items': [{'name': 'Invalid', 'quantity': 1, 'unit_price': 100,
                            'discount_percent': 105}],
        })
        out['bad_rate'] = bad.status_code
        client.delete('/api/platform/quotes/' + str(quote['id']))
        gone = client.get('/api/quotes/' + str(quote['id']) + '/pdf')
        out['archived_pdf'] = gone.status_code
    """)
    assert result['total'] == 248, result
    assert result['line_total'] == 198, result
    assert result['account_id'] == result['expected_account'], result
    assert result['contact_id'] == result['expected_contact'], result
    assert result['pdf_status'] == 200 and result['pdf_magic'] == '%PDF-', result
    assert result['pdf_type'] == 'application/pdf', result
    assert result['bad_rate'] == 422, result
    assert result['archived_pdf'] == 404, result
