# CONVOSIS CRM audit — 15 October 2026

Baseline revision: b4a7b53. Baseline: 324 tests executed, 317 passed, 7 failed in 572 seconds. Ten dedicated browser test files were excluded; an embedded browser test failed because Chromium was unavailable.

## User report

The signed-in demo profile is Sales rep on Free. Earlier live navigation covered 31 sidebar destinations, with paid and administrator pages restricted. This session inspected the Setup directory and inventoried 97 links. Browser transport disconnected during the first settings navigation. No claim is made that all links, buttons or animations were exercised. The four supplied screenshots were inspected successfully.

Known reproducible usability defect: normal record creation requests layout configuration from an administration endpoint. A member with CRM create permission but no layout-management permission is blocked before the create form renders. Layout record-value requests are also classified as layout administration rather than record access. Fix must preserve module restrictions, record ownership, tenant boundaries, and denial of layout edits.

## Tester report

| Failure | Classification |
|---|---|
| Embedded AI queue browser test | Environment: Chromium executable unavailable |
| Converted custom related record absent | Fixture: custom modules now require explicit profile permission; conversion and data preservation assertions pass |
| Module Permissions Setup link | Stale registry expectation: implemented special page not listed in test |
| Security overview for signup account | Stale fixture: signup creates organization owner, which has setup capability |
| Backend layering | Architecture debt: main.py is 350156 bytes versus 320000 budget |
| Frontend layering | Cache-versioned import not recognized; app.js also exceeds 160000-byte budget |
| Plan selection | Stale payment expectation: current behavior requires owner approval and does not activate plan |

## Scope and limits

Automated coverage includes core CRUD, conversion, filtering, tenant/security boundaries, module permissions, sharing, workflows, blueprints, billing, imports, exports and setup contracts. Passing backend tests do not prove UI behavior. Privileged live actions, all paid features, external integrations, all viewport sizes, animation timing and full click coverage remain unverified. No production security settings were changed during testing.

## Developer work

Pending: reproduce ordinary-member layout access failure, apply narrowly scoped record-versus-setup authorization fix, update obsolete test fixtures to current contracts, and rerun affected regressions. Architecture extraction and remaining browser coverage are tracked separately; limits must not be raised just to make tests pass.

## Confirmed defect and fix

**AUDIT-01 — High: ordinary members cannot open CRM create/edit forms.** Reproduced in an isolated tenant with an invited member: layout metadata GET, record-value GET and PUT returned 403 despite normal CRM record access. The frontend awaits the metadata GET before rendering the form.

Fix: classify standard-layout metadata reads and record-value GET/PUT as CRM module operations, while keeping layout mutations behind manage_layouts. The existing route retains record authorization and tenant checks. A regression test verifies metadata/value access succeeds, layout administration remains 403, and a profile denying Leads read still receives 403.

**Retest: 22 passed in 53.25 seconds.** Includes member-form access, Setup mapping, standard-member administration denial, owner-approval billing, custom conversion with explicit module permission, setup capability mapping and sharing security regressions. The new form regression failed before the fix and passed afterward.

## Test corrections, not product fixes

- Add Module Permissions to the Setup special-page contract and verify its actual renderer exists.
- Make the standard-user security fixture a Member instead of an organization Owner. Owner capability behavior is intentional.
- Grant explicit custom-module read access in the conversion fixture. Do not bypass profile restrictions to display converted rows.
- Assert pending owner approval rather than the obsolete requires_payment flag, retaining checks that the active plan remains Free and exactly one request exists.
- Accept a cache-version query on the runtime import. Keep the original file-size limits.

## Remaining findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| AUDIT-02 | Medium | app/main.py exceeds 320000-byte layering budget | Open; requires focused extraction and broader retest |
| AUDIT-03 | Medium | static/js/app.js exceeds 160000-byte layering budget | Open; requires component extraction |
| AUDIT-04 | Coverage blocker | Browser transport disconnected and recovery timed out | Full link/button/animation audit incomplete |
| AUDIT-05 | Coverage blocker | Free Sales rep demo account cannot exercise paid/admin-only flows | Authorized privileged session required for live coverage |
| AUDIT-06 | Environment | Embedded AI queue browser test cannot launch missing Chromium | Not an application failure |

Architecture retest: 2 failed, 1 passed. No limits were increased. The full suite was not repeated after the focused change; the baseline is not presented as a clean post-fix run.

## Coverage evidence

- Automated baseline: 324 executed, 317 passed, 7 failed; 572.17 seconds.
- Post-fix targeted regressions: 22 passed; 53.25 seconds.
- Setup directory: 97 links inventoried from the live DOM, not 97 completed navigation tests.
- Current browser attempt: Setup loaded; first subsequent navigation timed out; browser transport then disconnected.
- Prior session evidence: 31 sidebar destinations visited, basic report open/close, sidebar collapse/expand, search borders and current-stage visibility checked in Day/Night. These are prior observations and do not replace current full coverage.
- Uploaded evidence: four screenshots show dashboard KPIs, sales performance, AI queue, sidebar modules, Setup categories/search, and navigation. Static images establish appearance only, not functionality.
- No production records were deleted, no messages were sent, no subscriptions were approved, and no production security configuration was changed during this audit.

## Release assessment

The confirmed form-access defect has an isolated fix and passing targeted regressions. This is a partial audit, not certification that every option works. Remaining architecture failures, restricted flows and disconnected browser coverage prevent a zero-issue conclusion.
