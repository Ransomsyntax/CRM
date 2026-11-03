import { confirmDialog,promptDialog } from "../core/dialogs.js?v=20261027-centered-popups-v1";
import { createEnterpriseRuntime } from "./enterprise-runtime.js?v=20261029-runtime-v1";
// Setup, customization, metadata-builder, security, CPQ and developer UI domain.
// Dependencies are injected to keep this feature independent from the SPA entrypoint.
export function createSetupFeature(ctx) {
  const enterpriseRuntime = createEnterpriseRuntime({...ctx,confirmDialog});
  const { state, PLATFORM_MODULE_ROUTES, MODULES, $, $$, esc, titleCase, initials, formatDate, formatDateTime, formatMoney, slug, pathFor, badge, lookupName, api, toast, setBreadcrumb, activeNav, enhanceNavigation, pricingView, bindPricing, pageHeader, loading, emptyState, ensureLookups, ensurePlatformLookup, invalidateLookups, refreshMeta, ensurePlatformCatalog, ensureCustomModules, enhanceCustomModuleNavigation, greeting, applyProfile, refreshNavCount, navigate, renderRoute, teamspacesView, bindTeamspaces, dashboardView, reportEngineView, dashboardBuilderView, bindReportDashboard, performanceTable, attentionQueue, activityItem, bindDashboard, moduleView, activityTypeView, platformState, platformTable, platformDisplay, platformPanel, platformModuleView, tableView, kanbanView, gridView, splitView, chartView, timelineModuleView, pagination, dataIds, bulkArchiveLeads, bindModule, detailView, detailFields, relatedNavigation, relatedPlainRow, relatedPlainSection, relatedContent, dealProgress, bindDetail, fieldHtml, openRecordModal, openPlatformModal, settingsResourceConfig, readForm, submitRecord, submitPlatformRecord, submitConvert, closeModal, closeConfirm, confirmAction, deleteRecord, deletePlatformRecord, bindPlatform, bindGlobal, settingsView, myProfileView, profileUsersView, approvalSettingsView, blueprintSettingsView } = ctx;

  function setupDirectory(active) {
    let hiddenGroups = []; let hiddenItems = [];
    try { hiddenGroups = JSON.parse(localStorage.getItem('yash.setup.hidden_groups') || '[]'); hiddenItems = JSON.parse(localStorage.getItem('yash.setup.hidden_items') || '[]'); } catch (_) {}
    const isAdmin = String(state.profile?.role || "").toLowerCase() === "administrator" || state.profile?.owner_console_access === true;
    const groups = Object.entries(state.platformCatalog.setup_navigation || {}).filter(([group]) => !hiddenGroups.includes(group));
    return `<section class="card settings-nav"><div class="setup-quick-actions"><a href="/settings/general" class="${active === 'company_details' ? 'active' : ''}">General Settings</a><a href="/settings/organization" class="${active === 'organization' ? 'active' : ''}">Organization</a><a href="/setup/search_setup" class="${active === "search_setup" ? "active" : ""}">Search Setup</a><a href="/setup/custom_modules" class="${active === "custom_modules" ? "active" : ""}">Modules and Fields</a></div>${groups.map(([group, links]) => `<div data-setup-group="${esc(group)}"><span class="eyebrow setup-directory-group">${esc(group)}</span>${links.filter(([resource]) => !hiddenItems.includes(resource) && (isAdmin || !["users", "roles", "profiles", "permissions", "sharing_rules", "audit_log"].includes(resource))).map(([resource, label]) => resource === "company_details" ? `<details class="company-settings-nav" ${["company_details","fiscal_years","business_hours","shifts","holidays","currencies","calendar_settings"].includes(active) ? "open" : ""}><summary><a href="/setup/company_details" class="${active === "company_details" ? "active" : ""}">Company Settings</a></summary><div class="company-settings-children">${[["fiscal_years","Fiscal Year"],["business_hours","Business Hours"],["shifts","Shifts"],["holidays","Holidays"],["currencies","Currencies"],["calendar_settings","Calendar Settings"]].filter(([id]) => !hiddenItems.includes(id)).map(([id,name]) => `<a href="/setup/${id}" class="${active === id ? "active" : ""}">${esc(name)}</a>`).join("")}</div></details>` : `<a href="/setup/${resource}" class="${active === resource ? "active" : ""}">${esc(label)}</a>`).join("")}</div>`).join("")}</section>`;
  }
  
  function setupSearchView() {
    const groups = {...(state.platformCatalog.setup_navigation || {})};
    groups["Company Settings"] = [["fiscal_years","Fiscal Year"],["business_hours","Business Hours"],["shifts","Shifts"],["holidays","Holidays"],["currencies","Currencies"],["calendar_settings","Calendar Settings"]];
    const cards = Object.entries(groups).map(([group, links]) => `<section class="card settings-section setup-search-group" data-search-group="${esc(group.toLowerCase())}"><div class="settings-section-head"><h2>${esc(group)}</h2><p>${links.length} configuration surface${links.length === 1 ? "" : "s"}</p></div><div class="setup-search-links">${links.map(([resource,label]) => `<a class="rule-row setup-search-item" href="/setup/${resource}" data-search-text="${esc(`${group} ${label} ${resource}`.toLowerCase())}"><span class="related-dot">›</span><div class="rule-info"><strong>${esc(label)}</strong><small>${esc(resource)}</small></div><span class="table-action">Open</span></a>`).join("")}</div></section>`).join("");
    return `<section class="card settings-section"><div class="settings-section-head"><h2>Search Setup</h2><p>Search every registered CONVOSIS CRM setup option.</p></div><label class="toolbar-search setup-global-search"><span>⌕</span><input data-setup-search-input placeholder="Search settings, channels, security, Apex, developer tools…" autofocus /></label><p class="related-empty" data-setup-search-count>Type to filter ${Object.values(groups).flat().length} setup options.</p></section><div data-setup-search-results>${cards}</div>`;
  }
  
  async function customizeSetupView() {
    let record = null;
    try { const data = await api('/api/platform/setup_preferences?limit=1'); record = data.items?.[0] || null; } catch (_) {}
    const hiddenGroups = new Set(record?.hidden_groups || []);
    const hiddenItems = new Set(record?.hidden_items || []);
    const rows = Object.entries(state.platformCatalog.setup_navigation || {}).map(([group, links]) => `<section class="card settings-section"><div class="settings-section-head settings-heading-row"><div><h2>${esc(group)}</h2><p>Show or hide this group and its items without deleting configuration.</p></div><label class="setup-check"><input type="checkbox" data-setup-group-visible="${esc(group)}" ${hiddenGroups.has(group) ? '' : 'checked'} /> Visible</label></div>${links.map(([resource,label]) => `<label class="rule-row setup-toggle-row"><span class="related-dot">◈</span><div class="rule-info"><strong>${esc(label)}</strong><small>${esc(resource)}</small></div><input type="checkbox" data-setup-item-visible="${esc(resource)}" ${hiddenItems.has(resource) ? '' : 'checked'} /></label>`).join('')}</section>`).join('');
    return `<section class="foundation-note">Customize Setup changes navigation visibility only. Existing configuration and records are preserved.</section><form data-customize-setup-form data-pref-id="${record?.id || ''}">${rows}<div class="form-actions"><button class="button button-primary" type="submit">Save Setup Navigation</button></div></form>`;
  }
  
  async function auditView() {
    const data = await api("/api/audit?limit=100");
    return `<section class="card settings-section"><div class="settings-section-head"><h2>Audit history</h2><p>Immutable application events for record, configuration and automation changes.</p></div>${data.items.length ? data.items.map((item) => `<div class="audit-row"><small>${formatDateTime(item.occurred_at)}</small>${badge(titleCase(item.action))}<div><strong>${esc(item.summary)}</strong><small>${esc(titleCase(item.resource))}${item.record_id ? ` · #${item.record_id}` : ""}</small></div></div>`).join("") : emptyState("A", "No audit events yet", "Changes made after this upgrade will appear here.")}</section>`;
  }
  
  async function recycleBinView() {
    const data = await api("/api/administration/recycle-bin");
    return `<section class="card settings-section"><div class="settings-section-head"><h2>Recycle Bin</h2><p>Deleted records are retained for 30 days. Restore before expiry. Owner-only permanent deletion cannot be undone.</p></div>
    <div class="form-actions"><button class="button button-small" data-recycle-restore-selected disabled>Restore selected</button><button class="button button-small" data-recycle-permanent-selected disabled>Permanently delete selected</button><button class="button button-small" data-recycle-purge-expired>Clean up expired records</button></div>
    ${data.items.length ? `<label><input type="checkbox" data-recycle-select-all/> Select all displayed</label>` + data.items.map(item=>`<div class="rule-row"><label><input type="checkbox" data-recycle-select data-resource="${esc(item.resource)}" data-id="${Number(item.id)}" /> </label><div class="rule-info"><strong>${esc(item.name)}</strong><small>${esc(titleCase(item.resource))} · #${item.id} · Deleted: ${esc(item.archived_at || "—")} · Expires after 30 days</small></div><button class="button button-small button-ghost" data-restore-resource="${esc(item.resource)}" data-id="${item.id}">Restore</button><button class="button button-small" data-recycle-permanent data-resource="${esc(item.resource)}" data-id="${item.id}">Delete permanently</button></div>`).join("") : emptyState("R", "Recycle bin is empty", "Deleted records will appear here.")}</section>`;
  }
  
  function importView() {
    const choices = ["leads", "deals", "accounts", "contacts"];
    return `<section class="card settings-section"><div class="settings-section-head"><h2>Import</h2><p>Choose a CRM module, then upload CSV, XLS, XLSX or VCF files and map the required Phone Number field.</p></div>
      <form data-setup-import-selector>
        <div class="form-grid"><div class="field"><label for="setup-import-module">Module</label>
          <select class="field-select" id="setup-import-module" name="resource" required>
            ${choices.map(resource=>`<option value="${resource}">${esc(MODULES[resource].label)}</option>`).join("")}
          </select>
        </div></div>
        <div class="form-actions"><button class="button button-primary" type="submit">Import records</button></div>
      </form>
      <div class="form-actions"><a class="button button-ghost" href="/setup/import_history">View Import History</a><a class="button button-ghost" href="/setup/export">Export Records</a><a class="button button-ghost" href="/setup/recycle_bin">Recycle Bin</a></div>
      </section>`;
  }

  async function importHistoryView() {
    const data = await api("/api/import-jobs");
    return `<section class="card settings-section"><div class="settings-section-head"><h2>Import History</h2><p>Review completed imports, skipped rows and row-level errors.</p></div>
    <div class="form-actions"><a class="button button-ghost" href="/setup/import">New Import</a></div>
    ${data.items?.length ? data.items.map(item=>`<div class="rule-row"><div class="rule-info"><strong>${esc(titleCase(item.resource))} Imported — ${esc(item.filename)}</strong>
    <small>${esc(item.created_at)} · ${esc(item.status)} · ${item.imported_rows}/${item.total_rows} created or updated · ${item.error_rows} errors</small>
    ${item.errors?.length ? `<details><summary>View errors</summary>${item.errors.map(error=>`<div>Row ${Number(error.row)}: ${esc(error.error)}</div>`).join("")}</details>` : ""}</div></div>`).join("") : emptyState("▤","No imports yet","Start an import from Leads, Deals, Accounts or Contacts.")}</section>`;
  }

    function exportView() {
    const resources = [...Object.keys(MODULES), ...Object.keys(state.platformCatalog.resources)];
    return `<section class="card settings-section"><div class="settings-section-head"><h2>Export</h2><p>Download active records as UTF-8 CSV for analysis or backup.</p></div><div class="setup-directory">${resources.map((resource) => `<a class="button button-ghost" href="/api/export/${resource}.csv" download>${esc(MODULES[resource]?.label || state.platformCatalog.resources[resource]?.label || titleCase(resource))}</a>`).join("")}</div></section>`;
  }
  
  function duplicateView() {
    return `<section class="card settings-section"><div class="settings-section-head"><h2>Duplicate Management</h2><p>Scan platform modules by normalized name, or leads, contacts and users by email.</p></div><form data-duplicate-form><div class="form-grid"><div class="field"><label>Module</label><select class="field-select" name="resource"><option>leads</option><option>contacts</option><option>users</option>${Object.keys(state.platformCatalog.resources).map((key) => `<option>${key}</option>`).join("")}</select></div></div><div class="form-actions"><button class="button button-primary" type="submit">Scan for duplicates</button></div></form><div data-duplicate-results></div></section>`;
  }
  
  async function workflowRulesView() {
    const [rules, executions] = await Promise.all([platformPanel("workflow_rules", true), api("/api/automation/executions?limit=100")]);
    const rows = executions.items.length ? executions.items.map((item) => `<div class="rule-row"><span class="related-dot">${item.status === "completed" ? "✓" : item.status === "queued" ? "◷" : "!"}</span><div class="rule-info"><strong>Execution #${item.id} · ${esc(item.resource)} #${item.record_id}</strong><small>${esc(item.event)} · ${esc(item.status)} · ${item.scheduled_for ? `scheduled ${formatDateTime(item.scheduled_for)}` : formatDateTime(item.created_at)}</small></div>${badge(titleCase(item.status))}${item.status === "queued" ? `<button class="button button-small button-ghost" data-run-workflow="${item.id}">Run now</button>` : ""}</div>`).join("") : emptyState("◷", "No workflow executions yet", "Create a rule and trigger it from a CRM record.");
    return `${rules}<section class="card settings-section"><div class="settings-section-head"><h2>Execution history</h2><p>Every workflow run is idempotent, auditable, and queued when external delivery is required.</p></div>${rows}</section>`;
  }
  
  async function securityAdminView() {
    const data = await api("/api/security/overview");
    const configCard = (title, resource, items, description) => `<section class="card settings-section"><div class="settings-section-head settings-heading-row"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div><button class="button button-primary button-small" data-platform-create="${resource}">＋ Add</button></div>${items.length ? items.map((item) => `<div class="rule-row"><span class="related-dot">◈</span><div class="rule-info"><strong>${esc(item.name)}</strong><small>${esc(item.data_scope || item.module || item.status || "Configured")} · updated ${formatDateTime(item.updated_at)}</small></div>${badge(item.status || "Active")}<a class="table-action" href="/setup/${resource}">›</a></div>`).join("") : `<p class="related-empty">No ${title.toLowerCase()} configured yet.</p>`}</section>`;
    const audit = data.audit.length ? `<div class="audit-list">${data.audit.map((item) => `<div class="audit-row"><small>${formatDateTime(item.occurred_at)}</small>${badge(titleCase(item.action))}<div><strong>${esc(item.summary)}</strong><small>${esc(item.resource)}${item.record_id ? ` · #${item.record_id}` : ""}</small></div></div>`).join("")}</div>` : emptyState("A", "No audit events", "Security and configuration changes will appear here.");
    const fieldSecurity = data.field_security.length ? data.field_security.map((module) => `<div class="rule-row"><span class="related-dot">ƒ</span><div class="rule-info"><strong>${esc(module.label)}</strong><small>${module.fields.length} metadata field${module.fields.length === 1 ? "" : "s"} with visibility and permission rules</small></div><a class="table-action" href="/setup-console/modules">Open</a></div>`).join("") : `<p class="related-empty">No custom field-security definitions yet.</p>`;
    return `${pageHeader("Administration", "Security Administration", "Control hierarchy, permissions, record sharing, field visibility, and audit evidence.", `<button class="button button-primary" data-go="/setup/roles">Open Setup Directory</button>`)}<section class="security-callout"><strong>Server-side controls</strong><span>Roles define visibility. Profiles define capability. Sharing rules extend access. Field security is carried into forms, reports, exports, and APIs.</span></section><div class="security-grid">${configCard("Roles", "roles", data.roles, "Define hierarchical record visibility and manager scope.")}${configCard("Profiles", "profiles", data.profiles, "Bundle module, setup, import, export, and developer permissions.")}${configCard("Data Sharing", "sharing_rules", data.sharing_rules, "Configure private, public read-only, public read/write, and role-based sharing.")}${configCard("Permission Sets", "permissions", data.permissions, "Assign granular grants for modules and administrative surfaces.")}</div><section class="card settings-section"><div class="settings-section-head"><h2>Field security</h2><p>Review field-level visibility and permission metadata applied to configurable modules.</p></div>${fieldSecurity}</section><section class="card settings-section"><div class="settings-section-head"><h2>Audit Log</h2><p>Immutable records of create, update, delete, ownership, permission, workflow, import, export, API, and security changes.</p></div>${audit}</section>`;
  }
  
  async function cpqView() {
    const data = await api("/api/cpq/catalog");
    const products = data.products.length ? data.products.map((product) => `<div class="cpq-product-row"><label><input type="checkbox" data-cpq-product="${product.id}" /><span><strong>${esc(product.name)}</strong><small>${esc(product.sku || product.category || "No SKU")} · ${formatMoney(product.unit_price)}</small></span></label><input class="field-input cpq-qty" data-cpq-qty="${product.id}" type="number" min="1" value="1" disabled /></div>`).join("") : `<p class="related-empty">No active products are available. Add products before configuring a quote.</p>`;
    const rules = data.price_rules.length ? data.price_rules.map((rule) => `<div class="rule-row"><span class="related-dot">%</span><div class="rule-info"><strong>${esc(rule.name)}</strong><small>${esc(rule.action_type || "Adjustment")} · ${esc(rule.scope || "All")} · priority ${esc(rule.priority || "100")}</small></div>${badge(rule.status || "Active")}<a class="table-action" href="/setup/price_rules">›</a></div>`).join("") : `<p class="related-empty">No active price rules. Prices will use product rates.</p>`;
    return `${pageHeader("Sales & Inventory", "CPQ Workspace", "Configure products, apply transparent price rules, and create quote-ready pricing in one controlled flow.", `<button class="button button-primary" data-go="/setup/price_rules">Manage Price Rules</button>`)}<div class="cpq-layout"><section class="card settings-section"><div class="settings-section-head"><h2>Product Configurator</h2><p>Select products and quantities. Price rules are applied server-side and shown line by line.</p></div><form data-cpq-form><div class="cpq-product-list">${products}</div><div class="form-grid cpq-controls"><div class="field"><label>Customer type</label><select class="field-select" name="customer_type"><option value="">Not specified</option><option>Enterprise</option><option>SMB</option><option>Partner</option></select></div><div class="field"><label>Tax rate (%)</label><input class="field-input" name="tax_rate" type="number" min="0" step="0.01" value="18" /></div></div><div class="form-actions"><button class="button button-primary" type="submit">Calculate price</button></div></form><div data-cpq-output class="cpq-output"></div></section><section><section class="card settings-section"><div class="settings-section-head settings-heading-row"><div><h2>Price Rules</h2><p>Ordered discounts, markups, and fixed adjustments.</p></div><button class="button button-ghost button-small" data-platform-create="price_rules">＋ Add rule</button></div>${rules}</section><section class="card settings-section"><div class="settings-section-head settings-heading-row"><div><h2>Configurators</h2><p>Product dependencies and guided selling flows.</p></div><button class="button button-ghost button-small" data-platform-create="product_configurators">＋ Add</button></div>${data.configurators.length ? data.configurators.map((item) => `<div class="rule-row"><span class="related-dot">▦</span><div class="rule-info"><strong>${esc(item.name)}</strong><small>Product #${esc(item.product_id || "—")} · ${esc(item.status || "Draft")}</small></div>${badge(item.status || "Draft")}</div>`).join("") : `<p class="related-empty">No product configurators defined yet.</p>`}</section></section></div>`;
  }
  
  function bindSecurityAdmin() {
    $$(`[data-platform-create]`).forEach((button) => button.addEventListener("click", () => openPlatformModal(button.dataset.platformCreate)));
  }
  
  function bindCPQ() {
    $$(`[data-platform-create]`).forEach((button) => button.addEventListener("click", () => openPlatformModal(button.dataset.platformCreate)));
    $$(`[data-cpq-product]`).forEach((checkbox) => checkbox.addEventListener("change", () => { const qty = $(`[data-cpq-qty="${checkbox.dataset.cpqProduct}"]`); if (qty) qty.disabled = !checkbox.checked; }));
    $(`[data-cpq-form]`)?.addEventListener("submit", async (event) => { event.preventDefault(); const lines = $$(`[data-cpq-product]:checked`).map((checkbox) => ({product_id:Number(checkbox.dataset.cpqProduct), quantity:Number($(`[data-cpq-qty="${checkbox.dataset.cpqProduct}"]`)?.value || 1)})); const form = event.currentTarget; if (!lines.length) return toast("Select products", "Choose at least one product before calculating.", "error"); try { const pricing = await api("/api/cpq/price", {method:"POST", body:JSON.stringify({lines, context:{customer_type:form.elements.customer_type.value}, tax_rate:Number(form.elements.tax_rate.value || 0)})}); $(`[data-cpq-output]`).innerHTML = `<div class="cpq-result"><div class="cpq-total"><span>Total</span><strong>${formatMoney(pricing.total)}</strong><small>${esc(pricing.currency)} · ${pricing.applied_rule_count} price rule${pricing.applied_rule_count === 1 ? "" : "s"} applied</small></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Base</th><th>Adjustments</th><th>Total</th></tr></thead><tbody>${pricing.lines.map((line) => `<tr><td><strong>${esc(line.name)}</strong><span class="sub-cell">${esc(line.sku || "")}</span></td><td>${line.quantity}</td><td>${formatMoney(line.base_total)}</td><td>${line.adjustments.length ? line.adjustments.map((item) => `<span class="table-subtext">${esc(item.rule)}: ${formatMoney(item.delta)}</span>`).join("") : "—"}</td><td><strong>${formatMoney(line.total)}</strong></td></tr>`).join("")}</tbody></table></div><form data-cpq-quote-form class="form-grid"><div class="field"><label>Quote name</label><input class="field-input" name="name" value="CPQ quote" required /></div><div class="field"><label>Terms</label><input class="field-input" name="terms" value="Prices valid for 30 days." /></div><div class="form-actions field-full"><button class="button button-primary" type="submit">Create draft quote</button></div></form></div>`; $(`[data-cpq-quote-form]`)?.addEventListener("submit", async (quoteEvent) => { quoteEvent.preventDefault(); const quoteForm = quoteEvent.currentTarget; try { const created = await api("/api/cpq/quotes", {method:"POST", body:JSON.stringify({lines, context:{customer_type:form.elements.customer_type.value}, tax_rate:Number(form.elements.tax_rate.value || 0), name:quoteForm.elements.name.value, terms:quoteForm.elements.terms.value})}); toast("Draft quote created", `${created.quote.quote_number || `Quote #${created.quote.id}`} · ${formatMoney(created.quote.amount)}`); } catch (error) { toast("Could not create quote", error.message, "error"); } }); } catch (error) { $(`[data-cpq-output]`).innerHTML = `<p class="apex-error">${esc(error.message)}</p>`; } });
  }
  
  async function developerHubView() {
    const [manifest, servers, tools, connections, functions] = await Promise.all([api("/api/developer/manifest"), api("/api/platform/mcp_servers?limit=100"), api("/api/platform/mcp_tools?limit=100"), api("/api/platform/connections?limit=100"), api("/api/platform/functions?limit=100")]);
    const stat = (label, value, detail) => `<article class="card developer-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`;
    const rows = manifest.endpoints.map((item) => `<tr><td><span class="method-pill ${item.method.toLowerCase()}">${item.method}</span></td><td><code>${esc(item.path)}</code></td><td>${esc(item.description)}</td></tr>`).join("");
    const resourceCard = (label, resource, data, icon) => `<section class="card settings-section"><div class="settings-section-head settings-heading-row"><div><h2>${icon} ${esc(label)}</h2><p>${data.total} configured record${data.total === 1 ? "" : "s"}.</p></div><button class="button button-primary button-small" data-platform-create="${resource}">＋ Add</button></div>${data.items.length ? data.items.slice(0, 5).map((item) => `<div class="rule-row"><span class="related-dot">${icon}</span><div class="rule-info"><strong>${esc(item.name)}</strong><small>${esc(item.status || "Draft")} · updated ${formatDateTime(item.updated_at)}</small></div>${badge(item.status || "Draft")}<a class="table-action" href="/setup/${resource}">›</a></div>`).join("") : emptyState("◎", `No ${label.toLowerCase()} configured`, `Add a ${label.toLowerCase().replace(/s$/, "")} to make this surface available.`)}</section>`;
    return `${pageHeader("Administration", "Developer Hub", "Build secure integrations, MCP tools, REST clients, SDKs, functions, and data-model extensions.", `<button class="button button-primary" data-go="/setup-console/modules">Open Setup Console</button>`)}<section class="developer-stats">${stat("API version", manifest.api.version, manifest.api.base_path)}${stat("MCP servers", servers.total, "approved server registrations")}${stat("MCP tools", tools.total, "scoped agent tools")}${stat("Connections", connections.total, "secret references only")}${stat("Functions", functions.total, "server-side definitions")}</section><div class="developer-grid">${resourceCard("MCP Servers", "mcp_servers", servers, "⌘")}${resourceCard("MCP Tools", "mcp_tools", tools, "◆")}</div><section class="card settings-section"><div class="settings-section-head settings-heading-row"><div><h2>REST API Explorer</h2><p>Versioned contracts, supported scopes, and safe endpoint descriptions.</p></div><select class="field-select developer-sdk-select" data-developer-sdk><option value="python">Python SDK</option><option value="javascript">JavaScript SDK</option><option value="curl">cURL</option></select></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div><div class="developer-sdk-output" data-developer-sdk-output><pre>Loading SDK example…</pre></div><p class="field-hint">Scopes: ${manifest.api.scopes.map((scope) => `<code>${esc(scope)}</code>`).join(" · ")} · Credentials remain outside source control.</p></section><div class="developer-grid">${resourceCard("Connections", "connections", connections, "↔")}${resourceCard("Functions", "functions", functions, "ƒ")}</div>`;
  }
  
  async function setupConsoleView() {
    const data = await api("/api/admin/metadata/modules");
    const moduleRows = data.items.length ? data.items.map((module) => `
      <section class="card setup-module-card">
        <div class="setup-module-head">
          <div class="setup-module-title">
            <div class="setup-module-title-line"><h2>${esc(module.label)}</h2><span class="status-dot ${module.enabled ? "active" : "inactive"}">${module.enabled ? "Enabled" : "Disabled"}</span></div>
            <p><code>${esc(module.api_name)}</code><span>·</span><span>${esc(module.description || "No description")}</span></p>
          </div>
          <details class="action-menu">
            <summary class="action-menu-trigger" aria-label="Module actions" title="Module actions">⋯</summary>
            <div class="action-menu-popover">
              <button type="button" data-custom-module-builder="${module.id}">Edit fields</button>
              <button type="button" data-custom-module-toggle="${module.id}" data-enabled="${module.enabled}">${module.enabled ? "Disable module" : "Enable module"}</button>
              <button type="button" class="danger-action" data-custom-module-delete="${module.id}">Delete module</button>
            </div>
          </details>
        </div>
        <div class="metadata-field-table">
          <div class="metadata-field-head"><span>Field</span><span>Type</span><span>Rules</span><span>Visibility</span></div>
          ${module.fields.length ? module.fields.map((field) => `<div class="metadata-field-row"><strong>${esc(field.label)}<small>${esc(field.api_name)}</small></strong><span>${esc(field.field_type)}</span><span>${field.required ? "Required" : "Optional"}${field.read_only ? " · Read only" : ""}</span><span class="metadata-visibility">${metadataFieldEnabled(field) ? "Visible" : "Hidden"}</span></div>`).join("") : `<p class="related-empty metadata-empty">No custom fields yet.</p>`}
        </div>
        <div class="setup-module-actions">
          <button class="button button-ghost button-small" data-add-metadata-field="${module.id}">＋ Add field</button>
          <button class="button button-ghost button-small" data-add-metadata-layout="${module.id}">＋ Add layout</button>
          <button class="button button-ghost button-small" data-add-metadata-view="${module.id}">＋ Add view</button>
        </div>
      </section>`).join("") : emptyState("◇", "No custom modules", "Create your first metadata-driven module below.");
    return `${pageHeader("Administration", "Setup Console", "Customize modules and fields with API names, validation, permissions, layouts, and saved views.", `<button class="button button-primary" data-focus-module-form>＋ New module</button>`)}
      <div class="setup-console-grid">
        <div class="setup-console-modules">${moduleRows}</div>
        <section class="card settings-section setup-module-create-card" data-module-form-card>
          <div class="settings-section-head"><h2>New module</h2><p>Module definitions are stored in metadata tables and can be consumed by APIs, views, and AI agents.</p></div>
          <form class="settings-form" data-metadata-module-form>
            <div class="form-grid">
              <div class="field"><label>Label</label><input class="field-input" name="label" required placeholder="Service Requests" /></div>
              <div class="field"><label>API name</label><input class="field-input" name="api_name" required pattern="[a-z][a-z0-9_]*" placeholder="service_requests" /></div>
              <div class="field"><label>Plural label</label><input class="field-input" name="plural_label" placeholder="Service Requests" /></div>
              <div class="field field-full"><label>Description</label><textarea class="field-textarea" name="description" rows="3"></textarea></div>
            </div>
            <div class="form-actions"><button class="button button-primary" type="submit">Create module</button></div>
          </form>
        </section>
      </div>
      <section class="card settings-section setup-capabilities-card"><div class="settings-section-head"><h2>Field types and capabilities</h2><p>Supported metadata fields include text, rich text, numbers, currency, dates, picklists, lookups, formulas, files, images, and subforms.</p></div><div class="setup-capability-list"><span>Required / read-only</span><span>Unique values</span><span>Defaults</span><span>Validation rules</span><span>Field permissions</span><span>Layout visibility</span></div></section>`;
  }
  
  function bindDeveloperHub() {
    $$(`[data-platform-create]`).forEach((button) => button.addEventListener("click", () => openPlatformModal(button.dataset.platformCreate)));
    const select = $(`[data-developer-sdk]`), output = $(`[data-developer-sdk-output]`);
    const loadSdk = async () => { if (!select || !output) return; try { const data = await api(`/api/developer/sdk/${select.value}`); output.innerHTML = `<pre>${esc(data.code)}</pre>`; } catch (error) { output.innerHTML = `<p class="apex-error">${esc(error.message)}</p>`; } };
    select?.addEventListener("change", loadSdk); loadSdk();
  }
  
  function bindMetadataModuleActions() {
    $$('[data-custom-module-builder]').forEach((button) => button.addEventListener("click", () => navigate(`/setup/custom_modules/builder/${button.dataset.customModuleBuilder}`)));
    $$('[data-custom-module-toggle]').forEach((button) => button.addEventListener("click", async () => {
      const id = Number(button.dataset.customModuleToggle);
      const enabled = button.dataset.enabled !== "true";
      try {
        await api(`/api/admin/metadata/modules/${id}`, {method:"PATCH", body:JSON.stringify({enabled})});
        await ensureCustomModules();
        enhanceCustomModuleNavigation();
        toast(enabled ? "Module enabled" : "Module disabled");
        await renderRoute();
      } catch (error) { toast("Could not update module", error.message, "error"); }
    }));
    $$('[data-custom-module-delete]').forEach((button) => button.addEventListener("click", async () => {
      const id = Number(button.dataset.customModuleDelete);
      if (!await confirmAction("Delete this custom module?","Its active custom records will be archived and the module definition, fields, layouts and views will be removed.","Delete module")) return;
      try {
        await api(`/api/admin/metadata/modules/${id}`, {method:"DELETE"});
        await ensureCustomModules();
        enhanceCustomModuleNavigation();
        toast("Custom module deleted");
        await renderRoute();
      } catch (error) { toast("Could not delete module", error.message, "error"); }
    }));
    $$('details.action-menu').forEach((menu) => menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      $$('details.action-menu').forEach((other) => { if (other !== menu) other.open = false; });
    }));
  }
  
  function bindSetupConsole() {
    bindMetadataModuleActions();
    $(`[data-focus-module-form]`)?.addEventListener("click", () => $(`[data-module-form-card]`)?.scrollIntoView({behavior:"smooth"}));
    $(`[data-metadata-module-form]`)?.addEventListener("submit", async (event) => { event.preventDefault(); try { await api("/api/admin/metadata/modules", {method:"POST", body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries()))}); toast("Module created", "The metadata module is ready for fields and layouts."); await navigate("/setup-console/modules", true); } catch (error) { toast("Could not create module", error.message, "error"); } });
    $$(`[data-add-metadata-field]`).forEach((button) => button.addEventListener("click", async () => { const label = (await promptDialog("Field label:")); if (!label) return; const apiName = (await promptDialog("Field API name:", label.toLowerCase().replace(/[^a-z0-9]+/g, "_"))); if (!apiName) return; const type = (await promptDialog("Field type (text, number, currency, date, picklist, lookup):", "text")); if(type === null) return; try { await api(`/api/admin/metadata/modules/${button.dataset.addMetadataField}/fields`, {method:"POST", body:JSON.stringify({label, api_name:apiName, field_type:type || "text", position:0})}); toast("Field created", `${label} is available in the metadata model.`); await renderRoute(); } catch (error) { toast("Could not create field", error.message, "error"); } }));
    $$(`[data-add-metadata-layout]`).forEach((button) => button.addEventListener("click", async () => { const name = (await promptDialog("Layout name:", "Standard layout")); if (!name) return; try { await api(`/api/admin/metadata/modules/${button.dataset.addMetadataLayout}/layouts`, {method:"POST", body:JSON.stringify({name, sections:[]})}); toast("Layout created", "The layout is now stored in the metadata model."); await renderRoute(); } catch (error) { toast("Could not create layout", error.message, "error"); } }));
    $$(`[data-add-metadata-view]`).forEach((button) => button.addEventListener("click", async () => { const name = (await promptDialog("View name:", "My records")); if (!name) return; try { await api(`/api/admin/metadata/modules/${button.dataset.addMetadataView}/views`, {method:"POST", body:JSON.stringify({name, criteria:[], columns:[], sorting:[], visibility:{scope:"private"}})}); toast("View created", "The saved view is now available to the module engine."); await renderRoute(); } catch (error) { toast("Could not create view", error.message, "error"); } }));
  }
  
  
  const CUSTOM_FIELD_TYPES = [
    ["text","Single Line","↔"],["multiline","Multi-Line","☰"],["email","Email","✉"],["phone","Phone","⌕"],
    ["picklist","Pick List","▾"],["multi_select","Multi-Select","☷"],["date","Date","□"],["datetime","Date/Time","◫"],
    ["number","Number","123"],["auto_number","Auto-Number","№"],["currency","Currency","¤"],["decimal","Decimal",".00"],
    ["percentage","Percent","%"],["checkbox","Checkbox","☑"],["url","URL","↗"],["lookup","Lookup","⌕"],
    ["formula","Formula","ƒx"],["user_lookup","User","♙"],["file","File Upload","⇧"],["image","Image Upload","▧"],
    ["subform","Subform","▦"],["rich_text","Rich Text","¶"]
  ];
  
  function metadataFieldEnabled(field) {
    return field?.visibility?.enabled !== false;
  }
  
  function modulesAndFieldsLandingView() {
    return `${pageHeader("Customization", "Modules and Fields", "Manage custom CRM modules and configure record layouts for existing modules.")}
      <div class="setup-hub-grid modules-fields-options">
        <a class="card setup-hub-card modules-fields-option" href="/setup/custom_modules/modules" aria-label="Open Custom Modules">
          <div class="setup-hub-head"><span class="setup-hub-icon">▦</span><h2>Custom Modules</h2></div>
          <p>Create, edit, enable and manage independent CRM modules and their fields.</p><strong>Open Custom Modules →</strong>
        </a>
        <a class="card setup-hub-card modules-fields-option" href="/layout-settings/leads" aria-label="Open Modules and Fields / Layouts">
          <div class="setup-hub-head"><span class="setup-hub-icon">▤</span><h2>Modules and Fields / Layouts</h2></div>
          <p>Edit, create and select named layouts for existing CRM modules without creating a custom module.</p><strong>Manage Layouts →</strong>
        </a>
      </div>`;
  }

  async function customModulesAdminView() {
    const data = await api("/api/admin/metadata/modules");
    state.customModules = data.items || [];
    enhanceCustomModuleNavigation();
    const rows = state.customModules.length ? state.customModules.map((module) => `
      <article class="custom-module-row">
        <div class="custom-module-primary"><strong>${esc(module.label)}</strong><span>${esc(module.api_name)}</span></div>
        <div class="custom-module-cell"><span class="mobile-cell-label">Plural label</span><strong>${esc(module.plural_label || module.label)}</strong></div>
        <div class="custom-module-cell"><span class="mobile-cell-label">Fields</span><strong>${module.fields?.length || 0}</strong></div>
        <div class="custom-module-cell"><span class="mobile-cell-label">Status</span>${badge(module.enabled ? "Active" : "Inactive")}</div>
        <div class="custom-module-cell"><span class="mobile-cell-label">Updated</span><span>${formatDateTime(module.updated_at)}</span></div>
        <div class="custom-module-actions">
          <details class="action-menu">
            <summary class="action-menu-trigger" aria-label="Module actions" title="Module actions">⋯</summary>
            <div class="action-menu-popover">
              <button type="button" data-custom-module-builder="${module.id}">Edit fields</button>
              <button type="button" data-custom-module-toggle="${module.id}" data-enabled="${module.enabled}">${module.enabled ? "Disable" : "Enable"}</button>
              <button type="button" class="danger-action" data-custom-module-delete="${module.id}">Delete</button>
            </div>
          </details>
        </div>
      </article>`).join("") : `<div class="custom-module-empty">${emptyState("◇","No custom modules yet","Create your first custom module and design its fields visually.")}</div>`;
    return `${pageHeader("Customization", "Custom Modules", "Create unlimited metadata-driven modules, design fields visually, and control whether each module is available to users.", `<button class="button button-primary" data-custom-module-new>＋ Create Custom Module</button>`)}
      <section class="card custom-module-list">
        <div class="custom-module-list-head"><span>Module</span><span>Plural label</span><span>Fields</span><span>Status</span><span>Updated</span><span></span></div>
        ${rows}
      </section>`;
  }
  
  async function customModuleBuilderView(moduleId = null) {
    let module = null;
    if (moduleId) {
      const data = await api("/api/admin/metadata/modules");
      module = (data.items || []).find((item) => Number(item.id) === Number(moduleId));
      if (!module) return `<section class="card">${emptyState("!","Custom module not found","Return to Custom Modules and choose another module.")}</section>`;
    }
    state.customBuilder = {
      moduleId: module?.id || null,
      label: module?.label || "Untitled",
      api_name: module?.api_name || "",
      plural_label: module?.plural_label || "",
      description: module?.description || "",
      fields: module ? (module.fields || []).map((field) => ({...field, enabled: metadataFieldEnabled(field)})) : [{label:"Name", api_name:"name", field_type:"text", enabled:true, required:true}],
      sections: (module?.config?.layout_sections || []).map(section => ({...section})),
      existingConfig: module?.config || {},
      newFields: [],
      activeTab: "create",
    };
    const palette = CUSTOM_FIELD_TYPES.map(([type,label,icon]) => `<button type="button" class="builder-palette-field" draggable="true" data-builder-field-type="${type}" data-builder-field-label="${esc(label)}"><span>${icon}</span><strong>${esc(label)}</strong></button>`).join("");
    return `<section class="module-builder-shell">
      <header class="module-builder-topbar">
        <div class="builder-module-title"><input class="builder-title-input" data-builder-module-label value="${esc(state.customBuilder.label)}" aria-label="Module name" /><span>Standard</span></div>
        <div class="builder-top-actions"><button class="button button-ghost" data-builder-cancel>Cancel</button><button class="button button-ghost" data-builder-save-close>Save and Close</button><button class="button button-primary" data-builder-save>Save</button></div>
      </header>
      <div class="module-builder-body">
        <aside class="builder-palette"><div class="builder-palette-head"><strong>New Fields</strong><small>Drag fields into the layout</small></div><div class="builder-palette-grid">${palette}</div><button type="button" class="builder-palette-field builder-section-button" draggable="true" data-builder-field-type="section" data-builder-field-label="New Section"><span>▤</span><strong>NEW SECTION</strong></button></aside>
        <main class="builder-canvas">
          <nav class="builder-tabs"><button class="active" data-builder-tab="create">Create</button><button data-builder-tab="quick">Quick Create</button><button data-builder-tab="detail">Detail View</button></nav>
          <section class="builder-module-meta">
            <div class="form-grid"><div class="field"><label>Module Name</label><input class="field-input" data-builder-label value="${esc(state.customBuilder.label)}" /></div><div class="field"><label>Plural Label</label><input class="field-input" data-builder-plural value="${esc(state.customBuilder.plural_label)}" placeholder="e.g. Service Requests" /></div><div class="field"><label>API Name</label><input class="field-input" data-builder-api value="${esc(state.customBuilder.api_name)}" placeholder="service_requests" ${module ? "readonly" : ""} /></div><div class="field"><label>Description</label><input class="field-input" data-builder-description value="${esc(state.customBuilder.description)}" /></div></div>
          </section>
          <section class="builder-layout-frame">
            <div class="builder-layout-head"><div><h2 data-builder-layout-heading>Create ${esc(state.customBuilder.label)}</h2><p>Drag fields from the left panel into this layout.</p></div></div>
            <div class="builder-drop-zone" data-builder-drop>
              ${builderFieldCards(state.customBuilder.fields)}
              <div class="builder-drop-hint" data-builder-empty ${state.customBuilder.fields.length ? "hidden" : ""}>Drag a field here to add it to this custom module.</div>
            </div>
          </section>
        </main>
      </div>
    </section>`;
  }
  
  function builderFieldCards(fields) {
    return (fields || []).map((field, index) => `<article class="builder-field-card ${field.enabled === false ? "disabled" : ""}" draggable="true" data-builder-field-id="${field.id || ""}" data-builder-local-index="${index}">
      <span class="builder-field-grip">⋮⋮</span>
      <div class="builder-field-copy"><strong>${esc(field.label)}</strong><small>${esc(field.field_type)} · ${esc(field.api_name || "new field")}</small></div>
      <span class="status-dot ${field.enabled === false ? "inactive" : "active"}">${field.enabled === false ? "Disabled" : "Enabled"}</span>
      <details class="action-menu builder-field-menu">
        <summary class="action-menu-trigger" aria-label="Field actions" title="Field actions">⋯</summary>
        <div class="action-menu-popover">
          <button type="button" data-builder-field-edit="${index}">Edit field</button>
          <button type="button" data-builder-field-toggle="${index}">${field.enabled === false ? "Enable field" : "Disable field"}</button>
          <button type="button" class="danger-action" data-builder-field-delete="${index}">Delete field</button>
        </div>
      </details>
    </article>`).join("");
  }
  
  function builderSlug(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,100);
  }
  
  function renderBuilderFields() {
    const zone = $('[data-builder-drop]');
    if (!zone || !state.customBuilder) return;
    const hint = `<div class="builder-drop-hint" data-builder-empty ${state.customBuilder.fields.length ? "hidden" : ""}>Drag a field here to add it to this custom module.</div>`;
    zone.innerHTML = (state.customBuilder.sections || []).map((section,index) => '<div class="builder-layout-section-entry" data-builder-section-id="'+esc(section.id)+'"><input data-builder-section-label="'+index+'" value="'+esc(section.title)+'" aria-label="Section title" /><button type="button" data-builder-section-remove="'+index+'">Remove section</button></div>').join("") + builderFieldCards(state.customBuilder.fields) + hint;
    $('[data-builder-section-label]').forEach(input => input.addEventListener("input", () => {state.customBuilder.sections[Number(input.dataset.builderSectionLabel)].title = input.value;}));
    $('[data-builder-section-remove]').forEach(button => button.addEventListener("click", () => {state.customBuilder.sections.splice(Number(button.dataset.builderSectionRemove),1);renderBuilderFields();}));
    bindBuilderFieldActions();
  }
  
  function bindBuilderFieldActions() {
    $$('[data-builder-local-index]').forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("application/x-yash-field-index", card.dataset.builderLocalIndex);
        event.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; });
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData("application/x-yash-field-index"));
        const to = Number(card.dataset.builderLocalIndex);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
        const [moved] = state.customBuilder.fields.splice(from, 1);
        state.customBuilder.fields.splice(to, 0, moved);
        renderBuilderFields();
      });
    });
    $$('[data-builder-field-toggle]').forEach((button) => button.addEventListener("click", async () => {
      const index = Number(button.dataset.builderFieldToggle);
      const field = state.customBuilder.fields[index];
      field.enabled = field.enabled === false;
      if (field.id) await api(`/api/admin/metadata/fields/${field.id}`, {method:"PATCH", body:JSON.stringify({enabled:field.enabled})});
      renderBuilderFields();
    }));
    $$('[data-builder-field-edit]').forEach((button) => button.addEventListener("click", async () => {
      const index = Number(button.dataset.builderFieldEdit);
      const field = state.customBuilder.fields[index];
      const card = button.closest('[data-builder-local-index]');
      const labelNode = card?.querySelector('.builder-field-copy strong');
      if (!labelNode) return;
      const input = document.createElement('input');
      input.className = 'builder-inline-field-label';
      input.value = field.label;
      input.setAttribute('aria-label','Edit field name');
      labelNode.replaceWith(input);
      input.focus();input.select();
      let finished = false;
      const commit = async () => {
        if (finished) return; finished = true;
        const label = input.value.trim();
        if (!label) return renderBuilderFields();
        try {
          field.label = label;
          if (!field.id) field.api_name = builderSlug(label) || field.api_name;
          if (field.id) await api(`/api/admin/metadata/fields/${field.id}`, {method:"PATCH",body:JSON.stringify({label})});
        } catch (error) {toast("Rename failed",error.message,"error");}
        renderBuilderFields();
      };
      input.addEventListener('blur',commit,{once:true});
      input.addEventListener('keydown',event=>{if(event.key==='Enter')input.blur();if(event.key==='Escape'){finished=true;renderBuilderFields();}});

    }));
    $$('[data-builder-field-delete]').forEach((button) => button.addEventListener("click", async () => {
      const index = Number(button.dataset.builderFieldDelete);
      const field = state.customBuilder.fields[index];
      if (!await confirmAction("Delete this custom field?", `The field "${field.label}" will be removed from this module. Existing stored values are not displayed after removal.`, "Delete field")) return;
      if (field.id) await api(`/api/admin/metadata/fields/${field.id}`, {method:"DELETE"});
      state.customBuilder.fields.splice(index,1);
      renderBuilderFields();
    }));
  }
  
  async function saveCustomBuilder(closeAfter = false) {
    const b = state.customBuilder;
    if (!b) return;
    b.label = $('[data-builder-label]')?.value.trim() || $('[data-builder-module-label]')?.value.trim() || b.label;
    b.plural_label = $('[data-builder-plural]')?.value.trim() || b.plural_label || b.label;
    b.api_name = builderSlug($('[data-builder-api]')?.value || b.api_name || b.plural_label || b.label);
    b.description = $('[data-builder-description]')?.value.trim() || "";
    if (!b.label || !b.api_name) return toast("Module details required","Enter a module name and API name.","error");
    try {
      let moduleId = b.moduleId;
      if (!moduleId) {
        const created = await api("/api/admin/metadata/modules", {method:"POST", body:JSON.stringify({label:b.label, plural_label:b.plural_label, api_name:b.api_name, description:b.description, enabled:true, config:{record_name_field:"name",layout_sections:b.sections || []}})});
        moduleId = created.id; b.moduleId = moduleId;
      } else {
        await api(`/api/admin/metadata/modules/${moduleId}`, {method:"PATCH", body:JSON.stringify({label:b.label, plural_label:b.plural_label, description:b.description, config:{...(b.existingConfig || {}),layout_sections:b.sections || []}})});
      }
      for (let i=0;i<b.fields.length;i++) {
        const field = b.fields[i];
        if (field.id) {
          await api(`/api/admin/metadata/fields/${field.id}`, {method:"PATCH", body:JSON.stringify({position:i, label:field.label, required:!!field.required, enabled:field.enabled !== false})});
        } else {
          const created = await api(`/api/admin/metadata/modules/${moduleId}/fields`, {method:"POST", body:JSON.stringify({label:field.label, api_name:field.api_name, field_type:field.field_type, position:i, required:!!field.required, enabled:field.enabled !== false})});
          field.id = created.id;
        }
      }
      const modules = await ensureCustomModules();
      enhanceCustomModuleNavigation();
      toast("Custom module saved", `${b.label} is now available in the CRM navigation.`);
      if (closeAfter) return navigate("/setup/custom_modules/modules", true);
      return navigate(`/setup/custom_modules/builder/${moduleId}`, true);
    } catch (error) { toast("Could not save custom module", error.message, "error"); }
  }
  
  function bindCustomModuleAdmin() {
    $('[data-custom-module-new]')?.addEventListener("click", () => navigate("/setup/custom_modules/new"));
    bindMetadataModuleActions();
  
    const drop = $('[data-builder-drop]');
    $$('[data-builder-field-type]').forEach((item) => {
      item.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("application/x-yash-field", JSON.stringify({type:item.dataset.builderFieldType,label:item.dataset.builderFieldLabel}));
        event.dataTransfer.effectAllowed = "copy";
      });
      item.addEventListener("dblclick", () => {
        if (item.dataset.builderFieldType === "section") {state.customBuilder.sections.push({id:"section_"+Date.now().toString(36),title:"New Section"});renderBuilderFields();return;}
        const label = item.dataset.builderFieldLabel;
        state.customBuilder.fields.push({label, api_name:builderSlug(label), field_type:item.dataset.builderFieldType, enabled:true, required:false});
        renderBuilderFields();
      });
    });
    drop?.addEventListener("dragover", (event) => { event.preventDefault(); drop.classList.add("drag-over"); event.dataTransfer.dropEffect = "copy"; });
    drop?.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
    drop?.addEventListener("drop", (event) => {
      event.preventDefault(); drop.classList.remove("drag-over");
      try {
        const data = JSON.parse(event.dataTransfer.getData("application/x-yash-field"));
        if (!data.type) return;
        if (data.type === "section") {
          state.customBuilder.sections.push({id:"section_"+Date.now().toString(36),title:"New Section"});
          renderBuilderFields();
          return;
        }
        const label = data.label;
        let apiName = builderSlug(label);
        let suffix = 2;
        while (state.customBuilder.fields.some((field) => field.api_name === apiName)) apiName = `${builderSlug(label)}_${suffix++}`;
        state.customBuilder.fields.push({label, api_name:apiName, field_type:data.type, enabled:true, required:false});
        renderBuilderFields();
      } catch {}
    });
    bindBuilderFieldActions();
    $('[data-builder-cancel]')?.addEventListener("click", () => navigate("/setup/custom_modules/modules"));
    $('[data-builder-save]')?.addEventListener("click", () => saveCustomBuilder(false));
    $('[data-builder-save-close]')?.addEventListener("click", () => saveCustomBuilder(true));
    $$('[data-builder-tab]').forEach((button) => button.addEventListener("click", () => {
      $$('[data-builder-tab]').forEach((node)=>node.classList.toggle("active",node===button));
      state.customBuilder.activeTab = button.dataset.builderTab;
      $('[data-builder-layout-heading]').textContent = `${titleCase(button.dataset.builderTab)} ${state.customBuilder.label}`;
    }));
  }
  
  function customRuntimeFieldControl(field) {
    const required = field.required ? "required" : "";
    const marker = field.required ? ' <span class="required">*</span>' : "";
    const name = esc(field.api_name);
    const label = esc(field.label);
    const type = String(field.field_type || "text");
    const validation = field.validation || {};
    const min = validation.min != null ? `min="${esc(validation.min)}"` : "";
    const max = validation.max != null ? `max="${esc(validation.max)}"` : "";
    const minLength = validation.min_length != null ? `minlength="${esc(validation.min_length)}"` : "";
    const maxLength = validation.max_length != null ? `maxlength="${esc(validation.max_length)}"` : "";
    const pattern = validation.regex ? `pattern="${esc(validation.regex)}"` : "";
    if (field.read_only) return "";
    if (type === "multiline" || type === "rich_text") {
      return `<div class="field field-full"><label>${label}${marker}</label><textarea class="field-textarea" name="${name}" rows="4" ${required} ${minLength} ${maxLength}></textarea></div>`;
    }
    if (type === "checkbox") {
      return `<label class="custom-runtime-check"><input type="checkbox" name="${name}" value="true" /><span>${label}${marker}</span></label>`;
    }
    if (type === "picklist") {
      const options = validation.options || validation.allowed_values || [];
      return `<div class="field"><label>${label}${marker}</label><select class="field-select" name="${name}" ${required}><option value="">Select</option>${options.map((item)=>`<option value="${esc(item)}">${esc(item)}</option>`).join("")}</select></div>`;
    }
    const inputType = ({email:"email",phone:"tel",url:"url",date:"date",datetime:"datetime-local",number:"number",decimal:"number",currency:"number",percentage:"number"})[type] || "text";
    const step = ["decimal","currency","percentage"].includes(type) ? 'step="any"' : "";
    return `<div class="field"><label>${label}${marker}</label><input class="field-input" type="${inputType}" name="${name}" ${required} ${step} ${min} ${max} ${minLength} ${maxLength} ${pattern} /></div>`;
  }
  
  async function customRuntimeView(module) {
    const schema = await api(`/api/custom/${module.api_name}/schema`);
    const data = await api(`/api/custom/${module.api_name}?limit=100`);
    const fields = (schema.fields || []).filter((field)=>field.visibility?.enabled !== false);
    const tableFields = fields.slice(0,5);
    const rows = data.items?.length ? data.items.map((row)=>`<tr><td><strong>${esc(row.name || row.title || `${module.label} #${row.id}`)}</strong></td>${tableFields.map((field)=>`<td>${esc(Array.isArray(row[field.api_name]) ? row[field.api_name].join(", ") : (row[field.api_name] ?? "—"))}</td>`).join("")}<td>${badge(row.status || "Active")}</td></tr>`).join("") : "";
    const formFields = fields.map(customRuntimeFieldControl).join("");
    const addButton = fields.length ? `<button class="button button-primary" data-custom-runtime-new>＋ Add Report</button>` : "";
    return `${pageHeader("Custom Modules", module.plural_label || module.label, module.description || "Custom CRM module.", `${addButton}<button class="button button-ghost" data-go="/setup/custom_modules/builder/${module.id}">Customize fields</button>`)}
      ${fields.length ? `<section class="card custom-runtime-form-card" data-custom-runtime-form-card hidden>
        <div class="settings-section-head"><h2>Add report</h2><p>Complete the fields configured for ${esc(module.label)}. Required fields are marked with *.</p></div>
        <form class="settings-form" data-custom-runtime-form>
          <div class="form-grid">${formFields}</div>
          <div class="form-actions"><button type="button" class="button button-ghost" data-custom-runtime-cancel>Cancel</button><button type="submit" class="button button-primary">Save Report</button></div>
        </form>
      </section>` : `<section class="card settings-section"><div class="settings-section-head"><h2>Configure fields first</h2><p>This module has no active fields. Add fields in the visual builder before adding reports.</p></div><button class="button button-primary" data-go="/setup/custom_modules/builder/${module.id}">Customize fields</button></section>`}
      <section class="card table-card custom-runtime-table">${rows ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>${esc(module.label)}</th>${tableFields.map((field)=>`<th>${esc(field.label)}</th>`).join("")}<th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState("◇","No reports yet","Use Add Report to create the first record for this module.")}</section>`;
  }
  
  function bindCustomRuntime(module) {
    $$('[data-go]').forEach((button)=>button.addEventListener("click",()=>navigate(button.dataset.go)));
    const card = $('[data-custom-runtime-form-card]');
    const form = $('[data-custom-runtime-form]');
    $('[data-custom-runtime-new]')?.addEventListener("click", () => {
      if (!card) return;
      card.hidden = false;
      card.scrollIntoView({behavior:"smooth",block:"start"});
      card.querySelector("input,select,textarea")?.focus();
    });
    $('[data-custom-runtime-cancel]')?.addEventListener("click", () => {
      if (card) card.hidden = true;
      form?.reset();
    });
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const payload = {};
      const data = new FormData(form);
      for (const [key,value] of data.entries()) {
        if (value === "") continue;
        payload[key] = value;
      }
      form.querySelectorAll('input[type="checkbox"]').forEach((input)=>{ payload[input.name] = input.checked; });
      try {
        await api(`/api/custom/${module.api_name}`, {method:"POST", body:JSON.stringify(payload)});
        toast("Report saved", `The report was saved in ${module.plural_label || module.label}.`);
        form.reset();
        if (card) card.hidden = true;
        await renderRoute();
      } catch(error) {
        toast("Could not save report", error.message, "error");
      }
    });
  }
  
  function setupLandingView() {
    let hiddenGroups = []; let hiddenItems = [];
    try { hiddenGroups = JSON.parse(localStorage.getItem('yash.setup.hidden_groups') || '[]'); hiddenItems = JSON.parse(localStorage.getItem('yash.setup.hidden_items') || '[]'); } catch (_) {}
    const groups = Object.entries(state.platformCatalog.setup_navigation || {}).filter(([group]) => !hiddenGroups.includes(group));
    const icons = {
      "General":"♙","Security Control":"◇","Channels":"◔","Customization":"⚙","Automation":"⚙",
      "Process Management":"⌘","Experience Center":"⌘","Data Administration":"▤","Marketplace":"▣",
      "Developer Hub":"◈","Apex":"✦","CPQ":"▦"
    };
    const sparkle = new Set(["Canvas","Teamspace","Agents","MCP for AI Agents","StyleUI","Voice of the Customer"]);
    const shortcutsByGroup = {
      "Security Control": state.profile?.owner_console_access === true ? [["/security", "Security Administration"]] : [],
      "Apex": [["/ai", "AI Copilot"]],
      "Developer Hub": [["/developer", "Developer Hub"]],
      "CPQ": [["/cpq", "CPQ Workspace"]],
      "Customization": [["/setup-console/modules", "Setup Console"]]
    };
    const cards = groups.map(([group, links]) => `<section class="card setup-hub-card setup-search-group" data-search-group="${esc(group.toLowerCase())}"><div class="setup-hub-head"><span class="setup-hub-icon">${icons[group] || "◈"}</span><h2>${esc(group)}</h2></div><div class="setup-hub-links">${(shortcutsByGroup[group] || []).map(([href,label]) => `<a href="${href}" class="setup-hub-link setup-search-item" data-search-text="${esc(`${group} ${label}`.toLowerCase())}"><span>${esc(label)}</span><span aria-hidden="true">↗</span></a>`).join("")}${links.filter(([resource]) => !hiddenItems.includes(resource)).map(([resource, label]) => `<a href="/setup/${resource}" class="setup-hub-link setup-search-item" data-search-text="${esc(`${group} ${label} ${resource}`.toLowerCase())}"><span>${esc(label)}</span>${sparkle.has(label) ? '<b class="setup-sparkle">✦</b>' : ""}</a>`).join("")}</div></section>`).join("");
    return `<section class="setup-page-shell setup-home"><div class="setup-home-toolbar"><h1>Setup</h1><label class="toolbar-search setup-toolbar-search"><span>⌕</span><input data-setup-search-input placeholder="Search Setup" autofocus /></label></div><p class="related-empty setup-toolbar-note" data-setup-search-count>Browse ${Object.values(state.platformCatalog.setup_navigation || {}).flat().length} setup options.</p><div class="setup-hub-grid" data-setup-search-results>${cards}</div></section>`;
  }
  


  async function hierarchyRolesView() {
    const data = await api("/api/admin/security/role-hierarchy");
    const roles = data.items || [];
    const children = new Map();
    const names = new Set(roles.map(r => String(r.name).toLowerCase()));
    for (const r of roles) {
      const parent = String(r.parent_role||"").toLowerCase();
      const key = names.has(parent) ? parent : "";
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(r);
    }
    const options = (selected, exclude) => '<option value="">No superior role</option>' + roles.filter(r=>r.id!==exclude).map(r=>`<option value="${esc(r.name)}" ${r.name===selected?'selected':''}>${esc(r.name)}</option>`).join("");
    const seen = new Set();
    function node(r) {
      if (seen.has(r.id)) return "";
      seen.add(r.id);
      const kids = children.get(String(r.name).toLowerCase()) || [];
      return `<li class="cr-tree-node"><div class="cr-tree-row"><button type="button" class="cr-tree-toggle" data-role-toggle="${r.id}" ${kids.length?'':'disabled'} aria-expanded="true">${kids.length?'−':'·'}</button><button type="button" class="cr-tree-label" data-role-open="${r.id}">${esc(r.name)}</button><span class="cr-role-count">${r.user_count} users</span><button type="button" class="cr-edit-action" data-role-open="${r.id}">Edit</button></div>
      <div class="cr-role-editor" data-role-editor="${r.id}" hidden><form data-hierarchy-edit="${r.id}" class="form-grid"><label class="field">Role name<input class="field-input" name="name" maxlength="80" required value="${esc(r.name)}"></label><label class="field">Reports To<select class="field-select" name="parent_role">${options(r.parent_role,r.id)}</select></label><label class="field"><input name="share_data_with_peers" type="checkbox" ${r.share_data_with_peers?'checked':''}> Share Data with Peers</label><div class="form-actions"><button class="button button-primary">Save role</button><button type="button" class="button button-ghost" data-hierarchy-delete="${r.id}">Delete / Reassign</button></div></form></div>
      ${kids.length?`<ul class="cr-tree-children" data-role-children="${r.id}">${kids.map(node).join("")}</ul>`:""}</li>`;
    }
    const tree = (children.get("")||[]).map(node).join("") + roles.filter(r=>!seen.has(r.id)).map(node).join("");
    return `<style>
    .cr-roles{background:#fff;border:1px solid #e0e5ef;border-radius:13px;min-height:650px;overflow:hidden}
    .cr-tabs{display:flex;gap:36px;border-bottom:1px solid #e4e8f0;padding:0 32px}
    .cr-tab{padding:16px 0;background:transparent;border:0;cursor:pointer;color:#253d60;font-size:15px}
    .cr-tab.active{border-bottom:3px solid #425ef5;font-weight:650}
    .cr-panel{padding:32px}.cr-panel h2{margin:0 0 7px;font-size:22px;color:#182e4b}
    .cr-intro{color:#37547b;margin:0 0 25px;line-height:1.5}
    .cr-actions{display:flex;align-items:center;gap:21px;margin-bottom:29px}
    .cr-actions>button:not(.button){background:none;border:0;color:#365df3;cursor:pointer;padding:0}
    .cr-tree,.cr-tree-children{list-style:none;margin:0;padding:0}
    .cr-tree-children{margin-left:9px;padding-left:23px;border-left:1px dashed #9aaac6}
    .cr-tree-node{position:relative}
    .cr-tree-children>.cr-tree-node:before{content:"";position:absolute;left:-23px;top:20px;width:19px;border-top:1px dashed #9aaac6}
    .cr-tree-row{display:flex;align-items:center;gap:10px;min-height:42px}
    .cr-tree-toggle{width:18px;height:18px;line-height:14px;padding:0;border:1px solid #8ca0c1;background:#fff;color:#526b91;border-radius:3px;cursor:pointer;flex-shrink:0}
    .cr-tree-toggle:disabled{border-color:transparent;cursor:default}
    .cr-tree-label{background:none;border:0;padding:3px 0;cursor:pointer;text-align:left;color:#1e3553;font-size:15px}
    .cr-tree-label:hover{text-decoration:underline;color:#365df3}
    .cr-role-count,.cr-edit-action{opacity:0;color:#637595;font-size:12px}
    .cr-edit-action{background:none;border:0;color:#365df3;cursor:pointer}
    .cr-tree-row:hover .cr-role-count,.cr-tree-row:hover .cr-edit-action,.cr-tree-row:focus-within .cr-role-count,.cr-tree-row:focus-within .cr-edit-action{opacity:1}
    .cr-role-editor,.cr-create{max-width:740px;padding:19px;margin:10px 0 15px 28px;border:1px solid #e0e7f2;border-radius:9px;background:#f9faff}
    .cr-create{margin:0 0 26px}
    .cr-role-editor input[type="checkbox"][name="share_data_with_peers"],.cr-create input[type="checkbox"][name="share_data_with_peers"]{appearance:auto!important;-webkit-appearance:checkbox!important;width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;flex:0 0 16px!important;margin:0 7px 0 0!important;padding:0!important;vertical-align:middle;accent-color:#365df3;box-shadow:none!important;transform:none!important}.cr-role-editor label:has(input[name="share_data_with_peers"]),.cr-create label:has(input[name="share_data_with_peers"]){display:flex;align-items:center;gap:2px;line-height:20px}
    .cr-panel[hidden],.cr-role-editor[hidden],.cr-create[hidden],.cr-tree-children[hidden]{display:none!important}
    </style>
    <section class="cr-roles"><nav class="cr-tabs"><button type="button" class="cr-tab active" data-roles-tab="roles">Roles</button><button type="button" class="cr-tab" data-roles-tab="sharing">Data Sharing Settings</button></nav>
    <div class="cr-panel" data-roles-panel="roles"><h2>Roles</h2><p class="cr-intro">This page lets you define how data is shared among users based on your organization's role hierarchy. Profile permissions continue to control View, Edit and Delete access.</p>
    <div class="cr-actions"><button type="button" class="button button-primary" data-role-new>New Role</button><button type="button" data-roles-expand>Expand All</button><span>|</span><button type="button" data-roles-collapse>Collapse All</button></div>
    <div class="cr-create" data-role-create-panel hidden><h3>New Role</h3><form data-hierarchy-create class="form-grid"><label class="field">Role name<input class="field-input" name="name" required maxlength="80"></label><label class="field">Reports To<select class="field-select" name="parent_role">${options(null,null)}</select></label><label class="field"><input type="checkbox" name="share_data_with_peers"> Share Data with Peers</label><div class="form-actions"><button class="button button-primary">Create Role</button><button class="button button-ghost" type="button" data-role-cancel>Cancel</button></div></form></div>
    ${roles.length?`<ul class="cr-tree">${tree}</ul>`:'<p class="related-empty">No roles configured. Select New Role to create the first one.</p>'}</div>
    <div class="cr-panel" data-roles-panel="sharing" hidden><h2>Data Sharing Settings</h2><p class="cr-intro">Select the organizational role hierarchy or users' reporting-manager hierarchy. Module and profile restrictions still apply.</p><form data-hierarchy-mode class="form-grid"><label class="field">Hierarchy mode<select name="mode" class="field-select"><option value="role" ${data.mode==='role'?'selected':''}>Role hierarchy</option><option value="reporting_manager" ${data.mode==='reporting_manager'?'selected':''}>Reporting manager hierarchy</option></select></label><div class="form-actions"><button class="button button-primary">Save Settings</button></div></form><p class="cr-intro">To change peer sharing, select a role in the Roles tab. <a href="/setup/sharing_rules">Manage module sharing rules</a> · <a href="/setup/module_permissions">Module Permissions</a></p></div>
    </section>`;
  }




  async function profilesDirectoryView() {
    const data=await api("/api/admin/security/module-permissions?profile=Standard");
    const profiles=data.profiles || ["Administrator","Standard"];
    const users=data.users || [];
    const filter=new URLSearchParams(location.search).get("search")||"";
    const names=profiles.filter(n=>n.toLowerCase().includes(filter.toLowerCase()));
    return `<section class="card settings-section" style="min-height:650px"><div class="settings-section-head"><div><h2>Profiles</h2><p>Profiles define module access, record operations, setup permissions, and integration permissions. Select a profile to edit its permissions.</p></div><button class="button button-primary" data-profile-create>New Profile</button></div><div style="margin:24px 0"><input class="field-input" style="max-width:300px" placeholder="Search profiles" value="${esc(filter)}" data-profile-search></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Profile Name</th><th>Description</th><th>Assigned Users</th><th>Actions</th></tr></thead><tbody>${names.map(name=>`<tr><td><a href="/setup/profiles/${encodeURIComponent(name)}" style="color:#365df3;font-weight:600">${esc(name)}</a></td><td>Module access and operation permissions</td><td>${users.filter(u=>u.profile===name).length}</td><td><a href="/setup/profiles/${encodeURIComponent(name)}">Permissions →</a></td></tr>`).join("")}</tbody></table></div></section>`;
  }

  const profileSections = [
    ["Module Permissions", [["Basic",["read","create","update","delete"]],["Import/Export",["import","export"]],["Send Email",["send_email","mass_email"]],["Tools",["decrypt","mass_update","mass_delete","mass_transfer","change_owner","convert","mass_convert","share","record_lock"]],["Others",["manage_views"]]]],
    ["Setup Permissions", [["Admin Level",[]],["Email & Templates",[]],["Automation",[]],["Webform",[]],["Data Administration",[]],["AI",[]],["CPQ",[]]]],
    ["Extension Permissions", [["Zoho",[]],["Google",[]],["Microsoft",[]],["Others",[]],["Social",[]]]],
    ["Developer Permissions", [["API Access",[]],["Manage Extensibility",[]],["CRM Variables",[]]]]
  ];

  async function profilePermissionDetailsView(name) {
    const data=await api("/api/admin/security/module-permissions?profile="+encodeURIComponent(name));
    const label={decrypt:"Decrypt protected fields",read:"View",create:"Create",update:"Edit",delete:"Delete",import:"Import Records",export:"Export",mass_update:"Mass Update",mass_delete:"Mass Delete",mass_transfer:"Mass Transfer",change_owner:"Change Owner",share:"Share",convert:"Convert",mass_convert:"Mass Convert",send_email:"Send Email",mass_email:"Mass Email",manage_views:"Manage Views",record_lock:"Record Lock"};
    const setupLabels={manage_users:"Manage Users",manage_roles:"Manage Roles",manage_profiles:"Manage Profiles",manage_groups:"Manage Groups",manage_modules_fields:"Manage Modules and Fields",manage_layouts:"Manage Layouts",manage_automation:"Manage Automation",manage_workflow_rules:"Manage Workflow Rules",manage_blueprints:"Manage Blueprints",manage_assignment_rules:"Manage Assignment Rules",manage_approval_rules:"Manage Approval Rules",manage_templates:"Manage Templates",manage_import_settings:"Import Settings",manage_backup:"Manage Backup",manage_data_administration:"Data Administration",manage_audit_logs:"Manage Audit Logs",manage_security_configuration:"Security Configuration"};
    const setupGroup={ "Admin Level":["manage_users","manage_roles","manage_profiles","manage_groups","manage_security_configuration","manage_audit_logs","manage_modules_fields","manage_layouts"],"Email & Templates":["manage_templates"],"Automation":["manage_automation","manage_workflow_rules","manage_blueprints","manage_assignment_rules","manage_approval_rules"],"Data Administration":["manage_import_settings","manage_backup","manage_data_administration"]};
    const featureSection=`<section class="cp-permission-section"><h2>Subscription capabilities</h2><p>Current plan: <strong>${esc(data.subscription?.plan_name||"Free")}</strong>. A profile cannot unlock capabilities outside this subscription.</p>${(data.feature_actions||[]).map(key=>{const available=data.subscription?.owner_unrestricted||data.subscription?.features?.[key];return `<div class="cp-permission-row"><strong>${esc(key.replaceAll("_"," "))}</strong><label class="cp-switch"><input type="checkbox" data-feature-permission="${esc(key)}" ${data.feature_permissions?.[key]!==false?"checked":""} ${available?"":"disabled"}><span></span></label><small>${available?"Included in subscription":"Requires a different plan"}</small></div>`;}).join("")}</section>`;
    const nav=profileSections.map(([group,sub])=>`<div class="cp-nav-group"><h3>${esc(group)}</h3>${sub.map(([title])=>`<button type="button" data-profile-section="${esc(title)}">${esc(title)}</button>`).join("")}</div>`).join("");
    const sections=profileSections.map(([group,sub])=>sub.map(([title,actions])=>{
      if(!actions.length){
        const keys=title==="Admin Level" ? (data.setup_actions||[]) : [];
        return `<section class="cp-permission-section" id="cp-${slug(title)}"><h2>${esc(title)}</h2>${keys.length?keys.map(key=>`<div class="cp-permission-row"><strong>${esc(setupLabels[key]||key)}</strong><label class="cp-switch"><input type="checkbox" data-setup-capability="${esc(key)}" ${data.setup?.[key]?"checked":""} ${data.setup_availability?.[key]===false?"disabled":""}><span></span></label><small>${data.setup_availability?.[key]===false?"Requires a different plan":"Delegated organization setup access"}</small></div>`).join(""):'<p class="related-empty">No additional connected setup permissions in this category.</p>'}</section>`;
      }
      const rows=(title==="Basic"?data.modules:actions).map(key=>{
        const basic=title==="Basic";const module=basic?key:null;
        const checked=basic?actions.filter(action=>data.permissions[module]?.[action]):data.modules.filter(m=>data.permissions[m]?.[key]);
        const item=basic?module:key;
        const checkedLabel=basic?checked.map(a=>label[a]).join(", "):checked.slice(0,4).join(", ")+(checked.length>4?` & ${checked.length-4} more`:"");
        const inputs=basic?actions.map(a=>[module,a]):data.modules.map(m=>[m,key]);
        return `<div class="cp-permission-row"><strong>${esc((basic?item:item.replaceAll("_"," ")))}</strong><label class="cp-switch"><input type="checkbox" data-profile-toggle="${esc(item)}" ${checked.length?"checked":""}><span></span></label><details><summary>${esc(checkedLabel||"No permissions")} <span>⌄</span></summary><div class="cp-permission-choices">${inputs.map(([m,a])=>`<label><input type="checkbox" data-permission-module="${esc(m)}" data-permission-action="${esc(a)}" ${data.permissions[m]?.[a]?"checked":""} ${data.module_availability?.[m]===false?'disabled title="Unavailable on current plan"':""}> ${esc(basic?label[a]:m.replaceAll("_"," "))}</label>`).join("")}</div></details></div>`;
      }).join("");
      return `<section class="cp-permission-section" id="cp-${slug(title)}"><h2>${esc(title)} Permissions</h2>${rows}</section>`;
    }).join("")).join("");
    return `<style>.cp-profile{background:#fff;min-height:80vh}.cp-profile-head{display:flex;justify-content:space-between;align-items:center;background:#edf1fa;padding:16px 24px}.cp-profile-head h2{margin:0;font-size:19px}.cp-profile-layout{display:grid;grid-template-columns:285px minmax(0,1fr)}.cp-profile-nav{padding:22px 0;border-right:1px solid #e2e8f0;position:sticky;top:0;align-self:start;max-height:77vh;overflow:auto}.cp-nav-group{margin-bottom:27px}.cp-nav-group h3{padding:0 25px;margin:8px 0;font-size:15px}.cp-nav-group button{display:block;width:100%;text-align:left;background:none;border:0;padding:9px 35px;color:#243f62;cursor:pointer}.cp-nav-group button:hover,.cp-nav-group button.selected{background:#eef2ff;color:#405cfa;border-left:3px solid #405cfa}.cp-profile-main{padding:26px 55px;max-height:77vh;overflow:auto;scroll-behavior:smooth}.cp-permission-section{margin-bottom:38px;scroll-margin-top:20px}.cp-permission-section h2{font-size:19px;margin:5px 0 15px}.cp-permission-row{display:grid;grid-template-columns:220px 85px minmax(0,1fr);align-items:center;border-bottom:1px solid #e9edf2;min-height:50px;gap:12px}.cp-permission-row strong{font-size:14px;font-weight:550}.cp-permission-row details summary{cursor:pointer;color:#405269;font-size:14px}.cp-permission-choices{display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:12px;padding:15px 0}.cp-permission-choices label{display:flex;align-items:center;gap:8px;font-size:13px}.cp-permission-choices input{width:16px;height:16px}.cp-switch{position:relative;width:34px;height:20px}.cp-switch input{opacity:0;width:34px;height:20px;position:absolute;z-index:2;cursor:pointer}.cp-switch span{display:block;border-radius:12px;background:#cbd5e1;width:34px;height:20px}.cp-switch span:after{content:"";display:block;position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:100%;background:#fff;transition:.2s}.cp-switch input:checked+span{background:#67c986}.cp-switch input:checked+span:after{left:17px}@media(max-width:900px){.cp-profile-layout{grid-template-columns:185px minmax(0,1fr)}.cp-profile-main{padding:20px}.cp-permission-row{grid-template-columns:140px 48px minmax(0,1fr)}}</style><div class="cp-profile" data-editing-profile="${esc(name)}"><div class="cp-profile-head"><h2><a href="/setup/profiles">← Profile:</a> ${esc(name)}</h2><div><button class="button" type="button" data-profile-view-users>View Users</button> <button class="button button-primary" type="button" data-profile-save>Save Permissions</button></div></div><div class="cp-profile-layout"><aside class="cp-profile-nav">${nav}</aside><main class="cp-profile-main" data-profile-scroll>${sections}${featureSection}</main></div></div>`;
  }

  function bindProfilePermissions() {
    if(document.documentElement.dataset.profilePermissionsBound)return;
    document.documentElement.dataset.profilePermissionsBound="1";
    document.addEventListener("submit", async event => {
      if (!event.target.matches("[data-profile-new]")) return;
      event.preventDefault();
      const button=event.target.querySelector("button"); button.disabled=true;
      try {
        const payload=Object.fromEntries(new FormData(event.target));
        await api("/api/admin/security/profiles",{method:"POST",body:JSON.stringify(payload)});
        event.target.reset();
        await navigate("/setup/profiles/"+encodeURIComponent(payload.name));
      } catch(error) { toast("Could not create profile",error.message,"error"); }
      finally { button.disabled=false; }
    });
    document.addEventListener("click",async event=>{
      const section=event.target.closest("[data-profile-section]");
      if(section){document.querySelector('[id="cp-'+slug(section.dataset.profileSection)+'"]')?.scrollIntoView({behavior:"smooth",block:"start"});document.querySelectorAll("[data-profile-section]").forEach(e=>e.classList.toggle("selected",e===section));}
      const switchEl=event.target.closest("[data-profile-toggle]");
      if(switchEl){
        const row=switchEl.closest(".cp-permission-row");
        const keys=row?.querySelectorAll("[data-permission-module]")||[];
        keys.forEach(el=>{if(!el.disabled)el.checked=switchEl.checked;});
      }
      const save=event.target.closest("[data-profile-save]");
      if(save){
        const matrix={};
        document.querySelectorAll("[data-permission-module]").forEach(input=>{const m=input.dataset.permissionModule;matrix[m]??={};matrix[m][input.dataset.permissionAction]=input.checked;});
        const name=document.querySelector("[data-editing-profile]")?.dataset.editingProfile || decodeURIComponent(location.pathname.split("/").pop());
        try{await api("/api/admin/security/module-permissions",{method:"PUT",body:JSON.stringify({profile:name,modules:matrix,setup:Object.fromEntries([...document.querySelectorAll("[data-setup-capability]")].map(i=>[i.dataset.setupCapability,i.checked])),features:Object.fromEntries([...document.querySelectorAll("[data-feature-permission]")].map(i=>[i.dataset.featurePermission,i.checked]))})});toast("Profile saved","Permissions updated.");}
        catch(error){toast("Could not save profile",error.message,"error");}
      }
      if(event.target.closest("[data-profile-view-users]")){navigate("/setup/users");}
      if(event.target.closest("[data-profile-create]")) navigate("/setup/profiles/new");
    });
  }

  async function modulePermissionsView() {
    const params=new URLSearchParams(location.search);
    const profile=params.get("profile")||"Standard";
    const data=await api("/api/admin/security/module-permissions?profile="+encodeURIComponent(profile));
    const labels={decrypt:"Decrypt protected fields",read:"View",create:"Create",update:"Edit",delete:"Delete",import:"Import",export:"Export",mass_update:"Mass Update",mass_delete:"Mass Delete",mass_transfer:"Mass Transfer",change_owner:"Change Owner",share:"Share",convert:"Lead Convert",mass_convert:"Mass Convert",send_email:"Send Email",mass_email:"Mass Email",manage_views:"Manage Views",record_lock:"Record Lock"};
    const row=(module)=>`<tr><th style="position:sticky;left:0;background:#fff;z-index:1;white-space:nowrap">${esc(module.replaceAll("_"," "))}</th>${data.actions.map(action=>`<td style="text-align:center"><input type="checkbox" aria-label="${esc(module)} ${esc(labels[action]||action)}" data-permission-module="${esc(module)}" data-permission-action="${esc(action)}" ${data.permissions[module]?.[action]?"checked":""} ${data.module_availability?.[module]===false?"disabled":""} style="width:16px;height:16px;min-width:16px;min-height:16px;accent-color:#425ef5"></td>`).join("")}</tr>`;
    return `<section class="card settings-section"><div class="settings-section-head"><h2>Module Permissions</h2><p>Current plan: ${esc(data.subscription?.plan_name||'Free')}. Locked modules require a plan upgrade. Configure each CRM module's capabilities independently. Unchecked permissions are denied in the permission matrix.</p></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:16px 0">
      <label class="field" style="min-width:220px">Permission profile<select class="field-select" data-matrix-profile>${data.profiles.map(name=>`<option ${name===profile?"selected":""} value="${esc(name)}">${esc(name)}</option>`).join("")}</select></label>
      <button type="button" class="button button-primary" data-matrix-save>Save Permissions</button>
      <label class="field" style="min-width:220px">Preview user's effective permissions<select class="field-select" data-matrix-user><option value="">Select a user</option>${data.users.map(u=>`<option value="${u.id}">${esc(u.name)} (${esc(u.profile)})</option>`).join("")}</select></label>
      <button type="button" class="button" data-matrix-preview>Preview</button>
    </div><div data-matrix-preview-output></div>
    <p class="related-empty">Dependencies are validated when saving: Mass Delete requires Delete, Mass Update requires Edit, and Mass Transfer requires Edit plus Change Owner.</p>
    <div class="table-wrap" style="max-height:65vh;overflow:auto"><table class="data-table" style="min-width:1800px"><thead><tr><th style="position:sticky;left:0;background:#fff;z-index:2">Module</th>${data.actions.map(a=>`<th style="white-space:nowrap">${esc(labels[a]||a)}</th>`).join("")}</tr></thead><tbody>${data.modules.map(row).join("")}</tbody></table></div></section>`;
  }

  function bindModulePermissions() {
    if(document.documentElement.dataset.matrixBound)return;
    document.documentElement.dataset.matrixBound="1";
    document.addEventListener("change",event=>{
      if(event.target.matches("[data-matrix-profile]"))navigate("/setup/module_permissions?profile="+encodeURIComponent(event.target.value));
    });
    document.addEventListener("click",async event=>{
      const save=event.target.closest("[data-matrix-save]");
      const preview=event.target.closest("[data-matrix-preview]");
      if(!save&&!preview)return;
      try{
        if(save){
          const matrix={};
          document.querySelectorAll("[data-permission-module]").forEach(input=>{
            const module=input.dataset.permissionModule;matrix[module]??={};
            matrix[module][input.dataset.permissionAction]=input.checked;
          });
          await api("/api/admin/security/module-permissions",{method:"PUT",body:JSON.stringify({profile:document.querySelector("[data-matrix-profile]").value,modules:matrix})});
          toast("Permissions saved","Module permissions were updated.");
        }
        if(preview){
          const id=document.querySelector("[data-matrix-user]").value;
          if(!id)return toast("Select user","Select a user for preview.","error");
          const result=await api("/api/admin/security/module-permissions/effective/"+id);
          const rows=Object.entries(result.permissions).map(([module,grants])=>`<tr><td>${esc(module)}</td><td>${Object.entries(grants).filter(([,ok])=>ok).map(([action])=>esc(action)).join(", ")||"No access"}</td></tr>`).join("");
          document.querySelector("[data-matrix-preview-output]").innerHTML=`<section class="card settings-section"><h3>Effective permissions: ${esc(result.name)}</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Module</th><th>Allowed actions</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
        }
      }catch(error){toast("Permission operation failed",error.message,"error");}
    });
  }

  async function dataSharingRulesView() {
    const data=await api("/api/admin/security/data-sharing");
    const levels=["Private","Public Read Only","Public Read/Write","Public Read/Write/Delete"];
    const select=levels.map(level=>`<option value="${esc(level)}">${esc(level)}</option>`).join("");
    const modules=data.modules.map(row=>`<tr><td>${esc(row.module.replaceAll("_"," "))}</td><td><select class="field-select" data-sharing-module="${esc(row.module)}">${levels.map(l=>`<option value="${esc(l)}" ${l===row.access?"selected":""}>${esc(l)}</option>`).join("")}</select></td><td><button class="button button-small" data-sharing-save="${esc(row.module)}">Save</button></td></tr>`).join("");
    const rules=data.rules.map(r=>`<tr><td>${esc(r.module)}</td><td>${esc(r.source_role)}</td><td>${esc(r.target_type)}: ${esc(r.target)}</td><td>${esc(r.grant)}</td><td><button type="button" class="button button-small" data-sharing-remove="${r.id}">Remove</button></td></tr>`).join("");
    return `<section class="card settings-section"><h2>Organization-wide data sharing</h2><p>Private is the default. Sharing cannot override profile capabilities or organization isolation.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Module</th><th>Default access</th><th>Action</th></tr></thead><tbody>${modules}</tbody></table></div></section><section class="card settings-section"><h2>Role & group sharing rules</h2><p>Grant Read Only or Read/Write access between selected roles or groups.</p><form data-sharing-create class="form-grid"><label class="field">Module<select name="module" class="field-select">${data.modules.map(m=>`<option value="${esc(m.module)}">${esc(m.module)}</option>`).join("")}</select></label><label class="field">Rule Type<select name="kind" class="field-select"><option value="owner">Owner-based</option><option value="criteria">Criteria-based</option></select></label><label class="field">Source role<input name="source_role" class="field-input" required></label><label class="field">Destination type<select name="target_type" class="field-select"><option value="role">Role</option><option value="group">Security Group</option></select></label><label class="field">Destination role/group<input name="target" class="field-input" required></label><label class="field">Access<select class="field-select" name="grant"><option>Read Only</option><option>Read/Write</option></select></label><label class="field"><input type="checkbox" name="superiors_allowed" style="width:16px;height:16px"> Superiors Allowed</label><div class="form-actions"><button class="button button-primary">Create Rule</button></div></form><div class="table-wrap"><table class="data-table"><thead><tr><th>Module</th><th>Source</th><th>Destination</th><th>Grant</th><th></th></tr></thead><tbody>${rules}</tbody></table></div></section>`;
  }

  function bindSharingRuleActions() {
    if (document.documentElement.dataset.sharingRulesBound) return;
    document.documentElement.dataset.sharingRulesBound="1";
    document.addEventListener("click",async event=>{
      const save=event.target.closest("[data-sharing-save]");
      const remove=event.target.closest("[data-sharing-remove]");
      if(!save&&!remove)return;
      try {
        if(save) {
          const module=save.dataset.sharingSave;
          const access=document.querySelector('[data-sharing-module="'+module+'"]').value;
          await api("/api/admin/security/data-sharing/"+encodeURIComponent(module),{method:"PUT",body:JSON.stringify({access})});
        } else if((await confirmDialog("Remove this sharing rule?"))) {
          await api("/api/admin/security/data-sharing/rules/"+remove.dataset.sharingRemove,{method:"DELETE"});
        } else return;
        toast("Sharing updated","Sharing permissions saved."); await renderRoute();
      }catch(error){toast("Sharing update failed",error.message,"error");}
    });
    document.addEventListener("submit",async event=>{
      if(!event.target.matches("[data-sharing-create]"))return;
      event.preventDefault();
      const form=event.target;const payload=Object.fromEntries(new FormData(form).entries());
      payload.superiors_allowed=Boolean(form.elements.superiors_allowed.checked);
      if(payload.kind==="criteria"){toast("Unsupported criteria","Criteria-based rules require a specific status/stage predicate; use the API until the criteria editor is available.","error");return;}
      try{await api("/api/admin/security/data-sharing/rules",{method:"POST",body:JSON.stringify(payload)});toast("Rule created","Sharing rule saved.");await renderRoute();}
      catch(error){toast("Could not create rule",error.message,"error");}
    });
  }

  function bindHierarchyRoleActions() {
    if (document.documentElement.dataset.hierarchyRolesBound) return;
    document.documentElement.dataset.hierarchyRolesBound = "1";
    document.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-roles-tab]");
      if (tab) {
        document.querySelectorAll("[data-roles-tab]").forEach(el=>el.classList.toggle("active",el===tab));
        document.querySelectorAll("[data-roles-panel]").forEach(el=>el.hidden=el.dataset.rolesPanel!==tab.dataset.rolesTab);
      }
      const newButton=event.target.closest("[data-role-new]");
      if(newButton) { const panel=document.querySelector("[data-role-create-panel]"); if(panel) panel.hidden=false; }
      if(event.target.closest("[data-role-cancel]")) {const panel=document.querySelector("[data-role-create-panel]");if(panel)panel.hidden=true;}
      const edit=event.target.closest("[data-role-open]");
      if(edit) {const form=document.querySelector('[data-role-editor="'+edit.dataset.roleOpen+'"]');if(form)form.hidden=!form.hidden;}
      const toggle=event.target.closest("[data-role-toggle]");
      if(toggle) {const list=document.querySelector('[data-role-children="'+toggle.dataset.roleToggle+'"]');if(list){list.hidden=!list.hidden;toggle.textContent=list.hidden?"+":"−";toggle.setAttribute("aria-expanded",String(!list.hidden));}}
      if(event.target.closest("[data-roles-expand], [data-roles-collapse]")){
        const collapse=Boolean(event.target.closest("[data-roles-collapse]"));
        document.querySelectorAll("[data-role-children]").forEach(el=>el.hidden=collapse);
        document.querySelectorAll("[data-role-toggle]:not(:disabled)").forEach(el=>{el.textContent=collapse?"+":"−";el.setAttribute("aria-expanded",String(!collapse));});
      }
    });
    document.addEventListener("submit", async (event) => {
      const form = event.target;
      if (!form.matches("[data-hierarchy-create], [data-hierarchy-edit], [data-hierarchy-mode]")) return;
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      if (!form.matches("[data-hierarchy-mode]")) payload.share_data_with_peers = Boolean(form.elements.share_data_with_peers?.checked);
      const roleId = form.dataset.hierarchyEdit;
      const url = form.matches("[data-hierarchy-mode]") ? "/api/admin/security/role-hierarchy/mode" :
        roleId ? `/api/admin/security/role-hierarchy/${roleId}` : "/api/admin/security/role-hierarchy";
      try { await api(url, {method: form.matches("[data-hierarchy-mode]") || roleId ? "PUT" : "POST", body: JSON.stringify(payload)});
        toast("Roles updated", "Hierarchy settings saved."); await renderRoute();
      } catch(error) { toast("Could not save role", error.message, "error"); }
    });
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-hierarchy-delete]");
      if (!button) return;
      const id = button.dataset.hierarchyDelete;
      const replacement = (await promptDialog("Enter the ID of the replacement role for assigned users and child roles. Leave blank only if this role has no users or children."));
      if (replacement === null) return;
      if (replacement && !/^\\d+$/.test(replacement.trim())) return toast("Invalid role ID", "Enter the numeric ID of an existing role.", "error");
      if (!(await confirmDialog("Delete this role and reassign its users and child roles?"))) return;
      try { await api(`/api/admin/security/role-hierarchy/${id}`, {method:"DELETE", body: JSON.stringify(replacement ? {reassign_to_role_id:Number(replacement)} : {})});
        toast("Role deleted", "Assignments have been transferred where applicable."); await renderRoute();
      } catch(error) { toast("Could not delete role", error.message, "error"); }
    });
  }


  // Zoho-inspired company settings workspace. Existing setup resources keep their
  // own authorization checks and CRUD routes; this layer only changes navigation.
  async function companySettingsWorkspace(tab = "company") {
    const tabs = [
      ["company", "Company Details"], ["domain", "Domain Mapping"],
      ["fiscal", "Fiscal Year"], ["hours", "Business hours"],
      ["holidays", "Holidays"], ["currencies", "Currencies"],
      ["hierarchy", "Hierarchy Preference"]
    ];
    const active = tabs.some(([key]) => key === tab) ? tab : "company";
    const nav = tabs.map(([key, label]) =>
      `<a class="cs-tab ${key === active ? "active" : ""}" href="/setup/company_details/${key}" ${key === active ? 'aria-current="page"' : ""}>${esc(label)}</a>`
    ).join("");
    let body = "";
    if (active === "company") {
      const [org, settings] = await Promise.all([api("/api/organization"), api("/api/settings/general")]);
      const value = (v) => esc(v == null || v === "" ? "—" : String(v));
      body = `<div class="cs-company-head"><div class="cs-company-icon" aria-hidden="true">▦</div><div class="cs-company-intro">
        <h2>${value(org.name)} <a class="cs-edit" href="/settings/organization" aria-label="Edit organization">✎</a></h2>
        <p>Org ID: <strong>${value(org.public_id ?? settings.org_public_id ?? org.id)}</strong></p>
        <p class="cs-muted">Organization profile and workspace identity</p>
        <p>Membership: ${value(org.membership_role)} · ${value(org.member_count)} member(s)</p>
        </div></div>
        <div class="cs-section"><h3>Company information</h3><dl class="cs-facts">
        <dt>Organization name</dt><dd>${value(org.name)}</dd>
        <dt>Organization ID</dt><dd>${value(org.public_id ?? settings.org_public_id ?? org.id)}</dd>
        <dt>Workspace URL slug</dt><dd>${value(org.slug)}</dd>
        <dt>Base currency</dt><dd>${value(settings.currency)}</dd>
        </dl><a class="button button-primary" href="/settings/organization">Manage organization & members</a>
        <a class="button" href="/settings/general">Edit workspace defaults</a></div>
        <div class="cs-section"><h3>Locale Information</h3><dl class="cs-facts">
        <dt>Time zone</dt><dd>${value(settings.timezone)}</dd>
        <dt>Date format</dt><dd>${value(settings.date_format)}</dd>
        <dt>Fiscal year begins</dt><dd>${value(settings.fiscal_year_start)}</dd>
        </dl></div>
`;
    } else if (active === "domain") {
      body = `<div class="cs-empty"><div class="cs-globe" aria-hidden="true">◎</div><h2>Rebrand your Portals</h2>
      <p>Access your CRM portals with your own custom domain.</p>
      <p class="cs-muted">Custom domain mapping is not configured in this CRM yet. Domain verification, TLS provisioning and routing must be implemented before this can be enabled.</p></div>`;
    } else if (active === "hierarchy") {
      body = `<h2>Hierarchy Preference</h2><p>Choose how record access follows your organization hierarchy.</p>
      <div class="cs-choice"><strong>Role Hierarchy</strong><p>Manage role-based access through the existing hierarchy configuration.</p>
      <a href="/setup/roles" class="button button-primary">Manage Role Hierarchy</a></div>
      <div class="cs-choice"><strong>Reporting Hierarchy</strong><p class="cs-muted">A separate reporting-hierarchy mode is not available yet. No permissions are changed on this page.</p></div>`;
    } else {
      const key = {fiscal:"fiscal_years", hours:"business_hours", holidays:"holidays", currencies:"currencies"}[active];
      const heading = tabs.find(([name]) => name === active)?.[1] || "";
      body = `<div class="cs-heading"><h2>${esc(heading)}</h2><p>Manage your organization's ${esc(heading.toLowerCase())}.</p>
      <a class="button button-primary" href="/setup/${key}">Manage ${esc(heading)}</a></div>`;
      if (active === "fiscal") {
        const setting = await api("/api/settings/general");
        body += `<div class="cs-choice"><dl class="cs-facts"><dt>Fiscal year begins in</dt><dd>${esc(setting.fiscal_year_start || "Not set")}</dd></dl>
        <a href="/settings/general">Edit fiscal year preferences</a></div>`;
      }
      // Display existing records in-place rather than offering dead-end tabs.
      if (state.platformCatalog.resources[key]) body += await platformPanel(key, true);
    }
    return `<div class="cs-workspace"><nav class="cs-tabs" aria-label="Company settings tabs">${nav}</nav>
      <div class="cs-body">${body}</div></div>`;
  }

  async function setupView(resource, subparts = []) {
    if(['connections','integration_settings','marketplace_integrations','protected_fields','sandboxes'].includes(resource)) {
      const content=await enterpriseRuntime.view(resource,subparts);
      return `<section class="setup-page-shell"><div class="setup-workspace">${setupDirectory(resource)}<div class="settings-content">${content}</div></div></section>`;
    }
    if (resource === 'index') return setupLandingView();
    if (resource === "roles") bindHierarchyRoleActions();
    if (resource === "sharing_rules") bindSharingRuleActions();
    if (resource === "module_permissions") bindModulePermissions();
    if (resource === "profiles") bindProfilePermissions();
    if (resource === "users" && String(state.profile?.role || "").toLowerCase() !== "administrator" && state.profile?.owner_console_access !== true) return myProfileView();
    if (resource === "custom_modules" && subparts[0] === "new") return customModuleBuilderView(null);
    if (resource === "custom_modules" && subparts[0] === "builder") return customModuleBuilderView(Number(subparts[1]));
    let content;
    if (resource === "company_details") content = await companySettingsWorkspace(subparts[0] || "company");
    else if (resource === "search_setup") content = setupSearchView();
    else if (resource === "customize_setup") content = await customizeSetupView();
    else if (resource === "personal_settings") content = await myProfileView();
    else if (resource === "users") content = await profileUsersView();
    else if (resource === "roles") content = await hierarchyRolesView();
    else if (resource === "profiles" && subparts[0] === "new") content = `<section class="card settings-section"><h2>New permission profile</h2><p>New profiles start with no access. Assign permissions before adding users.</p><form data-profile-new class="form-grid"><label class="field">Profile name<input class="field-input" name="name" required maxlength="120"></label><label class="field">Description<textarea class="field-textarea" name="description"></textarea></label><div class="form-actions"><button class="button button-primary">Create profile</button><a class="button" href="/setup/profiles">Cancel</a></div></form></section>`;
    else if (resource === "profiles") content = subparts.length ? await profilePermissionDetailsView(decodeURIComponent(subparts[0])) : await profilesDirectoryView();
    else if (resource === "sharing_rules") content = await dataSharingRulesView();
    else if (resource === "module_permissions") content = await modulePermissionsView();
    else if (resource === "approval_processes") content = await approvalSettingsView();
    else if (resource === "blueprints") content = await blueprintSettingsView();
    else if (resource === "workflow_rules") content = await workflowRulesView();
    else if (resource === "audit_log") content = await auditView();
    else if (resource === "recycle_bin") content = await recycleBinView();
    else if (resource === "import") content = importView();
    else if (resource === "import_history") content = await importHistoryView();
    else if (resource === "export") content = exportView();
    else if (resource === "duplicates") content = duplicateView();
    else if (resource === "custom_modules") content = subparts[0] === "modules" ? await customModulesAdminView() : modulesAndFieldsLandingView();
    else if (state.platformCatalog.resources[resource]) {
      content = await platformPanel(resource, true);
    }
    else content = `<section class="card">${emptyState("!", "Unknown setup page", "Choose a setup item from the directory.")}</section>`;
    return `<section class="setup-page-shell"><div class="setup-toolbar setup-toolbar-search-only"><label class="toolbar-search setup-toolbar-search"><span>⌕</span><input data-setup-search-input placeholder="Search Setup" /></label></div><div class="setup-workspace">${setupDirectory(resource)}<div class="settings-content">${content}</div></div></section>`;
  }

  return { setupDirectory, setupSearchView, customizeSetupView, auditView, recycleBinView, importView, exportView, duplicateView, workflowRulesView, securityAdminView, cpqView, bindSecurityAdmin, bindCPQ, developerHubView, setupConsoleView, bindDeveloperHub, bindMetadataModuleActions, bindSetupConsole, metadataFieldEnabled, customModulesAdminView, customModuleBuilderView, builderFieldCards, builderSlug, renderBuilderFields, bindBuilderFieldActions, saveCustomBuilder, bindCustomModuleAdmin, customRuntimeFieldControl, customRuntimeView, bindCustomRuntime, setupLandingView, setupView };
}



