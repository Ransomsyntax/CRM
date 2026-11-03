# CONVOSIS CRM: AWS deployment and migration runbook

Status: preparation only. No AWS resources have been created. Do not cut over until the release audit blockers are resolved and PostgreSQL/browser checks pass.

## Target architecture

Use the existing Docker image on ECS Fargate, with an HTTPS Application Load Balancer, a private RDS PostgreSQL database, ECR images, Secrets Manager, and CloudWatch logs. Run `python -m app.workflow_worker` as a separate ECS service using the same release image and database. The worker has no public listener and must not use the web container health check.

Before provisioning, choose the AWS account, region, domain, budget, availability requirements, and RDS size. A cost estimate must include the database, web and worker tasks, load balancer, logs, backups, storage, and private-subnet egress. This guide does not estimate prices.

## Build and configuration

1. Build the root `Dockerfile`, tag it with the exact tested Git commit, and push that immutable tag to ECR. Scan the image before deployment.
2. Give ECS task execution permission to pull that ECR image, write its own log streams, and read only the required secret ARNs. Do not store credentials in task-definition plaintext or Git.
3. Set `APP_ENV=production`, `ENABLE_AUTH=true`, `SEED_DEMO_DATA=false`, `PORT=8000`, and `APP_REVISION` equal to the tested Git commit.
4. Set `DATABASE_URL` to the private RDS PostgreSQL connection. Use verified TLS with the current AWS RDS CA bundle. URL-encode special characters in passwords. Test the exact connection from the ECS network before migration.
5. Set `ALLOWED_HOSTS` to the exact public application hostname and `APP_PUBLIC_URL` to its HTTPS URL. Keep wildcard host and CORS settings disabled.
6. Store `APP_USERNAME`, `APP_PASSWORD`, `ADMIN_NAME`, `ADMIN_EMAIL`, `YASHCRM_CSRF_SECRET`, and `READINESS_EVIDENCE_TOKEN` in Secrets Manager as appropriate. Use the existing owner identity during migration so startup does not accidentally create a different owner. Keep the CSRF secret consistent across replicas.
7. Configure trusted proxy addresses for Uvicorn through `FORWARDED_ALLOW_IPS`. Limit direct access to the task to the load balancer security group. Confirm HTTPS cookies, login, logout, and CSRF checks through the actual load balancer.
8. Keep optional AI, SMTP, webhook, and workflow-delivery settings disabled until configured and tested for the intended recipients/providers. Do not copy secret values into release reports.

## Networking and health

- Public ingress: HTTPS 443 to the load balancer; redirect HTTP to HTTPS.
- Task ingress: port 8000 only from the load balancer security group.
- Database ingress: PostgreSQL 5432 only from application/migration task security groups.
- Use target type `ip` for Fargate/awsvpc tasks.
- Configure the target-group readiness path as `/ready`, with HTTP 200 as success. The existing middleware permits only GET `/ready` for internal probe hostnames, without relaxing ordinary application routes.
- Keep the image's local liveness check separate from load-balancer readiness. Do not expose `/ready` release evidence without its token.
- Private tasks need an explicit path to ECR, Secrets Manager, logging, and any enabled external services (VPC endpoints and/or controlled egress).

## Database migration and data cutover

1. Take a source PostgreSQL backup and verify a restore into an isolated staging RDS database. Inventory legacy files under `uploads/documents`: newer document payloads are stored in the database, while older records can still reference disk files.
2. Use a migration identity with the required schema permissions. Run `python -m alembic upgrade head` exactly once as a one-off task against staging, then run `python -m scripts.check_worker_readiness` and the PostgreSQL regression checks.
3. The default `cloud-entrypoint.sh` migrates on every web start. For ECS rolling deployments, override the web command to start Uvicorn directly after the one-off migration succeeds, preventing concurrent migration runners. Pass the configured proxy trust setting explicitly in that command.
4. Test the staged clone using synthetic test records: organizations, users, owner controls, role/profile restrictions, paid and Free plans, CRUD, conversions, quotations/orders/invoices, PDF output, uploads/downloads, recycle/restore, imports/exports, workflow worker, and tenant isolation.
5. Schedule a maintenance window. Stop source writes and workflow delivery before the final backup. Restore the final data; do not run both workers against separate writable copies and risk duplicate external notifications.
6. Compare business-record counts, organization/user IDs, numbering sequences, uploaded document bytes, schema revision, and key financial totals. Confirm login using the migrated accounts.
7. Start the AWS web and worker services, verify `/health` and `/ready`, then change DNS. Preserve the source deployment and backup for rollback.
8. After AWS accepts new writes, do not blindly route traffic back to the old database. Reconcile new data first or deliberately declare and accept data loss; DNS rollback alone is not a safe database rollback.

## Release evidence required before cutover

- Full backend regression suite green under the approved owner-data-access policy.
- Chromium end-to-end suite green, including desktop and narrow viewports.
- PostgreSQL migration to the single expected Alembic head and worker readiness green.
- Dependency and image security scans reviewed.
- Actual AWS staging image build, secrets, proxy/cookie behavior, database restore, document download, and worker delivery verified.
- Confirm the exact deployed Git revision and migration using `scripts/verify_production.py` with `PRODUCTION_BASE_URL` set to the AWS URL. Configure its secrets outside Git. Credential-backed smoke checks can create test data and should use designated test accounts.
- Backup restore and rollback rehearsal completed.

## Official references

- ECS load balancing: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-load-balancing.html
- Application Load Balancer with ECS: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/alb.html
- ECS secret injection: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html
