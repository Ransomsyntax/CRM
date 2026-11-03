#!/usr/bin/env bash
# Isolated GitHub runner only: no production data, credentials, or AWS resources.
set -euo pipefail
: "${POSTGRES_CONTAINER_ID:?GitHub PostgreSQL service container is required}"
release_tmp=$(mktemp -d)
web_container=""
cleanup() {
  if [[ -n "$web_container" ]]; then
    docker logs "$web_container" || true
    docker rm -f "$web_container" >/dev/null || true
  fi
  rm -rf "$release_tmp"
}
trap cleanup EXIT
cat > "$release_tmp/runtime.env" <<'ENV'
APP_ENV=production
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/crm_runtime_ci
ENABLE_AUTH=true
ALLOWED_HOSTS=localhost,127.0.0.1
ADMIN_EMAIL=ci-owner@example.test
ADMIN_NAME=CI Owner
APP_USERNAME=ci.owner
APP_PASSWORD=synthetic-ci-password-123
YASHCRM_CSRF_SECRET=synthetic-ci-csrf-secret-123
SEED_DEMO_DATA=false
PORT=18080
ENV
docker build -t convosis-web-ci .
docker build -f Dockerfile.worker -t convosis-worker-ci .
for image in convosis-web-ci convosis-worker-ci; do
  image_user=$(docker inspect --format '{{.Config.User}}' "$image")
  [[ -n "$image_user" && "$image_user" != root && "$image_user" != 0 ]]
done
web_container=$(docker run -d --network host --env-file "$release_tmp/runtime.env" convosis-web-ci)
python3 - <<'PY'
import json,time,urllib.request
for attempt in range(60):
    try:
        with urllib.request.urlopen('http://127.0.0.1:18080/ready', timeout=2) as response:
            ready=json.load(response)
            assert response.status==200 and ready['database']=='ready' and ready['schema']=='ready',ready
            print('Production-mode web image readiness passed')
            break
    except Exception:
        if attempt==59: raise
        time.sleep(1)
PY
docker run --rm --network host --env-file "$release_tmp/runtime.env" convosis-worker-ci python -m scripts.check_worker_readiness
# pg_dump/pg_restore run inside the PostgreSQL 17 container, avoiding client/server version mismatch.
docker exec "$POSTGRES_CONTAINER_ID" psql -U postgres -d crm_runtime_ci -v ON_ERROR_STOP=1 -c "CREATE TABLE release_restore_probe (id integer PRIMARY KEY, payload text NOT NULL); INSERT INTO release_restore_probe VALUES (1, 'synthetic-restore-probe');"
docker exec "$POSTGRES_CONTAINER_ID" pg_dump -U postgres -Fc crm_runtime_ci > "$release_tmp/restore.dump"
docker exec "$POSTGRES_CONTAINER_ID" createdb -U postgres crm_restored_ci
docker exec -i "$POSTGRES_CONTAINER_ID" pg_restore -U postgres --exit-on-error -d crm_restored_ci < "$release_tmp/restore.dump"
restored_probe=$(docker exec "$POSTGRES_CONTAINER_ID" psql -U postgres -d crm_restored_ci -Atc 'SELECT payload FROM release_restore_probe WHERE id=1')
[[ "$restored_probe" == synthetic-restore-probe ]]
source_head=$(docker exec "$POSTGRES_CONTAINER_ID" psql -U postgres -d crm_runtime_ci -Atc 'SELECT version_num FROM alembic_version')
restored_head=$(docker exec "$POSTGRES_CONTAINER_ID" psql -U postgres -d crm_restored_ci -Atc 'SELECT version_num FROM alembic_version')
[[ -n "$source_head" && "$restored_head" == "$source_head" ]]
docker run --rm --network host --env-file "$release_tmp/runtime.env" -e DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/crm_restored_ci convosis-worker-ci python -m scripts.check_worker_readiness
printf '%s\n' 'Web/worker image build and synthetic PostgreSQL backup/restore gates passed.'
