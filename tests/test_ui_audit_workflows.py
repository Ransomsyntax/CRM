from test_workflow_rule_builder import app_scenario


def test_solution_default_and_legacy_status_remain_filterable():
    out = app_scenario("""
    with TestClient(main.app, follow_redirects=False) as c:
        c.post('/api/auth/signup',json={'name':'Audit Owner','organization_name':'Audit Org','username':'audit.owner','email':'audit.owner@example.com','password':'strong-password-123'})
        draft=c.post('/api/platform/solutions',json={'name':'New knowledge','content':'Steps to resolve the issue.'})
        legacy=c.post('/api/platform/solutions',json={'name':'Legacy knowledge','content':'Existing knowledge.','status':'Active'})
        invalid=c.post('/api/platform/solutions',json={'name':'Invalid knowledge','content':'Invalid status test.','status':'Unknown'})
        out['draft_status']=draft.status_code
        out['default']=draft.json().get('status')
        out['legacy_status']=legacy.status_code
        out['filtered']=c.get('/api/platform/solutions?status=Active').json()['total']
        out['invalid']=invalid.status_code
    """)
    assert out == {'draft_status':201,'default':'Draft','legacy_status':201,'filtered':1,'invalid':422}


def test_completed_related_activity_and_bulk_restore():
    out = app_scenario("""
    with TestClient(main.app, follow_redirects=False) as c:
        c.post('/api/auth/signup',json={'name':'Activity Owner','organization_name':'Activity Org','username':'audit.activity','email':'audit.activity@example.com','password':'strong-password-123'})
        contact=c.post('/api/contacts',json={'first_name':'Test','last_name':'Contact'}).json()
        activity=c.post('/api/activities',json={'subject':'Completed follow-up','activity_type':'Task','status':'Completed','related_type':'contacts','related_id':contact['id']})
        row=activity.json()
        out['created']=activity.status_code
        out['status']=row.get('status')
        out['linked']=row.get('related_id')==contact['id'] and row.get('related_type')=='contacts'
        out['archived']=c.post('/api/administration/bulk-delete',json={'resource':'activities','ids':[row['id']]}).status_code
        result=c.post('/api/administration/recycle-bin/bulk-restore',json={'resource':'activities','ids':[row['id']]})
        out['restored']=result.status_code
        out['visible']=c.get('/api/activities/'+str(row['id'])).status_code
    """)
    assert out == {'created':200,'status':'Completed','linked':True,'archived':200,'restored':200,'visible':200}
