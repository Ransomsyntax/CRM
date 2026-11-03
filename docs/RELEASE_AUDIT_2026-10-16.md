# CONVOSIS CRM release audit — 16 October 2026

**Hold AWS production cutover.** Hosted PostgreSQL, browser, container and synthetic restore checks now pass. Actual source-data restoration and AWS staging verification remain required.

This follow-up validates release `6d1de243006452809ed45f09020e972ca9f5c218` and the Workflow Rules repair tested at `64ac7a4c17c34813af9abd72d4b57e68951dfea1`. It includes the authentication extraction, reserved-Owner protection, tenant Admin recycle fix, commercial identity-row alignment, active-only owner plan list and regression-fixture updates. Concurrent changes must be checked against the final release SHA before cutover.

## Results

| Check | Result | Scope / limit |
| --- | --- | --- |
| Selected backend/API suite | 341 passed, 0 failed | SQLite development databases; one browser case explicitly deselected |
| Complete hosted regression suite | 364 passed, 0 failed | Run `38900452989` at `bdebcbb67fd553f3c3f221675ed19f7750e7a35e`; 24 existing datetime deprecation warnings |
| Frontend behavior scripts | 8 passed | Actual application bootstrap, shared form refinement, header navigation, report/dashboard submission, plan gates, quote totals, theme/icon checks and draft/lookup/recycle behavior |
| Focused onboarding, privacy and architecture | 5 passed | Explicit organization Admin membership, ten examples per core module and cross-tenant owner denials |
| Focused retired-plan / privacy checks | 6 passed | After the final owner-plan query change; inactive CRM Plus excluded while Enterprise and tenant privacy remain intact |
| Focused recycle and reserved-Owner checks | 8 passed | Cross-tenant deletion/restore rejected; Admin may delete own recycled records; no actor may transfer Owner membership |
| Python compilation and JavaScript syntax | Passed | App, migrations and all frontend modules |
| Alembic migrations | Passed on hosted PostgreSQL | Head `0033_single_platform_owner_membership`; actual destination staging migration still required |
| Automated browser suite | 22 passed across 11 groups | Hosted Chromium run `38898382031`, including owner security, authentication/accessibility, commercial numbering, workflow builder and the complete CRM journey |
| Dependency and static security audit | Hosted checks passed | Production dependency audit and high-severity Bandit checks passed in run `38898382134`. These are not complete security certification |
| Live health/readiness | HTTP 200 | Database/schema ready at observation time; verify the exact final release revision separately |
| PostgreSQL migration and worker prerequisites | Passed on hosted runner | Standard release workflow plus production-mode container checks |
| Docker images and synthetic restore | Passed | Run `38896866901`: non-root web/worker builds, web readiness, worker prerequisites, PostgreSQL 17 dump/restore, preserved probe row and migration head, restored worker readiness |
| Actual source-data restore and AWS staging | Not verified | No AWS resources created; CI synthetic restoration does not certify customer-data migration or AWS network/TLS configuration |

## Repairs and preserved privacy

Customer CRM records remain private from the platform owner. Ordinary owner CRM requests retain the owner's tenant scope; record checks, searches, reports, exports and AI totals enforce tenant visibility. Owner-console CRM export rejects cross-tenant requests and hides the unavailable action. Administrative account/plan controls and subscription bypass remain available to the configured platform owner.

A real startup regression in the report-editor extraction left three moved helper names in the Setup initialization arguments. Removing the unused dependencies restores initialization. The new bootstrap test imports the actual application script, checks that authenticated API requests and initial-route rendering occur, and confirms the initial loading shell disappears. Component-only tests had missed this dependency wiring error.

Closing an unchanged file-upload form no longer produces a false draft warning. Named selected files and real field edits remain protected. Switching from a core form to a commercial document clears the previous layout actions, preventing duplicate selectors/editor buttons. Owner and automatic number now occupy the first row consistently in Quote, Invoice, Sales Order and Purchase Order forms; numbers remain read-only and entered data is preserved.

Organization founders now have Admin membership. The recycle endpoint previously recognized Owner/Administrator but omitted Admin; it now accepts Admin while retaining tenant and record-access checks. Owner membership cannot be transferred through the API, including by the platform owner, and the transfer control was removed from organization settings. Member and Admin remain the available assignable organization roles.

The owner plan list previously displayed inactive CRM Plus as available. It now returns only active plans; a focused regression adds a retired plan and verifies it is excluded while Enterprise remains available.

Authentication routes were extracted without changing the seven moved function bodies. Backend and frontend size checks pass without changing their limits. Signup-related fixtures now account for ten onboarding examples per core module, explicitly use non-admin roles for restricted-user tests, and preserve denial, conversion, deduplication, quota and cross-tenant assertions. Host-header tests now use a new temporary database rather than reusing a stale database across schema revisions.

## Live desktop verification

Earlier checks opened Lead, Contact, Account, Deal, Task/Meeting/Call, Campaign, Case, Solution, Document and Site Visit forms. After secure owner sign-in, Product, Quote, Sales Order, Purchase Order, Invoice, Payment, Price Book and Vendor forms were inspected. Inspected forms used aligned fields, 42px single-line controls and 100px multiline controls without page-width overflow; commercial layout selectors were 36px header controls. Invoice, Payment and Price Book automatic numbers were confirmed read-only. The Quote item table scrolled within its own container; quantity 2 at rate 100 produced subtotal/grand total 200.

The live pass found the commercial Owner/number ordering discrepancy corrected in this release. Post-deployment verification on release `6d1de243006452809ed45f09020e972ca9f5c218` confirmed Owner and the read-only order number share the first row, with one layout selector and no page overflow. The live available-plan view excludes CRM Plus, and Railway reported a successful deployment with HTTP 200 health/readiness checks. Owner Overview, Plans & Subscriptions and Plan Approval Requests also opened successfully. No financial records or customer CRM data were submitted or changed during this follow-up. Some click/console operations remain restricted by the browser's credential-protection state, so direct form-document navigation was used for inspection. Every button, mobile viewport, role/profile combination, integration and owner-console mutation is not certified.

## Reproduce and cutover gates

Install Python 3.12 development dependencies with `python -m pip install -r requirements-dev.txt` and Node dependencies with `npm ci --ignore-scripts`.

- `npm run test:frontend`
- `python -m pytest -q --ignore-glob='tests/test_browser*' --ignore=tests/test_dashboard_drilldown_browser.py -k 'not test_apex_attention_queue_browser_appearance_and_navigation' --timeout=180`
- On a Chromium-capable runner: `python -m playwright install --with-deps chromium`, then the complete `python -m pytest -q --timeout=180`.
- Run the PostgreSQL CI migration and worker checks against an isolated staging restore. Rehearse backup restoration and final write cutover; preserve the current host/database until staging passes.

Follow `AWS_DEPLOY.md` for ECS Fargate web/worker separation, private RDS, TLS, one-off migration, secrets, backups and rollback. Confirm AWS account, region, domain, budget and downtime window before provisioning.

## Hosted release-gate follow-up

The final complete suite passed all 364 tests in run `38900452989`; the latest independent browser run `38900453334` also passed all eleven groups. The tested application repair was merged as `e372ab52e157aca3429181b71e8276f131761b00`, preserving the concurrent inline authentication-logo change and the runtime CI checks. The only failure in the preceding 363-pass run was an obsolete source assertion requiring the unconditional paid API fetch; actual UI behavior remains covered by the frontend regression.

Hosted browser diagnostics passed all 22 tests across eleven independent groups in run `38898382031`. The run exposed a real Workflow Rules bug: Free organizations could not open basic workflows because the page always fetched Enterprise-only custom functions. Optional function loading now respects the subscription and tolerates permission denial; other failures still surface and backend authorization remains unchanged. Frontend regression coverage checks Free, entitled-but-denied, and server-error cases. Isolated paid-feature browser fixtures now provision their own plan, and CRM journey expectations account for seeded onboarding records and current plan-gate wording.

The independent runtime run `38896866901` passed both Docker builds, non-root configuration, production-mode web readiness, worker prerequisites and a synthetic PostgreSQL 17 backup/restore. It used disposable CI data only. Actual customer-data restoration, legacy-file migration, AWS networking/TLS and final cutover remain unverified.
