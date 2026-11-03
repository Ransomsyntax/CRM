from test_core_completion import run_app_script


def test_html_assets_and_data_cannot_reuse_stale_http_responses():
    out = run_app_script('''
    with TestClient(main.app) as c:
        for path in ['/login', '/signup', '/dashboard', '/owner',
                     '/static/js/app.js', '/static/js/core/http.js',
                     '/static/css/foundation.css', '/sw.js', '/api/dashboard']:
            response = c.get(path, headers=auth)
            out[path] = [response.status_code, response.headers.get('cache-control'),
                         response.headers.get('pragma'), response.headers.get('expires')]
    ''')
    assert all(value == [200, 'no-store', 'no-cache', '0'] for value in out.values()), out
