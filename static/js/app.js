import { createRouteLoading } from "./features/route-loading.js?v=20261029-loading-logo-v2";
import { installGlobalSearch } from "./features/global-search.js";
import { installModuleAI } from "./features/module-ai.js?v=20261029-cross-module-ai-v6";
import { notFoundView } from "./features/not-found.js?v=20261027-404-v1";
import { confirmDialog,promptDialog,notify } from "./core/dialogs.js?v=20261027-centered-popups-v1";
import "./features/webforms-designer.js?v=20261027-centered-popups-v1";
import { createReportBuilder } from "./features/report-builder.js?v=20261027-centered-popups-v1";
import { blockedPlanRoute, applyPlanNavigation } from "./features/plan-access.js";
import { installFormRefinement } from "./features/form-refinement.js?v=20261029-qa-retest-v2";
import { mountRecordSharing } from "./features/record-sharing.js";
import { renderGridView } from "./features/grid-view.js";
import { createOrganizationSettings } from "./features/organization-settings.js?v=20261027-centered-popups-v1";
import { createAppInteractions } from "./features/app-interactions.js?v=20261029-loading-v1";
import { layoutQuoteForm, layoutProductLineItems, fillQuoteAccountAddresses } from "./features/quote-layout.js?v=20261028-detail-grid-v1";
import { createRelatedViews, createCoreDetailViews } from "./features/related-records.js?v=20261028-human-labels-v1";
import { installAttachmentPicker, createAttachmentFromFile } from "./features/attachments.js";
import { requestJson } from "./core/http.js?v=20261015-sharing-security-v1";
import { renderPricingView, bindPricingInteractions } from "./features/pricing.js?v=20261008-convosis-ui-v2";
import { state, PLATFORM_MODULE_ROUTES, $, $$, esc, titleCase, initials, formatDate, formatDateTime, formatMoney, slug, pathFor, badge, lookupName } from "./core/runtime.js?v=20261014-timeline-timezone-v1";
import { MODULES } from "./features/modules.js";
import { FILTERABLE_MODULES, renderModuleFilters, bindModuleFilters } from "./features/module-filters.js";
import { createSetupFeature } from "./features/setup.js?v=20261029-enterprise-runtime-v1";
import { createImportWizardFeature } from "./features/import-wizard.js";
import { createBlueprintFeature } from "./features/blueprints.js?v=20261027-centered-popups-v1";
import { createWorkflowRulesUI } from "./features/workflow-rules.js?v=20261027-centered-popups-v1";
import { createAiFeature } from "./features/ai.js?v=20261028-apex-section-tabs-v1";
import { createTeamspacesFeature } from "./features/teamspaces.js?v=20261028-teamspace-save-navigation-v2";
import { createDashboardSupport } from "./features/dashboard-support.js";
import { loading } from "./features/loading-view.js";
import { createPlatformDetailFeature } from "./features/platform-detail.js?v=20261028-detail-grid-v1";
import { createContextActions } from "./features/context-actions.js";
import { createUsability, activityDefaults, viewError } from "./features/usability.js?v=20261029-enterprise-runtime-v1";
const usability = createUsability({state, esc, titleCase});
installFormRefinement({api,state});
async function api(path, options = {}, retried = false) {
  try {
    return await requestJson(path, options, state.aiStatus?.csrf_token || null);
  } catch (error) {
    if (error.status === 403 && error.code === "CSRF_REJECTED" && !retried && path !== "/api/ai/status") {
      let refreshed = null;
      try {
        refreshed = await requestJson("/api/ai/status", {}, null);
      } catch {
        throw error;
      }
      if (refreshed?.csrf_token) {
        state.aiStatus = refreshed;
        return api(path, options, true);
      }
    }
    throw error;
  }
}
function toast(title, message = "", type = "success") {
  return notify(title, message, {type});
}

function setBreadcrumb(label, parent = "Workspace") {
  $("#breadcrumbs").innerHTML = `<span>${esc(parent)}</span><b>/</b><strong>${esc(label)}</strong>`;
}
function activeNav(route) {
  const parts = route.split("/").filter(Boolean);
  const root = parts[0] || "dashboard";
  $$('[data-route]').forEach((link) => {
    // Activities shares one module root, but each child page has its own sidebar link.
    // Match that child by pathname so Tasks, Meetings and Calls cannot all be active.
    const linkPath = new URL(link.getAttribute("href"), window.location.origin).pathname.replace(/^\/app(?=\/|$)/, "").replace(/\/$/, "");
    const isActivityLink = link.dataset.route === "activities";
    const selected = isActivityLink
      ? (root === "activities" && (route === linkPath || route.startsWith(linkPath + "/")))
      : link.dataset.route === root;
    link.classList.toggle("active", selected);
  });
  $$('[data-custom-module-route]').forEach((link) => link.classList.toggle("active", root === "custom" && link.dataset.customModuleRoute === parts[1]));
}
function enhanceNavigation() {
  const setupLink = $('[data-route="setup"]');
  if (setupLink) setupLink.textContent = "Settings & Setup";
  const settingsLink = $('[data-route="settings"]');
  if (settingsLink) settingsLink.remove();
  const addAfter = (route, nextRoute, label) => {
    const anchor = $(`[data-route="${route}"]`);
    if (anchor && !$(`[data-route="${nextRoute}"]`)) anchor.insertAdjacentHTML("afterend", `<a href="/${nextRoute}" data-route="${nextRoute}">${label}</a>`);
  };
  addAfter("invoices", "payments", "Payments");
  addAfter("documents", "site_visits", "Site Visits");
  addAfter("reports", "sales_targets", "Sales Targets & Incentives");
  addAfter("sales_targets", "ai", "AI Copilot");
}
async function pricingView() {
  return renderPricingView({ api, esc, pageHeader });
}
function bindPricing() {
  return bindPricingInteractions({
    api,
    toast,
    state,
    applyProfile,
    renderRoute,
    titleCase,
    queryOne: $,
    queryAll: $$,
  });
}
function pageHeader(eyebrow, title, copy, actions = "", { showAI = true } = {}) {
  return `<div class="page-heading"><div><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p class="subheading">${esc(copy)}</p></div><div class="heading-actions">${showAI ? `<button type="button" class="button button-ghost" data-module-ai-open aria-label="${esc(title)} AI actions">✦ AI actions</button>` : ""}${actions}</div></div>`;
}

function emptyState(icon, title, copy, button = "") { return `<div class="empty-state"><span class="empty-icon">${icon}</span><h3>${esc(title)}</h3><p>${esc(copy)}</p>${button ? `<div style="margin-top:16px">${button}</div>` : ""}</div>`; }
async function ensureLookups() {
  if (state.lookups.loaded) return;
  const resources = ["accounts", "contacts", "leads", "deals"];
  const results = await Promise.allSettled(
    resources.map((resource) => api(`/api/${resource}?limit=100`))
  );
  results.forEach((result, index) => {
    const resource = resources[index];
    state.lookups[resource] = result.status === "fulfilled"
      ? (result.value?.items || [])
      : [];
  });
  state.lookups.loaded = true;
}
async function ensurePlatformLookup(resource) {
  if (state.platformLookups[resource]) return;
  try {
    state.platformLookups[resource] = (await api(resource === "products" ? "/api/products?limit=100" : `/api/platform/${resource}?limit=100&sort=name_asc`)).items || [];
  } catch (error) {

    state.platformLookups[resource] = [];
  }
}
function invalidateLookups() { state.lookups.loaded = false; state.platformLookups = {}; }
async function refreshMeta() {
  try { state.meta = await api("/api/meta"); } catch (error) { /* keep the previous list */ }
}
async function ensurePlatformCatalog() {
  if (Object.keys(state.platformCatalog.resources || {}).length) return true;
  try {
    state.platformCatalog = await api("/api/platform/catalog");
    return Object.keys(state.platformCatalog.resources || {}).length > 0;
  } catch (error) {
    return false;
  }
}

async function ensureCustomModules() {
  try {
    const data = await api("/api/admin/metadata/modules");
    state.customModules = data.items || [];
  } catch {
    state.customModules = [];
  }
  return state.customModules;
}
function enhanceCustomModuleNavigation() {
  $$('.dynamic-custom-module-link').forEach((node) => node.remove());
  $('.dynamic-custom-module-label')?.remove();
  const enabled = (state.customModules || []).filter((module) => module.enabled);
  if (!enabled.length) return;
  const anchor = $('[data-route="deals"]');
  if (!anchor) return;
  const html = `<span class="nav-label dynamic-custom-module-label">CUSTOM MODULES</span>${enabled.map((module) => `<a class="dynamic-custom-module-link" href="/custom/${esc(module.api_name)}" data-custom-module-route="${esc(module.api_name)}">${esc(module.plural_label || module.label)}</a>`).join("")}`;
  anchor.insertAdjacentHTML("afterend", html);
}
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
function applyProfile() {
  const profile = state.profile;
  if (!profile) return;
  applyPlanNavigation(profile);
  const username = String(profile.username || profile.name || "Account").trim() || "Account";
  const role = String(profile.role || "CRM user").trim() || "CRM user";
  const planName = String(profile.plan_name || profile.subscription?.plan_name || "Free").trim() || "Free";
  const isOwnerAdmin = profile.owner_console_access === true;
  const isAdministrator = role.toLowerCase() === "administrator";
  const planCode = String(profile.subscription?.plan_code || profile.plan_code || "").toLowerCase();
  const isEnterprise = planCode === "enterprise" || planName.toLowerCase() === "enterprise";
  for (const id of ["sidebar-upgrade-plan", "upgrade-plan-button"]) {
    const upgrade = document.getElementById(id);
    if (upgrade) {
      upgrade.hidden = isEnterprise || isOwnerAdmin;
      upgrade.setAttribute("aria-hidden", String(isEnterprise || isOwnerAdmin));
    }
  }


  document.querySelectorAll("[data-admin-only]").forEach((node) => {
    node.hidden = !isAdministrator;
    node.setAttribute("aria-hidden", String(!isAdministrator));
  });

  const photo = typeof profile.avatar_data === "string" && /^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(profile.avatar_data) ? profile.avatar_data : "";
  document.querySelectorAll(".user-mini .avatar, .top-profile .avatar, .profile-settings-avatar").forEach((node) => {
    node.textContent = photo ? "" : initials(username);
    node.style.backgroundImage = photo ? 'url("' + photo + '")' : "none";
    node.classList.toggle("has-profile-photo", Boolean(photo));
  });
  $$(".user-mini strong").forEach((node) => { node.textContent = username; });
  $$(".user-mini-role").forEach((node) => { node.textContent = role; });
  $$(".user-mini-plan").forEach((node) => { node.textContent = planName; });

  const topProfile = $("#top-profile");
  const ownerButton = $("#owner-console-button");
  if (topProfile) {
    topProfile.hidden = false;
    topProfile.setAttribute("aria-hidden", "false");
  }
  if (ownerButton) {
    ownerButton.hidden = !isOwnerAdmin;
    ownerButton.setAttribute("aria-hidden", String(!isOwnerAdmin));
  }
  $$(".top-profile-copy strong").forEach((node) => { node.textContent = username; });
  $$(".top-profile-copy small").forEach((node) => { node.textContent = role; });
  const drawerAvatar = $("#crm-account-avatar");
  if (drawerAvatar) { drawerAvatar.textContent = photo ? "" : initials(username); drawerAvatar.style.backgroundImage = photo ? `url("${photo}")` : "none"; }
  if ($("#crm-account-name")) $("#crm-account-name").textContent = username;
  if ($("#crm-account-role")) $("#crm-account-role").textContent = role;
  if ($("#crm-account-plan")) $("#crm-account-plan").textContent = planName;
  if ($("#crm-account-id")) $("#crm-account-id").textContent = (profile.public_id ?? profile.id) ? `User ID: ${profile.public_id ?? profile.id}` : "";
  if ($("#crm-account-owner")) $("#crm-account-owner").hidden = !isOwnerAdmin;
}
async function refreshNavCount() {
  try {
    const data = await api("/api/leads?limit=1");
    const badgeNode = $("#nav-leads-count");
    if (badgeNode) { badgeNode.textContent = data.total; badgeNode.hidden = !data.total; }
  } catch (error) { /* counts are best effort */ }
}
const workflowRulesUI = createWorkflowRulesUI({api, esc, toast, navigate, renderRoute, state});
const importWizardUI = createImportWizardFeature({api, toast, navigate, esc, MODULES});
const { platformDetailView, bindPlatformDetail } = createPlatformDetailFeature({ api, state, esc, formatDateTime, formatMoney, navigate, openPlatformModal, deletePlatformRecord, selectAll: $$ });
const { openDealForAccount, bindContextCreationActions } = createContextActions({ api, openPlatformModal, openRecordModal, state, toast, selectAll: $$ });
const { teamspacesView, bindTeamspaces } = createTeamspacesFeature({ api, pageHeader, esc, emptyState, $, $$, readForm, toast, navigate, onSaved: () => usability.clear() });
const { dashboardReportView, performanceTable, attentionQueue, attentionPanel, activityItem, bindDashboard } = createDashboardSupport({ api, formatDate, formatDateTime, formatMoney, esc, badge, pageHeader, emptyState, titleCase, $$, openRecordModal });
let currentRouteIs404 = false;
async function navigate(path, replace = false) {
  const webformAction = /^\/(?:webforms(?:\/|$)|setup\/webforms(?:\/|$))/.test(window.location.pathname) && /^\/webforms(?:\/|$)/.test(path);
  if (!webformAction && !(await usability.canLeave())) return false;
  usability.clear();
  if (replace) history.replaceState(history.state || {}, "", path); else history.pushState({ crmPreviousPage: !currentRouteIs404 }, "", path);
  state.route = path;
  await renderRoute();
  $("#sidebar").classList.remove("open");
}
const routeLoading = createRouteLoading({content: $("#app-content")});
let routeRenderGeneration = 0;
async function renderRoute() {
  currentRouteIs404 = false;
  const generation = ++routeRenderGeneration;
  const isCurrentRoute = () => generation === routeRenderGeneration;
  let renderedView;
  const route = window.location.pathname.replace(/^\/app(?=\/|$)/, "") || "/dashboard";
  state.route = route;
  activeNav(route);
  const content = $("#app-content");
  const priorBackdrop = $("#modal-backdrop");
  if (priorBackdrop?.classList.contains("crm-page-backdrop")) {
    priorBackdrop.classList.remove("crm-page-backdrop");
    $("#modal .crm-edit-layout")?.remove();
    priorBackdrop.hidden = true;
    state.modal = null;
    document.body.appendChild(priorBackdrop);
  }
  const routeParts = route.split("/").filter(Boolean);
  const finishLoading = routeLoading.start(route);
  refreshNavCount();
  try {
    if (blockedPlanRoute(route, state.profile?.subscription)) {
      content.innerHTML = '<section class="card" style="padding:28px"><h2>Plan access required</h2><p>This module is unavailable with your current subscription.</p><a class="button button-primary" href="/subscriptions">View plans</a></section>';
      return;
    }
    if (!["subscriptions", "settings", "owner"].includes(routeParts[0])) await ensureLookups();
    if (!isCurrentRoute()) return;
    const parts = route.split("/").filter(Boolean);
    if (!parts.length || route === "/dashboard") {
      setBreadcrumb("Dashboard");
      renderedView = await dashboardView();
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindDashboard();
      return;
    }
    if (parts[0] === "dashboard" && parts[1] === "report" && parts[2] && parts.length === 3) {
      setBreadcrumb("Dashboard report", "Dashboard");
      renderedView = await dashboardReportView(parts[2]);
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      return;
    }
    if (parts[0] === "teamspaces") {
      setBreadcrumb("Teamspaces", "Customization");
      renderedView = await teamspacesView();
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      return;
    }
    if (parts[0] === "pricing") {
      return navigate("/subscriptions", true);
    }
    if (parts[0] === "subscriptions") {
      setBreadcrumb("Upgrade plan", "Account");
      renderedView = await pricingView();
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindPricing();
      return;
    }
    if (parts[0] === "activities" && !parts[1]) {
      return navigate("/activities/tasks", true);
    }
    if (parts[0] === "ai") {
      if (parts[1] === "exceptions") {
        setBreadcrumb("Quotation Exceptions", "Apex AI Copilot");
        renderedView = await aiView();
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
        bindAI();
      } else {
        setBreadcrumb("AI Copilot", "Intelligence");
        renderedView = await aiDashboardView();
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
        // Animate APEX content only after its data has loaded.
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          content.classList.remove("apex-page-enter");
          void content.offsetWidth;
          content.classList.add("apex-page-enter");
        }
        bindDashboard();
        bindApexAssistant();
      }
      return;
    }
    if (parts[0] === "developer") {
      setBreadcrumb("Developer Hub", "Administration");
      renderedView = await developerHubView();
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindDeveloperHub();
      return;
    }
    if (parts[0] === "security") {
      const role = String(state.profile?.role || "").trim().toLowerCase();
      if (role !== "administrator") return navigate("/dashboard", true);
      setBreadcrumb("Security Administration", "Administration");
      renderedView = await securityAdminView();
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindSecurityAdmin();
      return;
    }
    if (parts[0] === "cpq") {
      setBreadcrumb("CPQ Workspace", "Sales & Inventory");
      renderedView = await cpqView();
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindCPQ();
      return;
    }
    if (parts[0] === "setup-console") {
      setBreadcrumb("Setup Console", "Administration");
      renderedView = await setupConsoleView(parts[1] || "modules");
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindSetupConsole();
      return;
    }
    if (parts[0] === "setup" && parts[1] === "webforms") return navigate("/webforms", true);
    if (parts[0] === "setup") {
      const resource = parts[1] || "index";
      if (resource === "workflow_rules") {
        setBreadcrumb("Workflow Rules", "Setup");
        renderedView = `<section class="setup-page-shell"><div class="setup-toolbar setup-toolbar-search-only"><label class="toolbar-search setup-toolbar-search"><span>⌕</span><input data-setup-search-input placeholder="Search Setup" /></label></div><div class="setup-workspace">${setupDirectory("workflow_rules")}<div class="settings-content" id="workflow-rules-container">${await workflowRulesUI.view()}</div></div></section>`;
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
        bindSettings();
        workflowRulesUI.bind($("#workflow-rules-container"));
        return;
      }
      setBreadcrumb(resource === "index" ? "Setup" : titleCase(resource), "Setup");
      renderedView = await setupView(resource, parts.slice(2));
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindSettings();
      if (state.platformCatalog.resources[resource] || resource === "recycle_bin") bindPlatform(resource);
      return;
    }
    if (parts[0] === "custom" && parts[1]) {
      const module = (state.customModules || []).find((item) => item.api_name === parts[1] && item.enabled);
      if (!module) return navigate("/dashboard", true);
      setBreadcrumb(module.plural_label || module.label, "Custom Modules");
      renderedView = await customRuntimeView(module);
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindCustomRuntime(module);
      return;
    }
    if (parts[0] === "import" && ["leads", "deals", "accounts", "contacts"].includes(parts[1])) {
      setBreadcrumb("Import " + MODULES[parts[1]].label, "Data Administration");
      content.innerHTML = importWizardUI.view(parts[1]);
      importWizardUI.bind(content);
      return;
    }
    if (parts[0] === "settings") {
      const validTabs = ["general", "my-profile", "profile-users", "organization", "approval-process", "blueprint"];
      if (parts[1] && !validTabs.includes(parts[1])) return navigate("/settings/general", true);
      const tab = parts[1] || "general";
      setBreadcrumb("Settings", "Manage");
      renderedView = await settingsView(tab);
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindSettings();
      if (tab === 'organization') bindOrganizationManagement();
      return;
    }
    if (parts[0] === "reports") {
      setBreadcrumb("Reports", "Analytics");
      renderedView = await reportEngineView();
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindReportDashboard();
      return;
    }
    if (parts[0] === "dashboards") {
      setBreadcrumb("Dashboards", "Analytics");
      renderedView = await dashboardBuilderView(parts[1] ? Number(parts[1]) : null);
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindReportDashboard();
      return;
    }
    // Security profiles are configuration editors, not generic CRM records.
    if (parts[0] === "profiles") {
      setBreadcrumb("Profiles", "Security Control");
      if (parts[1] && /^\d+$/.test(parts[1])) {
        const profile = await api("/api/platform/profiles/" + Number(parts[1]));
        const name = String(profile.name || profile.data?.name || profile.title || "").trim();
        if (!name) throw new Error("Profile name is missing");
        renderedView = await setupView("profiles", [name]);
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
      } else if (parts[1]) {
        renderedView = await setupView("profiles", [decodeURIComponent(parts[1])]);
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
      } else {
        renderedView = await setupView("profiles");
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
      }
      return;
    }
    if (parts[0] === "webforms" && parts.length === 2 && /^\d+$/.test(parts[1])) return navigate("/webforms/edit/"+parts[1], true);
    if (parts[0] === "webforms" && parts[1] === "analytics" && /^\d+$/.test(parts[2] || "") && parts.length === 3) {
      setBreadcrumb("Webform Analytics", "Webforms");
      content.innerHTML = await window.webformAnalyticsPage(parts[2]);
      return;
    }
    if (PLATFORM_MODULE_ROUTES.includes(parts[0])) {
      const catalogReady = await ensurePlatformCatalog();
      if (!isCurrentRoute()) return;
      const resource = parts[0];
      if (!catalogReady || !state.platformCatalog.resources[resource]) {
        content.innerHTML = `<div class="card empty-state"><span class="empty-icon">!</span><h3>${esc(titleCase(resource))} is temporarily unavailable</h3><p>CONVOSIS CRM could not load the module catalog. Please retry without leaving this module.</p><div style="margin-top:16px"><button class="button button-primary" data-retry>Retry module</button></div></div>`;
        return;
      }
      setBreadcrumb(state.platformCatalog.resources[resource].label);
      if (parts[1] === "create" || (parts[1] === "edit" && /^\d+$/.test(parts[2] || ""))) {
        const id = parts[1] === "edit" ? Number(parts[2]) : null;
        setBreadcrumb(id ? "Edit Record" : "Create Record", state.platformCatalog.resources[resource].label);
        content.innerHTML = '<div class="crm-fullpage-form-host" id="crm-fullpage-form-host"></div>';
        await presentFullPageForm(resource, id);
        return;
      }
      if (parts[1] && /^\d+$/.test(parts[1])) {
        renderedView = await platformDetailView(resource, Number(parts[1]));
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
        bindPlatformDetail(resource, Number(parts[1]));
      } else {
        renderedView = await platformModuleView(resource);
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
        bindPlatform(resource);
      }
      return;
    }
    if (parts[0] === "activities" && ["tasks", "meetings", "calls"].includes(parts[1])) {
      const type = parts[1].slice(0, -1).replace(/^./, (value) => value.toUpperCase());
      setBreadcrumb(`${type}s`, "Activities");
      renderedView = await activityTypeView(type);
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindModule("activities");
      return;
    }
    if (parts[0] === "leads" && parts[1] && parts[2] === "convert") {
      setBreadcrumb("Convert Lead", "Leads");
      renderedView = await leadConvertPage(Number(parts[1]));
      if (!isCurrentRoute()) return;
      content.innerHTML = renderedView;
      bindLeadConvertPage(Number(parts[1]));
      return;
    }
    if (parts[0] === "leads" && parts[1] && parts[2] === "converted") {
      setBreadcrumb("Lead Converted", "Leads");
      content.innerHTML = leadConversionSuccess();
      document.querySelectorAll("[data-conversion-go]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.conversionGo)));
      return;
    }

    if (parts[0] === "layout-settings") {
      setBreadcrumb("Layouts", "Customization");
      await ensurePlatformCatalog();
      if (!isCurrentRoute()) return;
      const available = [...new Set([...Object.keys(MODULES),...Object.keys(state.platformCatalog.resources || {})])];
      const resource = available.includes(parts[1]) ? parts[1] : "leads";
      await fetchStandardLayout(resource);
      if (!isCurrentRoute()) return;
      const info = standardLayouts[resource] || {};
      const names = ["Standard",...Object.keys(info.named_layouts || {}).filter(n=>n.toLowerCase()!=="standard")];
      content.innerHTML = '<section class="card settings-section"><div class="settings-section-head"><h2>Modules and Fields / Layouts</h2><p>Manage layouts for each CRM module.</p></div><label>Module <select class="field-select" data-layout-settings-resource>'+available.map(k=>'<option value="'+esc(k)+'" '+(k===resource?'selected':'')+'>'+esc(MODULES[k]?.label||state.platformCatalog.resources[k]?.label||titleCase(k))+'</option>').join("")+'</select></label><div class="settings-section-head settings-heading-row"><h2>'+esc(MODULES[resource]?.label||titleCase(resource))+' — Layouts</h2><button type="button" class="button button-primary" data-new-layout>Create New Layout</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+names.map(n=>'<tr><td>'+esc(n)+'</td><td>Active</td><td><button class="button button-small button-ghost" data-edit-layout-name="'+esc(n)+'">Edit</button> '+(n==="Standard"?'<span>Default · Protected</span>':'<button class="button button-small button-ghost" data-delete-layout-name="'+esc(n)+'">Delete</button>')+'</td></tr>').join("")+'</tbody></table></div></section>';
      content.querySelector("[data-layout-settings-resource]").addEventListener("change",e=>navigate("/layout-settings/"+e.target.value));
      content.querySelector("[data-new-layout]").addEventListener("click",async()=>{
        const typed=(await promptDialog("New layout name:")); if(typed===null)return;
        const name=typed.trim(); if(!name)return toast("Layout name required","Enter a layout name.","error");
        if(names.some(n=>n.toLowerCase()===name.toLowerCase()))return toast("Duplicate layout name","Choose a different name.","error");
        const sections=(info.sections?.length?info.sections:[{id:"information",title:"Information",fields:[]}]).map(v=>({id:v.id,title:v.title,fields:[...(v.fields||[])]}));
        try {await api("/api/admin/standard-layout/"+resource+"/named",{method:"POST",body:JSON.stringify({name,sections})});localStorage.setItem("convosis-selected-layout:"+resource,name);navigate("/layout-settings/"+resource,true);}
        catch(e){toast("Layout creation failed",e.message,"error");}
      });
      content.querySelectorAll("[data-edit-layout-name]").forEach(b=>b.addEventListener("click",()=>{localStorage.setItem("convosis-selected-layout:"+resource,b.dataset.editLayoutName);navigate("/layout-editor/"+resource);}));
      content.querySelectorAll("[data-delete-layout-name]").forEach(b=>b.addEventListener("click",async()=>{
        const name=b.dataset.deleteLayoutName;
        if(!(await confirmDialog('Delete custom layout "'+name+'"?')))return;
        try {await api("/api/admin/standard-layout/"+resource+"/named/"+encodeURIComponent(name),{method:"DELETE"});if(localStorage.getItem("convosis-selected-layout:"+resource)===name)localStorage.setItem("convosis-selected-layout:"+resource,"Standard");navigate("/layout-settings/"+resource,true);}
        catch(e){toast("Deletion failed",e.message,"error");}
      }));
      return;
    }
    if (parts[0] === "layout-editor" && parts[1]) {
      const resource = parts[1];
      const config = MODULES[resource] || state.platformCatalog.resources[resource];
      if (!config) return navigate("/dashboard", true);
      setBreadcrumb("Edit Page Layout", config.label);
      await fetchStandardLayout(resource);
      if (!isCurrentRoute()) return;
      content.innerHTML = layoutEditorPage(resource, config);
      bindLayoutEditor(resource, config);
      return;
    }
    if (parts.length >= 2 && (MODULES[parts[0]] || state.platformCatalog.resources[parts[0]] || parts[0] === "users") && (parts[1] === "create" || parts[1] === "edit" && /^\d+$/.test(parts[2] || ""))) {
      const resource = parts[0], id = parts[1] === "edit" ? Number(parts[2]) : null;
      setBreadcrumb(id ? "Edit Record" : "Create Record", resource);
      content.innerHTML = '<div class="crm-fullpage-form-host" id="crm-fullpage-form-host"></div>';
      await presentFullPageForm(resource, id);
      return;
    }
    if (route === "/leads/create") {
      setBreadcrumb("Create Lead", "Leads");
      content.innerHTML = createLeadPage();
      bindCreateLeadPage();
      return;
    }
    if (MODULES[parts[0]]) {
      const resource = parts[0];
      setBreadcrumb(parts[1] ? `${MODULES[resource].singular} detail` : MODULES[resource].label);
      if (parts[1] && !Number.isInteger(Number(parts[1]))) return navigate(`/${resource}`, true);
      if (parts[1]) {
        renderedView = await detailView(resource, Number(parts[1]));
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
        bindDetail(resource, Number(parts[1]));
      } else {
        renderedView = await moduleView(resource);
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
        bindModule(resource);
      }
      return;
    }
    if (state.platformCatalog.resources[parts[0]]) {
      const resource = parts[0];
      setBreadcrumb(state.platformCatalog.resources[resource].label);
      if (parts[1] && /^\d+$/.test(parts[1])) {
        renderedView = await platformDetailView(resource, Number(parts[1]));
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
        bindPlatformDetail(resource, Number(parts[1]));
      } else {
        renderedView = await platformModuleView(resource);
        if (!isCurrentRoute()) return;
        content.innerHTML = renderedView;
        bindPlatform(resource);
      }
      return;
    }
    currentRouteIs404 = true;
    setBreadcrumb("Page not found");
    content.innerHTML = notFoundView();
    content.querySelector("[data-not-found-back]").addEventListener("click", () => {
      if (history.state?.crmPreviousPage) history.back();
      else navigate("/dashboard", true);
    });
  } catch (error) {
    if (!isCurrentRoute()) return;
    const issue = viewError(error);
    content.innerHTML = `<section class="card empty-state"><span class="empty-icon" aria-hidden="true">!</span><h3>${esc(issue.title)}</h3><p>${esc(issue.message)}</p><div class="form-actions">${issue.retry ? '<button class="button button-primary" data-retry>Try again</button>' : `<button class="button button-primary" data-go="${issue.path || '/dashboard'}">${esc(issue.action || 'Back to dashboard')}</button>`}</div></section>`;
    content.querySelector('[data-retry]')?.addEventListener('click',()=>renderRoute());
  } finally {
    if (!isCurrentRoute()) return;
    finishLoading();
    if (routeParts.length === 2 && /^\d+$/.test(routeParts[1]) &&
        (MODULES[routeParts[0]] || state.platformCatalog?.resources?.[routeParts[0]]) &&
        !["profiles", "roles", "users"].includes(routeParts[0]) &&
        !content.querySelector(':scope > section.empty-state')) {
      await mountRecordSharing({root:content,resource:routeParts[0],id:routeParts[1],api,esc,toast});
    }
    if (!isCurrentRoute()) return;
    usability.enhance(content);
    // Scope scroll locking to rendered core record details; restore it on exit.
    const isDetailPage = Boolean(content.querySelector(".detail-page-shell"));
    document.documentElement.classList.toggle("record-detail-page", isDetailPage);
    document.body.classList.toggle("record-detail-page", isDetailPage);
  }
}
async function dashboardView() {
  const data = await api("/api/dashboard");
  const metrics = data.metrics;
  const maxPipeline = Math.max(...data.pipeline.map((row) => row.amount), 1);
  const maxLeads = Math.max(...data.lead_funnel.map((row) => row.count), 1);
  const performancePanel = `<section class="card dashboard-performance"><div class="card-head"><div class="card-head-copy"><h2>Sales performance</h2><small>Target, collections, conversion and earned incentive</small></div><button class="card-head-link" data-go="/sales_targets">Manage targets →</button></div><div class="card-body">${performanceTable(data.sales_performance || [])}</div></section>`;
  const queuePanel = attentionPanel(data.attention || {});
  return `${pageHeader("Overview", `${greeting()}, ${String(state.profile?.name || "there").split(" ")[0]}`, "Here is what is happening across your customer workspace.", `<button class="button button-ghost" data-module-ai-open><span class="button-icon">✦</span>Ask AI</button><button class="button button-ghost" data-create="activities"><span class="button-icon">＋</span>Log activity</button><button class="button button-primary" data-create="leads"><span class="button-icon">＋</span>Add lead</button>`, { showAI: false })}
    <div class="stats-grid">
      <button type="button" class="card stat-card dashboard-metric-link" data-go="/dashboard/report/total-leads" aria-label="Open Total leads report"><div class="stat-top"><span class="stat-label">Total leads</span><span class="stat-icon">✦</span></div><div class="stat-value">${metrics.total_leads}</div><div class="stat-foot"><span class="trend-up">Live</span><span>from CRM records</span></div></button>
      <button type="button" class="card stat-card dashboard-metric-link" data-go="/dashboard/report/open-deals" aria-label="Open Open deals report"><div class="stat-top"><span class="stat-label">Open deals</span><span class="stat-icon">◇</span></div><div class="stat-value">${metrics.open_deals}</div><div class="stat-foot"><span class="trend-up">Live</span><span>from CRM records</span></div></button>
      <button type="button" class="card stat-card dashboard-metric-link" data-go="/dashboard/report/pipeline-value" aria-label="Open Pipeline value report"><div class="stat-top"><span class="stat-label">Pipeline value</span><span class="stat-icon">₹</span></div><div class="stat-value">${formatMoney(metrics.pipeline_value)}</div><div class="stat-foot"><span class="trend-up">Live</span><span>open opportunities</span></div></button>
      <button type="button" class="card stat-card dashboard-metric-link" data-go="/dashboard/report/activities-due" aria-label="Open Activities due report"><div class="stat-top"><span class="stat-label">Activities due</span><span class="stat-icon">✓</span></div><div class="stat-value">${metrics.activities_due}</div><div class="stat-foot"><span class="trend-warm">Needs attention</span><span>next 7 days</span></div></button>
    </div>
    <div class="dashboard-grid management-grid">${performancePanel}${queuePanel}</div>
    <div class="dashboard-grid">
      <div class="dashboard-column">
        <section class="card"><div class="card-head"><div class="card-head-copy"><h2>Pipeline overview</h2><small>Open opportunities by stage</small></div><button class="card-head-link" data-go="/deals">View deals ↗</button></div><div class="card-body"><div class="pipeline-chart">${data.pipeline.length ? data.pipeline.map((row) => `<div class="pipeline-row"><span class="pipeline-label">${esc(row.stage)}</span><div class="progress-track"><div class="progress-bar" style="width:${Math.max(4, row.amount / maxPipeline * 100)}%"></div></div><span class="pipeline-meta"><strong>${formatMoney(row.amount)}</strong>${row.count} deal${row.count === 1 ? "" : "s"}</span></div>`).join("") : `<p class="loading">No pipeline records yet.</p>`}</div></div></section>
        <section class="card"><div class="card-head"><div class="card-head-copy"><h2>Recent activity</h2><small>Latest updates from the team</small></div><button class="card-head-link" data-go="/activities">View all ↗</button></div><div class="card-body"><div class="activity-list">${data.recent_activity.length ? data.recent_activity.map(activityItem).join("") : emptyState("✓", "No activity yet", "Log a call, task, or meeting to start your timeline.")}</div></div></section>
      </div>
      <div class="dashboard-column">
        <section class="card"><div class="card-head"><div class="card-head-copy"><h2>Lead funnel</h2><small>Current lead distribution</small></div><button class="card-head-link" data-go="/leads">View leads ↗</button></div><div class="card-body"><div class="funnel">${data.lead_funnel.length ? data.lead_funnel.map((row) => `<div class="funnel-row"><span>${esc(row.status)}</span><div class="funnel-bar"><i style="width:${Math.max(8, row.count / maxLeads * 100)}%"></i></div><b>${row.count}</b></div>`).join("") : `<p class="loading">No lead records yet.</p>`}</div></div></section>
        <section class="card"><div class="card-head"><div class="card-head-copy"><h2>Quick actions</h2><small>Keep your workspace up to date</small></div></div><div class="card-body"><div class="quick-actions"><button class="quick-action" data-create="leads"><span>✦</span>Add lead</button><button class="quick-action" data-create="contacts"><span>◎</span>Add contact</button><button class="quick-action" data-create="accounts"><span>▣</span>Add account</button><button class="quick-action" data-create="deals"><span>◇</span>Add deal</button><button class="quick-action" data-create="activities"><span>✓</span>Log activity</button><button class="quick-action" data-go="/settings/general"><span>⚙</span>Open settings</button></div></div></section>
      </div>
    </div>`;
}
async function moduleView(resource) {
  const config = MODULES[resource];
  const current = state.moduleState[resource] || { search: "", status: "", owner_id: "", sort: "created_desc", min_amount: "", max_amount: "", close_from: "", close_to: "", offset: 0, view: "list", selectedIds: [] };
  state.moduleState[resource] = current;
  const advanced = FILTERABLE_MODULES.includes(resource);
  if (advanced && !current.filterCatalog) {
    current.filterCatalog = await api(`/api/module-filter-options/${resource}`);
  }
  const broadView = ["kanban","grid","split","chart","timeline"].includes(current.view);
  const params = new URLSearchParams({ limit: broadView ? "100" : "25", offset: broadView ? "0" : String(current.offset) });
  if (current.search) params.set("search", current.search);
  if (current.status) params.set("status", current.status);
  if (current.owner_id) params.set("owner_id", current.owner_id);
  if (current.sort) params.set("sort", current.sort);
  if (current.min_amount) params.set("min_amount", current.min_amount);
  if (current.max_amount) params.set("max_amount", current.max_amount);
  if (current.close_from) params.set("close_from", current.close_from);
  if (current.close_to) params.set("close_to", current.close_to);
  if (advanced && current.advancedFilters?.rules?.length) {
    params.set("filters", JSON.stringify(current.advancedFilters));
  }
  const data = await api(`/api/${resource}?${params}`);
  const importAction = ["leads","deals","accounts","contacts"].includes(resource) ? `<button class="button button-ghost" data-start-import="${resource}">Import ${config.label}</button>` : "";
  const sampleNotice = resource === 'products' && data.items.some(item => ['YCR-ENT-001','YCR-SVC-010'].includes(item.sku) && ['CONVOSIS CRM Enterprise','Implementation Sprint'].includes(item.name)) ? '<p class="foundation-note">This list includes starter example products: CONVOSIS CRM Enterprise and Implementation Sprint. Review them before using them in sales records.</p>' : '';
  const actions = `${importAction}<button class="button button-primary" data-create="${resource}"><span class="button-icon">＋</span>Add ${config.singular.toLowerCase()}</button>`;
  const viewOptions = [["list","List"],["grid","Grid"],["split","Split"],["chart","Chart"],["timeline","Timeline"]];
  if (resource === "deals") viewOptions.splice(1,0,["kanban","Pipeline"]);
  const viewToggle = `<div class="view-toggle">${viewOptions.map(([key,label]) => `<button class="${current.view === key ? "active" : ""}" data-toggle-view="${key}">${label}</button>`).join('')}</div>`;
  let body = tableView(resource, data);
  if (current.view === "kanban" && resource === "deals") body = kanbanView(data.items);
  else if (current.view === "grid") body = gridView(resource, data);
  else if (current.view === "split") body = splitView(resource, data);
  else if (current.view === "chart") body = chartView(resource, data);
  else if (current.view === "timeline") body = timelineModuleView(resource, data);
  return `${pageHeader("Workspace / " + config.label, config.label, config.description, `${viewToggle}${actions}`)}
    ${sampleNotice}<div class="module-toolbar">${advanced ? `<button type="button" class="button button-ghost button-small advanced-filter-toggle" data-filter-toggle aria-expanded="${Boolean(current.filtersOpen)}" aria-controls="module-filter-sidebar">⚲ Filter${current.advancedFilters?.rules?.length ? ` (${current.advancedFilters.rules.length})` : ""}</button>` : ""}<label class="toolbar-search"><span>⌕</span><input data-module-search="${resource}" value="${esc(current.search)}" placeholder="${esc(config.search)}" /></label>${config.status.length ? `<select class="filter-select" data-module-status="${resource}"><option value="">All statuses</option>${config.status.map((option) => `<option ${current.status === option ? "selected" : ""}>${esc(option)}</option>`).join("")}</select>` : ""}<select class="filter-select" data-module-owner="${resource}"><option value="">All owners</option>${(state.meta?.users || []).map((user) => `<option value="${user.id}" ${String(current.owner_id) === String(user.id) ? "selected" : ""}>${esc(user.name)}</option>`).join("")}</select><select class="filter-select" data-module-sort="${resource}"><option value="created_desc" ${current.sort === "created_desc" ? "selected" : ""}>Recently added</option><option value="name_asc" ${current.sort === "name_asc" ? "selected" : ""}>Name A–Z</option>${resource === "deals" ? `<option value="amount_desc" ${current.sort === "amount_desc" ? "selected" : ""}>Amount high–low</option><option value="close_asc" ${current.sort === "close_asc" ? "selected" : ""}>Close date soonest</option>` : ""}${resource === "leads" ? `<option value="score_desc" ${current.sort === "score_desc" ? "selected" : ""}>Lead score high–low</option>` : ""}</select>${resource === "deals" ? `<input class="field-input" style="width:105px" data-deal-filter="min_amount" type="number" placeholder="Min amount" value="${esc(current.min_amount)}" /><input class="field-input" style="width:105px" data-deal-filter="max_amount" type="number" placeholder="Max amount" value="${esc(current.max_amount)}" /><details class="crm-date-range-filter"><summary class="button button-ghost button-small">Close date range${current.close_from || current.close_to ? " • Active" : ""}</summary><div class="crm-date-range-popover"><label>From<input class="field-input" data-deal-filter="close_from" type="date" value="${esc(current.close_from)}" aria-label="Close date from" /></label><label>To<input class="field-input" data-deal-filter="close_to" type="date" value="${esc(current.close_to)}" aria-label="Close date to" /></label></div></details>` : ""}<button class="button button-ghost button-small" data-clear-filters="${resource}">Clear filters</button>${resource === "accounts" ? `<button type="button" class="button button-primary button-small" data-selected-account-deal ${current.selectedIds.length === 1 ? "" : "disabled"}>Convert to Deal${current.selectedIds.length === 1 ? " (1 selected)" : ""}</button>` : ""}<button type="button" class="button button-ghost button-small" data-clear-selection ${current.selectedIds.length ? "" : "disabled"}>Clear selection</button><button class="button button-ghost button-small" data-bulk-delete="${resource}" ${current.selectedIds.length ? "" : "disabled"}>Delete selected${current.selectedIds.length ? ` (${current.selectedIds.length})` : ""}</button><span style="margin-left:auto;color:var(--text-faint);font-size:11px">${data.total} record${data.total === 1 ? "" : "s"}</span></div>
    ${advanced
      ? `<div class="advanced-filter-layout ${current.filtersOpen ? "filters-visible" : ""}" data-filter-layout>
            ${renderModuleFilters(resource, current, current.filterCatalog, esc)}
            <div class="advanced-filter-results">${body}${current.view === "list" ? pagination(resource, data) : ""}</div>
          </div>`
      : `${body}${current.view === "list" ? pagination(resource, data) : ""}`}`;
}
async function activityTypeView(type) {
  const resource = "activities";
  const current = state.moduleState[resource] || { search: "", status: "", owner_id: "", sort: "created_desc", offset: 0, selectedIds: [] };
  state.moduleState[resource] = current;
  const params = new URLSearchParams({ limit: "25", offset: String(current.offset), activity_type: type });
  if (current.search) params.set("search", current.search);
  if (current.status) params.set("status", current.status);
  if (current.owner_id) params.set("owner_id", current.owner_id);
  if (current.sort) params.set("sort", current.sort);
  const data = await api(`/api/activities?${params}`);
  return `${pageHeader("Activities", `${type}s`, `Manage ${type.toLowerCase()} records, ownership, due dates and related CRM context.`, `<button class="button button-primary" data-create="activities" data-activity-type="${type}">+ Add ${type.toLowerCase()}</button>`)}
    <div class="module-toolbar"><label class="toolbar-search"><span>?</span><input data-module-search="activities" value="${esc(current.search)}" placeholder="Search ${type.toLowerCase()}s..." /></label><select class="filter-select" data-module-status="activities"><option value="">All statuses</option><option ${current.status === "Open" ? "selected" : ""}>Open</option><option ${current.status === "Completed" ? "selected" : ""}>Completed</option></select><select class="filter-select" data-module-owner="activities"><option value="">All owners</option>${(state.meta?.users || []).map((user) => `<option value="${user.id}" ${String(current.owner_id) === String(user.id) ? "selected" : ""}>${esc(user.name)}</option>`).join("")}</select><select class="filter-select" data-module-sort="activities"><option value="created_desc">Recently added</option><option value="name_asc">Subject A-Z</option></select><span style="margin-left:auto;color:var(--text-faint);font-size:11px">${data.total} record${data.total === 1 ? "" : "s"}</span></div>
    ${tableView(resource, data).replace('data-create="activities"', 'data-create="activities" data-activity-type="' + type + '"').replace('Add activity', 'Add ' + type.toLowerCase())}${pagination(resource, data)}`;
}
function platformState(resource) {
  if (!state.moduleState[`platform:${resource}`]) state.moduleState[`platform:${resource}`] = { search: "", status: "", owner_id: "", sort: "updated_desc", offset: 0, selectedIds: [] };
  return state.moduleState[`platform:${resource}`];
}
function platformTable(resource, data) {
  const config = state.platformCatalog.resources[resource];
  if (!data.items.length) return `<section class="card">${emptyState("+", `No ${config.label.toLowerCase()} found`, "Create a record or adjust the current filters.", `<button class="button button-primary" data-platform-create="${resource}">Add ${config.singular.toLowerCase()}</button>`)}</section>`;
  const visible = (config.fields || []).filter((item) => !["textarea", "json", "file"].includes(item.type)).slice(0, 4);
  return `<section class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr><th><input type="checkbox" data-platform-select-all="${resource}" aria-label="Select all displayed records"/></th>${visible.map((field) => `<th>${esc(field.label)}</th>`).join("")}<th>Owner</th><th>Updated</th><th></th></tr></thead><tbody>${data.items.map((row) => `<tr><td><input type="checkbox" data-platform-select-record="${resource}" data-id="${row.id}" ${platformState(resource).selectedIds.includes(row.id) ? "checked" : ""}/></td>${visible.map((field, index) => `<td class="${index === 0 ? "platform-cell" : ""}">${index === 0 ? `<button type="button" class="record-link" data-platform-open="${resource}" data-id="${row.id}">${esc(row[field.key] ?? row.name ?? "-")}<span class="sub-cell">${esc(row.record_number || "#"+row.id)}</span></button>` : field.type === "number" && ["amount", "budget", "target", "target_amount", "committed", "best_case", "expected_revenue"].includes(field.key) ? formatMoney(row[field.key]) : field.type === "date" ? formatDate(row[field.key]) : field.key === "status" ? badge(row[field.key]) : platformDisplay(field, row[field.key])}</td>`).join("")}<td>${esc(row.owner_name || "Unassigned")}</td><td>${formatDateTime(row.updated_at)}</td><td><div class="table-actions"><button class="table-action" title="Edit" data-platform-edit="${resource}" data-id="${row.id}">Edit</button><button class="table-action" title="Delete (30-day Recycle Bin)" data-platform-delete="${resource}" data-id="${row.id}">Archive</button></div></td></tr>`).join("")}</tbody></table></div></section>`;
}
function platformDisplay(field, value) {
  const type = String(field.type || "");
  if (type === "account" || type === "contact" || type === "lead" || type === "deal") return esc(lookupName(`${type}s`, value));
  if (type === "user") return esc((state.meta?.users || []).find((item) => Number(item.id) === Number(value))?.name || (value ? `#${value}` : "-"));
  if (type.startsWith("platform:")) {
    const resource = type.split(":")[1];
    return esc((state.platformLookups[resource] || []).find((item) => Number(item.id) === Number(value))?.name || (value ? `#${value}` : "-"));
  }
  return esc(value ?? "-");
}
async function platformPanel(resource, compact = false) {
  const config = state.platformCatalog.resources[resource];
  if (!config) return `<section class="card">${emptyState("!", "Configuration view unavailable", "This setup surface is not registered in the platform catalog.")}</section>`;
  const current = platformState(resource);
  const statusField = (config.fields || []).find(field => field.key === "status" && field.type === "select");
  const statusOptions = Array.isArray(statusField?.options) ? statusField.options : [];
  if (current.status && !statusOptions.includes(current.status)) { current.status = ""; current.offset = 0; }
  const params = new URLSearchParams({ limit: compact ? "100" : "25", offset: compact ? "0" : String(current.offset), sort: current.sort });
  if (current.search) params.set("search", current.search);
  if (current.status) params.set("status", current.status);
  if (current.owner_id) params.set("owner_id", current.owner_id);
  const data = await api(`/api/platform/${resource}?${params}`);
  const toolbar = `<div class="module-toolbar"><button class="button button-small" data-platform-bulk-delete ${current.selectedIds?.length ? "" : "disabled"}>Delete selected (${current.selectedIds?.length || 0})</button><label class="toolbar-search"><span>?</span><input data-platform-search="${resource}" value="${esc(current.search)}" placeholder="Search ${esc(config.label.toLowerCase())}..." /></label>${statusOptions.length ? `<select class="filter-select" data-platform-status="${resource}" aria-label="Filter ${esc(config.label)} by status"><option value="">All statuses</option>${statusOptions.map(status => `<option value="${esc(status)}" ${current.status === status ? "selected" : ""}>${esc(status)}</option>`).join("")}</select>` : ""}<select class="filter-select" data-platform-owner="${resource}"><option value="">All owners</option>${(state.meta?.users || []).map((user) => `<option value="${user.id}" ${String(current.owner_id) === String(user.id) ? "selected" : ""}>${esc(user.name)}</option>`).join("")}</select><select class="filter-select" data-platform-sort="${resource}"><option value="updated_desc">Recently updated</option><option value="name_asc" ${current.sort === "name_asc" ? "selected" : ""}>Name A-Z</option><option value="created_desc" ${current.sort === "created_desc" ? "selected" : ""}>Recently created</option></select><a class="button button-ghost button-small" href="/api/export/${resource}.csv" download>Export CSV</a><span style="margin-left:auto;color:var(--text-faint);font-size:11px">${data.total} record${data.total === 1 ? "" : "s"}</span></div>`;
  return `${toolbar}${platformTable(resource, data)}${compact ? "" : pagination(`platform:${resource}`, data)}`;
}
async function platformModuleView(resource) {
  if (resource === "webforms" && typeof window.webformDashboard === "function") return window.webformDashboard(await api("/api/platform/webforms?limit=100"));
  const config = state.platformCatalog.resources[resource];
  await Promise.all((config.fields || []).filter((field) => String(field.type || "").startsWith("platform:")).map((field) => ensurePlatformLookup(field.type.split(":")[1])));
  let organizationIdentity = "";
  if (resource === "company_details") {
    const settings = await api("/api/settings/general");
    const orgId = settings.org_id == null ? "Not assigned" : String(settings.org_id);
    organizationIdentity = `<section class="card" style="margin:0 0 18px;padding:20px 22px"><div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><h3 style="margin:0 0 8px">Your CRM Organization ID</h3><div style="font-size:24px;font-weight:700;color:var(--text)">${esc(orgId)}</div><p style="margin:6px 0 0;color:var(--text-faint);font-size:12px">Read-only organization identifier. Company records listed below are not organization IDs.</p></div><a class="button button-ghost" href="/settings/general">View General Settings</a></div></section>`;
  }
  return `${pageHeader(config.group || "Workspace", config.label, config.description, `<button class="button button-primary" data-platform-create="${resource}">+ Add ${config.singular.toLowerCase()}</button>`)}${organizationIdentity}${await platformPanel(resource)}`;
}
let setupFeature;
function setupDirectory(...args) { return setupFeature.setupDirectory(...args); }
function setupSearchView(...args) { return setupFeature.setupSearchView(...args); }
function customizeSetupView(...args) { return setupFeature.customizeSetupView(...args); }
function auditView(...args) { return setupFeature.auditView(...args); }
function recycleBinView(...args) { return setupFeature.recycleBinView(...args); }
function importView(...args) { return setupFeature.importView(...args); }
function exportView(...args) { return setupFeature.exportView(...args); }
function duplicateView(...args) { return setupFeature.duplicateView(...args); }
function workflowRulesView(...args) { return setupFeature.workflowRulesView(...args); }
function securityAdminView(...args) { return setupFeature.securityAdminView(...args); }
function cpqView(...args) { return setupFeature.cpqView(...args); }
function bindSecurityAdmin(...args) { return setupFeature.bindSecurityAdmin(...args); }
function bindCPQ(...args) { return setupFeature.bindCPQ(...args); }
function developerHubView(...args) { return setupFeature.developerHubView(...args); }
function setupConsoleView(...args) { return setupFeature.setupConsoleView(...args); }
function bindDeveloperHub(...args) { return setupFeature.bindDeveloperHub(...args); }
function bindMetadataModuleActions(...args) { return setupFeature.bindMetadataModuleActions(...args); }
function bindSetupConsole(...args) { return setupFeature.bindSetupConsole(...args); }
function metadataFieldEnabled(...args) { return setupFeature.metadataFieldEnabled(...args); }
function customModulesAdminView(...args) { return setupFeature.customModulesAdminView(...args); }
function customModuleBuilderView(...args) { return setupFeature.customModuleBuilderView(...args); }
function builderFieldCards(...args) { return setupFeature.builderFieldCards(...args); }
function builderSlug(...args) { return setupFeature.builderSlug(...args); }
function renderBuilderFields(...args) { return setupFeature.renderBuilderFields(...args); }
function bindBuilderFieldActions(...args) { return setupFeature.bindBuilderFieldActions(...args); }
function saveCustomBuilder(...args) { return setupFeature.saveCustomBuilder(...args); }
function bindCustomModuleAdmin(...args) { return setupFeature.bindCustomModuleAdmin(...args); }
function customRuntimeFieldControl(...args) { return setupFeature.customRuntimeFieldControl(...args); }
function customRuntimeView(...args) { return setupFeature.customRuntimeView(...args); }
function bindCustomRuntime(...args) { return setupFeature.bindCustomRuntime(...args); }
function setupLandingView(...args) { return setupFeature.setupLandingView(...args); }
function setupView(...args) { return setupFeature.setupView(...args); }
function tableView(resource, data) {
  const config = MODULES[resource];
  if (!data.items.length) return `<section class="card">${emptyState(config.icon, `No ${config.label.toLowerCase()} found`, "Try changing your filters or create a new record.", `<button class="button button-primary" data-create="${resource}">Add ${config.singular.toLowerCase()}</button>`)}</section>`;
  const allSelected = data.items.every(row => state.moduleState[resource].selectedIds.includes(row.id));
  const selectionHeader = `<th><input type="checkbox" data-select-all="${resource}" ${allSelected ? "checked" : ""} aria-label="Select all displayed records" /></th>`;
  return `<section class="card table-card"><div class="table-wrap"><table class="data-table"><thead><tr>${selectionHeader}${config.columns.map((column) => `<th>${column.label}</th>`).join("")}<th></th></tr></thead><tbody>${data.items.map((row) => `<tr><td><input type="checkbox" data-select-record="${resource}" data-id="${row.id}" ${state.moduleState[resource].selectedIds.includes(row.id) ? "checked" : ""} /></td>${config.columns.map((column) => `<td class="${column.key === "name" ? "primary-cell" : ""}">${column.cell ? column.cell(row) : esc(row[column.key] ?? "—")}</td>`).join("")}<td><div class="table-actions">${resource === "activities" && row.status !== "Completed" ? `<button class="table-action" title="Mark complete" data-complete-activity="${row.id}">✓</button>` : ""}${resource === "accounts" ? `<button class="table-action" title="Convert to Deal" data-create-account-deal="${row.id}">Convert to Deal</button>` : ""}<button class="table-action" title="Edit" data-edit-record="${resource}" data-id="${row.id}">✎</button><button class="table-action" title="Delete (30-day Recycle Bin)" data-delete-record="${resource}" data-id="${row.id}">⌫</button></div></td></tr>`).join("")}</tbody></table></div></section>`;
}
function kanbanView(items) {
  const stages = MODULES.deals.status;
  return `<div class="kanban-grid">${stages.map((stage) => { const deals = items.filter((item) => item.stage === stage); return `<section class="kanban-column"><div class="kanban-head"><strong>${esc(stage)}</strong><span>${deals.length}</span></div>${deals.map((deal) => `<article class="deal-card" data-open-record="deals" data-id="${deal.id}"><h3>${esc(deal.name)}</h3><p>${esc(lookupName("accounts", deal.account_id))}</p><div class="deal-card-foot"><strong>${formatMoney(deal.amount)}</strong><span>${deal.probability || 0}%</span></div></article>`).join("") || `<p style="font-size:10px;color:var(--text-faint);padding:10px 2px">No deals here</p>`}</section>`; }).join("")}</div>`;
}

function gridView(resource, data) {
  return renderGridView(resource, data, {MODULES, emptyState, esc});
}

function flatSplitPreview(resource, row) {
  const config=MODULES[resource], name=row.name||row.subject||row.full_name||row.title||`Record ${row.id}`;
  const labels={status:"Status",stage:"Stage",company:"Company",source:"Source",email:"Email",phone:"Phone",lead_score:"Lead score",next_follow_up:"Follow-up",owner_name:"Owner",account_name:"Account",amount:"Amount",probability:"Probability",expected_close_date:"Closing date"};
  const keys=resource==="leads"?["status","company","source","email","phone","lead_score","next_follow_up","owner_name"]:
    resource==="deals"?["stage","account_name","amount","probability","expected_close_date","owner_name"]:
    (config.columns||[]).map(c=>c.key).filter(k=>k&&k!=="name").slice(0,8);
  const details=[...new Set(keys)].filter(key=>row[key]!=null&&row[key]!=="").map(key=>{
    const label=labels[key]||(config.columns||[]).find(c=>c.key===key)?.label||titleCase(key);
    const value=key==="amount"?formatMoney(row[key]):["next_follow_up","expected_close_date"].includes(key)?formatDate(row[key]):
      key==="probability"?`${Number(row[key])}%`:String(row[key]);
    return `<div class="flat-preview-field"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  }).join("");
  return `<div class="flat-preview-heading"><div><span class="flat-section-eyebrow">${esc(config.singular)} preview</span><h2>${esc(name)}</h2>
    <p>Choose a record on the left to inspect its details.</p></div>
    <button type="button" class="button button-primary button-small" data-split-open="${resource}" data-id="${row.id}">Open record ↗</button></div>
    <dl class="flat-preview-fields">${details||'<p class="flat-muted">No additional details available.</p>'}</dl>`;
}
function splitView(resource,data) {
  const config=MODULES[resource], current=state.moduleState[resource];
  if(!data.items.length)return `<section class="flat-empty">${emptyState(config.icon,`No ${config.label.toLowerCase()} found`,"Change filters or create a new record.")}</section>`;
  const selected=data.items.find(item=>String(item.id)===String(current.splitSelectedId))||data.items[0];
  current.splitSelectedId=selected.id;current.splitRows=data.items;
  return `<div class="module-split-flat"><nav class="flat-split-list" aria-label="${esc(config.label)} records">
    <div class="flat-split-heading"><strong>Records</strong><span>${data.items.length} shown</span></div>
    ${data.items.map(item=>{
      const name=item.name||item.subject||item.full_name||item.title||`Record ${item.id}`;
      const active=String(item.id)===String(selected.id);
      return `<button type="button" class="flat-split-item ${active?"active":""}" data-split-select="${resource}" data-id="${item.id}" aria-pressed="${active}">
        <span class="flat-split-avatar" aria-hidden="true">${esc(initials(name))}</span>
        <span class="flat-split-copy"><strong>${esc(name)}</strong><small>${esc(item.status||item.stage||item.company||"Record")}</small></span>
        <span class="flat-split-chevron" aria-hidden="true">›</span></button>`;
    }).join("")}</nav>
    <section class="flat-split-preview" data-split-preview aria-live="polite">${flatSplitPreview(resource,selected)}</section></div>`;
}
function chartView(resource, data) {
  const config = MODULES[resource];
  const key = resource === 'deals' ? 'stage' : 'status';
  const counts = {};
  data.items.forEach((row) => { const label = String(row[key] || 'Unspecified'); counts[label] = (counts[label] || 0) + 1; });
  const max = Math.max(1, ...Object.values(counts));
  return `<section class="card settings-section"><div class="settings-section-head"><h2>${esc(config.label)} distribution</h2><p>Current filtered records grouped by ${esc(key)}.</p></div><div class="pipeline-chart">${Object.entries(counts).map(([label,count]) => `<div class="pipeline-row"><span class="pipeline-label">${esc(label)}</span><div class="progress-track"><div class="progress-bar" style="width:${Math.max(4, Number(count) / max * 100)}%"></div></div><span class="pipeline-meta"><strong>${count}</strong> record${count === 1 ? '' : 's'}</span></div>`).join('') || `<p class="related-empty">No chart data available.</p>`}</div></section>`;
}
function timelineModuleView(resource,data) {
  const config=MODULES[resource];
  const rows=[...data.items].sort((a,b)=>String(b.updated_at||b.created_at||"").localeCompare(String(a.updated_at||a.created_at||"")));
  let previousDay="";
  const items=rows.map(item=>{
    const name=item.name||item.subject||item.full_name||item.title||`Record ${item.id}`;
    const date=String(item.updated_at||item.created_at||""),day=date.slice(0,10);
    const heading=day&&day!==previousDay?`<h3 class="flat-timeline-day">${esc(formatDate(date))}</h3>`:"";
    previousDay=day;
    return `${heading}<button type="button" class="flat-timeline-entry" data-open-record="${resource}" data-id="${item.id}">
      <span class="flat-timeline-rail" aria-hidden="true"><span class="flat-timeline-point"></span></span>
      <span class="flat-timeline-copy"><strong>${esc(name)}</strong>
        <small>${esc(item.status||item.stage||"Updated")}${item.company?` · ${esc(item.company)}`:""}</small></span>
      <time class="flat-timeline-time" datetime="${esc(date)}">${esc(formatDateTime(date))}</time>
      <span class="flat-timeline-open" aria-hidden="true">↗</span></button>`;
  }).join("");
  return `<section class="flat-timeline-view"><header class="flat-timeline-heading"><h2>${esc(config.label)} timeline</h2>
    <p>Recent filtered records, newest changes first.</p></header>
    <div class="flat-timeline-entries">${items||'<p class="flat-muted">No timeline entries match the filters.</p>'}</div></section>`;
}
function pagination(resource, data) {
  const start = data.total ? data.offset + 1 : 0;
  const end = Math.min(data.offset + data.items.length, data.total);
  return `<div class="pagination"><span>Showing ${start}–${end} of ${data.total}</span><div class="pagination-actions"><button data-page="prev" data-resource="${resource}" ${data.offset === 0 ? "disabled" : ""}>←</button><button data-page="next" data-resource="${resource}" ${end >= data.total ? "disabled" : ""}>→</button></div></div>`;
}
function dataIds(resource) {
  return $$(`[data-select-record="${resource}"]`).map((input) => Number(input.dataset.id));
}
async function bulkArchiveLeads(current) {
  if (!current.selectedIds.length) return;
  const confirmed = await confirmAction("Archive selected leads?", `This will remove ${current.selectedIds.length} selected lead${current.selectedIds.length === 1 ? "" : "s"} from the active list.`, "Archive leads");
  if (!confirmed) return;
  try {
    await api("/api/leads/bulk-archive", { method: "POST", body: JSON.stringify({ related_id: current.selectedIds }) });
    current.selectedIds = [];
    toast("Leads archived", "The selected leads are no longer in the active list.");
    await renderRoute();
  } catch (error) { toast("Could not archive leads", error.message, "error"); }
}
const { relatedNavigation, relatedPlainRow, relatedPlainSection, relatedContent, leadStagePanel } = createRelatedViews({ MODULES, esc, formatMoney, formatDateTime, titleCase });
const { detailView, detailFields, scrollDetailSection } = createCoreDetailViews({ $$, api, MODULES, esc, formatMoney, formatDateTime, titleCase, pageHeader, blueprintDealProgress, initials, relatedNavigation, relatedContent, leadStagePanel, timelineHtml, activityItem, badge, formatDate, lookupName });
function timelineHtml(events) {
  const ordered = [...events].sort((a,b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
  const renderEntries = (rows) => {
    if (!rows.length) return `<p class="crm-timeline-empty">No record history yet.</p>`;
    let dateKey = "";
    return rows.map((item) => {
      const key = String(item.occurred_at || "").slice(0,10);
      const dayHeading = key && key !== dateKey ? `<div class="crm-timeline-day">${esc(formatDate(key))}</div>` : "";
      dateKey = key;
      const kind = ["activity","note"].includes(item.kind) ? item.kind : "audit";
      const time = item.occurred_at ? formatDateTime(item.occurred_at) : "";
      return `${dayHeading}<article class="crm-timeline-event" data-timeline-entry="${kind}"><div class="crm-timeline-dot ${kind}" aria-hidden="true">${kind === "activity" ? "✓" : kind === "note" ? "✎" : "↻"}</div><div class="crm-timeline-event-body"><strong>${esc(item.title || "Record updated")}</strong>${item.detail ? `<p>${esc(item.detail)}</p>` : ""}<small>${esc(item.actor_name || "System")} · ${esc(time)}</small></div></article>`;
    }).join("");
  };
  const interactions = ordered.filter((item) => ["activity","note"].includes(item.kind));
  return `<div class="crm-timeline"><div class="crm-timeline-toolbar"><div class="crm-timeline-tabs" role="group" aria-label="Timeline view"><button type="button" class="crm-timeline-tab active" data-timeline-kind="history" aria-pressed="true">History</button><button type="button" class="crm-timeline-tab" data-timeline-kind="interactions" aria-pressed="false">Interactions</button></div><label class="crm-timeline-filter-label">Filter <select class="crm-timeline-filter" data-timeline-filter><option value="all">All events</option><option value="audit">Record changes</option><option value="activity">Activities</option><option value="note">Notes</option></select></label></div><div data-timeline-content="history" class="crm-timeline-list">${renderEntries(ordered)}</div><div data-timeline-content="interactions" class="crm-timeline-list" hidden>${renderEntries(interactions)}</div></div>`;
}
function dealProgress(record) {
  const stages = MODULES.deals.status.filter((stage) => stage !== "Closed Lost");
  const current = record.stage || stages[0];
  const selectedIndex = stages.indexOf(current);
  const completed = current === "Closed Lost" ? stages.length - 2 : selectedIndex;
  return `<div class="crm-deal-pipeline" aria-label="Deal stage process">
    <div class="crm-pipeline-header">
      <div><span>START</span><strong>${esc(formatDate(record.created_at))}</strong></div>
      <div class="crm-pipeline-current"><span>Current stage</span><strong>${esc(current)}</strong></div>
      <div><span>CLOSING</span><strong>${esc(formatDate(record.expected_close_date))}</strong></div>
    </div>
    <div class="crm-pipeline-track" role="group" aria-label="Select deal stage">${stages.map((stage,index) => `<button type="button" class="crm-pipeline-step ${current === stage ? "is-current" : index < completed ? "is-complete" : "is-upcoming"}" data-stage-update="${record.id}" data-stage="${esc(stage)}" aria-label="Move deal to ${esc(stage)}" ${current === stage ? `aria-current="step" disabled` : ""}><span>${esc(stage)}</span><small>${current === stage ? "Current stage" : index < completed ? "Completed" : "Select stage"}</small></button>`).join("")}</div>
    <div class="crm-pipeline-footer"><span>Click a stage to update this deal. Blueprint rules and permissions still apply.</span><button type="button" class="crm-pipeline-lost ${current === "Closed Lost" ? "is-current" : ""}" data-stage-update="${record.id}" data-stage="Closed Lost" ${current === "Closed Lost" ? 'aria-current="step" disabled' : ""}>${current === "Closed Lost" ? "Closed Lost · Current stage" : "Mark Closed Lost"}</button></div>
  </div>`;
}
function blueprintDealProgress(record,timeline) {
  if (!timeline?.blueprint_enabled) return dealProgress(record);
  const stages = (timeline.blueprint_states || []).filter(Boolean);
  const current = timeline.current_stage || record.stage;
  const choices = timeline.transition_details || [];
  return `<div class="crm-deal-pipeline" aria-label="Published Blueprint process">
    <div class="crm-pipeline-header"><div><span>BLUEPRINT</span><strong>${esc(timeline.blueprint_name || "Custom process")}</strong></div>
    <div class="crm-pipeline-current"><span>Current stage</span><strong>${esc(current)}</strong></div>
    <div><span>CLOSING</span><strong>${esc(formatDate(record.expected_close_date))}</strong></div></div>
    <div class="crm-pipeline-track" role="group" aria-label="Blueprint states">${stages.map(stage => {
      const edge = choices.find(item => item.to === stage);
      const isCurrent = stage === current;
      return `<button type="button" class="crm-pipeline-step ${isCurrent ? "is-current" : edge ? "is-upcoming" : "is-complete"}" ${edge ? `data-blueprint-move="${esc(edge.id)}" data-blueprint-resource="deals" data-blueprint-record="${record.id}" data-blueprint-required="${esc(JSON.stringify(edge.required || []))}"` : "disabled"} ${isCurrent ? 'aria-current="step"' : ""}><span>${esc(stage)}</span><small>${isCurrent ? "Current stage" : edge ? "Available" : "Not available"}</small></button>`;
    }).join("")}</div>
    <div class="crm-pipeline-footer"><span>Available Blueprint transitions</span><div class="crm-transition-options">${choices.length ? choices.map(edge => `<button class="crm-transition-action" data-blueprint-move="${esc(edge.id)}" data-blueprint-resource="deals" data-blueprint-record="${record.id}" data-blueprint-required="${esc(JSON.stringify(edge.required || []))}" title="${esc(edge.message || edge.to)}">${esc(edge.label)} →</button>`).join("") : "<span>No available transitions</span>"}</div></div></div>`;
}
function bindBlueprintMoves(){
  $$('[data-blueprint-move]').forEach(button=>button.addEventListener("click", async()=>{
    const resource = button.dataset.blueprintResource;
    const recordId = button.dataset.blueprintRecord;
    if(resource === "leads" && button.dataset.blueprintTo === "Converted"){
      await navigate(`/leads/${recordId}/convert`);
      return;
    }
    const required = JSON.parse(button.dataset.blueprintRequired || "[]");
    const fields = {};
    for(const name of required){
      const answer = (await promptDialog(`Required field: ${name}`));
      if(answer===null)return;
      const trimmed=answer.trim();
      if(!trimmed){toast("Required field",`${name} cannot be empty.`,"error");return;}
      fields[name]=["amount","probability","lead_score"].includes(name)?Number(trimmed):trimmed;
    }
    button.disabled=true;
    try {
      const changed = await api(`/api/blueprint-records/${resource}/${recordId}/transition`,{method:"POST",body:JSON.stringify({transition_id:button.dataset.blueprintMove,fields})});
      toast("Blueprint transition completed","Current stage and transitions updated.");
      if(resource==="leads" && changed.status==="Converted" && changed.converted_deal_id) toast("Lead converted","Account, Contact and Deal records are now linked.");
      await renderRoute();
    }catch(error){button.disabled=false;toast("Transition blocked",error.message,"error");}
  }));
}
function bindDetail(resource, id) {
  bindBlueprintMoves();
  $$('[data-go]').forEach((button) => button.addEventListener("click", () => navigate(button.dataset.go)));
  $$('[data-edit-record]').forEach((button) => button.addEventListener("click", () => navigate("/" + button.dataset.editRecord + "/edit/" + encodeURIComponent(button.dataset.id))));
  $$('[data-delete-record]').forEach((button) => button.addEventListener("click", () => deleteRecord(button.dataset.deleteRecord, Number(button.dataset.id))));
  $$('[data-create]').forEach((button) => button.addEventListener("click", () => openCreateRecord(button.dataset.create, { related_type: resource, related_id: Number(id), _returnTo: pathFor(resource,id), ...(button.closest('#detail-section-closed_activities') ? {status:'Completed'} : {}) })));
  $$('[data-platform-create]').forEach((button) => button.addEventListener("click", () => openPlatformModal(button.dataset.platformCreate, null, { lead_id: button.dataset.leadId ? Number(button.dataset.leadId) : null, deal_id: button.dataset.dealId ? Number(button.dataset.dealId) : null })));
  $$('[data-platform-related-create]').forEach(button => button.addEventListener('click', async () => {
    const target = button.dataset.platformRelatedCreate;
    const key = resource === 'accounts' ? 'account_id' : resource === 'contacts' ? 'contact_id' : 'deal_id';
    try {
      await openPlatformModal(target, null, { [key]: Number(id) });
      if (target === 'quotes' && resource === 'deals') {
        document.querySelector('#modal-body [name="deal_id"]')?.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch (error) { toast('Could not open ' + target, error.message, 'error'); }
  }));
  $$('[data-related-platform]').forEach(button => button.addEventListener('click', () => navigate('/' + encodeURIComponent(button.dataset.relatedPlatform) + '/' + encodeURIComponent(button.dataset.id))));
  $$('[data-open-record]').forEach((button) => button.addEventListener("click", () => navigate(pathFor(button.dataset.openRecord, button.dataset.id))));
  $$('[data-related-complete-activity]').forEach((button) => button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await api(`/api/activities/${encodeURIComponent(button.dataset.relatedCompleteActivity)}`, { method: 'PATCH', body: JSON.stringify({ status: 'Completed' }) });
      toast('Activity completed', 'Moved to Closed activities.');
      await renderRoute();
    } catch (error) {
      button.disabled = false;
      toast('Could not complete activity', error.message, 'error');
    }
  }));

  $$('[data-related-quick-add]').forEach(button => button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    const section = button.dataset.relatedQuickAdd;
    const panel = document.getElementById('detail-section-' + section);
    const existingAdd = panel?.querySelector('[data-create-account-contact], [data-create-related-deal], [data-platform-related-create], [data-create]');
    if (existingAdd) { existingAdd.click(); return; }
    if (section === 'notes') {
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      panel?.querySelector('[data-inline-note-create] textarea')?.focus({ preventScroll: true });
      return;
    }
    const mapping = { connected_records: resource === 'contacts' ? 'deals' : 'contacts', contacts: 'contacts', deals: 'deals', attachments: 'attachments', products: 'products', open_activities: 'activities', closed_activities: 'activities', emails: 'emails', quotes: 'quotes', invoices: 'invoices' };
    const target = mapping[section];
    if (!target) {
      if (section === 'custom_records') {
        panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast('Related modules', 'Select a related custom module to add a record.', 'info');
      }
      return;
    }
    const preset = { related_type: resource, related_id: Number(id), _returnTo: pathFor(resource,id), ...(section === 'closed_activities' ? {status:'Completed'} : {}) };
    if (resource === 'accounts') preset.account_id = Number(id);
    if (resource === 'contacts') preset.contact_id = Number(id);
    if (resource === 'deals') preset.deal_id = Number(id);
    try {
      if (MODULES[target]) {
        pendingRecordPresets.set(target, preset);
        await openFullPageRecord(target);
      } else if (state.platformCatalog?.resources?.[target]) {
        pendingRecordPresets.set(target, preset);
        await openFullPageRecord(target);
      }
    } catch (error) { toast('Could not add ' + section, error.message, 'error'); }
  }));
  $$('[data-create-account-contact]').forEach(button => button.addEventListener('click', () => {
    const accountId = Number(button.dataset.createAccountContact);
    if (!Number.isInteger(accountId) || accountId <= 0) return;
    openRecordModal('contacts', null, { account_id: accountId }).catch(error => toast('Could not add contact', error.message, 'error'));
  }));
  $("[data-convert-lead]")?.addEventListener("click", () => openConvertModal(Number(id)));
  bindContextCreationActions();
  // Notes are editable in place rather than through a modal.
  $('[data-inline-note-create]')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = '';
    const content = form.querySelector('[name="content"]').value.trim();
    if (!content) { toast("Note required", "Enter note content before saving.", "error"); return; }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await api('/api/notes', {method:'POST',body:JSON.stringify({title:title || 'Untitled note',content,related_type:resource,related_id:Number(id)})});
      toast("Note saved", "The note was added to this record.");
      await renderRoute();
    } catch(error) { button.disabled = false; toast("Could not save note",error.message,"error"); }
  });
  $$('[data-inline-note-edit]').forEach(button => button.addEventListener('click', () => {
    const container = button.closest('.crm-inline-note');
    container.querySelector('.crm-inline-note-display').hidden = true;
    container.querySelector('.crm-inline-note-editor').hidden = false;
    container.querySelector('[data-note-content]').focus();
  }));
  $$('[data-inline-note-cancel]').forEach(button => button.addEventListener('click', () => {
    const container = button.closest('.crm-inline-note');
    container.querySelector('.crm-inline-note-editor').hidden = true;
    container.querySelector('.crm-inline-note-display').hidden = false;
  }));
  $$('[data-inline-note-save]').forEach(button => button.addEventListener('click', async () => {
    const container = button.closest('.crm-inline-note');
    const title = container.querySelector('.detail-related-row-copy strong')?.textContent?.trim() || 'Untitled note';
    const content = container.querySelector('[data-note-content]').value.trim();
    if (!content) { toast("Note required", "Note content cannot be empty.", "error"); return; }
    button.disabled = true;
    try {
      await api('/api/notes/' + encodeURIComponent(button.dataset.inlineNoteSave), {method:'PATCH',body:JSON.stringify({title:title || 'Untitled note',content})});
      toast("Note updated", "Your changes have been saved.");
      await renderRoute();
    } catch(error) { button.disabled = false; toast("Could not update note",error.message,"error"); }
  }));
  $$('[data-lead-transition]').forEach((button) => button.addEventListener("click", async () => {
    if (button.dataset.status === "Converted") {
      await navigate(`/leads/${button.dataset.leadTransition}/convert`);
      return;
    }
    button.disabled = true;
    try {
      const changed = await api(`/api/leads/${button.dataset.leadTransition}`, { method: "PATCH", body: JSON.stringify({ status: button.dataset.status }) });
      toast("Lead updated", `Stage changed to ${button.dataset.status}`);
      if(changed.status==="Converted" && changed.converted_deal_id) await navigate(`/deals/${changed.converted_deal_id}`);
      else await renderRoute();
    } catch (error) { button.disabled = false; toast("Lead transition failed", error.message, "error"); }
  }));
  $$('[data-stage-update]').forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await api(`/api/deals/${button.dataset.stageUpdate}`, { method: "PATCH", body: JSON.stringify({ stage: button.dataset.stage }) });
      toast("Deal updated", `Current stage: ${button.dataset.stage}`);
      await renderRoute();
    } catch (error) { button.disabled = false; toast("Deal transition failed", error.message, "error"); }
  }));
  $$('[data-timeline-kind]').forEach((button) => button.addEventListener("click", () => {
    $$('[data-timeline-kind]').forEach((entry) => { entry.classList.toggle('active', entry === button); entry.setAttribute('aria-pressed', entry === button ? 'true' : 'false'); });
    $$('[data-timeline-content]').forEach((panel) => { panel.hidden = panel.dataset.timelineContent !== button.dataset.timelineKind; });
    const filter = $('[data-timeline-filter]');
    if (filter) { filter.value = 'all'; filter.dispatchEvent(new Event('change')); }
  }));
  $('[data-timeline-filter]')?.addEventListener('change', (event) => {
    const selected = event.target.value;
    $$('[data-timeline-content] .crm-timeline-event').forEach((item) => {
      item.hidden = selected !== 'all' && item.dataset.timelineEntry !== selected;
    });
  });
  const showDetailTab = (tab) => {
    $$('[data-detail-tab]').forEach((button) => button.classList.toggle('active', button.dataset.detailTab === tab));
    $$('[data-detail-panel]').forEach((panel) => { panel.hidden = panel.dataset.detailPanel !== tab; });
  };
  $$('[data-detail-tab]').forEach((button) => button.addEventListener('click', () => showDetailTab(button.dataset.detailTab)));
  $$('[data-detail-nav]').forEach((button) => button.addEventListener('click', () => {
    const isTimeline = button.dataset.detailNav === 'timeline';
    showDetailTab(isTimeline ? 'timeline' : 'overview');
    requestAnimationFrame(() => {
      scrollDetailSection(button);
    });
  }));
}
function bindDatePickerClick(root = document) {
  root.addEventListener("click", event => {
    const input = event.target.closest('input[type="date"], input[type="datetime-local"]');
    if (!input || input.disabled || input.readOnly) return;
    if (typeof input.showPicker === "function") {
      try { input.showPicker(); } catch (_) { input.focus(); }
    } else input.focus();
  });
}
function fieldHtml(field, value = "") {
  const type = field.key === "product_id" ? "platform:products" : field.type || "text";
  const id = `field-${field.key}`;
  const required = field.required ? "required" : "";
  const isNumberField = ["record_number","quote_number","order_number","po_number","invoice_number","lead_score"].includes(field.key);
  const hint = field.hint ? `<small style="font-size:10px;color:var(--text-faint)">${esc(field.hint)}</small>` : "";
  let input = "";
  if (type === "file") {
    input = `<input class="field-input" id="${id}" name="${field.key}" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" ${required} />`;
  }
  else if (type === "textarea" || type === "json") {
    let rendered = value || "";
    if (type === "json" && typeof rendered !== "string") rendered = JSON.stringify(rendered ?? [], null, 2);
    if (["conditions", "steps", "stages", "transitions", "transition_requirements"].includes(field.key) && typeof rendered !== "string") rendered = JSON.stringify(rendered || [], null, 2);
    input = `<textarea class="field-textarea" id="${id}" name="${field.key}" ${type === "json" ? 'data-json="true"' : ""} ${required}>${esc(rendered)}</textarea>`;
  }
  else if (["select", "user", "account", "contact", "lead", "deal"].includes(type) || type.startsWith("platform:")) {
    let options = field.options || [];
    if (type === "user") options = (state.meta?.users || []).map((user) => ({ value: user.id, label: user.name }));
    if (type === "account") options = state.lookups.accounts.map((item) => ({ value: item.id, label: item.name }));
    if (type === "contact") options = state.lookups.contacts.map((item) => ({ value: item.id, label: item.full_name || `${item.first_name} ${item.last_name}` }));
    if (type === "lead") options = state.lookups.leads.map((item) => ({ value: item.id, label: `${item.name}${item.company ? ` · ${item.company}` : ""}` }));
    if (type === "deal") options = state.lookups.deals.map((item) => ({ value: item.id, label: `${item.name} · ${formatMoney(item.amount)}` }));
    if (type.startsWith("platform:")) options = (state.platformLookups[type.split(":")[1]] || []).map((item) => ({ value: item.id, label: item.name }));
    const normalized = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
    const numeric = type !== "select" ? 'data-numeric="true"' : "";
    input = `<select class="field-select" id="${id}" name="${field.key}" ${type === "platform:products" ? 'data-product-selector="true"' : ""} ${numeric} ${required}><option value="">Select ${esc(field.label.toLowerCase())}</option>${normalized.map((option) => `<option value="${esc(option.value)}" ${String(option.value) === String(value ?? "") ? "selected" : ""}>${esc(field.key === "related_type" ? titleCase(option.label) : option.label)}</option>`).join("")}</select>`;
  } else {
    let rendered = value ?? "";
    if (type === "datetime-local" && rendered) rendered = String(rendered).slice(0, 16);
    if (type === "date" && rendered) rendered = String(rendered).slice(0, 10);
    if (field.key === "tags" && Array.isArray(rendered)) rendered = rendered.join(", ");
    if (["conditions", "steps", "stages", "transitions", "transition_requirements"].includes(field.key) && typeof rendered !== "string") rendered = JSON.stringify(rendered || [], null, 2);
    input = `<input class="field-input" id="${id}" name="${field.key}" type="${type}" value="${esc(field.key === "lead_score" ? (rendered || 0) : isNumberField && !rendered ? "Assigned on save" : rendered)}" ${isNumberField ? "readonly aria-readonly=true" : ""} ${type === "number" ? 'step="any" data-numeric="true"' : ""} ${required} />`;
  }
  return `<div class="field ${field.full ? "full" : ""}"><label for="${id}">${esc(/list price/i.test(field.label) || field.key === "unit_price" ? "Rate" : field.label)}${field.required ? ' <span class="required">*</span>' : ""}</label>${input}${hint}</div>`;
}
function createLeadPage() {
  const fields = MODULES.leads.fields;
  const identity = fields.filter(field => ["name", "company", "email", "phone", "owner_id"].includes(field.key));
  const qualification = fields.filter(field => ["source", "status", "lead_score", "next_follow_up", "tags"].includes(field.key));
  const notes = fields.filter(field => field.key === "notes");
  const section = (title, list) => `<section class="lead-page-section"><h3>${title}</h3><div class="lead-page-grid">${list.map(field => fieldHtml(field, field.key === "status" ? "New" : "")).join("")}</div></section>`;
  return `<div class="lead-create-page">
    <header class="lead-page-toolbar"><div><span class="eyebrow">LEADS</span><h1>Create Lead</h1></div>
      <div class="lead-page-actions"><button type="button" class="button button-ghost" data-lead-cancel>Cancel</button>
        <button type="submit" form="lead-page-form" class="button" data-lead-save-new>Save and New</button>
        <button type="submit" form="lead-page-form" class="button button-primary" data-lead-save>Save</button></div></header>
    <form id="lead-page-form" class="lead-page-form">
      ${section("Lead Information", identity)}
      ${section("Lead Qualification", qualification)}
      ${section("Additional Information", notes)}
    </form></div>`;
}
function bindCreateLeadPage() {
  const form = $("#lead-page-form");
  const save = $("[data-lead-save]");
  const saveNew = $("[data-lead-save-new]");
  $("[data-lead-cancel]")?.addEventListener("click", () => navigate("/leads"));
  let keepCreating = false;
  save?.addEventListener("click", () => { keepCreating = false; });
  saveNew?.addEventListener("click", () => { keepCreating = true; });
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (save.disabled) return;
    try {
      const payload = readForm(form);
      save.disabled = true;
      saveNew.disabled = true;
      const record = await api("/api/leads", { method: "POST", body: JSON.stringify(payload) });
      usability.clear();
      toast("Lead created", "The lead has been saved.");
      if (keepCreating) {
        await navigate("/leads/create", true);
        $("#lead-page-form [name=name]")?.focus();
      } else {
        await navigate(record?.id ? `/leads/${record.id}` : "/leads");
      }
    } catch (error) {
      toast("Could not create lead", error.message, "error");
      save.disabled = false;
      saveNew.disabled = false;
    }
  });
}
function openCreateRecord(resource, preset = {}) {
  if (resource === 'activities') preset = activityDefaults(window.location.pathname, preset, state.profile?.id);
  pendingRecordPresets.set(resource, preset);
  return openFullPageRecord(resource);
}
let isFullPageRendering = false;
const pendingRecordPresets = new Map();
async function presentFullPageForm(resource, id = null) {
  isFullPageRendering = true;
  const preset = id ? {} : (pendingRecordPresets.get(resource) || {});
  pendingRecordPresets.delete(resource);
  try {
    if (MODULES[resource] || resource === "users") { if(resource!=="users") await fetchStandardLayout(resource); await openRecordModal(resource, id, preset); }
    else await openPlatformModal(resource, id, preset);
    const host = $("#crm-fullpage-form-host");
    const backdrop = $("#modal-backdrop");
    if (!host || !backdrop) return;
    host.appendChild(backdrop);
    if (MODULES[resource] && id && (standardLayouts[resource]?.fields || []).length) {
      try {
        const data = await api("/api/admin/standard-layout/" + resource + "/records/" + id);
        Object.entries(data.values || {}).forEach(([key,value]) => {
          const input = document.querySelector('#modal-body [name="cf__' + key + '"]');
          if (!input) return;
          if (value === "[Encrypted]") {input.value="";input.disabled=true;input.required=false;input.placeholder="Protected value";return;}
          if (input.type === "checkbox") input.checked = !!value;
          else input.value = Array.isArray(value) ? value.join(", ") : (value ?? "");
        });
      } catch(error) { toast("Could not load custom values",error.message,"error"); }
    }
    // Commercial documents share the same header layout controls.
    if (["quotes","invoices","sales_orders","purchase_orders"].includes(resource)) {
      const body = document.querySelector("#modal-body");
      const layoutLabel = body?.querySelector(".crm-platform-layout-label");
      const layoutSelect = layoutLabel?.querySelector("[data-platform-layout-select]");
      const headerRow = document.querySelector("#modal-title")?.parentElement;
      if (layoutLabel && layoutSelect && headerRow) {
        headerRow.querySelectorAll(".crm-platform-header-actions, .crm-layout-header-actions").forEach(element => element.remove());
        const actions=document.createElement("div");
        actions.className="crm-platform-header-actions crm-layout-header-actions";
        const edit=document.createElement("button");
        edit.type="button";edit.className="button button-ghost crm-edit-layout";
        edit.textContent="Edit Page Layout";
        edit.addEventListener("click",()=>navigate("/layout-editor/"+resource));
        actions.append(edit,layoutSelect);
        headerRow.append(actions);
        layoutLabel.remove();
      }
      // Keep the saved automatic number within the Information fields, beside Owner.
      const number=body?.querySelector(".crm-number-row .field");
      const owner=body?.querySelector('[name="owner_id"]')?.closest(".field");
      if(number&&owner){owner.after(number);number.classList.add("crm-inline-document-number");}
    }
    backdrop.classList.add("crm-page-backdrop");
    $("#modal")?.setAttribute("aria-modal", "false");
    const heading = $("#modal-title");
    if (heading && MODULES[resource]) {
      // This modal header survives SPA navigation: clear prior controls before rebuilding.
      const headerControls = heading.parentElement;
      headerControls.querySelectorAll(".crm-layout-header-actions, .crm-edit-layout, .crm-record-layout-picker").forEach(element=>element.remove());
      const layoutActions = document.createElement("div");
      layoutActions.className = "crm-layout-header-actions";
      const editLayout = document.createElement("button");
      editLayout.type = "button";
      editLayout.className = "button button-ghost crm-edit-layout";
      editLayout.textContent = "Edit Page Layout";
      editLayout.addEventListener("click", () => navigate("/layout-editor/" + resource));
      const named = standardLayouts[resource]?.named_layouts || {};
      if (MODULES[resource]) {
        const select = document.createElement("select");
        select.className="field-select crm-record-layout-picker";
        select.setAttribute("aria-label","Record layout");
        select.innerHTML=['Standard',...Object.keys(named).filter(name=>name.trim().toLowerCase()!=="standard")].map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join("");
        select.value=localStorage.getItem("convosis-selected-layout:"+resource) || standardLayouts[resource]?.active_layout || "Standard";
        select.addEventListener("change", () => {
          localStorage.setItem("convosis-selected-layout:"+resource,select.value);
          const form = document.querySelector("#modal-body .form-grid");
          if(!form)return;
          const ordered=orderedFormFields(resource,MODULES[resource].fields);
          const inputs=new Map([...form.querySelectorAll("[name]")].map(el=>[el.name,{value:el.value,checked:el.checked}]));
          form.innerHTML=ordered.map(f=>f.custom?customFieldHtml(f):fieldHtml(f,inputs.get(f.key)?.value)).join("");
          form.querySelectorAll("[name]").forEach(el=>{const prior=inputs.get(el.name);if(prior){el.value=prior.value; if(el.type==="checkbox")el.checked=prior.checked;}});
        });
        layoutActions.appendChild(select);
      }
      layoutActions.insertBefore(editLayout, layoutActions.firstChild);
      headerControls.appendChild(layoutActions);
    }
    const cancel = $("#modal-cancel");
    if (cancel) cancel.textContent = "Cancel";
  } finally { isFullPageRendering = false; }
}
function openFullPageRecord(resource, id = null) {
  return navigate("/" + resource + (id ? "/edit/" + id : "/create"));
}
const standardLayouts = {};
async function fetchStandardLayout(resource) {
  if (!MODULES[resource] && !state.platformCatalog?.resources?.[resource]) return;
  standardLayouts[resource] = await api("/api/admin/standard-layout/" + resource);
}
function customFieldHtml(field) {
  const name = "cf__" + field.key;
  const type = ({multiline:"textarea",email:"email",phone:"tel",date:"date",datetime:"datetime-local",number:"number",decimal:"number",currency:"number",percentage:"number",url:"url"}[field.type] || "text");
  const input = field.type === "checkbox" ? '<input type="checkbox" name="' + esc(name) + '">'
    : type === "textarea" ? '<textarea class="field-textarea" name="' + esc(name) + '"></textarea>'
    : field.type === "picklist" ? '<select class="field-select" name="' + esc(name) + '"><option value="">Select</option>' + (field.options || []).map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join("") + '</select>'
    : field.type === "multi_select" ? '<input class="field-input" data-multi="true" name="' + esc(name) + '" placeholder="Separate values with commas">'
    : '<input class="field-input" name="' + esc(name) + '" type="' + esc(type) + '" ' + (field.required ? 'required ' : '') + (type === "number" ? 'step="any"' : '') + '>';
  return '<div class="field"><label>' + esc(field.label) + (field.required ? " *" : "") + '</label>' + input + '</div>';
}
function formCustomValues(form) {
  const out = {};
  form.querySelectorAll('[name^="cf__"]').forEach(input => {
    let value = input.type === "checkbox" ? input.checked : input.value;
    if (input.dataset.multi === "true") value = value.split(",").map(v=>v.trim()).filter(Boolean);
    out[input.name.slice(4)] = value || (input.type === "checkbox" ? false : null);
  });
  return out;
}
function layoutEditorKey(resource) { return "convosis-form-layout-v1:" + resource; }
function orderedFormFields(resource, fields) {
  const layout = standardLayouts[resource];
  const selected = localStorage.getItem("convosis-selected-layout:"+resource) || layout?.active_layout || "Standard";
  const sections = selected === "Standard" ? layout?.sections : layout?.named_layouts?.[selected]?.sections;
  let keys = sections?.flatMap(section=>section.fields || []) ?? null;
  if (!layout) { try { keys = JSON.parse(localStorage.getItem(layoutEditorKey(resource)) || "null"); } catch {} }
  const all = [...fields, ...(layout?.fields || []).map(field=>({...field,custom:true}))];
  if (keys !== null) {
    const byKey = new Map(all.map(field=>[field.key,field]));
    const visible = [...new Set(keys)].map(key=>byKey.get(key)).filter(Boolean);
    // A malformed or empty saved layout must not render an unusable blank record form.
    if (visible.length) return visible;
  }
  const rank = new Map((layout?.order || []).map((key,index)=>[key,index]));
  return all.sort((a,b)=>(rank.get(a.key) ?? 9999)-(rank.get(b.key) ?? 9999));
}
async function openRecordModal(resource, id = null, preset = {}) {
  if (!isFullPageRendering && (MODULES[resource] || resource === "users")) { if (!id) pendingRecordPresets.set(resource, preset); return openFullPageRecord(resource, id); }
  const config = MODULES[resource] || settingsResourceConfig(resource);
  if (!config) return;
  if (["contacts", "deals", "activities", "notes", "attachments", "emails"].some((resourceName) => resource === resourceName) || config.fields.some((field) => ["account", "contact"].includes(field.type))) await ensureLookups();
  let record = resource === 'activities' ? activityDefaults(window.location.pathname, preset, state.profile?.id) : {owner_id: state.profile?.id, ...preset};
  if (id) record = await api(resource === "users" ? `/api/admin/users/${id}` : `/api/${resource}/${id}`);
  if(resource === "users") {
    const access=await api("/api/admin/users/options");
    config.fields=config.fields.filter(f=>f.key!=="status");
    config.fields.push({key:"profile_name",label:"Permission profile",type:"select",options:access.profiles});
    if(!id) record.profile_name="Standard";
  }
  state.modal = { resource, id, preset };
  $("#modal-eyebrow").textContent = id ? `Edit ${config.singular}` : `New ${config.singular}`;
  $("#modal-title").textContent = id ? `Update ${config.singular.toLowerCase()}` : `Create ${config.singular.toLowerCase()}`;
  $("#modal-submit").textContent = id ? "Save changes" : resource === "users" ? "Send invitation" : `Create ${config.singular.toLowerCase()}`;
  const body = $("#modal-body");
  body.innerHTML = `<div class="form-grid">${orderedFormFields(resource, config.fields).map((field) => field.custom ? customFieldHtml(field) : fieldHtml(field, record[field.key])).join("")}</div>`;
  usability.relatedLookup(body);
  if (resource === "attachments" && !id) installAttachmentPicker($("#modal-body"));
  $("#modal-backdrop").hidden = false;
  $("#modal-body input, #modal-body select, #modal-body textarea")?.focus();
  if (!$("#modal-body").dataset.calendarClickBound) { bindDatePickerClick($("#modal-body")); $("#modal-body").dataset.calendarClickBound = "1"; }
}
async function openPlatformModal(resource, id = null, preset = {}) {
  if (!isFullPageRendering && state.platformCatalog.resources[resource]) { if (!id) pendingRecordPresets.set(resource, preset); return openFullPageRecord(resource, id); }
  // Check the server entitlement before rendering fields or accepting user input.
  await api(`/api/platform/${resource}?limit=1`);
  $("#modal")?.classList.remove("quote-form-active");
  const config = state.platformCatalog.resources[resource];
  if (!config) return;
  if ((config.fields || []).some((field) => ["account", "contact", "lead", "deal"].includes(field.type))) await ensureLookups();
  if (["quotes","invoices","sales_orders","purchase_orders","price_books"].includes(resource) || (config.fields || []).some(field => /product/i.test(field.key))) await ensurePlatformLookup("products");
  await Promise.all((config.fields || []).filter((field) => String(field.type || "").startsWith("platform:")).map((field) => ensurePlatformLookup(field.type.split(":")[1])));
  let record = { ...preset };
  if (["quotes","solutions"].includes(resource) && !id && !record.status) record.status = "Draft";
  if (resource === "cases" && !id && !record.status) record.status = "New";
  if (id) record = await api(`/api/platform/${resource}/${id}`);
  state.modal = { resource, id, platform: true };
  $("#modal")?.classList.toggle("quote-form-active", resource === "quotes");
  $("#modal-eyebrow").textContent = id ? `Edit ${config.singular}` : `New ${config.singular}`;
  $("#modal-title").textContent = id ? `Update ${config.singular.toLowerCase()}` : `Create ${config.singular.toLowerCase()}`;
  $("#modal-submit").textContent = id ? "Save changes" : `Create ${config.singular.toLowerCase()}`;
  const layoutData = await api("/api/admin/standard-layout/" + resource).catch(() => null);
  const namedLayouts = layoutData?.named_layouts || {};
  const selectedLayout = localStorage.getItem("convosis-selected-layout:" + resource) || layoutData?.active_layout || "Standard";
  const layoutOptions = ["Standard", ...Object.keys(namedLayouts)];
  const layoutPicker = '<label class="crm-platform-layout-label">Layout <select class="field-select" data-platform-layout-select aria-label="Select record layout">' + layoutOptions.map(name => '<option value="' + esc(name) + '"' + (name === selectedLayout ? ' selected' : '') + '>' + esc(name) + '</option>').join("") + '</select></label>';
  const originalFields = [...config.fields, ...(config.fields.some(field => field.key === "owner_id") ? [] : [{key:"owner_id",label:"Owner",type:"user"}])];
  const renderFields = name => {
    const sections = name === "Standard" ? layoutData?.sections : namedLayouts[name]?.sections;
    const orderedKeys = sections?.flatMap(section => section.fields || []);
    const available = [...originalFields, ...(layoutData?.fields || []).map(field=>({...field,custom:true}))];
    const byKey = new Map(available.map(field=>[field.key,field]));
    const configured = orderedKeys ? [...new Set(orderedKeys)].map(key=>byKey.get(key)).filter(Boolean) : [];
    // Fall back to the module's actual fields when a saved layout contains no valid fields.
    const visible = configured.length ? configured : available;
    return visible.map(field => field.custom ? customFieldHtml(field) : fieldHtml(field,record[field.key])).join("");
  };
  $("#modal-body").innerHTML = layoutPicker + '<div class="form-grid">' + renderFields(selectedLayout) + '</div>';
  $("#modal-body [data-platform-layout-select]")?.addEventListener("change", event => {
    const values = new Map([...document.querySelectorAll("#modal-body .form-grid [name]")].map(input => [input.name, {value:input.value,checked:input.checked}]));
    localStorage.setItem("convosis-selected-layout:" + resource,event.target.value);
    const grid = document.querySelector("#modal-body .form-grid");
    grid.innerHTML = renderFields(event.target.value);
    grid.querySelectorAll("[name]").forEach(input => { const old = values.get(input.name); if(old){input.value=old.value;if(input.type==="checkbox")input.checked=old.checked;} });
    usability.relatedLookup(grid); usability.enhance();
  });
  if (resource === "campaigns") usability.campaignValidation($("#modal-body"));
  usability.relatedLookup($("#modal-body"));
  if (["invoices","sales_orders","purchase_orders"].includes(resource)) layoutProductLineItems(record,{esc,formatMoney,products:state.platformLookups.products || []});
  if (resource === "quotes") {
    layoutQuoteForm(record, {esc, formatMoney, products:state.platformLookups.products || []});
    const form = document.querySelector("#modal-body");
    const dealField = form.querySelector('[name="deal_id"]');
    const fillAccount = async accountId => {
      if(!accountId)return;
      const accountRecord=await api("/api/accounts/"+encodeURIComponent(accountId));
      fillQuoteAccountAddresses(form,accountRecord);
    };
    form.querySelector('[name="account_id"]')?.addEventListener("change",event=>fillAccount(event.target.value).catch(error=>toast("Account mapping",error.message,"error")));
    form.querySelector('[name="contact_id"]')?.addEventListener("change",async event=>{
      if(!event.target.value)return;
      try{
        const contact=await api("/api/contacts/"+encodeURIComponent(event.target.value));
        const account=form.querySelector('[name="account_id"]');
        if(account && contact.account_id){account.value=contact.account_id;await fillAccount(contact.account_id);}
      }catch(error){toast("Contact mapping",error.message,"error");}
    });
    dealField?.addEventListener("change", async () => {
      if(!dealField.value)return;
      try {
        const deal=await api("/api/deals/"+encodeURIComponent(dealField.value));
        const account=form.querySelector('[name="account_id"]'),contact=form.querySelector('[name="contact_id"]');
        if(account)account.value=deal.account_id || "";
        if(contact)contact.value=deal.contact_id || "";
        if(deal.account_id)await fillAccount(deal.account_id);
        const subject=form.querySelector('[name="name"]');
        if(subject && !subject.value.trim())subject.value=deal.name+" - Quote";
        const amount=form.querySelector('[name="amount"]');
        if(amount && !(form.querySelector('[name="line_items"]')?.value || "").includes('"name"'))amount.value=String(deal.amount||0);
      } catch(error) { toast("Could not fill Deal details",error.message,"error"); }
    });
  }
  $("#modal-backdrop").hidden = false;
  $("#modal-body input, #modal-body select, #modal-body textarea")?.focus();
  if (!$("#modal-body").dataset.calendarClickBound) { bindDatePickerClick($("#modal-body")); $("#modal-body").dataset.calendarClickBound = "1"; }
}
function settingsResourceConfig(resource) {
  if (resource === "users") return { label: "Users", singular: "User", fields: [{ key: "name", label: "Name", required: true }, { key: "email", label: "Email", type: "email", required: true }, { key: "role", label: "Role", type: "select", options: ["User", "Sales rep", "Sales manager", "Administrator"] }, { key: "designation", label: "Designation", hint: "Job title in this organization; does not grant access." }, { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"], hint: "For new teammates, access begins after they accept the invitation." }] };
  if (resource === "notes") return { label: "Notes", singular: "Note", fields: [{ key: "title", label: "Title", required: true }, { key: "content", label: "Note", type: "textarea", full: true }, { key: "related_type", label: "Related module", type: "select", options: ["leads", "contacts", "accounts", "deals"] }, { key: "related_id", label: "Related record", type: "number" }] };
  if (resource === "attachments") return { label: "Attachments", singular: "Attachment", fields: [{ key: "name", label: "File name", required: true }, { key: "file_type", label: "File type" }, { key: "file_size", label: "File size" }, { key: "url", label: "File URL" }, { key: "related_type", label: "Related module", type: "select", options: ["leads", "contacts", "accounts", "deals"] }, { key: "related_id", label: "Related record", type: "number" }] };
  if (resource === "emails") return { label: "Emails", singular: "Email", fields: [{ key: "subject", label: "Subject", required: true }, { key: "from_email", label: "From", type: "email" }, { key: "to_email", label: "To", type: "email" }, { key: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Scheduled"] }, { key: "sent_at", label: "Sent at", type: "datetime-local" }, { key: "body", label: "Message", type: "textarea", full: true }, { key: "related_type", label: "Related module", type: "select", options: ["leads", "contacts", "accounts", "deals"] }, { key: "related_id", label: "Related record", type: "number" }] };
  if (resource === "approval_processes") return { label: "Approval process", singular: "Approval rule", fields: [{ key: "name", label: "Rule name", required: true }, { key: "module", label: "Module", type: "select", options: ["Deals", "Leads", "Accounts"] }, { key: "trigger", label: "Trigger", required: true }, { key: "approver", label: "Approver", required: true }, { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] }, { key: "conditions", label: "Conditions (JSON)", type: "textarea", hint: "Example: [{\"field\":\"amount\",\"operator\":\">\",\"value\":\"100000\"}]", full: true }, { key: "steps", label: "Approval steps (JSON)", type: "textarea", hint: "Example: [{\"order\":1,\"approver\":\"Sales manager\"}]", full: true }] };
  return null;
}
function readForm(form) {
  const data = {};
  $$('[name]', form).forEach((input) => {
    if (input.type === "file" || input.readOnly || input.name.startsWith("cf__")) return;
    let value = input.value;
    if (input.dataset.numeric === "true" || ["owner_id", "account_id", "contact_id", "deal_id", "related_id", "lead_score", "probability", "amount", "employees", "annual_revenue", "unit_price", "stock_quantity"].includes(input.name)) value = value ? Number(value) : null;
    else if (["tags"].includes(input.name)) value = value ? value.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
    else if (input.dataset.json === "true" || ["conditions", "steps", "stages", "transitions", "transition_requirements", "criteria", "actions"].includes(input.name)) {
      try { value = value ? JSON.parse(value) : []; } catch { throw new Error(`${titleCase(input.name)} must be valid JSON. Check the brackets and quotes.`); }
      if (input.dataset.json !== "true" && !Array.isArray(value)) throw new Error(`${titleCase(input.name)} must be a JSON list, like [ ... ].`);
    }
    else if (input.dataset.boolean === "true") value = input.classList.contains("on");
    else if (value === "") value = null;
    data[input.name] = value;
  });
  return data;
}
async function submitRecord(event) {
  event.preventDefault();
  if (!state.modal) return;
  if (state.modal.convert) return submitConvert(event.currentTarget);
  if (state.modal.platform) return submitPlatformRecord(event.currentTarget);
  const { resource, id, context, preset } = state.modal;
  const singular = MODULES[resource]?.singular || settingsResourceConfig(resource)?.singular || "record";
  const submit = $("#modal-submit");
  const form = event.currentTarget;
  try {
    if (submit.disabled) return;
    const data = readForm(form);
    if (context?.kind === "account-deal") data.account_id = context.sourceId;
    submit.disabled = true;
    let created = null;
    if (resource === "attachments" && !id) {
      await createAttachmentFromFile(event.currentTarget, data, api);
    } else if (resource === "users" && !id) {
      created = await api("/api/admin/users/invite", { method: "POST", body: JSON.stringify(data) });
      state.lastInvitation = created;
    } else if (resource === "users" && id) {
      created = await api(`/api/admin/users/${id}`, {method:"PATCH", body:JSON.stringify(data)});
    } else {
      created = await api(`/api/${resource}${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(data) });
      if ((standardLayouts[resource]?.fields || []).length && (created?.id || id)) await api("/api/admin/standard-layout/" + resource + "/records/" + (id || created.id), {method:"PUT",body:JSON.stringify({values:formCustomValues(form)})});
    }
    if (["accounts", "contacts", "deals"].includes(resource)) invalidateLookups();
    if (resource === "users") { await refreshMeta(); if (id && id === state.profile?.id) { state.profile = await api("/api/settings/profile"); applyProfile(); } }
    const savedRoute = resource === "webforms" ? `/webforms` : created?.id || id ? `/${resource}/${created?.id || id}` : `/${resource}`;
    closeModal(false);
    if (context?.kind === "account-deal" && created?.id) {
      toast("Deal created", "The new Deal is linked to the selected Account.");
      await navigate(`/deals/${created.id}`);
      return;
    }
    if (resource === "users" && !id) {
      if (created?.delivery === "sent") {
        toast("Invitation email sent", "SMTP accepted the message. Ask the recipient to check Inbox and Spam.");
      } else {
        const message = created?.delivery === "failed"
          ? "The invitation was created, but email delivery failed. Check Railway SMTP settings."
          : "The invitation was created, but SMTP is not configured in Railway.";
        toast("Invitation email not sent", message, "error");
        if (created?.accept_url) {
          toast("Invitation link available", "Copy the invitation link from the Users page and share it securely.");
        }
      }
    } else {
      toast(`${id ? "Updated" : "Created"} ${singular}`, "");
    }
    // Contacts created from an Account return to the originating Account record.
    // Only redirect when the newly saved Contact is still linked to that Account.
    const sourceAccountId = Number(preset?.account_id);
    const savedAccountId = Number(created?.account_id ?? data.account_id);
    const accountReturn = resource === "contacts" && !id && Number.isInteger(sourceAccountId) && sourceAccountId > 0 && savedAccountId === sourceAccountId;
    await navigate(resource === "users" ? "/setup/users" : accountReturn ? `/accounts/${sourceAccountId}` : preset?._returnTo || savedRoute, true);
  } catch (error) { toast("Could not save record", error.message, "error"); }
  finally { submit.disabled = false; }
}
async function submitPlatformRecord(form) {
  const { resource, id, context } = state.modal;
  const config = state.platformCatalog.resources[resource];
  const submit = $("#modal-submit");
  try {
    if (submit.disabled) return;
    const data = readForm(form);
    if (resource === "webforms") { delete data.public_token; data.target_module = "Leads"; }
    if (context?.kind === "deal-quote") data.deal_id = context.sourceId;
    submit.disabled = true;
    let created = null;
    const upload = resource === "documents" ? form.querySelector('input[type="file"]')?.files?.[0] : null;
    if (upload) {
      if (id) throw new Error("Upload a new document as a separate record; existing file history remains unchanged.");
      const body = new FormData();
      body.append("file", upload);
      Object.entries(data).forEach(([key, value]) => { if (value !== null && value !== "") body.append(key, String(value)); });
      const response = await fetch("/api/documents/upload", { method: "POST", body });
      const raw = await response.text();
      let result = {}; try { result = raw ? JSON.parse(raw) : {}; } catch { result = {}; }
      if (!response.ok) throw new Error(result.detail || raw.slice(0, 180) || `Upload failed with HTTP ${response.status}`);
    } else {
      created = await api(`/api/platform/${resource}${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(data) });
    }
    invalidateLookups();
    const savedRoute = created?.id || id ? `/${resource}/${created?.id || id}` : `/${resource}`;
    closeModal(false);
    if (context?.kind === "deal-quote" && created?.id) {
      toast("Quote created", `${created.quote_number || "Quote"} is linked to the Deal.`);
      await navigate("/quotes");
      return;
    }
    toast(`${id ? "Updated" : "Created"} ${config.singular}`);
    await navigate(savedRoute, true);
  } catch (error) { toast("Could not save record", error.message, "error"); }
  finally { submit.disabled = false; }
}
async function submitConvert(form) {
  const submit = $("#modal-submit");
  try {
    const data = readForm(form);
    data.create_deal = data.create_deal === "true";
    data.deal_amount = Number(data.deal_amount || 0);
    submit.disabled = true;
    await api(`/api/leads/${state.modal.id}/convert`, { method: "POST", body: JSON.stringify(data) });
    invalidateLookups();
    closeModal();
    toast("Lead converted", "The account, contact and deal are ready in your workspace.");
    await navigate("/leads");
  } catch (error) { toast("Could not convert lead", error.message, "error"); }
  finally { submit.disabled = false; }
}
async function closeModal(returnToList = true) {
  if (returnToList !== false && !(await usability.canLeave())) return;
  usability.clear();
  const backdrop = $("#modal-backdrop");
  const wasPage = backdrop.classList.contains("crm-page-backdrop");
  if (wasPage) {
    backdrop.classList.remove("crm-page-backdrop");
    $("#modal")?.setAttribute("aria-modal", "true");
    $("#modal .crm-edit-layout")?.remove();
    document.body.appendChild(backdrop);
  }
  if (wasPage) { backdrop.hidden = true; state.modal = null; if (returnToList) navigate("/" + (window.location.pathname.split("/")[1] || "dashboard"), true); return; }
  $("#modal-backdrop").hidden = true; $("#modal")?.classList.remove("quote-form-active"); state.modal = null; }
function closeConfirm(result) {
  if ($("#confirm-backdrop").hidden) return;
  $("#confirm-backdrop").hidden = true;
  const resolve = state.confirmResolve;
  state.confirmResolve = null;
  resolve?.(result);
}
function confirmAction(title, copy, actionLabel = "Continue") {
  return confirmDialog(copy, {title, confirmLabel:actionLabel, danger:/delete|archive|deactivate/i.test(actionLabel)});
}

async function deleteRecord(resource, id) {
  const permanent = false;
  const confirmed = resource === "users"
    ? await confirmAction("Deactivate this user?", "This user can be reactivated later.", "Deactivate")
    : await confirmAction("Delete this record?", "The record will remain in Settings > Recycle Bin for 30 days.", "Delete");
  if (!confirmed) return;
  try {
    await api(`/api/${resource}/${id}`, { method: "DELETE" });
    if (["accounts", "contacts"].includes(resource)) invalidateLookups();
    if (resource === "users") await refreshMeta();
    toast(resource === "users" ? "User deactivated" : "Record deleted", resource === "users" ? "User deactivated; access removed." : "Moved to Recycle Bin for 30 days.");
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (MODULES[resource] && parts[0] === resource && parts[1]) await navigate(`/${resource}`);
    else await renderRoute();
  } catch (error) { toast("Could not complete that action", error.message, "error"); }
}
async function deletePlatformRecord(resource, id) {
  const config = state.platformCatalog.resources[resource];
  const confirmed = await confirmAction(`Delete this ${config.singular.toLowerCase()}?`, "The record will remain in Recycle Bin for 30 days.", "Delete");
  if (!confirmed) return;
  try {
    await api(`/api/platform/${resource}/${id}`, { method: "DELETE" });
    toast("Record deleted", "It can be restored from Settings > Recycle Bin for 30 days.");
    if (window.location.pathname === `/${resource}/${id}`) await navigate(`/${resource}`);
    else await renderRoute();
  } catch (error) { toast("Could not archive record", error.message, "error"); }
}
function bindGlobal() {
  installModuleAI({ api, state, esc, toast });
  document.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) {
      event.preventDefault();
      const target = go.dataset.go;
      if (target) navigate(target);
      return;
    }
    const relatedAnchor = event.target.closest('.quote-zoho aside a[href^="#q-related-"], .quote-zoho aside a[href^="#invoice-"], .quote-zoho aside a[href^="#q-"]');
    if (relatedAnchor) {
      const targetId = relatedAnchor.getAttribute("href").slice(1);
      const target = document.getElementById(targetId);
      if (target) {
        event.preventDefault();
        target.style.scrollMarginTop = "110px";
        target.scrollIntoView({behavior:"smooth",block:"start"});
        history.replaceState(history.state, "", location.pathname + "#" + targetId);
      }
      return;
    }
    const link = event.target.closest("a[href]");
    if (link && !link.hasAttribute("download") && !link.getAttribute("href").startsWith("/api/") && !event.metaKey && !event.ctrlKey && !event.shiftKey && link.origin === window.location.origin && link.getAttribute("href").startsWith("/")) { event.preventDefault(); navigate(link.getAttribute("href")); return; }
    const retry = event.target.closest("[data-retry]"); if (retry) renderRoute();
  });
  window.addEventListener("popstate", async () => { const destination = location.pathname + location.search; if (await usability.canLeave()) { usability.clear(); state.route = destination; await renderRoute(); } else history.pushState({}, "", state.route); });
  $("#menu-toggle").addEventListener("click", () => $("#sidebar").classList.add("open"));
  $("#sidebar-close").addEventListener("click", () => $("#sidebar").classList.remove("open"));
  $("#modal-close").addEventListener("click", closeModal); $("#modal-cancel").addEventListener("click", closeModal); $("#modal-backdrop").addEventListener("click", (event) => { if (event.target.id === "modal-backdrop") closeModal(); });
  $("#confirm-close").addEventListener("click", () => closeConfirm(false)); $("#confirm-cancel").addEventListener("click", () => closeConfirm(false)); $("#confirm-action").addEventListener("click", () => closeConfirm(true));
  $("#confirm-backdrop").addEventListener("click", (event) => { if (event.target.id === "confirm-backdrop") closeConfirm(false); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { if (!$("#confirm-backdrop").hidden) closeConfirm(false); else if (!$("#modal-backdrop").hidden) closeModal(); else $("#search-results").classList.remove("open"); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#global-search").focus(); }
  });
  $("#record-form").addEventListener("submit", submitRecord);
  const accountDrawer = $("#crm-account-drawer");
  const accountMask = $("#crm-account-mask");
  const accountButton = $("#top-profile");
  function closeAccountDrawer() {
    if (!accountDrawer) return;
    accountDrawer.hidden = true;
    accountMask.hidden = true;
    accountDrawer.setAttribute("aria-hidden", "true");
    accountButton?.setAttribute("aria-expanded", "false");
    document.body.style.removeProperty("overflow");
    accountButton?.focus();
  }
  function openAccountDrawer() {
    if (!accountDrawer) return;
    applyProfile();
    accountDrawer.hidden = false;
    accountMask.hidden = false;
    accountDrawer.setAttribute("aria-hidden", "false");
    accountButton?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    accountDrawer.focus();
  }
  accountButton?.addEventListener("click", () => accountDrawer.hidden ? openAccountDrawer() : closeAccountDrawer());
  $("#crm-account-close")?.addEventListener("click", closeAccountDrawer);
  accountMask?.addEventListener("click", closeAccountDrawer);
  document.addEventListener("keydown", event => { if (event.key === "Escape" && accountDrawer && !accountDrawer.hidden) closeAccountDrawer(); });
  document.querySelectorAll("[data-account-link]").forEach(link => link.addEventListener("click", () => closeAccountDrawer()));
  $("#crm-account-signout")?.addEventListener("click", () => $("#logout-button")?.click());
  document.querySelectorAll("[data-account-mode]").forEach(button => {
    button.addEventListener("click", () => {
      const mode = button.dataset.accountMode;
      try { localStorage.setItem("crm-account-theme", mode); } catch (_) {}
      document.documentElement.dataset.accountTheme = mode;
      document.querySelectorAll("[data-account-mode]").forEach(b => b.classList.toggle("active", b === button));
    });
  });
  $("#profile-shortcut")?.addEventListener("click", openAccountDrawer);
  const avatarButton = $("#sidebar-avatar-button");
  const photoInput = $("#profile-photo-input");
  // The footer avatar opens profile settings. File selection is exclusive to the
  // explicit upload/change button within that settings page.
  avatarButton?.addEventListener("click", () => navigate("/settings/my-profile"));
  document.querySelector(".sidebar-footer .user-mini-copy")?.addEventListener("click", () => navigate("/settings/my-profile"));
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-profile-photo-select]")) photoInput?.click();
  });
  photoInput?.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast("Invalid image", "Choose a JPG, PNG or WebP image under 5 MB.");
      photoInput.value = "";
      return;
    }
    avatarButton.disabled = true;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext("2d");
      const side = Math.min(bitmap.width, bitmap.height);
      context.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, 256, 256);
      bitmap.close();
      const image = canvas.toDataURL("image/jpeg", 0.8);
      const result = await api("/api/settings/profile/photo", { method: "PUT", body: JSON.stringify({ image }) });
      state.profile.avatar_data = result.avatar_data;
      applyProfile();
      const settingsAvatar = document.querySelector(".profile-settings-avatar");
      if (settingsAvatar) {
        settingsAvatar.textContent = result.avatar_data ? "" : initials(state.profile.username || state.profile.name || "Account");
        settingsAvatar.style.backgroundImage = result.avatar_data ? 'url("' + result.avatar_data + '")' : "none";
        settingsAvatar.classList.toggle("has-profile-photo", Boolean(result.avatar_data));
      }
      toast("Profile picture updated", "Your new photo is saved.");
    } catch (error) {
      toast("Photo upload failed", error.message || "Could not save this picture.");
    } finally {
      avatarButton.disabled = false;
      photoInput.value = "";
    }
  });

  $("#logout-button")?.addEventListener("click", async () => {
    const button = $("#logout-button");
    button.disabled = true;
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" } });
    } finally {
      window.location.replace("/login");
    }
  });
  const notificationPopupRegion = $("#notification-popup-region");
  const shownNotificationIds = new Set();
  const dismissNotificationPopup = async (popup, notificationId) => {
    popup?.remove();
    if (!notificationId) return;
    try {
      await api(`/api/notifications/${notificationId}/read`, { method: "POST" });
    } catch {
    }
  };
  const showNotificationPopup = (item) => {
    if (!notificationPopupRegion || !item?.id || shownNotificationIds.has(item.id)) return;
    shownNotificationIds.add(item.id);
    notify(item.title || "Notification", item.body || "", {type:item.kind, duration:9000})
      .then(() => dismissNotificationPopup(null, item.id));
  };
  const checkForNotifications = async () => {
    try {
      const data = await api("/api/notifications?unread_only=true&limit=4");
      const items = Array.isArray(data.items) ? data.items : [];
      items.slice().reverse().forEach(showNotificationPopup);
    } catch {
    }
  };
  checkForNotifications();
  window.setInterval(checkForNotifications, 60000);
  installGlobalSearch({api,esc,titleCase,MODULES,navigate});
}
let aiFeature;
function aiDashboardView(...args) { return aiFeature.aiDashboardView(...args); }
function apexAssistantResultHtml(...args) { return aiFeature.apexAssistantResultHtml(...args); }
function bindApexAssistant(...args) { return aiFeature.bindApexAssistant(...args); }
function bindApexAssistantResult(...args) { return aiFeature.bindApexAssistantResult(...args); }
function aiView(...args) { return aiFeature.aiView(...args); }
function aiMessageHtml(...args) { return aiFeature.aiMessageHtml(...args); }
function renderAIConversation(...args) { return aiFeature.renderAIConversation(...args); }
function bindAIProposalActions(...args) { return aiFeature.bindAIProposalActions(...args); }
function bindAI(...args) { return aiFeature.bindAI(...args); }
async function settingsView(tab) {
  let content = '';
  if (tab === 'general') content = `${await generalSettingsView()}${await settingsPlatformSummary("company_details", "Company details")}${await settingsPlatformSummary("fiscal_years", "Fiscal years")}`;
  if (tab === 'my-profile') content = await myProfileView();
  if (tab === 'profile-users') content = await profileUsersView();
  if (tab === 'organization') content = await organizationManagementView();
  if (tab === 'approval-process') content = await approvalSettingsView();
  if (tab === 'blueprint') content = await blueprintSettingsView();
  const labels = { general: 'General settings', 'profile-users': 'Profile & users', 'approval-process': 'Approval process', blueprint: 'Blueprint' };
  return `<section class="setup-page-shell"><div class="setup-toolbar setup-toolbar-search-only"><label class="toolbar-search setup-toolbar-search"><span>⌕</span><input data-setup-search-input placeholder="Search Setup" /></label></div><div class="setup-workspace">${setupDirectory(tab === 'general' ? 'company_details' : tab === 'my-profile' ? 'personal_settings' : tab === 'profile-users' ? 'users' : tab === 'organization' ? 'organization' : tab === 'approval-process' ? 'approval_processes' : 'blueprints')}<div class="settings-content">${content}</div></div></section>`;
}
const { organizationManagementView, bindOrganizationManagement } = createOrganizationSettings({api,state,esc,$,$$,toast,renderRoute});
async function settingsPlatformSummary(resource, title) {
  const config = state.platformCatalog.resources[resource];
  if (!config) return "";
  const data = await api(`/api/platform/${resource}?limit=100&sort=name_asc`);
  const add = config.singleton && data.total ? "" : `<button class="button button-primary button-small" data-platform-create="${resource}">+ Add ${esc(config.singular.toLowerCase())}</button>`;
  const organizationManagement = resource === "company_details" ? `<div class="settings-section-head" style="margin-top:24px"><h3>Organization Management</h3><p>Manage your organization profile, members, invitations, and ownership.</p><a class="button button-primary" href="/settings/organization">Open Organization Management</a></div>` : "";
  return `<section class="card settings-section"><div class="settings-section-head settings-heading-row"><div><h2>${esc(title)}</h2><p>${esc(config.description)}</p></div>${add}</div>${organizationManagement}${platformTable(resource, data)}</section>`;
}
async function generalSettingsView() {
  const setting = await api("/api/settings/general"); state.settingsCache = { ...state.settingsCache, ...setting };
  const notifications = setting.notifications || {};
  return `<section class="card settings-section"><div class="settings-section-head"><h2>General settings</h2><p>Set the defaults your workspace uses across records and reports.</p></div><form class="settings-form" data-settings-form="general"><div class="form-grid"><div class="field"><label for="org_id">Organization ID</label><input class="field-input" id="org_id" type="text" value="${esc(setting.org_id == null ? 'Not assigned' : String(setting.org_id))}" readonly aria-readonly="true" title="System-assigned organization identifier" /><small style="display:block;margin-top:6px;color:var(--text-faint)">Permanent system identifier. Cannot be edited.</small></div><div class="field"><label for="org_name">Organization name</label><input class="field-input" id="org_name" name="org_name" value="${esc(setting.org_name)}" /></div><div class="field"><label for="timezone">Timezone</label><select class="field-select" id="timezone" name="timezone"><option ${setting.timezone === "Asia/Kolkata" ? "selected" : ""}>Asia/Kolkata</option><option ${setting.timezone === "Asia/Singapore" ? "selected" : ""}>Asia/Singapore</option><option ${setting.timezone === "UTC" ? "selected" : ""}>UTC</option></select></div><div class="field"><label for="currency">Currency</label><select class="field-select" id="currency" name="currency"><option ${setting.currency === "INR" ? "selected" : ""}>INR</option><option ${setting.currency === "USD" ? "selected" : ""}>USD</option><option ${setting.currency === "EUR" ? "selected" : ""}>EUR</option></select></div><div class="field"><label for="date_format">Date format</label><select class="field-select" id="date_format" name="date_format"><option ${setting.date_format === "DD MMM YYYY" ? "selected" : ""}>DD MMM YYYY</option><option ${setting.date_format === "MM/DD/YYYY" ? "selected" : ""}>MM/DD/YYYY</option><option ${setting.date_format === "YYYY-MM-DD" ? "selected" : ""}>YYYY-MM-DD</option></select></div><div class="field"><label for="fiscal_year_start">Fiscal year starts in</label><select class="field-select" id="fiscal_year_start" name="fiscal_year_start"><option ${setting.fiscal_year_start === "April" ? "selected" : ""}>April</option><option ${setting.fiscal_year_start === "January" ? "selected" : ""}>January</option><option ${setting.fiscal_year_start === "July" ? "selected" : ""}>July</option></select></div><div class="field"><label for="default_pipeline">Default pipeline</label><input class="field-input" id="default_pipeline" name="default_pipeline" value="${esc(setting.default_pipeline)}" /></div></div><div style="margin-top:24px"><h3 style="margin-bottom:5px">Notifications</h3><p style="color:var(--text-faint);font-size:11px;margin-bottom:10px">Choose which updates your team should see in their workspace.</p><div class="switch-row"><div class="switch-copy"><strong>Daily digest</strong><small>Receive a concise summary of records that need attention.</small></div><button type="button" class="switch ${notifications.daily_digest ? "on" : ""}" data-setting-toggle="daily_digest" data-boolean="true" aria-label="Toggle daily digest"></button></div><div class="switch-row"><div class="switch-copy"><strong>Mentions</strong><small>Be notified when someone mentions you in a note or activity.</small></div><button type="button" class="switch ${notifications.mentions ? "on" : ""}" data-setting-toggle="mentions" data-boolean="true" aria-label="Toggle mentions"></button></div><div class="switch-row"><div class="switch-copy"><strong>Deal updates</strong><small>Stay informed when deals you own change stage.</small></div><button type="button" class="switch ${notifications.deal_updates ? "on" : ""}" data-setting-toggle="deal_updates" data-boolean="true" aria-label="Toggle deal updates"></button></div></div><div class="form-actions"><button type="submit" class="button button-primary">Save general settings</button></div></form></section>`;
}
async function myProfileView() {
  const profile = await api("/api/settings/profile");
  return `<section class="card settings-section"><div class="settings-section-head"><h2>Your profile</h2><p>Keep your personal details current for the rest of the team.</p></div><div class="profile-photo-settings"><div class="profile-photo-card"><span class="avatar avatar-indigo profile-settings-avatar ${profile.avatar_data && /^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(profile.avatar_data) ? "has-profile-photo" : ""}" aria-label="Current profile picture" style="${profile.avatar_data && /^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(profile.avatar_data) ? `background-image:url(&quot;${profile.avatar_data}&quot;);` : ""}">${profile.avatar_data && /^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(profile.avatar_data) ? "" : esc(initials(profile.username || profile.name || "Account"))}</span><div class="profile-photo-meta"><h3>Profile picture</h3><p>Choose a picture that will appear beside your account throughout the CRM.</p><button type="button" class="button button-ghost button-small" data-profile-photo-select>Upload / change picture</button><small>JPG, PNG or WebP · Maximum 5 MB</small></div></div></div><form class="settings-form" data-settings-form="profile"><div class="form-grid"><div class="field"><label for="profile-name">Full name</label><input class="field-input" id="profile-name" name="name" value="${esc(profile.name)}" /></div><div class="field"><label for="profile-email">Email</label><input class="field-input" id="profile-email" name="email" type="email" required value="${esc(profile.email)}" /></div><div class="field"><label>Role</label><input class="field-input" value="${esc(profile.role)}" disabled /></div></div><div class="form-actions"><button type="submit" class="button button-primary">Save profile</button></div></form></section>`;
}
async function profileUsersView() {
  const profile = state.profile || await api("/api/settings/profile");
  const isAdmin = String(profile.role || "").toLowerCase() === "administrator" || profile.owner_console_access === true;
  if (!isAdmin) return myProfileView();
  const users = await api("/api/admin/users?limit=100");
  const personal = await myProfileView();
  const invitation=state.lastInvitation;
  const inviteNotice=invitation?`<section class="card settings-section" role="status"><h3>Invitation for ${esc(invitation.email)}</h3><p>Share this invitation link with your teammate. It expires in 7 days.</p><input class="field-input" aria-label="Invitation link" readonly value="${esc(new URL(invitation.accept_url,location.origin).href)}"></section>`:"";
  return personal + inviteNotice + `<section class="card settings-section"><div class="settings-section-head" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h2>Users</h2><p>Manage who has access to this workspace and what they can do.</p></div><button class="button button-primary button-small" data-create="users">＋ Add user</button></div><div>${users.items.map((user) => `<div class="rule-row"><span class="avatar ${user.status === "Active" ? "avatar-green" : "avatar-amber"}">${initials(user.name)}</span><div class="rule-info"><strong>${esc(user.name)}</strong><small>${esc(user.email)} · ${esc(user.role)}${user.designation ? ` · ${esc(user.designation)}` : ""} · Last active ${formatDateTime(user.last_active)}</small></div>${badge(user.status)}<div class="rule-actions"><button class="table-action" data-edit-record="users" data-id="${user.id}">✎</button><button class="table-action" data-toggle-user="${user.id}" data-status="${user.status}">${user.status === "Active" ? "⏸" : "▶"}</button></div></div>`).join("")}</div></section>`;
}

async function approvalSettingsView() {
  const [data, inbox] = await Promise.all([api("/api/approval_processes?limit=100"), api("/api/approvals/requests?status=Pending&limit=100")]);
  const processes = data.items.length ? data.items.map((rule) => `<div class="rule-row"><span class="related-dot">✓</span><div class="rule-info"><strong>${esc(rule.name)}</strong><small>${esc(rule.module)} · ${esc(rule.trigger)} · ${esc((rule.steps || []).length || 1)} approval level(s)</small></div>${badge(rule.status)}<div class="rule-actions"><button class="table-action" data-edit-record="approval_processes" data-id="${rule.id}">✎</button><button class="table-action" data-delete-record="approval_processes" data-id="${rule.id}">⌫</button></div></div>`).join("") : emptyState("✓", "No approval rules", "Create a multi-level approval process for deals, leads, or accounts.", `<button class="button button-primary" data-create="approval_processes">New rule</button>`);
  const requests = inbox.items.length ? inbox.items.map((request) => { const step = request.steps.find((item) => item.status === "Pending"); return `<div class="rule-row"><span class="related-dot">◷</span><div class="rule-info"><strong>${esc(request.process_name)} · ${esc(request.resource)} #${request.record_id}</strong><small>Level ${request.current_step} · ${esc(step?.approver_name || step?.approver_label || "Unassigned")} · submitted ${formatDateTime(request.submitted_at)}</small></div><button class="button button-small button-ghost" data-approval-action="approve" data-approval-id="${request.id}">Approve</button><button class="button button-small button-ghost" data-approval-action="reject" data-approval-id="${request.id}">Reject</button><button class="table-action" title="Delegate" data-approval-action="delegate" data-approval-id="${request.id}">↗</button></div>`; }).join("") : emptyState("◷", "No pending approvals", "Submitted records will appear here at the current approval level.");
  return `<section class="card settings-section"><div class="settings-section-head" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h2>Approval processes</h2><p>Configure ordered approval levels with approve, reject, delegate, and audit history.</p></div><button class="button button-primary button-small" data-create="approval_processes">＋ New process</button></div><div>${processes}</div></section><section class="card settings-section"><div class="settings-section-head"><h2>Approval inbox</h2><p>Actions advance only the current level; later levels remain waiting until their turn.</p></div>${requests}</section>`;
}
async function blueprintSettingsView() { return blueprintFeature.view(); }
async function openConvertModal(id) {
  await navigate(`/leads/${id}/convert`);
}
async function leadConvertPage(id) {
  const lead = await api(`/api/leads/${id}`);
  if (lead.status === "Converted") {
    return `<section class="card" style="padding:28px"><h2>Lead already converted</h2><p>This lead has already been converted. Additional records will not be created.</p><button class="button button-primary" data-conversion-go="/leads">Go to Leads</button></section>`;
  }
  const timeline = await api(`/api/leads/${id}/timeline`);
  if (timeline.blueprint_enabled && !(timeline.transition_details || []).some(edge => edge.to === "Converted")) return `<section class="card" style="padding:28px"><h2>Conversion unavailable</h2><p>Advance this lead through the published Blueprint to reach a stage that allows conversion.</p><button class="button button-primary" data-conversion-go="/leads/${id}">Go to lead</button></section>`;
  const name = esc(lead.name || "Lead");
  const company = esc(lead.company || "");
  return `<section class="card" style="padding:0;overflow:visible;min-height:70vh">
    <header style="padding:22px 28px;border-bottom:1px solid var(--border,#dde3ed)"><h2 style="margin:0">Convert Lead <span style="font-size:14px;color:#66758c">(${name})</span></h2></header>
    <form id="lead-conversion-form" style="padding:26px 32px;max-width:920px">
      <p style="margin-bottom:24px"><strong>Create New Contact</strong> <span style="color:#66758c">${name}</span></p>
      <div class="field" style="max-width:560px;margin-bottom:22px"><label for="convert-account">Company / Account (match existing when available)</label><input class="field-input" id="convert-account" name="account_name" value="${company}" placeholder="Optional company name"></div>
      <label style="display:flex;align-items:center;gap:10px;margin-bottom:24px;cursor:pointer"><input type="checkbox" id="convert-deal" name="create_deal" value="true"> Create a new Deal for this Contact</label>
      <div id="convert-deal-fields" hidden style="max-width:650px;margin-bottom:26px">
        <div class="form-grid">
          <div class="field full"><label for="convert-name">Deal Name *</label><input class="field-input" name="deal_name" id="convert-name" value="${company || name}" placeholder="Deal name"></div>
          <div class="field"><label for="convert-date">Closing Date *</label><input class="field-input" type="date" name="expected_close_date" id="convert-date"></div>
          <div class="field"><label for="convert-stage">Stage *</label><select class="field-select" name="stage" id="convert-stage"><option>Qualification</option><option>Needs Analysis</option><option>Identify Decision Makers</option><option>Value Proposition</option><option>Proposal/Price Quote</option><option>Negotiation/Review</option><option>Closed Won</option><option>Closed Lost</option></select></div>
          <div class="field"><label for="convert-pipeline">Pipeline</label><select class="field-select" name="pipeline" id="convert-pipeline"><option value="Standard">Standard</option></select></div>
          <div class="field"><label for="convert-role">Contact Role</label><select class="field-select" name="contact_role" id="convert-role"><option>None</option><option>Developer/Evaluator</option><option>Decision Maker</option><option>Purchasing</option><option>Executive Sponsor</option><option>Engineering Lead</option><option>Economic Decision Maker</option><option>Product Management</option></select></div>
          <div class="field"><label for="convert-amount">Deal Amount</label><input class="field-input" name="deal_amount" id="convert-amount" type="number" min="0" step="any" value="0"></div>
        </div>
      </div>
      <p style="font-size:13px;color:#66758c;margin-bottom:20px">Existing notes, activities, attachments and related records remain linked to the converted contact or deal. Matching accounts and contacts are reused.</p>
      <div style="display:flex;gap:12px"><button class="button button-primary" type="submit" id="convert-submit">Convert</button><button class="button button-ghost" type="button" id="convert-cancel">Cancel</button></div>
    </form>
  </section>`;
}
function bindLeadConvertPage(id) {
  const form = $("#lead-conversion-form");
  if (!form) {
    $("[data-conversion-go]")?.addEventListener("click", (event) => navigate(event.currentTarget.dataset.conversionGo || "/leads"));
    return;
  }
  const checkbox = $("#convert-deal");
  const fields = $("#convert-deal-fields");
  checkbox.addEventListener("change", () => {
    fields.hidden = !checkbox.checked;
    $("#convert-name").required = checkbox.checked;
    $("#convert-date").required = checkbox.checked;
  });
  // Keep the displayed option and the submitted payload in sync.
  checkbox.dispatchEvent(new Event("change"));
  $("#convert-cancel").addEventListener("click", () => navigate(`/leads/${id}`));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = $("#convert-submit");
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.create_deal = checkbox.checked;
    payload.deal_amount = checkbox.checked ? Number(payload.deal_amount || 0) : 0;
    submit.disabled = true;
    try {
      const converted = await api(`/api/leads/${id}/convert`, {method:"POST",body:JSON.stringify(payload)});
      invalidateLookups();
      state.conversionResult = converted;
      usability.clear();
      await navigate(`/leads/${id}/converted`);
    } catch (error) {
      toast("Lead conversion failed", error.message, "error");
    } finally { submit.disabled = false; }
  });
}
function leadConversionSuccess() {
  const result = state.conversionResult;
  if (!result) return `<section class="card" style="padding:28px"><h2>Conversion details unavailable</h2><button class="button button-primary" data-conversion-go="/leads">Go to Leads</button></section>`;
  const links = [
    ["Contact",result.contact,"contacts",result.contact?.full_name || [result.contact?.first_name,result.contact?.last_name].filter(Boolean).join(" ")],
    ["Deal",result.deal,"deals",result.deal?.name],
    ["Account",result.account,"accounts",result.account?.name]
  ].filter(item=>item[1]);
  return `<section class="card" style="padding:30px;min-height:55vh">
    <h2>Lead converted successfully</h2><p>Conversion Details</p>
    <div style="max-width:760px">${links.map(([label,item,resource,name])=>`<div style="display:grid;grid-template-columns:160px 1fr;padding:14px 0;border-bottom:1px solid #dde3ed"><span>${label}</span><a href="/${resource}/${item.id}" data-conversion-go="/${resource}/${item.id}">${esc(name||label)}</a></div>`).join("")}</div>
    <button class="button button-primary" style="margin-top:26px" data-conversion-go="/leads">Go to Leads</button>
  </section>`;
}
let blueprintFeature;
async function init() {
  blueprintFeature = createBlueprintFeature({api,esc,toast,renderRoute});
  aiFeature = createAiFeature({ state, MODULES, $, $$, esc, titleCase, initials, formatDate, formatDateTime, formatMoney, slug, pathFor, badge, lookupName, api, toast, pageHeader, loading, emptyState, navigate, openRecordModal, openPlatformModal, closeModal, confirmAction, fieldHtml, platformDisplay, platformTable, platformPanel, ensureLookups, ensurePlatformLookup, invalidateLookups, refreshMeta, performanceTable, renderRoute });
  setupFeature = createSetupFeature({ markFormSaved: form => usability.markSaved(form), state, PLATFORM_MODULE_ROUTES, MODULES, $, $$, esc, titleCase, initials, formatDate, formatDateTime, formatMoney, slug, pathFor, badge, lookupName, api, toast, setBreadcrumb, activeNav, enhanceNavigation, pricingView, bindPricing, pageHeader, loading, emptyState, ensureLookups, ensurePlatformLookup, invalidateLookups, refreshMeta, ensurePlatformCatalog, ensureCustomModules, enhanceCustomModuleNavigation, greeting, applyProfile, refreshNavCount, navigate, renderRoute, teamspacesView, bindTeamspaces, dashboardView, reportEngineView, dashboardBuilderView, bindReportDashboard, performanceTable, attentionQueue, activityItem, bindDashboard, moduleView, activityTypeView, platformState, platformTable, platformDisplay, platformPanel, platformModuleView, tableView, kanbanView, gridView, splitView, chartView, timelineModuleView, pagination, dataIds, bulkArchiveLeads, bindModule, detailView, detailFields, relatedNavigation, relatedPlainRow, relatedPlainSection, relatedContent, dealProgress, bindDetail, fieldHtml, openRecordModal, openPlatformModal, settingsResourceConfig, readForm, submitRecord, submitPlatformRecord, submitConvert, closeModal, closeConfirm, confirmAction, deleteRecord, deletePlatformRecord, bindPlatform, bindGlobal, settingsView, myProfileView, profileUsersView, approvalSettingsView, blueprintSettingsView });
  bindGlobal();
  try { await ensurePlatformCatalog(); } catch (error) { toast("Module catalog unavailable", error.message, "error"); }
  await ensureCustomModules();
  enhanceNavigation();
  enhanceCustomModuleNavigation();
  try { state.profile = await api("/api/settings/profile"); applyProfile(); } catch (_) { /* normal initialization retries below */ }
  if (!blockedPlanRoute("/teamspaces", state.profile?.subscription)) await bindTeamspaces();
  try { state.meta = await api("/api/meta"); } catch (error) { toast("Workspace data unavailable", error.message, "error"); }
  try { state.settingsCache = await api("/api/settings/general"); } catch (error) { /* use defaults until settings load */ }
  try { state.profile = await api("/api/settings/profile"); applyProfile(); } catch (error) { /* keep the shell usable */ }
  try { await ensureLookups(); } catch (error) { /* lookups retry when a related form opens */ }
  await renderRoute();
  // Only announce an approved request once per browser, including after a later login.
  const checkPlanApproval = async () => {
    try {
      state.profile = await api("/api/settings/profile");
      applyProfile();
      const result = await api("/api/subscription/approval-status");
      if (result.status !== "Approved" || !result.request_id) return;
      const key = "convosis-plan-approval-notified-" + result.request_id;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      toast("Plan upgraded successfully", "Your " + result.plan_name + " plan is now active.");
      state.profile = await api("/api/settings/profile");
      applyProfile();
      if (location.pathname === "/subscriptions") await renderRoute();
    } catch (_) { /* polling must never block CRM navigation */ }
  };
  checkPlanApproval();
  setInterval(checkPlanApproval, 30000);
}
const { layoutEditorPage, bindLayoutEditor, bindPlatform, bindModule, bindSettings } = createAppInteractions({ openDealForAccount, api, toast, emptyState, refreshMeta, applyProfile, navigate, renderRoute, platformState, bindCustomModuleAdmin, flatSplitPreview, dataIds, openCreateRecord, fetchStandardLayout, orderedFormFields, openRecordModal, openPlatformModal, readForm, deleteRecord, deletePlatformRecord, state, $, $$, esc, titleCase, pathFor, badge, bindModuleFilters, bindContextCreationActions, standardLayouts, bindBlueprintFeature: () => blueprintFeature?.bind() });

const { reportEngineView, dashboardBuilderView, bindReportDashboard } = createReportBuilder({ api, $, $$, esc, titleCase, formatMoney, MODULES, badge, emptyState, pageHeader, toast, renderRoute, navigate });

init();
// One-time removal of legacy offline caches and service-worker registrations.
// Keep localStorage/sessionStorage intact: they hold user preferences and drafts.
if ("serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.filter((registration) =>
      registration.scope === new URL("/", location.origin).href
    ).map((registration) => registration.unregister())))
    .catch(() => {});
}
if ("caches" in window) {
  caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
}





