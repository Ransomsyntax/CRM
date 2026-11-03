// Related record UI rendering. Dependencies are injected by the app entrypoint.
export function createRelatedViews({ MODULES, esc, formatMoney, formatDateTime, titleCase }) {
function relatedNavigation(resource, related, timeline = null) {
const openActivities = (related.activities || []).filter((item) => item.status !== 'Completed').length;
const closedActivities = (related.activities || []).filter((item) => item.status === 'Completed').length;
const connectedCount = (related.accounts || []).length + (related.contacts || []).length + (related.deals || []).length;
const items = [
  ['current_stage', 'Current stage & transitions', resource === 'leads'],
  ['stage_progress', 'Stage progress', resource === 'deals'],
  ['notes', 'Notes', true, (related.notes || []).length],
  ['connected_records', 'Connected records', ['accounts', 'contacts', 'deals'].includes(resource) || connectedCount > 0, connectedCount],
  ['deals', 'Deals', ['contacts', 'accounts'].includes(resource), (related.deals || []).length],
  ['contacts', 'Contacts', resource === 'accounts', (related.contacts || []).length],
  ['quotes', 'Quotes', resource === 'deals', (related.quotes || []).length],
  ['invoices', 'Invoices', resource === 'deals', (related.invoices || []).length],
  ['attachments', 'Attachments', true, (related.attachments || []).length],
  ['products', 'Products', true, (related.products || []).length],
  ['open_activities', 'Open activities', true, openActivities],
  ['closed_activities', 'Closed activities', true, closedActivities],
  ['emails', 'Emails', true, (related.emails || []).length],
  ['timeline', 'Timeline', true, timeline ? (timeline.items || []).length : (related.activities || []).length],
].filter(([, , visible]) => visible);
const quickAdd = new Set(['notes', 'connected_records', 'deals', 'contacts', 'attachments', 'products', 'open_activities', 'closed_activities', 'emails', 'quotes', 'invoices']);
return `<nav class="detail-related-links">${items.map(([key, label, , count]) => `<div class="detail-related-link-row"><button class="detail-related-link" type="button" data-detail-nav="${key}" data-detail-target="detail-section-${key}"><span>${esc(label)}</span>${count > 0 ? `<small>${count}</small>` : ''}</button>${quickAdd.has(key) ? `<button class="detail-related-quick-add" type="button" data-related-quick-add="${key}" title="Add ${esc(label)}" aria-label="Add ${esc(label)}">+</button>` : ''}</div>`).join('')}</nav>`;
}
function relatedPlainRow(title, meta, resource, id, navigable = true) {
const action = navigable && MODULES[resource] ? `data-open-record="${resource}"` : `data-edit-record="${resource}"`;
return `<button class="detail-related-row" ${action} data-id="${id}"><span class="detail-related-row-copy"><strong>${esc(title)}</strong><small>${esc(meta || '')}</small></span><span class="detail-related-row-action">${navigable && MODULES[resource] ? '›' : '✎'}</span></button>`;
}
function relatedPlainSection(id, label, rows, createResource, emptyMessage) {
return `<section class="detail-plain-section" id="detail-section-${id}"><div class="detail-plain-head"><h3>${esc(label)}</h3>${createResource ? createResource.startsWith("platform:") ? `<button class="card-head-link" type="button" data-platform-related-create="${createResource.slice(9)}">Add</button>` : `<button class="card-head-link" data-create="${createResource}">Add</button>` : ''}</div><div class="detail-plain-body">${rows.length ? rows.join('') : `<p class="related-empty">${esc(emptyMessage)}</p>`}</div></section>`;
}
function relatedContent(resource, related, recordId = null) {
const sections = [];
const noteRows = (related.notes || []).map(item => `<div class="crm-inline-note" data-note-id="${Number(item.id)}"><div class="crm-inline-note-display"><button type="button" class="detail-related-row" data-inline-note-edit="${Number(item.id)}"><span class="detail-related-row-copy"><strong>${esc(item.title || "Untitled note")}</strong><small>${esc(item.content || "Click to edit")}</small></span><span class="detail-related-row-action">✎</span></button></div><div class="crm-inline-note-editor" hidden><textarea class="field-input" data-note-content rows="5" aria-label="Note content">${esc(item.content || "")}</textarea><div class="form-actions"><button type="button" class="button button-primary" data-inline-note-save="${Number(item.id)}">Save</button><button type="button" class="button button-ghost" data-inline-note-cancel>Cancel</button></div></div></div>`);
sections.push(`<section class="detail-plain-section" id="detail-section-notes"><div class="detail-plain-head"><h3>Notes</h3></div><div class="detail-plain-body"><form class="crm-inline-note-compose" data-inline-note-create><textarea class="field-input" name="content" rows="4" placeholder="Add a note…" aria-label="Note content"></textarea><div class="form-actions"><button class="button button-primary" type="submit">Save note</button></div></form>${noteRows.join("")}</div></section>`);
const connectedRows = [];
if (related.accounts?.length) connectedRows.push(...related.accounts.map((item) => relatedPlainRow(item.name, item.industry || item.type || 'Account', 'accounts', item.id)));
if (related.contacts?.length) connectedRows.push(...related.contacts.map((item) => relatedPlainRow(item.full_name || `${item.first_name} ${item.last_name}`, item.job_title || item.email || 'Contact', 'contacts', item.id)));
if (related.deals?.length) connectedRows.push(...related.deals.map((item) => relatedPlainRow(item.name, `${formatMoney(item.amount)} · ${item.stage}`, 'deals', item.id)));
sections.push(relatedPlainSection('connected_records', 'Connected records', connectedRows, null, 'No connected records.'));
if (resource === 'accounts') {
  const contactRows = (related.contacts || []).map((item) => relatedPlainRow(item.full_name || [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Contact', item.job_title || item.email || 'Contact', 'contacts', item.id));
  sections.push(relatedPlainSection('contacts', 'Contacts', contactRows, null, 'No contacts linked to this account yet.').replace('</h3>', '</h3><button class="card-head-link" type="button" data-create-account-contact="' + Number(recordId) + '">Add</button>'));
}
if (['contacts', 'accounts'].includes(resource)) {
  const dealRows = (related.deals || []).map((item) => relatedPlainRow(item.name, `${formatMoney(item.amount)} · ${item.stage || 'No stage'}`, 'deals', item.id));
  sections.push(relatedPlainSection('deals', 'Deals', dealRows, null, 'No related deals yet.').replace('</h3>', `</h3><button class="card-head-link" type="button" data-create-related-deal="${Number(recordId)}" data-related-source="${resource}">Add</button>`));
}
if (resource === 'deals') {
  const rows = (related.quotes || []).map(q => `<button class="detail-related-row" data-related-platform="quotes" data-id="${Number(q.id)}"><strong>${esc(q.quote_number || q.name || q.title || 'Quote')}</strong> · ${esc(q.status || 'Draft')} · ${formatMoney(q.amount)} ›</button>`);
  sections.push(relatedPlainSection('quotes', 'Quotes', rows, 'platform:quotes', 'No quotes yet.'));
}
if (resource === 'deals') {
  const rows = (related.invoices || []).map(invoice => `<button class="detail-related-row" type="button" data-related-platform="invoices" data-id="${Number(invoice.id)}"><strong>${esc(invoice.invoice_number || invoice.record_number || invoice.name || 'Invoice')}</strong> · ${esc(invoice.status || 'Draft')} · ${formatMoney(invoice.amount)} ›</button>`);
  sections.push(relatedPlainSection('invoices', 'Invoices', rows, 'platform:invoices', 'No related invoices yet.'));
}
sections.push(relatedPlainSection('attachments', 'Attachments', (related.attachments || []).map((item) => item.url && /^\/api\/documents\/\d+\/download$/.test(item.url) ? `<a class="detail-related-row" href="${esc(item.url)}"><span class="detail-related-row-copy"><strong>${esc(item.name)}</strong><small>${esc(item.file_type || 'File')} · ${esc(item.file_size || 'Size not set')}</small></span><span class="detail-related-row-action">Download ↓</span></a>` : relatedPlainRow(item.name, `${item.file_type || 'File'} · ${item.file_size || 'Size not set'}`, 'attachments', item.id, false)), 'attachments', 'No attachments yet.'));
sections.push(relatedPlainSection('products', 'Products', (related.products || []).map((item) => relatedPlainRow(item.name, `${formatMoney(item.unit_price)} · ${item.sku || 'No SKU'}`, 'products', item.id)), 'products', 'No products yet.'));
sections.push(relatedPlainSection('open_activities', 'Open activities', (related.activities || []).filter((item) => item.status !== 'Completed').map((item) => `<div class="detail-related-activity-row">${relatedPlainRow(item.subject, `${titleCase(item.activity_type)} · ${formatDateTime(item.due_at)}`, 'activities', item.id)}<button class="button button-ghost button-small" type="button" data-related-complete-activity="${Number(item.id)}" aria-label="Mark ${esc(item.subject || 'activity')} as completed">Mark as completed</button></div>`), 'activities', 'No open activities yet.'));
const closedActivities = (related.activities || []).filter((item) => item.status === 'Completed').map((item) => relatedPlainRow(item.subject, `${titleCase(item.activity_type)} · completed ${formatDateTime(item.updated_at || item.due_at)}`, 'activities', item.id));
sections.push(relatedPlainSection('closed_activities', 'Closed activities', closedActivities, 'activities', 'No closed activities yet.'));
sections.push(relatedPlainSection('emails', 'Emails', (related.emails || []).map((item) => relatedPlainRow(item.subject, `${item.status} · ${item.to_email || 'No recipient'}`, 'emails', item.id, false)), 'emails', 'No email yet.'));
return sections.join('');
}
function leadStagePanel(record,timeline) {
  const current = timeline?.current_stage || record.status || "New";
  const custom = !!timeline?.blueprint_enabled;
  const defaultStages = ["New", "Contacted", "Qualified", "Unqualified", "Converted"];
  const nextStages = current === "New" ? ["Contacted"] : current === "Contacted" ? ["Qualified", "Unqualified"] : ["Qualified", "Unqualified"].includes(current) ? ["Converted"] : [];
  const choices = (custom ? (timeline.transition_details || []) : nextStages.map(s => ({label:s,to:s})))
    .filter(choice => choice.to && choice.to !== current)
    .filter((choice, index, all) => all.findIndex(candidate => candidate.to === choice.to) === index);
  const converted = current === "Converted" && record.status === "Converted" && Boolean(record.converted_deal_id);
  return `<section class="detail-plain-section crm-lead-state" id="detail-section-current_stage"><div class="detail-plain-head"><h3>Current stage &amp; transitions</h3><span class="crm-stage-label">${custom ? esc(timeline.blueprint_name || "Custom Blueprint") : "Lead process"}</span></div>
    <div class="crm-state-body"><div class="crm-state-current"><span>Current stage</span><strong>${esc(current)}</strong></div>
    <div class="crm-state-actions"><span>Available transitions</span><div class="crm-transition-options">${converted ? `<div class="crm-conversion-confirmation"><p class="related-empty">This lead has been converted.</p><button class="crm-transition-action" type="button" data-go="/deals/${Number(record.converted_deal_id)}">View created Deal →</button></div>` : choices.length ? choices.map(choice =>
      custom ? `<button type="button" class="crm-transition-action" data-blueprint-move="${esc(choice.id)}" data-blueprint-resource="leads" data-blueprint-to="${esc(choice.to)}" data-blueprint-record="${record.id}" data-blueprint-required="${esc(JSON.stringify(choice.required || []))}" title="${esc(choice.message || choice.to)}">${esc(choice.label || choice.to)} <span aria-hidden="true">→</span></button>` :
      `<button type="button" class="crm-transition-action" data-lead-transition="${record.id}" data-status="${esc(choice.to)}">${esc(choice.label)} <span aria-hidden="true">→</span></button>`).join("") : `<p class="related-empty">${custom ? "No outgoing transitions from this stage in the published Blueprint." : "No transitions are available from this stage."}</p>`}
    </div><small>${custom ? "Transitions and rules are supplied by the published Blueprint." : "Account, Contact and optional Deal records are created when you convert the lead."}</small></div></div></section>`;
}

return { relatedNavigation, relatedPlainRow, relatedPlainSection, relatedContent, leadStagePanel };
}

// Core record detail rendering shares the related-list feature boundary.
export function createCoreDetailViews({ $$, api, MODULES, esc, formatMoney, formatDateTime, titleCase, pageHeader, blueprintDealProgress, initials, relatedNavigation, relatedContent, leadStagePanel, timelineHtml, activityItem, badge, formatDate, lookupName }) {
async function detailView(resource, id) {
  const [record, related, timeline] = await Promise.all([api(`/api/${resource}/${id}`), api(`/api/${resource}/${id}/related`), ["leads", "deals"].includes(resource) ? api(`/api/${resource}/${id}/timeline`) : Promise.resolve(null)]);
  const config = MODULES[resource];
  const title = resource === "contacts" ? record.full_name : record.name || record.subject;
  const secondary = resource === "leads" ? record.company || record.email : resource === "contacts" ? record.email || record.job_title : resource === "accounts" ? record.website || record.industry : resource === "deals" ? `${record.stage} · ${formatMoney(record.amount)}` : resource === "products" ? `${record.category || "Product"} · ${formatMoney(record.unit_price)}` : `${titleCase(record.activity_type)} · ${formatDateTime(record.due_at)}`;
  const details = detailFields(resource, record);
  const contextualActions = "";
  return `<div class="detail-page-shell"><aside class="detail-related-nav" aria-label="Related list"><div class="detail-related-nav-head"><h3>Related List</h3></div>${relatedNavigation(resource, related, timeline)}</aside>${pageHeader(config.label, title, secondary || "Record detail", `${resource === "leads" ? `<button class="button button-ghost" data-go="/ai?lead=${id}">✦ Analyze with AI</button>` : ""}${contextualActions}<button class="button button-ghost" data-go="/${resource}">← Back to ${config.label.toLowerCase()}</button><button class="button button-primary" data-edit-record="${resource}" data-id="${id}">Edit ${config.singular.toLowerCase()}</button>`)}
    <div class="detail-body-scroll" tabindex="0" aria-label="Record details">${resource === "deals" ? `<section class="card crm-deal-top-stage" id="detail-section-stage_progress" aria-label="Deal stage progress">${blueprintDealProgress(record,timeline)}</section>` : ""}
    <section class="card detail-summary"><div class="detail-title-row"><span class="detail-avatar">${initials(title)}</span><div class="detail-title-copy"><span class="eyebrow">${esc(config.singular)}</span><h2>${esc(title)}</h2><p>${esc(secondary || "No summary available")}</p></div><div class="detail-actions">${resource === "leads" && record.status !== "Converted" && !timeline?.blueprint_enabled ? `<button class="button button-small button-ghost" data-convert-lead="${id}">Convert</button>` : ""}<button class="button button-small button-ghost" data-delete-record="${resource}" data-id="${id}">Archive</button></div></div><div class="detail-meta-grid">${details.map((item) => `<div><span class="meta-label">${esc(item.label)}</span><span class="meta-value">${item.html || esc(item.value || "—")}</span></div>`).join("")}</div>${record.notes ? `<div class="notes-box"><h3>Notes</h3><p>${esc(record.notes)}</p></div>` : ""}</section>
    <div class="detail-record-layout"><section class="detail-record-main"><div class="detail-tab-strip"><button class="detail-tab active" type="button" data-detail-tab="overview">Overview</button><button class="detail-tab" type="button" data-detail-tab="timeline">Timeline</button></div><div class="detail-tab-panel" data-detail-panel="overview">${resource === "leads" ? leadStagePanel(record, timeline) : ""}${relatedContent(resource, related, record.id)}</div><div class="detail-tab-panel" data-detail-panel="timeline" hidden><section class="detail-plain-section" id="detail-section-timeline"><div class="detail-plain-head"><h3>Timeline</h3></div><div class="detail-plain-body">${(resource === "leads" || resource === "deals") ? timelineHtml(timeline?.items || []) : `<div class="activity-list">${related.activities?.length ? related.activities.map(activityItem).join("") : `<p class="related-empty">No linked activity yet.</p>`}</div>`}</div></section></div></section></div></div></div>`;
}
function detailFields(resource, record) {
  const owner = record.owner_name || "Unassigned";
  if (resource === "leads") return [{ label: "Status", html: badge(record.status) }, { label: "Owner", value: owner }, { label: "Lead score", value: `${record.lead_score || 0}/100` }, { label: "Email", value: record.email }, { label: "Phone", value: record.phone }, { label: "Follow-up", value: formatDate(record.next_follow_up) }];
  if (resource === "contacts") return [{ label: "Email", value: record.email }, { label: "Phone", value: record.phone }, { label: "Job title", value: record.job_title }, { label: "Department", value: record.department }, { label: "Account", value: lookupName("accounts", record.account_id) }, { label: "Owner", value: owner }];
  if (resource === "accounts") return [{ label: "Type", value: record.type }, { label: "Industry", value: record.industry }, { label: "Employees", value: record.employees }, { label: "Website", value: record.website }, { label: "Location", value: [record.billing_city, record.billing_country].filter(Boolean).join(", ") }, { label: "Owner", value: owner }];
  if (resource === "deals") return [{ label: "Current stage", html: badge(record.stage) }, { label: "Amount", value: formatMoney(record.amount) }, { label: "Probability", value: `${record.probability || 0}%` }, { label: "Account", value: lookupName("accounts", record.account_id) }, { label: "Close date", value: formatDate(record.expected_close_date) }, { label: "Owner", value: owner }];
  if (resource === "products") return [{ label: "Product Number", value: record.record_number }, { label: "SKU", value: record.sku }, { label: "Category", value: record.category }, { label: "Unit price", value: formatMoney(record.unit_price) }, { label: "Stock", value: record.stock_quantity }, { label: "Status", html: badge(record.status) }, { label: "Owner", value: owner }];
  return [{ label: "Type", value: titleCase(record.activity_type) }, { label: "Status", html: badge(record.status) }, { label: "Priority", html: badge(record.priority) }, { label: "Starts", value: formatDateTime(record.start_at) }, { label: "Due", value: formatDateTime(record.due_at) }, { label: "Owner", value: owner }, { label: "Related to", value: record.related_label }];
}
function scrollDetailSection(button) {
      const target = document.getElementById(button.dataset.detailTarget);
      const scroller = target?.closest('.detail-body-scroll');
      if (target && scroller) {
        scroller.scrollTo({top: scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16, behavior: 'smooth'});
      } else target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $$('[data-detail-nav]').forEach((entry) => entry.classList.toggle('active', entry === button));
}
return { detailView, detailFields, scrollDetailSection };
}
