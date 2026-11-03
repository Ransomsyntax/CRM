# APEX across CONVOSIS CRM

Open **AI actions** in the module heading, or use the top-bar APEX icon on screens without a module heading. The current module is selected automatically. On a record page, enable record focus; otherwise select a module or all permitted modules.

## What the integration does

- Uses the existing connected provider, model, API endpoint and credentials. No second AI account is introduced.
- Reads every visible record in keyset pages of 30. Related context includes permitted parent records and up to ten recent activities and emails per source. Each page consumes one plan-counted AI request, including failed provider calls.
- Analyzes saved report output using the existing report engine and its configured row limits. Document records provide metadata, not OCR or extraction of uploaded file contents.
- Produces evidence-grounded answers, opportunities, risks, and exact action proposals. Up to 100 action proposals are retained per run; refine the scope if more are required. Result summaries retain the last 30 page answers and up to 50 opportunities and risks. Coverage identifies complete and interrupted scopes.
- Supports validated record creation and updates, follow-up tasks/calls/meetings, email drafts, approved email sending and saved-report execution. Existing CRM handlers still enforce field rules, record limits, blueprints, validation and business automation.
- Keeps access-changing and executable integration configuration as guided recommendations through the dedicated administration controls.

## Plans and permissions

Analysis requires APEX (Standard or higher under the current catalog). Executing actions and creating recurring runs require AI Agents (Professional or Enterprise). Individual modules and email features retain their own plan restrictions. The platform owner retains the application’s existing plan exemption, which does not expand tenant-record visibility.

Every read and action checks the initiating user’s organization, active status, profile, module and field rights, sharing and role hierarchy. AI history is private to that user. Changes to security configuration invalidate previously generated results. Record-access revocation blocks history and action replay. Credentials and server-managed identity fields are excluded from AI actions.

## Recurring work

Enter instructions, expand **Recurring analysis and automation**, choose hourly, daily or weekly, and explicitly select automatic tasks, drafts or sends. With no automatic action types selected, the run performs analysis and saves proposals only. Other record mutations always remain proposals. Use **Pause** to stop recurring runs. The policy runs as its creator, and every execution rechecks current permissions and plan entitlements.

Customer email addresses come from permitted CRM source records and links. Opt-outs are honored when stored on the record. Multiple proposed sends require mass-email rights. Tasks and customer-contact actions have a 72-hour duplicate cooldown. Uncertain sends are marked for review and never automatically replayed. SMTP configuration alone is not proof of successful mail delivery.

## Operations

The additive migration is `0036_module_ai`, following `0035_subscription_permissions`. It adds durable job, operation and automation tables. The application runs a background agent worker in production; `YASHCRM_MODULE_AI_WORKER=true` also enables it in development, and `false` disables it. No recurring business automation is enabled merely by deploying the code.

Queued work is durable. A claimed job or external action is not replayed after a crash; interrupted results remain available for review. Actions and policy changes are audited, and completed analyses create a notification for their designated user.

## Module map

All entries below expose the same permission-bound AI panel. Custom modules are discovered from their active metadata and use their own field schema. Actual options depend on the user’s profile and plan.

| Module | AI use | Execution |
|---|---|---|
| Leads | Qualify and prioritize prospects; Find overdue follow-ups; Draft outreach and schedule next steps | Validated proposals; permitted follow-ups can be automated |
| Contacts | Summarize relationship history; Find inactive relationships; Personalize follow-ups | Validated proposals; permitted follow-ups can be automated |
| Accounts | Find expansion opportunities; Review customer health; Coordinate account follow-ups | Validated proposals; permitted follow-ups can be automated |
| Deals | Find stalled opportunities; Review pipeline and close dates; Plan next sales actions | Validated proposals; permitted follow-ups can be automated |
| Products | Review stock and product data; Find catalog gaps; Suggest replenishment actions | Validated proposals; permitted follow-ups can be automated |
| Notes | Summarize Notes records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| Attachments | Summarize Attachments records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| Emails | Summarize correspondence; Draft contextual replies; Find unanswered conversations | Validated proposals; permitted follow-ups can be automated |
| Activities | Prioritize overdue work; Prepare calls and meetings; Create follow-up tasks | Validated proposals; permitted follow-ups can be automated |
| Users | Summarize Users records; Identify data gaps and next steps; Prepare contextual actions | Guidance through dedicated controls |
| Approval Processes | Summarize Approval Processes records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| Blueprints | Summarize Blueprints records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| Price Books | Summarize Price Books records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| Vendors | Summarize Vendors records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| Quotes | Review expiring quotations; Draft quotation follow-ups; Find missing commercial details | Validated proposals; permitted follow-ups can be automated |
| Sales Orders | Review pending orders; Identify delivery risks; Coordinate customer updates | Validated proposals; permitted follow-ups can be automated |
| Purchase Orders | Identify procurement delays; Review purchase commitments; Prepare supplier follow-ups | Validated proposals; permitted follow-ups can be automated |
| Invoices | Identify overdue invoices; Review collection priorities; Prepare payment reminders | Validated proposals; permitted follow-ups can be automated |
| Payments | Review recorded collections; Find reconciliation gaps; Suggest collection next steps | Validated proposals; permitted follow-ups can be automated |
| Site Visits | Prepare visit briefs; Identify missed visits; Create post-visit follow-ups | Validated proposals; permitted follow-ups can be automated |
| Sales Targets | Explain Sales Targets records; Identify target and performance gaps; Recommend evidence-based next steps | Validated proposals; permitted follow-ups can be automated |
| Campaigns | Review campaign records; Find follow-up opportunities; Draft campaign tasks | Validated proposals; permitted follow-ups can be automated |
| Cases | Prioritize unresolved cases; Suggest resolution steps; Prepare customer updates | Validated proposals; permitted follow-ups can be automated |
| Solutions | Find knowledge gaps; Summarize solutions; Draft knowledge improvements | Validated proposals; permitted follow-ups can be automated |
| Documents | Summarize Documents records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| Forecasts | Review forecast gaps; Compare commitments and targets; Identify pipeline risks | Validated proposals; permitted follow-ups can be automated |
| Reports | Explain saved reports; Find business risks and opportunities; Run permitted report definitions | Validated proposals; permitted follow-ups can be automated |
| Dashboards | Explain dashboard definitions; Identify missing KPIs; Suggest management actions | Validated proposals; permitted follow-ups can be automated |
| Company Details | Review Company Details settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Fiscal Year | Review Fiscal Year settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Roles | Explain Roles and access effects; Review hierarchy and permission gaps; Prepare administration recommendations | Guidance through dedicated controls |
| Profiles | Explain Profiles and access effects; Review hierarchy and permission gaps; Prepare administration recommendations | Guidance through dedicated controls |
| Permissions | Explain Permissions and access effects; Review hierarchy and permission gaps; Prepare administration recommendations | Guidance through dedicated controls |
| Sharing Rules | Explain Sharing Rules and access effects; Review hierarchy and permission gaps; Prepare administration recommendations | Guidance through dedicated controls |
| Modules | Explain Modules configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Fields | Explain Fields configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Layouts | Explain Layouts configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Pipelines | Explain Pipelines configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Validation Rules | Explain Validation Rules configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Custom Views | Explain Custom Views configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Workflow Rules | Review Workflow Rules and workflow conditions; Identify missing triggers or actions; Suggest a business-flow configuration | Validated proposals; permitted follow-ups can be automated |
| Assignment Rules | Review Assignment Rules and workflow conditions; Identify missing triggers or actions; Suggest a business-flow configuration | Validated proposals; permitted follow-ups can be automated |
| Scoring Rules | Review Scoring Rules and workflow conditions; Identify missing triggers or actions; Suggest a business-flow configuration | Validated proposals; permitted follow-ups can be automated |
| Schedules | Review Schedules and workflow conditions; Identify missing triggers or actions; Suggest a business-flow configuration | Validated proposals; permitted follow-ups can be automated |
| Webhooks | Review Webhooks and workflow conditions; Identify missing triggers or actions; Suggest a business-flow configuration | Guidance through dedicated controls |
| Email Templates | Review Email Templates content; Draft customer-ready copy; Find missing business information | Validated proposals; permitted follow-ups can be automated |
| Quote Templates | Review Quote Templates content; Draft customer-ready copy; Find missing business information | Validated proposals; permitted follow-ups can be automated |
| Invoice Templates | Review Invoice Templates content; Draft customer-ready copy; Find missing business information | Validated proposals; permitted follow-ups can be automated |
| API | Explain API configuration; Identify integration and schema gaps; Prepare implementation recommendations | Validated proposals; permitted follow-ups can be automated |
| Integration Settings | Explain Integration Settings configuration; Identify integration and schema gaps; Prepare implementation recommendations | Validated proposals; permitted follow-ups can be automated |
| MCP Servers | Explain MCP Servers configuration; Identify integration and schema gaps; Prepare implementation recommendations | Guidance through dedicated controls |
| MCP Tools | Explain MCP Tools configuration; Identify integration and schema gaps; Prepare implementation recommendations | Guidance through dedicated controls |
| API Versions | Explain API Versions configuration; Identify integration and schema gaps; Prepare implementation recommendations | Validated proposals; permitted follow-ups can be automated |
| Connections | Explain Connections configuration; Identify integration and schema gaps; Prepare implementation recommendations | Guidance through dedicated controls |
| Variables | Explain Variables configuration; Identify integration and schema gaps; Prepare implementation recommendations | Validated proposals; permitted follow-ups can be automated |
| Functions | Explain Functions configuration; Identify integration and schema gaps; Prepare implementation recommendations | Guidance through dedicated controls |
| Widgets | Explain Widgets configuration; Identify integration and schema gaps; Prepare implementation recommendations | Guidance through dedicated controls |
| Data Model | Explain Data Model configuration; Identify integration and schema gaps; Prepare implementation recommendations | Validated proposals; permitted follow-ups can be automated |
| Queries | Explain Queries configuration; Identify integration and schema gaps; Prepare implementation recommendations | Validated proposals; permitted follow-ups can be automated |
| Client Scripts | Explain Client Scripts configuration; Identify integration and schema gaps; Prepare implementation recommendations | Guidance through dedicated controls |
| Developer Solutions | Explain Developer Solutions configuration; Identify integration and schema gaps; Prepare implementation recommendations | Validated proposals; permitted follow-ups can be automated |
| Product Configurator | Review Product Configurator and commercial rules; Find inconsistent product or pricing data; Recommend sales configuration improvements | Validated proposals; permitted follow-ups can be automated |
| Price Rules | Review Price Rules and commercial rules; Find inconsistent product or pricing data; Recommend sales configuration improvements | Validated proposals; permitted follow-ups can be automated |
| Guided Selling | Review Guided Selling and commercial rules; Find inconsistent product or pricing data; Recommend sales configuration improvements | Validated proposals; permitted follow-ups can be automated |
| Personal Settings | Review Personal Settings settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Calendar Booking | Review Calendar Booking settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Motivator | Review Motivator settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Agents | Review Agents settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Business Hours | Review Business Hours settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Shifts | Review Shifts settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Holidays | Review Holidays settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Currencies | Review Currencies settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Calendar Settings | Review Calendar Settings settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |
| Email / Mail Users | Review Email / Mail Users configuration; Identify incomplete access controls; Prepare administration recommendations | Validated proposals; permitted follow-ups can be automated |
| Compliance Settings | Review Compliance Settings configuration; Identify incomplete access controls; Prepare administration recommendations | Validated proposals; permitted follow-ups can be automated |
| Territory Management | Review Territory Management configuration; Identify incomplete access controls; Prepare administration recommendations | Validated proposals; permitted follow-ups can be automated |
| Trusted Domain | Review Trusted Domain configuration; Identify incomplete access controls; Prepare administration recommendations | Validated proposals; permitted follow-ups can be automated |
| Support Access | Review Support Access configuration; Identify incomplete access controls; Prepare administration recommendations | Validated proposals; permitted follow-ups can be automated |
| Single Sign-On (SAML) | Review Single Sign-On (SAML) configuration; Identify incomplete access controls; Prepare administration recommendations | Validated proposals; permitted follow-ups can be automated |
| Security Policies | Review Security Policies configuration; Identify incomplete access controls; Prepare administration recommendations | Validated proposals; permitted follow-ups can be automated |
| Active Directory Sync | Review Active Directory Sync configuration; Identify incomplete access controls; Prepare administration recommendations | Validated proposals; permitted follow-ups can be automated |
| Login History | Review Login History configuration; Identify incomplete access controls; Prepare administration recommendations | Validated proposals; permitted follow-ups can be automated |
| Email | Review Email and customer communication settings; Identify missing channel configuration; Prepare contextual follow-up recommendations | Validated proposals; permitted follow-ups can be automated |
| Telephony | Review Telephony and customer communication settings; Identify missing channel configuration; Prepare contextual follow-up recommendations | Validated proposals; permitted follow-ups can be automated |
| Business Messaging | Review Business Messaging and customer communication settings; Identify missing channel configuration; Prepare contextual follow-up recommendations | Validated proposals; permitted follow-ups can be automated |
| Notification SMS | Review Notification SMS and customer communication settings; Identify missing channel configuration; Prepare contextual follow-up recommendations | Validated proposals; permitted follow-ups can be automated |
| Webforms | Review Webforms and customer communication settings; Identify missing channel configuration; Prepare contextual follow-up recommendations | Validated proposals; permitted follow-ups can be automated |
| Social | Review Social and customer communication settings; Identify missing channel configuration; Prepare contextual follow-up recommendations | Validated proposals; permitted follow-ups can be automated |
| Chat | Review Chat and customer communication settings; Identify missing channel configuration; Prepare contextual follow-up recommendations | Validated proposals; permitted follow-ups can be automated |
| Portals | Review Portals and customer communication settings; Identify missing channel configuration; Prepare contextual follow-up recommendations | Validated proposals; permitted follow-ups can be automated |
| Wizards | Explain Wizards configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Kiosk Process Builder | Explain Kiosk Process Builder configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Page Designer | Explain Page Designer configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Customize Home Page | Explain Customize Home Page configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Translations | Explain Translations configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Templates | Explain Templates configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Teamspace | Explain Teamspace configuration; Identify missing fields or layout information; Suggest a clearer workflow | Validated proposals; permitted follow-ups can be automated |
| Actions | Review Actions and workflow conditions; Identify missing triggers or actions; Suggest a business-flow configuration | Validated proposals; permitted follow-ups can be automated |
| Cadences | Review Cadences and workflow conditions; Identify missing triggers or actions; Suggest a business-flow configuration | Validated proposals; permitted follow-ups can be automated |
| Review Processes | Explain Review Processes stages and requirements; Find blocked process steps; Suggest process improvements | Validated proposals; permitted follow-ups can be automated |
| Connected Workflow | Explain Connected Workflow stages and requirements; Find blocked process steps; Suggest process improvements | Validated proposals; permitted follow-ups can be automated |
| Signals | Summarize Signals records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| CommandCenter | Summarize CommandCenter records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| Segmentation | Summarize Segmentation records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| Data Backup | Review Data Backup metadata; Identify incomplete data administration settings; Prepare data quality recommendations | Validated proposals; permitted follow-ups can be automated |
| Storage | Review Storage metadata; Identify incomplete data administration settings; Prepare data quality recommendations | Validated proposals; permitted follow-ups can be automated |
| Sandbox | Review Sandbox metadata; Identify incomplete data administration settings; Prepare data quality recommendations | Validated proposals; permitted follow-ups can be automated |
| Copy Customization | Review Copy Customization metadata; Identify incomplete data administration settings; Prepare data quality recommendations | Validated proposals; permitted follow-ups can be automated |
| Data Quality | Review Data Quality metadata; Identify incomplete data administration settings; Prepare data quality recommendations | Validated proposals; permitted follow-ups can be automated |
| Migration | Review Migration metadata; Identify incomplete data administration settings; Prepare data quality recommendations | Validated proposals; permitted follow-ups can be automated |
| Marketplace | Summarize Marketplace records; Identify data gaps and next steps; Prepare contextual actions | Validated proposals; permitted follow-ups can be automated |
| OAuth Clients | Explain OAuth Clients configuration; Identify integration and schema gaps; Prepare implementation recommendations | Guidance through dedicated controls |
| API Usage | Explain API Usage configuration; Identify integration and schema gaps; Prepare implementation recommendations | Validated proposals; permitted follow-ups can be automated |
| Circuits | Explain Circuits configuration; Identify integration and schema gaps; Prepare implementation recommendations | Guidance through dedicated controls |
| StyleUI | Explain StyleUI configuration; Identify integration and schema gaps; Prepare implementation recommendations | Validated proposals; permitted follow-ups can be automated |
| Apex Agents | Review Apex Agents and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Data Enrichment | Review Data Enrichment and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Prediction | Review Prediction and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Recommendation | Review Recommendation and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Communication | Review Communication and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Vision | Review Vision and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Notifications | Review Notifications and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Voice of the Customer | Review Voice of the Customer and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Models | Review Models and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Presentation | Review Presentation and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Custom AI Studio | Review Custom AI Studio and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Competitors | Review Competitors and AI capabilities; Identify missing data or configuration; Recommend permission-aware AI use | Validated proposals; permitted follow-ups can be automated |
| Customize Setup | Review Customize Setup settings; Find incomplete business configuration; Recommend operational improvements | Validated proposals; permitted follow-ups can be automated |


### Module task controls and deletion

Each module heading exposes one AI actions button, with module-specific suggestions and permitted create/update/delete shortcuts. The top-bar entry is a fallback on screens without a module heading and is hidden when a module button is present.

Users can explicitly request deletion, review each proposed target, and confirm a single deletion or select multiple proposals and choose Delete selected records (up to 100). Single deletion requires Delete permission; selected deletion also requires Mass Delete for every affected module. Every target is checked against current record visibility, source version, plan and profile restrictions before execution. Existing module archive handlers move records to the recycle bin and preserve their audit and business side effects. Deletion is never a recurring automatic action. Batch results are per action; a later runtime failure does not roll back already completed actions. Security and executable configuration modules remain guidance-only.


### Cross-module actions in the source page

Ask AI on the dashboard and AI actions on module pages open the same in-page panel. Record pages focus the current record; module lists use up to 100 explicitly selected records. Removing focus analyzes the selected module. Every request checks the source selection again on the server.

APEX receives permitted destination field schemas and current linked records, so a source record can lead to a create/update/delete proposal in another module. Tasks, calls and meetings are linked Activities with their respective types; site_visit actions create Site Visits using the source lead/contact/account/deal or its permitted customer links. Required dates and field values must be supplied. Current destination permissions, plan, field restrictions and native module validation are rechecked at execution.

The panel shows destination previews, execution results and report results without navigating away. The next request in the same panel may reference records created or changed by its preceding completed actions. Those records are fetched fresh and checked against current access; up to 30 recent action records are retained as context. Linked discovery includes permitted parent references, up to 30 reverse core links, up to 30 reverse platform/custom links, and 10 recent activities/emails per source. These are related context, not an unlimited related-record scan. Select a module directly for its full permitted paged scan. Saved reports retain their existing row limit. Changes to security or executable configuration still use dedicated administration controls.
