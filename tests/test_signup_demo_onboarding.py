from test_tier0_organization_billing import run_app_script


def test_signup_admin_and_demo_records_are_tenant_scoped():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        for n in range(2):
            resp = c.post('/api/auth/signup', json={
                'organization_name': f'Demo Organization {n}',
                'name': f'Demo Admin {n}', 'username': f'demo.admin.{n}',
                'email': f'demo.admin.{n}@example.com',
                'password': 'a-secure-password-123',
            })
            assert resp.status_code == 201, resp.text
        with main.SessionLocal() as db:
            users = db.scalars(main.select(main.User).where(
                main.User.email.in_(['demo.admin.0@example.com','demo.admin.1@example.com'])
            )).all()
            for user in users:
                org = main._organization_for_user(db, user.id)
                member = db.scalar(main.select(main.OrganizationMember).where(
                    main.OrganizationMember.organization_id == org.id,
                    main.OrganizationMember.user_id == user.id
                ))
                row = {'role':user.role, 'membership':member.membership_role}
                for label, model in [('leads',main.Lead),('contacts',main.Contact),
                                     ('accounts',main.Account),('deals',main.Deal)]:
                    row[label] = db.scalar(main.select(main.func.count()).select_from(model).where(
                        model.organization_id == org.id))
                out[user.email] = row
    """)
    assert len(out) == 2
    for row in out.values():
        assert row == {
            "role": "Administrator", "membership": "Admin",
            "leads": 10, "contacts": 10, "accounts": 10, "deals": 10,
        }
