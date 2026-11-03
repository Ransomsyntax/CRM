import time

import pytest
from fastapi import HTTPException
from cryptography.fernet import Fernet
from app.services import provider_runtime as providers
from app.services.vault import seal, unseal


@pytest.mark.parametrize('provider,configuration,response',[
    ('gmail',{}, {'messages':[]}), ('outlook',{}, {'value':[{'id':'1','subject':'Email'}]}),
    ('google_calendar',{}, {'items':[{'id':'1','summary':'Event'}]}), ('outlook_calendar',{}, {'value':[{'id':'1','subject':'Event'}]}),
    ('slack',{}, {'ok':True,'channels':[{'id':'C123','name':'sales'}]}), ('teams',{}, {'value':[{'id':'team','displayName':'Sales'}]}),
    ('zoom',{}, {'meetings':[{'id':1,'topic':'Meeting'}]}), ('quickbooks',{'realm_id':'123'}, {'QueryResponse':{'Customer':[{'Id':'1','DisplayName':'Customer'}]}}),
    ('google_ads',{'customer_id':'123'}, {'results':[{'campaign':{'id':'1','name':'Campaign'}}]}),
    ('meta_ads',{'ad_account_id':'123','api_version':'v25.0'}, {'data':[{'campaign_id':'1','campaign_name':'Campaign','date_start':'2026-01-01','date_stop':'2026-01-02'}]})])
def test_provider_batches_use_fixed_hosts(monkeypatch,provider,configuration,response):
    calls=[]
    def request(url,token=None,**kwargs):
        calls.append((url,token,kwargs));return response
    monkeypatch.setattr(providers,'request_json',request)
    items,cursor=providers.fetch_batch(provider,{'access_token':'secret','developer_token':'devsecret'},configuration)
    assert isinstance(items,list)
    assert calls and calls[0][1]=='secret'
    assert all('secret' not in call[0] for call in calls)


def test_untrusted_hosts_and_bad_graph_cursors_are_rejected():
    with pytest.raises(HTTPException):
        providers.request_json('http://169.254.169.254/latest/meta-data','secret')
    with pytest.raises(HTTPException):
        providers.request_json('https://attacker.example/','secret')
    with pytest.raises(HTTPException):
        providers.graph_page('https://attacker.example/','me/messages')
    assert providers.NoRedirect().redirect_request(None,None,302,'',{},'https://attacker.example') is None


def test_refresh_keeps_rotated_refresh_token(monkeypatch):
    monkeypatch.setattr(providers,'request_json',lambda *args,**kwargs:{'access_token':'new-access','refresh_token':'new-refresh','expires_in':3600})
    result=providers.refresh('quickbooks',{'access_token':'old','refresh_token':'old-refresh','client_id':'id','client_secret':'secret','expires_at':time.time()-1})
    assert result['refresh_token']=='new-refresh' and result['access_token']=='new-access'


def test_key_ring_rotation_and_context_binding(monkeypatch):
    old,new=Fernet.generate_key().decode(),Fernet.generate_key().decode()
    monkeypatch.setenv('CRM_ENCRYPTION_KEYS',old)
    payload=seal({'token':'secret'},[1,'connection',2])
    monkeypatch.setenv('CRM_ENCRYPTION_KEYS',new+','+old)
    assert unseal(payload,[1,'connection',2])=={'token':'secret'}
    with pytest.raises(HTTPException):
        unseal(payload,[3,'connection',2])


@pytest.mark.parametrize('provider,configuration,values',[
    ('gmail',{}, {'from':'sender@example.test','to':'a@example.test','subject':'Hello','body':'Message'}),
    ('outlook',{}, {'to':'a@example.test','subject':'Hello','body':'Message'}),
    ('google_calendar',{}, {'subject':'Meeting','start':'2026-12-01T10:00:00+05:30','end':'2026-12-01T11:00:00+05:30'}),
    ('outlook_calendar',{}, {'subject':'Meeting','start':'2026-12-01T10:00:00+05:30','end':'2026-12-01T11:00:00+05:30'}),
    ('slack',{}, {'channel':'C123','body':'Message'}), ('teams',{}, {'team_id':'team','channel_id':'channel','body':'<script>escaped</script>'}),
    ('zoom',{}, {'subject':'Meeting','start':'2026-12-01T10:00:00Z','duration':30}),
    ('quickbooks',{'realm_id':'123'}, {'name':'Customer','to':'a@example.test'})])
def test_explicit_provider_action_payloads(provider,configuration,values):
    url,body=providers.prepare_write(provider,configuration,values)
    assert url.startswith('https://') and isinstance(body,dict)
    if provider=='teams':
        assert '<script>' not in body['body']['content']


def test_header_injection_and_naive_meeting_times_are_rejected():
    with pytest.raises(HTTPException):
        providers.prepare_write('gmail',{}, {'to':'a@example.test','subject':'Hello\nBcc: hidden@example.test','body':'Message'})
    with pytest.raises(HTTPException):
        providers.prepare_write('zoom',{}, {'subject':'Meeting','start':'2026-12-01T10:00:00'})
