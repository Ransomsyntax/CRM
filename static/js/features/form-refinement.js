import { enhanceCrmValidation } from './crm-validation.js?v=20261029-qa-retest-v2';
/* Shared form semantics; never guesses or reserves server-generated numbers. */
const numberKeys = new Set(['record_number','quote_number','order_number','po_number','invoice_number']);
export function fieldSize(control) {
  const key = control.name || control.dataset.fieldKey || '';
  if (control.matches('textarea') || /address|description|notes|terms|body|content|line_items/.test(key)) return 'wide';
  if (/name|subject|title/.test(key) && !/_id$/.test(key)) return 'long';
  if (control.type === 'number' || /currency|percent|quantity|postal|zip|code|sku|score/.test(key)) return 'short';
  if (['date','datetime-local','time','tel'].includes(control.type) || /phone|status|stage/.test(key)) return 'medium';
  return 'normal';
}
export function installFormRefinement({api,state}) {
  let pending = false;
  function enhance() {
    pending = false;
    const resource = state.modal?.resource || window.location.pathname.split('/')[1];
    document.querySelectorAll('#record-form, #lead-page-form').forEach(form => enhanceCrmValidation(form, form.id === 'lead-page-form' ? 'leads' : resource));
    document.querySelectorAll('form .field').forEach(field => {
      const control = field.querySelector('input,select,textarea');
      if (control) field.dataset.fieldSize = fieldSize(control);
    });
    const root = document.querySelector('#modal-body');
    if (!root) return;
    root.querySelectorAll('.field input[name]').forEach(input => {
      if (!numberKeys.has(input.name)) return;
      input.readOnly = true;
      input.setAttribute('aria-readonly','true');
      const documentResource = ['quotes','invoices','sales_orders','purchase_orders'].includes(document.querySelector('#modal')?.dataset?.resource || window.location.pathname.split('/')[1]);
      if (documentResource) {
        const owner = root.querySelector('[name="owner_id"]')?.closest('.field');
        const field = input.closest('.field');
        const grid = owner?.closest('.qform-grid, .form-grid');
        // Keep the same first row in every commercial form: Owner, automatic number.
        if (grid && grid.firstElementChild !== owner) grid.prepend(owner);
        if (owner && field && owner !== field && owner.nextElementSibling !== field) owner.after(field);
        field?.classList.add('crm-inline-document-number');
        return;
      }
      let header = root.querySelector(':scope > .crm-number-row');
      if (!header) { header = document.createElement('div'); header.className = 'crm-number-row'; root.prepend(header); }
      const field = input.closest('.field');
      if (field && field.parentElement !== header) {
        // Layout changes can recreate the same field: retain the real saved number.
        const previous = [...header.querySelectorAll('input')].find(item => item.name === input.name);
        if (previous && previous.value !== 'Assigned on save') input.value = previous.value;
        previous?.closest('.field')?.remove();
        header.append(field);
      }
    });
    document.querySelectorAll('select[name="product_id"],select[data-qfield="product_id"],select[data-product-key="product_id"],select[data-product-selector]').forEach(select => {
      if (select.dataset.productEnhanced) return;
      select.dataset.productEnhanced = '1';
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'button button-ghost crm-add-product';
      button.dataset.createProduct = ''; button.textContent = '+ Add product';
      button.addEventListener('click', () => openProduct(select));
      const container = document.createElement('div'); container.className = 'crm-product-picker';
      const menu = document.createElement('div'); menu.className = 'crm-product-dropdown'; menu.hidden = true;
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'field-select crm-product-toggle';
      toggle.textContent = select.selectedOptions[0]?.textContent || 'Select product';
      const refresh = () => {menu.replaceChildren(); [...select.options].forEach(option => {const pick=document.createElement('button');pick.type='button';pick.textContent=option.textContent;pick.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));menu.hidden=true;});menu.append(pick);});menu.append(button);};
      button.className='crm-product-choice crm-add-product';
      toggle.addEventListener('click',()=>{refresh();menu.hidden=!menu.hidden;});
      select.addEventListener('change',()=>{toggle.textContent=select.selectedOptions[0]?.textContent||'Select product';menu.hidden=true;});
      select.after(container);container.append(select,toggle,menu);select.classList.add('crm-product-native');
      document.addEventListener('click',event=>{if(!container.contains(event.target))menu.hidden=true;});
    });
  }
  function openProduct(select) {
    document.querySelector('.crm-inline-product')?.remove();
    const panel = document.createElement('section');
    panel.className = 'crm-inline-product'; panel.setAttribute('aria-label','Add product');
    // Inputs intentionally have no names: the parent record serializer must ignore them.
    panel.innerHTML = '<h3>Add product</h3><label>Product name<input class="field-input" data-new-name maxlength="255"></label><label>SKU<input class="field-input" data-new-sku maxlength="100"></label><label>Rate<input class="field-input" data-new-rate type="number" min="0" step="0.01" value="0"></label><label>Category<input class="field-input" data-new-category></label><label>Stock quantity<input class="field-input" data-new-stock type="number" min="0" step="1" value="0"></label><label>Status<select class="field-select" data-new-status><option>Active</option><option>Inactive</option></select></label><label>Description<textarea class="field-input" data-new-description></textarea></label><p role="status"></p><div><button type="button" class="button button-primary" data-save-product>Create product</button><button type="button" class="button button-ghost" data-cancel-product>Cancel</button></div>';
    panel.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.matches('input')) { event.preventDefault(); event.stopPropagation(); panel.querySelector('[data-save-product]').click(); }
    });
    const overlay=document.createElement('div');overlay.className='crm-product-modal-backdrop';document.body.append(overlay);overlay.append(panel);
    const dismiss=()=>{overlay.remove();};
    overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss();});
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape')dismiss();});
    panel.querySelector('[data-cancel-product]').onclick = () => { dismiss(); select.closest('.crm-product-picker')?.querySelector('.crm-product-toggle')?.focus(); };
    panel.querySelector('[data-save-product]').onclick = async event => {
      const name = panel.querySelector('[data-new-name]');
      const rate = panel.querySelector('[data-new-rate]');
      const status = panel.querySelector('[role=status]');
      if (!name.value.trim()) { status.textContent = 'Enter a product name.'; name.focus(); return; }
      if (!rate.value || !rate.checkValidity() || !Number.isFinite(Number(rate.value))) { status.textContent = 'Enter a valid non-negative rate.'; rate.focus(); return; }
      const save = event.currentTarget; save.disabled = true; status.textContent = 'Creating product…';
      try {
        const product = await api('/api/products', {method:'POST',body:JSON.stringify({name:name.value.trim(),sku:panel.querySelector('[data-new-sku]').value.trim(),unit_price:Number(rate.value),category:panel.querySelector('[data-new-category]').value.trim(),stock_quantity:Number(panel.querySelector('[data-new-stock]').value||0),status:panel.querySelector('[data-new-status]').value,description:panel.querySelector('[data-new-description]').value.trim()})});
        const products = state.platformLookups.products ||= [];
        if (!products.some(item => item.id === product.id)) products.push(product);
        document.querySelectorAll('select[name="product_id"],select[data-qfield="product_id"],select[data-product-key="product_id"],select[data-product-selector]').forEach(input => {
          if (![...input.options].some(option => option.value === String(product.id))) input.add(new Option(product.name, String(product.id)));
        });
        select.value = String(product.id);
        select.dispatchEvent(new Event('input',{bubbles:true}));
        select.dispatchEvent(new Event('change',{bubbles:true}));
        dismiss(); if(select.isConnected)select.closest('.crm-product-picker')?.querySelector('.crm-product-toggle')?.focus();
      } catch(error) { status.textContent = error.message || 'Could not create product.'; }
      finally { save.disabled = false; }
    };
    panel.querySelector('[data-new-name]').focus();
  }
  const observer = new MutationObserver(() => {
    if (!pending) { pending = true; queueMicrotask(enhance); }
  });
  observer.observe(document.body,{childList:true,subtree:true});
  enhance();
  return {enhance,disconnect:()=>observer.disconnect()};
}

