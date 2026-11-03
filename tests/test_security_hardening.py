from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_app_script(body: str, **env_overrides: str) -> dict:
    script = (
        "import json\n"
        "from fastapi.testclient import TestClient\n"
        "import app.main as main\n"
        "out = {}\n"
        + textwrap.dedent(body)
        + "\nprint('RESULT' + json.dumps(out))\n"
    )
    with tempfile.TemporaryDirectory() as tmp:
        env = os.environ.copy()
        env.update({
            "APP_ENV": "development",
            "DATABASE_URL": f"sqlite:///{tmp}/security.db",
            "ENABLE_AUTH": "true",
            "APP_USERNAME": "admin",
            "APP_PASSWORD": "supersecretpass123",
            "ADMIN_EMAIL": "admin@example.com",
            "ADMIN_NAME": "Administrator",
            "PYTHONPATH": str(ROOT),
        })
        env.update(env_overrides)
        result = subprocess.run(
            [sys.executable, "-c", script],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=180,
        )
    if result.returncode != 0:
        raise AssertionError(result.stderr[-5000:])
    line = [row for row in result.stdout.splitlines() if row.startswith("RESULT")][-1]
    return json.loads(line[6:])


def test_normal_account_cannot_administer_users_or_security():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        created = c.post('/api/auth/signup', json={"organization_name": "Automated Test Organization", 
            'name':'Standard User','username':'standard.user','email':'standard@example.com',
            'password':'strong-password-123'
        })
        out['signup'] = created.status_code
        with main.SessionLocal() as db:
            # Signup creates an organization owner; this test targets a regular member.
            user = db.scalar(main.select(main.User).where(main.User.username == 'standard.user'))
            membership = db.scalar(main.select(main.OrganizationMember).where(main.OrganizationMember.user_id == user.id))
            membership.membership_role = 'Member'
            user.role = 'User'
            db.commit()
            admin = db.scalar(main.select(main.User).where(main.func.lower(main.User.role) == 'administrator').order_by(main.User.id))
            out['report_users'] = None
            try:
                main._report_rows(db, 'users')
            except main.HTTPException as exc:
                out['report_users'] = exc.status_code
        out['users'] = c.get('/api/users').status_code
        out['security'] = c.get('/api/security/overview').status_code
        out['patch_admin'] = c.patch(f"/api/users/{admin.id}", json={'role':'Administrator'}).status_code
    """)
    assert out == {
        'signup': 201,
        'report_users': 422,
        'users': 403,
        'security': 403,
        'patch_admin': 403,
    }


def test_login_rate_limit_triggers():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        codes = []
        for _ in range(11):
            codes.append(c.post('/api/auth/login', json={
                'identifier':'rate-limit@example.com',
                'password':'wrong-password-123'
            }).status_code)
        out['codes'] = codes
    """)
    assert out['codes'][:10] == [401] * 10
    assert out['codes'][10] == 429


def test_password_login_creates_session_without_otp():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        response = c.post('/api/auth/login', json={
            'identifier':'admin',
            'password':'supersecretpass123'
        })
        payload = response.json()
        out['status'] = response.status_code
        out['ok'] = payload.get('ok')
        out['redirect'] = payload.get('redirect')
        out['session'] = c.get('/api/auth/session').status_code
        out['otp_route_present'] = any(
            getattr(route, 'path', None) == '/api/auth/login/verify-otp'
            for route in main.app.routes
        )
    """)
    assert out == {
        'status': 200,
        'ok': True,
        'redirect': '/dashboard',
        'session': 200,
        'otp_route_present': False,
    }


def test_security_headers_and_no_duplicate_routes():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        response = c.get('/login')
        out['csp'] = response.headers.get('content-security-policy', '')
        out['coop'] = response.headers.get('cross-origin-opener-policy', '')
        pairs = []
        for route in main.app.routes:
            path = getattr(route, 'path', None)
            methods = getattr(route, 'methods', None) or []
            for method in methods:
                pairs.append(method + ' ' + str(path))
        out['logout_routes'] = pairs.count('POST /api/auth/logout')
        out['uploads_mount'] = any(getattr(route, 'path', None) == '/uploads' for route in main.app.routes)
    """)
    assert "default-src 'self'" in out['csp']
    script_directive = next(part for part in out['csp'].split(';') if part.strip().startswith('script-src'))
    assert "'unsafe-inline'" not in script_directive
    assert "'unsafe-hashes'" not in script_directive
    assert "'sha256-" in script_directive
    assert out['coop'] == 'same-origin'
    assert out['logout_routes'] == 1
    assert out['uploads_mount'] is False


def test_password_policy_requires_eight_characters():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        short = c.post('/api/auth/signup', json={"organization_name": "Automated Test Organization", 
            'name':'Short Password','username':'short.password','email':'short@example.com',
            'password':'1234567'
        })
        valid = c.post('/api/auth/signup', json={"organization_name": "Automated Test Organization", 
            'name':'Valid Password','username':'valid.password','email':'valid@example.com',
            'password':'12345678'
        })
        out['short'] = short.status_code
        out['valid'] = valid.status_code
    """)
    assert out == {'short': 422, 'valid': 201}


def test_document_download_is_tenant_authorized_and_database_backed():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        c.post('/api/auth/signup', json={"organization_name": "Automated Test Organization", 
            'name':'Document Owner','username':'doc.owner','email':'doc.owner@example.com',
            'password':'strong-password-123'
        })
        uploaded = c.post(
            '/api/documents/upload',
            data={'name':'Private document'},
            files={'file':('private.txt', b'private tenant content', 'text/plain')},
        )
        out['upload'] = uploaded.status_code
        item = uploaded.json()
        out['url'] = item.get('url')
        item_id = item['id']
        own = c.get(f'/api/documents/{item_id}/download')
        out['own'] = own.status_code
        out['body'] = own.content.decode()
        with main.SessionLocal() as db:
            out['blob_count'] = int(db.scalar(main.select(main.func.count()).select_from(main.DocumentBlob)) or 0)
        c.post('/api/auth/logout')
        second = c.post('/api/auth/signup', json={"organization_name": "Automated Test Organization", 
            'name':'Other Tenant','username':'other.tenant','email':'other.tenant@example.com',
            'password':'strong-password-123'
        })
        out['second_signup'] = second.status_code
        if second.status_code != 201:
            login = c.post('/api/auth/login', json={
                'identifier':'other.tenant',
                'password':'strong-password-123'
            })
            out['second_login'] = login.status_code
        else:
            out['second_login'] = 200
        out['cross_tenant'] = c.get(f'/api/documents/{item_id}/download').status_code
    """)
    assert out['upload'] == 201
    assert out['url'].endswith('/download')
    assert out['own'] == 200
    assert out['body'] == 'private tenant content'
    assert out['blob_count'] == 1
    assert out['second_signup'] == 201
    assert out['second_login'] == 200
    assert out['cross_tenant'] == 404


def test_ready_hides_release_evidence_without_readiness_token():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        public_response = c.get('/ready')
        public_payload = public_response.json()
        protected_response = c.get('/ready', headers={'X-Readiness-Token':'release-check-token'})
        protected_payload = protected_response.json()
        wrong_response = c.get('/ready', headers={'X-Readiness-Token':'wrong-token'})
        unicode_response = c.get('/ready', headers={b'X-Readiness-Token':bytes([255])})
        out['status'] = public_response.status_code
        out['service'] = public_payload.get('service')
        out['database'] = public_payload.get('database')
        out['public_has_app_revision'] = 'app_revision' in public_payload
        out['public_has_migration_revision'] = 'migration_revision' in public_payload
        out['protected_app_revision'] = protected_payload.get('app_revision')
        out['protected_has_migration_revision'] = 'migration_revision' in protected_payload
        out['wrong_hidden'] = 'app_revision' not in wrong_response.json()
        out['unicode_hidden'] = unicode_response.status_code == 200 and 'app_revision' not in unicode_response.json()
        out['no_store'] = protected_response.headers.get('cache-control') == 'no-store'
    """, APP_REVISION="tier0-test-revision", READINESS_EVIDENCE_TOKEN="release-check-token")
    assert out == {
        'status': 200,
        'service': 'yash-crm',
        'database': 'ready',
        'public_has_app_revision': False,
        'public_has_migration_revision': False,
        'protected_app_revision': 'tier0-test-revision',
        'protected_has_migration_revision': True,
        'wrong_hidden': True,
        'unicode_hidden': True,
        'no_store': True,
    }


def test_production_readiness_schema_details_require_evidence_token():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        class MissingSchemaInspector:
            def get_table_names(self):
                return []
        main.inspect = lambda bind: MissingSchemaInspector()
        main.IS_PRODUCTION = True
        public = c.get('/ready')
        protected = c.get('/ready', headers={'X-Readiness-Token':'release-check-token'})
        out['public_status'] = public.status_code
        out['protected_status'] = protected.status_code
        out['public_code'] = public.json()['detail']['code']
        out['public_has_schema_names'] = 'missing' in public.json()['detail']
        out['protected_has_schema_names'] = bool(protected.json()['detail'].get('missing'))
    """, READINESS_EVIDENCE_TOKEN="release-check-token")
    assert out == {
        'public_status': 503,
        'protected_status': 503,
        'public_code': 'SCHEMA_NOT_READY',
        'public_has_schema_names': False,
        'protected_has_schema_names': True,
    }


def test_auth_form_has_safe_post_fallback_and_accessible_controls():
    out = run_app_script("""
    with TestClient(main.app, follow_redirects=False) as c:
        html = c.get('/login').text
        out['post_form'] = '<form id="auth-form" method="post" action="/api/auth/login">' in html
        out['password_toggles'] = html.count('data-password-toggle=')
        out['required_identifier'] = 'id="identifier" name="identifier" autocomplete="username" required' in html
        out['required_password'] = 'id="password" name="password" type="password" autocomplete="current-password" minlength="8" required' in html
        out['duplicate_signup_cta'] = html.count('<a href="/signup">')
    """)
    assert out == {
        'post_form': True,
        'password_toggles': 2,
        'required_identifier': True,
        'required_password': True,
        'duplicate_signup_cta': 1,
    }
