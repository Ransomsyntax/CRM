// Shared asynchronous, theme-aware dialogs. Callers must await a decision
// before changing records. Native browser dialog functions are never patched.
let queue = Promise.resolve();
let dismissNotice = null;
let sequence = 0;

function installStyles() {
  if (document.getElementById('crm-dialog-styles')) return;
  const style = document.createElement('style');
  style.id = 'crm-dialog-styles';
  style.textContent = `
.crm-dialog-overlay{--dialog-bg:#fff;--dialog-ink:#172944;--dialog-muted:#52617a;--dialog-border:#cad5e5;--dialog-input:#f6f8fc;--dialog-accent:#245de3;--dialog-danger:#b4233c;position:fixed!important;inset:0!important;z-index:2147483000!important;display:grid!important;place-items:center!important;padding:20px;background:rgba(3,13,30,.6);font-family:inherit;box-sizing:border-box}
html[data-crm-theme="dark"] .crm-dialog-overlay{--dialog-bg:#1b2a40;--dialog-ink:#edf4ff;--dialog-muted:#b6c7df;--dialog-border:#49617f;--dialog-input:#111b29;--dialog-accent:#2868d9;--dialog-danger:#ac304b;color-scheme:dark}
@media(prefers-color-scheme:dark){html:not([data-crm-theme]) .crm-dialog-overlay{--dialog-bg:#1b2a40;--dialog-ink:#edf4ff;--dialog-muted:#b6c7df;--dialog-border:#49617f;--dialog-input:#111b29;--dialog-accent:#2868d9;--dialog-danger:#ac304b;color-scheme:dark}}
.crm-dialog-overlay .crm-dialog{box-sizing:border-box;width:min(460px,100%);max-height:calc(100dvh - 40px);overflow:auto;margin:0;padding:28px;border:1px solid var(--dialog-border)!important;border-radius:14px;background:var(--dialog-bg)!important;color:var(--dialog-ink)!important;box-shadow:0 24px 70px #0005;animation:crm-dialog-enter .18s ease-out}
.crm-dialog-overlay .crm-dialog h2{margin:0 0 12px;font-size:21px;line-height:1.35;color:var(--dialog-ink)!important;overflow-wrap:anywhere}
.crm-dialog-overlay .crm-dialog-copy{margin:0 0 18px;font-size:14px;line-height:1.6;color:var(--dialog-muted)!important;white-space:pre-wrap;overflow-wrap:anywhere}
.crm-dialog-overlay .crm-dialog-label{display:block;margin:16px 0 8px;font-size:13px;font-weight:600;color:var(--dialog-ink)!important}
.crm-dialog-overlay .crm-dialog-input{box-sizing:border-box;width:100%;padding:11px 12px;font:inherit;border-radius:8px;border:1px solid var(--dialog-border)!important;background:var(--dialog-input)!important;color:var(--dialog-ink)!important;box-shadow:none!important}
.crm-dialog-overlay .crm-dialog-error{color:var(--dialog-ink)!important;margin:9px 0;font-size:13px}
.crm-dialog-overlay .crm-dialog-error[hidden]{display:none!important}
.crm-dialog-overlay .crm-dialog-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:26px}
.crm-dialog-overlay .crm-dialog-actions button{font:inherit;font-size:14px;font-weight:600;cursor:pointer;border:1px solid var(--dialog-border)!important;border-radius:8px;padding:10px 17px;min-height:42px;background:var(--dialog-input)!important;color:var(--dialog-ink)!important}
.crm-dialog-overlay .crm-dialog-actions .crm-dialog-primary{background:var(--dialog-accent)!important;border-color:var(--dialog-accent)!important;color:#fff!important}
.crm-dialog-overlay .crm-dialog-actions .crm-dialog-danger{background:var(--dialog-danger)!important;border-color:var(--dialog-danger)!important;color:#fff!important}
.crm-dialog-overlay :is(button,input):focus-visible{outline:2px solid var(--dialog-accent)!important;outline-offset:3px}
.crm-dialog-notice{background:transparent;pointer-events:none}
.crm-dialog-notice .crm-dialog{pointer-events:auto}
@keyframes crm-dialog-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){.crm-dialog-overlay .crm-dialog{animation:none}}
@media(max-width:480px){.crm-dialog-overlay{padding:16px}.crm-dialog-overlay .crm-dialog{padding:22px;max-height:calc(100dvh - 32px)}.crm-dialog-actions button{flex:1}}
`;
  document.head.appendChild(style);
}

function show(options) {
  installStyles();
  return new Promise(resolve => {
    const priorFocus = document.activeElement;
    const id = 'crm-dialog-' + (++sequence);
    const notice = options.kind === 'notice';
    const overlay = document.createElement('div');
    overlay.className = 'crm-dialog-overlay' + (notice ? ' crm-dialog-notice' : '');
    const panel = document.createElement('section');
    panel.className = 'crm-dialog';
    panel.tabIndex = -1;
    panel.setAttribute('role', notice ? 'status' : 'alertdialog');
    panel.setAttribute('aria-labelledby', id + '-title');
    if (!notice) panel.setAttribute('aria-modal', 'true');
    const title = document.createElement('h2');
    title.id = id + '-title'; title.textContent = options.title;
    panel.appendChild(title);
    if (options.message) {
      const copy = document.createElement('p'); copy.className = 'crm-dialog-copy';
      copy.id = id + '-message'; copy.textContent = options.message;
      panel.setAttribute('aria-describedby', copy.id); panel.appendChild(copy);
    }
    const form = document.createElement('form');
    let input, error;
    if (options.kind === 'prompt') {
      const label = document.createElement('label');
      label.className = 'crm-dialog-label'; label.htmlFor = id + '-input';
      label.textContent = options.label;
      input = document.createElement('input');
      input.className = 'crm-dialog-input'; input.id = label.htmlFor;
      input.name = 'dialog_value'; input.type = options.inputType || 'text';
      input.value = String(options.initial ?? ''); input.autocomplete = 'off';
      if (options.required) input.required = true;
      if (options.maxLength) input.maxLength = options.maxLength;
      error = document.createElement('p'); error.className = 'crm-dialog-error';
      error.id = id + '-error'; error.setAttribute('role', 'alert'); error.hidden = true;
      input.setAttribute('aria-describedby', error.id);
      input.addEventListener('input', () => { error.hidden = true; input.removeAttribute('aria-invalid'); });
      form.append(label, input, error);
    }
    const actions = document.createElement('div'); actions.className = 'crm-dialog-actions';
    let cancel;
    if (options.kind === 'confirm' || options.kind === 'prompt') {
      cancel = document.createElement('button'); cancel.type = 'button';
      cancel.dataset.crmDialogCancel = ''; cancel.textContent = options.cancelLabel || 'Cancel';
      actions.appendChild(cancel);
    }
    const accept = document.createElement('button'); accept.type = 'submit';
    accept.dataset.crmDialogAccept = '';
    accept.className = 'crm-dialog-primary' + (options.danger ? ' crm-dialog-danger' : '');
    accept.textContent = options.confirmLabel || (options.kind === 'confirm' ? 'Confirm' : options.kind === 'prompt' ? 'Save' : 'Done');
    actions.appendChild(accept); form.appendChild(actions); panel.appendChild(form);
    overlay.appendChild(panel);
    const inertElements = notice ? [] : Array.from(document.body.children).filter(el => !el.hasAttribute('inert'));
    inertElements.forEach(el => el.setAttribute('inert', ''));
    let finished = false, timer;
    const cancelValue = options.kind === 'prompt' ? null : false;
    function done(value) {
      if (finished) return;
      finished = true; clearTimeout(timer);
      document.removeEventListener('keydown', onKey, true);
      overlay.remove(); inertElements.forEach(el => el.removeAttribute('inert'));
      if (notice) dismissNotice = null;
      if (!notice && priorFocus?.isConnected && !priorFocus.closest('[inert]')) priorFocus.focus();
      resolve(value);
    }
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); done(cancelValue); }
      if (event.key === 'Tab') {
        const controls = [input, cancel, accept].filter(Boolean);
        const index = controls.indexOf(document.activeElement);
        if ((event.shiftKey && index <= 0) || (!event.shiftKey && (index < 0 || index === controls.length - 1))) {
          event.preventDefault(); event.stopPropagation();
          controls[event.shiftKey ? controls.length - 1 : 0].focus();
        }
      }
    }
    form.noValidate = true;
    form.addEventListener('submit', event => {
      event.preventDefault(); event.stopPropagation();
      if (input && ((options.required && !input.value.trim()) || !input.checkValidity())) {
        error.textContent = options.validationMessage || 'Enter a valid value to continue.';
        error.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return;
      }
      done(input ? input.value : true);
    });
    cancel?.addEventListener('click', () => done(cancelValue));
    overlay.addEventListener('click', event => { if (!notice && event.target === overlay) done(cancelValue); });
    document.body.appendChild(overlay);
    if (notice) { dismissNotice = () => done(true); timer = setTimeout(() => done(true), options.duration ?? 3600); }
    else {
      document.addEventListener('keydown', onKey, true);
      (input || cancel || accept).focus();
      input?.select();
    }
  });
}

function enqueue(options) {
  if (options.kind !== 'notice') dismissNotice?.();
  const result = queue.then(() => show(options));
  queue = result.catch(() => {});
  return result;
}
export function confirmDialog(message, options = {}) {
  return enqueue({kind:'confirm',title:'Confirm action',message,danger:/delete|remove|revoke|suspend|discard|clear/i.test(message),...options});
}
export function promptDialog(label, initial = '', options = {}) {
  return enqueue({kind:'prompt',title:'Enter details',label,initial,...options});
}
export function alertDialog(message, options = {}) {
  return enqueue({kind:'alert',title:'Notification',message,...options});
}
export function notify(title, message = '', options = {}) {
  return enqueue({kind:'notice',title,message,...options});
}
