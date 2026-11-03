"""Subscription, profile, invitation and lifecycle controls work together."""
from app.entitlements import FEATURE_TIERS, PLAN_CODES, plan_capabilities
from test_tier0_organization_billing import run_app_script


SIGNUP = """
with TestClient(main.app, follow_redirects=False) as c:
    assert c.post('/api/auth/signup', json={'name':'Workspace Owner',
        'organization_name':'Permission Workspace', 'username':'permission.owner',
        'email':'permission.owner@example.test','password':'strong-password-123'}).status_code == 201
    uid=c.get('/api/settings/profile').json()['id']
"""


def test_complete_capability_catalog_and_exceptions():
    for tier, code in enumerate(PLAN_CODES):
        features = plan_capabilities(code)
        for key, minimum in FEATURE_TIERS.items():
            assert features[key] == (tier >= minimum), (code, key)
        assert features['custom_modules'] == (code != 'bigin_express')
        assert features['quickbooks_integration'] == (code in {'bigin_express', 'enterprise'})


def test_plan_aware_preview_and_named_profiles():
    out=run_app_script(SIGNUP + '''
    matrix=c.get('/api/admin/security/module-permissions').json()
    out['free_available']=matrix['module_availability']['products']
    out['approval_setup']=matrix['setup_availability']['manage_approval_rules']
    preview=c.get(f'/api/admin/security/module-permissions/effective/{uid}').json()
    out['products']=preview['permissions']['products']['read']
    out['profile']=c.post('/api/admin/security/profiles',json={'name':'Custom Sales','description':'Sales access'}).status_code
    out['listed']='Custom Sales' in c.get('/api/admin/security/module-permissions').json()['profiles']
    assert c.put('/api/admin/security/module-permissions',json={'profile':'Custom Sales','modules':{'leads':{'read':True}},'features':{'webforms':False}}).status_code==200
    invite=c.post('/api/admin/users/invite',json={'name':'Reader','email':'reader@example.test','profile_name':'Custom Sales','role':'Sales rep'})
    out['invite']=invite.status_code
    token=invite.json()['invitation_token']
    c.post('/api/auth/logout')
    out['accepted']=c.post('/api/auth/signup',json={'name':'Reader','username':'permission.reader','email':'reader@example.test','password':'strong-password-123','invitation_token':token}).status_code
    out['profile_name']=c.get('/api/settings/profile').json()['profile_name']
    out['leads']=c.get('/api/leads').status_code
    out['create']=c.post('/api/leads',json={'name':'Should be denied'}).status_code
    ''')
    assert out == {'free_available':False,'approval_setup':False,'products':False,
                   'profile':201,'listed':True,'invite':201,'accepted':201,
                   'profile_name':'Custom Sales','leads':200,'create':403}


def test_paid_seats_and_acceptance_recheck():
    out=run_app_script(SIGNUP + '''
    with main.SessionLocal() as db:
        user=db.get(main.User,uid)
        sub=main._ensure_organization_subscription(db,user)
        sub.plan_id=db.scalar(main.select(main.Plan.id).where(main.Plan.code=='enterprise'))
        sub.purchased_seats=2
        sid=sub.id
        db.commit()
    invitation=c.post('/api/admin/users/invite',json={'name':'Teammate','email':'seat@example.test'})
    out['first']=invitation.status_code
    out['full']=c.post('/api/admin/users/invite',json={'name':'Extra','email':'extra@example.test'}).status_code
    out['limit']=c.get('/api/settings/profile').json()['subscription']['limits']['max_users']
    with main.SessionLocal() as db:
        db.get(main.OrganizationSubscription,sid).purchased_seats=1
        db.commit()
    c.post('/api/auth/logout')
    out['accept_full']=c.post('/api/auth/signup',json={'name':'Teammate','username':'seat.member','email':'seat@example.test','password':'strong-password-123','invitation_token':invitation.json()['invitation_token']}).status_code
    ''')
    assert out == {'first':201,'full':403,'limit':2,'accept_full':403}


def test_owner_protection_and_legacy_user_routes():
    out=run_app_script(SIGNUP + '''
    out['owner_deactivate']=c.post(f'/api/admin/users/{uid}/status/deactivate').status_code
    out['status_patch']=c.patch(f'/api/admin/users/{uid}',json={'status':'Inactive'}).status_code
    out['legacy_delete']=c.delete(f'/api/users/{uid}').status_code
    out['legacy_create']=c.post('/api/users',json={'name':'Bypass','email':'bypass@example.test'}).status_code
    out['unknown_profile']=c.post('/api/admin/users/invite',json={'name':'Bad','email':'bad@example.test','profile_name':'Other tenant profile'}).status_code
    ''')
    assert out == {'owner_deactivate':409,'status_patch':422,'legacy_delete':409,'legacy_create':422,'unknown_profile':422}


def test_feature_deny_and_plan_downgrade_are_authoritative():
    out=run_app_script(SIGNUP + '''
    with main.SessionLocal() as db:
        sub=main._ensure_organization_subscription(db,db.get(main.User,uid))
        sid=sub.id
        sub.plan_id=db.scalar(main.select(main.Plan.id).where(main.Plan.code=='enterprise'))
        db.commit()
    assert c.put('/api/admin/security/module-permissions',json={'profile':'Administrator','modules':{'apex_agents':{'read':True}},'features':{'ai_agents':False}}).status_code==200
    out['denied_agent']=c.get('/api/platform/apex_agents').status_code
    out['denied_agent_alias']=c.get('/api/v1/platform/apex_agents').status_code
    with main.SessionLocal() as db:
        db.get(main.OrganizationSubscription,sid).plan_id=main._default_plan(db).id
        db.commit()
    out['downgrade_agent']=c.get('/api/platform/apex_agents').status_code
    ''')
    assert out == {'denied_agent':403,'denied_agent_alias':403,'downgrade_agent':403}


def test_deactivation_frees_seat_and_reactivation_cannot_bypass_limit():
    out=run_app_script(SIGNUP + '''
    invitation=c.post('/api/admin/users/invite',json={'name':'Member','email':'lifecycle@example.test'}).json()
    c.post('/api/auth/logout')
    assert c.post('/api/auth/signup',json={'name':'Member','username':'lifecycle.member','email':'lifecycle@example.test','password':'strong-password-123','invitation_token':invitation['invitation_token']}).status_code==201
    member_id=c.get('/api/settings/profile').json()['id']
    c.post('/api/auth/logout')
    c.post('/api/auth/login',json={'identifier':'permission.owner','password':'strong-password-123'})
    out['deactivate']=c.post(f'/api/admin/users/{member_id}/status/deactivate').status_code
    with main.SessionLocal() as db:
        out['inactive_memberships']=int(db.scalar(main.select(main.func.count()).select_from(main.OrganizationMember).where(main.OrganizationMember.user_id==member_id,main.OrganizationMember.status=='Active')) or 0)
    a=c.post('/api/admin/users/invite',json={'name':'Reserved A','email':'a@example.test'})
    b=c.post('/api/admin/users/invite',json={'name':'Reserved B','email':'b@example.test'})
    out['reserved']=[a.status_code,b.status_code]
    out['full']=c.post(f'/api/admin/users/{member_id}/status/activate').status_code
    c.delete('/api/organization/invitations/'+str(a.json()['id']))
    out['activate']=c.post(f'/api/admin/users/{member_id}/status/activate').status_code
    ''')
    assert out == {'deactivate':200,'inactive_memberships':0,'reserved':[201,201],'full':403,'activate':200}


def test_checkout_seat_quantity_requires_verified_payment():
    out=run_app_script(SIGNUP + '''
    import os
    import app.routes.record_reporting as reporting
    os.environ['APP_PUBLIC_URL']='https://crm.example.test'
    reporting.create_hosted_checkout=lambda **kwargs: {'provider':'stripe','provider_reference':'checkout-test','checkout_url':'https://checkout.example.test'}
    checkout=c.post('/api/billing/checkout',json={'plan_code':'standard','seats':7})
    out['checkout']=checkout.status_code
    out['seats_before']=c.get('/api/settings/profile').json()['subscription']['purchased_seats']
    out['change_pending']=c.post('/api/billing/checkout',json={'plan_code':'standard','seats':9}).status_code
    request_id=checkout.json()['request_id']
    main.verify_webhook=lambda provider,body,headers: {'paid':True,'request_id':request_id,'provider_reference':'checkout-test','event_type':'checkout.session.completed'}
    out['verified']=c.post('/api/billing/webhook/stripe',content=b'paid-event').status_code
    subscription=c.get('/api/settings/profile').json()['subscription']
    out['seats_after']=subscription['purchased_seats']
    out['plan_after']=subscription['plan_code']
    ''')
    assert out == {'checkout':200,'seats_before':3,'change_pending':409,'verified':200,'seats_after':7,'plan_after':'standard'}


def test_delegated_admin_cannot_promote_users_or_change_billing():
    out=run_app_script(SIGNUP + '''
    assert c.post('/api/admin/security/profiles',json={'name':'User Administrator'}).status_code==201
    assert c.put('/api/admin/security/module-permissions',json={'profile':'User Administrator','modules':{'leads':{'read':True}},'setup':{'manage_users':True}}).status_code==200
    invitation=c.post('/api/admin/users/invite',json={'name':'User Admin','email':'delegated@example.test','role':'Administrator','profile_name':'User Administrator'}).json()
    c.post('/api/auth/logout')
    assert c.post('/api/auth/signup',json={'name':'User Admin','username':'delegated.admin','email':'delegated@example.test','password':'strong-password-123','invitation_token':invitation['invitation_token']}).status_code==201
    out['users']=c.get('/api/admin/users').status_code
    out['options']=c.get('/api/admin/users/options').status_code
    out['profiles']=c.get('/api/admin/security/module-permissions').status_code
    out['billing']=c.patch('/api/subscription',json={'plan_code':'enterprise'}).status_code
    out['promote']=c.post('/api/admin/users/invite',json={'name':'Promoted','email':'promoted@example.test','role':'Administrator'}).status_code
    ''')
    assert out == {'users':200,'options':200,'profiles':403,'billing':403,'promote':403}
