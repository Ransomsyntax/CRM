"""API checks derived from the uploaded October 28–29 QA reports."""
import pytest
from pydantic import ValidationError
from app.schemas import RecordPayload
from test_workflow_rule_builder import app_scenario


@pytest.mark.parametrize('value', ['Jane@#$%', 'A' * 101, '12345'])
def test_contact_names_match_person_and_storage_constraints(value):
    with pytest.raises(ValidationError):
        RecordPayload(first_name=value)


def test_required_names_cannot_be_cleared_and_failed_edits_preserve_records():
    out = app_scenario('''
    with TestClient(main.app) as c:
        signup = c.post('/api/auth/signup', json={
            'name':'QA Owner','organization_name':'QA Workspace',
            'username':'qa.owner','email':'qa.owner@example.test',
            'password':'strong-password-123'})
        assert signup.status_code == 201, signup.text
        out['edits'] = []
        for resource, payload, key in [
            ('leads', {'name':'QA Lead'}, 'name'),
            ('contacts', {'first_name':'Jane','last_name':'Smith'}, 'first_name'),
            ('contacts', {'first_name':'John','last_name':'Smith'}, 'last_name'),
            ('accounts', {'name':'QA Account'}, 'name')]:
            created = c.post('/api/' + resource, json=payload)
            assert created.status_code == 200, created.text
            path = '/api/' + resource + '/' + str(created.json()['id'])
            rejected = c.patch(path, json={key:''})
            out['edits'].append([rejected.status_code,c.get(path).json()[key],payload[key]])
        out['missing_last'] = c.post('/api/contacts',json={'first_name':'Missing'}).status_code
        out['search'] = c.get('/api/search',params={'q':'QA Lead'}).json()['results']
    ''', plan='enterprise')
    assert all(status == 422 and actual == expected for status, actual, expected in out['edits']), out
    assert out['missing_last'] == 422, out
    assert any(item['label'] == 'QA Lead' for item in out['search']), out


def test_reported_invalid_values_are_rejected_at_http_boundary():
    out = app_scenario('''
    with TestClient(main.app) as c:
        signup = c.post('/api/auth/signup', json={
            'name':'Field QA','organization_name':'Field QA',
            'username':'field.qa','email':'field.qa@example.test',
            'password':'strong-password-123'})
        assert signup.status_code == 201, signup.text
        out['invalid'] = []
        for payload in [{'name':'   '},{'name':'12345'},
            {'name':'Invalid Email','email':'angel@123'},
            {'name':'Missing At','email':'angelgmail.com'},
            {'name':'Missing Domain','email':'angel@'},
            {'name':'Invalid Phone','phone':'mmtth'},
            {'name':'Short Phone','phone':'123'},
            {'name':'Long Phone','phone':'1'*16}]:
            out['invalid'].append(c.post('/api/leads',json=payload).status_code)
        out['contact_phone'] = c.post('/api/contacts',json={
            'first_name':'Jane','last_name':'Smith','phone':'khjghmm'}).status_code
        account = c.post('/api/accounts',json={'name':'Website QA','website':'https://example.com'}).json()
        path = '/api/accounts/' + str(account['id'])
        out['website_rejected'] = c.patch(path,json={'website':'zsdxghj'}).status_code
        out['malformed_websites'] = [c.patch(path,json={'website':website}).status_code
            for website in ['https://.com','https://example..com','https://-example.com',
                            'https://example.com:bad','https://example.com:99999']]
        out['website_saved'] = c.get(path).json()['website']
        out['international_phone'] = c.post('/api/leads',json={
            'name':'International Phone','phone':'1234567899999'}).status_code
    ''', plan='enterprise')
    assert out['invalid'] == [422] * 8, out
    assert out['contact_phone'] == out['website_rejected'] == 422, out
    assert out['website_saved'] == 'https://example.com', out
    assert out['malformed_websites'] == [422] * 5, out
    assert out['international_phone'] == 200, out
