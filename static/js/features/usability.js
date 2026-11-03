import { confirmDialog } from "../core/dialogs.js?v=20261027-centered-popups-v1";
// Shared form recovery, named record lookups and accessible control presentation.
export function activityDefaults(route, preset = {}, ownerId = null) {
  const type = {tasks: 'Task', meetings: 'Meeting', calls: 'Call'}[route.split('/')[2]];
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16);
  return {start_at: local, due_at: local, status: 'Open', priority: 'Normal', owner_id: ownerId, ...(type ? {activity_type: type} : {}), ...preset};
}

export function viewError(error) {
  const message = String(error.message || 'Please try again.');
  if (/plan does not include|upgrade.*plan/i.test(message)) return {title: 'Upgrade required', message, action: 'Compare plans', path: '/subscriptions'};
  if (/access is required|not authorized|permission|access denied/i.test(message) && error.status === 403) return {title: 'Access restricted', message: message + ' Ask your organization administrator for access.', action: 'Back to dashboard', path: '/dashboard'};
  if (/record not found|lead not found/i.test(message)) return {title: 'Record unavailable', message: 'This record is missing, archived, or unavailable to your account.'};
  return {title: 'Could not load this view', message, retry: true};
}

export function createUsability({state, esc, titleCase}) {
  let tracked = new Map();
  // Empty file controls get a new lastModified timestamp on each FormData read.
  // Normalize that browser-generated placeholder so untouched upload forms stay clean.
  const values = form => JSON.stringify([...new FormData(form)].map(([key,value]) => [key, typeof value === 'string' ? value : (value.name ? [value.name,value.size,value.lastModified] : null)]));
  function dirty() { return [...tracked].some(([form, baseline]) => form.isConnected && !form.closest('[hidden]') && values(form) !== baseline); }
  function clear() { tracked.clear(); }
  function markSaved(form) { if (tracked.has(form)) tracked.set(form, values(form)); }
  let pendingNavigation = null;
  function canLeave() {
    if (!dirty()) return Promise.resolve(true);
    if (pendingNavigation) return pendingNavigation;
    pendingNavigation = confirmDialog('You have unsaved changes on this page. Leaving now will discard them.', {
      title:'Unsaved changes', confirmLabel:'Leave anyway', cancelLabel:'Stay here', danger:true
    }).then(answer => { if (answer) clear(); return answer; }).finally(() => { pendingNavigation = null; });
    return pendingNavigation;
  }
  window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });

  function campaignValidation(root) {
    const budget = root.querySelector('[name="budget"]');
    if (budget) budget.min = "0";
    const start = root.querySelector('[name="start_date"]');
    const end = root.querySelector('[name="end_date"]');
    const validateDates = () => { if (end) { end.min = start?.value || ""; end.setCustomValidity(start?.value && end.value && end.value < start.value ? "End date must be on or after start date" : ""); } };
    start?.addEventListener("input", validateDates);
    end?.addEventListener("input", validateDates);
    validateDates();
  }
  function relatedLookup(root) {
    const module = root.querySelector('[name="related_type"]');
    let record = root.querySelector('[name="related_id"]');
    if (!module || !record) return;
    const selected = record.value;
    const select = document.createElement('select');
    select.className = 'field-select'; select.name = record.name; select.id = record.id;
    select.dataset.numeric = 'true'; select.setAttribute('aria-label', 'Related record');
    select.required = record.required;
    record.replaceWith(select); record = select;
    const search = document.createElement('input');
    search.type = 'search'; search.className = 'field-input related-record-search';
    search.placeholder = 'Search related records'; search.setAttribute('aria-label', 'Search related records');
    record.before(search);
    function populate(value = '') {
      const list = state.lookups?.[module.value] || state.platformLookups?.[module.value] || [];
      const term = search.value.trim().toLowerCase();
      const label = item => item.full_name || item.name || item.subject || [item.first_name,item.last_name].filter(Boolean).join(' ') || 'Record #' + item.id;
      record.innerHTML = '<option value="">' + (module.value ? 'Select a record' : 'Select a related module first') + '</option>' + list.filter(item => !term || label(item).toLowerCase().includes(term) || String(item.id) === String(value)).map(item => '<option value="'+esc(item.id)+'">'+esc(label(item))+'</option>').join('');
      record.value = value; record.disabled = !module.value;
    }
    populate(selected);
    module.addEventListener('change', () => { search.value = ''; populate(); });
    search.addEventListener('input', () => populate(record.value));
  }
  function enhance(root = document.querySelector('#app-content')) {
    if (!root) return;
    root.querySelectorAll('input,select,textarea').forEach(input => {
      if (input.type === 'hidden' || input.getAttribute('aria-label') || input.labels?.length) return;
      const field = input.closest('.field');
      const name = field?.querySelector('label')?.textContent?.trim() || input.title || input.placeholder || titleCase(input.name || '');
      if(name) input.setAttribute('aria-label',name);
    });
    root.querySelectorAll('.toolbar-search').forEach(wrap => {
      const icon = wrap.querySelector('span');
      if (icon) { icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="2"/></svg>'; icon.setAttribute('aria-hidden','true'); }
      const input = wrap.querySelector('input');
      if (input) input.setAttribute('aria-label',input.placeholder || 'Search records');
    });
    const controls = {'data-module-status':'Filter by status','data-module-owner':'Filter by owner','data-module-sort':'Sort records','data-platform-owner':'Filter by owner','data-platform-sort':'Sort records','data-deal-min-amount':'Minimum deal amount','data-deal-max-amount':'Maximum deal amount','data-deal-close-from':'Closing date from','data-deal-close-to':'Closing date to'};
    for(const [attribute,label] of Object.entries(controls)) root.querySelectorAll('['+attribute+']').forEach(el=>el.setAttribute('aria-label',label));
    root.querySelectorAll('[data-deal-filter]').forEach(el => el.setAttribute('aria-label', ({min_amount:'Minimum deal amount',max_amount:'Maximum deal amount',close_from:'Closing date from',close_to:'Closing date to'})[el.dataset.dealFilter] || 'Deal filter'));
    root.querySelectorAll('button.table-action,button[data-page]').forEach(button => {
      const name = button.title || ({'✎':'Edit record','⌫':'Delete record','←':'Previous page','→':'Next page'})[button.textContent.trim()];
      if(name) button.setAttribute('aria-label',name);
    });
    // Searches and navigation selectors do not save records. Keep draft
    // protection on editing forms, including inline quote/settings forms.
    root.querySelectorAll('form').forEach(form => {
      if (form.matches('[data-setup-import-selector],[data-apex-assistant-form],[role="search"],[data-unsaved-ignore]')) return;
      if (!form.closest('[hidden]') && !tracked.has(form)) tracked.set(form,values(form));
    });
  }
  return {canLeave,clear,markSaved,dirty,enhance,relatedLookup,campaignValidation};
}



