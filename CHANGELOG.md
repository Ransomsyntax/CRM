# Changelog

## [0.2.1.0] - 2026-10-11

### Security

- Keep authentication credentials in POST bodies if page JavaScript is unavailable.
- Validate post-login return paths after URL normalization so they cannot redirect to another origin.
- Replace blanket inline-script permission with SHA-256 hashes of shipped scripts; bind Owner Console actions with event listeners so customer details work under the stricter policy.
- Hide application and migration revisions from public readiness responses. Release checks use the shared `READINESS_EVIDENCE_TOKEN`; readiness responses are not cached, and malformed token values do not interrupt health probes.

### Fixed

- Restore task headings and descriptions on sign-up and password-recovery pages.
- Add mode-specific required fields, accessible password visibility controls, clearer field borders and text, larger link targets, and a shorter mobile introduction.
- Remove the duplicated account-creation link and technical hashing copy from sign-in.
- Preserve customer-button focus when asynchronous Owner Console list refreshes replace rows, including focus restoration after closing a customer drawer.
- Make browser tests reliable on Windows with shared temporary database locations, discarded server output, and navigation assertions independent of external asset completion. Read JavaScript test fixtures explicitly as UTF-8.

### Deployment

- Wire the readiness token through all production verification workflows and document the matching Railway/GitHub secret requirement.

## [0.2.0.0] - 2026-10-05

### Added

- Expanded Setup to the full master taxonomy: General, Security Control, Channels, Customization, Automation, Process Management, Experience Center, Data Administration, Marketplace, Developer Hub, Apex and CPQ.
- Added 50+ persisted enterprise configuration surfaces including SAML metadata, security policies, telephony, messaging, webforms, portals, wizards, page designer, cadences, review processes, connected workflows, signals, segmentation, backup/storage, sandbox, marketplace, OAuth clients, Circuits, StyleUI and the complete Apex settings family.
- Added Search Setup and Customize Setup with persistent visibility preferences.
- Added List, Pipeline, Grid, Split, Chart and Timeline module view modes where applicable.
- Added operational Setup search, storage reporting, configuration backup export, webform record submission and Marketplace lifecycle endpoints.
- Added master Setup catalog regression tests.

### Verified

- Python modules compile successfully.
- Browser JavaScript passes syntax validation.
- Automated test suite passes 25/25 tests.
- No user-visible Zia branding remains in the repository sources.

### Integration boundaries

- External mail, telephony, messaging, SAML/AD and third-party AI execution require real provider credentials/endpoints. CONVOSIS CRM now manages their configuration and connection references without exposing secrets or pretending an unconfigured provider action succeeded.

## [0.1.0.0] - 2026-10-01

### Added

- Added functional CRM modules for activities, inventory and sales, marketing, service, documents, forecasts, reports and dashboards.
- Added the complete Setup directory for general administration, security, customization, automation, templates, data administration and developer settings.
- Added extensible platform records with ownership, audit metadata, relationships, filtering, sorting, archiving, recycle-bin restoration and duplicate scanning.
- Added configurable workflow and assignment foundations, role/profile/permission records, pipelines, custom views, templates, API settings, webhooks and integrations.
- Added CSV import/export foundations, audit history and a second database migration for platform records, audit events and import jobs.
- Added contract coverage for expanded CRUD, activity subtypes, lead conversion, related records, automation execution, profile email persistence and recycle/restore.

### Changed

- Expanded the existing CONVOSIS CRM navigation while retaining its branding, responsive theme and latest workspace styling.
- Strengthened lead conversion so retries reuse the existing account, contact and conversion deal instead of creating duplicates.
- Refactored reusable module definitions into a central platform catalog and added dialect-safe database engine configuration.
- Updated the service worker and route manifest for the expanded application.

### Fixed

- Preserved Railway and Render readiness behavior, trusted-host boundaries and deployment-only files while replacing the application source.
- Allowed decimal values in numeric CRM fields and lead-conversion deal amounts.
