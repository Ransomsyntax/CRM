// Keep browser constraints aligned with RecordPayload; the API remains authoritative.
export function crmFieldError(key, value, required = false, resource = '') {
  const text = value.trim();
  if (!text) return required ? 'This field is required.' : value ? 'Enter a value containing visible characters.' : '';
  if (['first_name', 'last_name'].includes(key) || key === 'name' && resource === 'leads') {
    const limit = key === 'name' ? 160 : 100;
    if (text.length > limit) return `Use ${limit} characters or fewer.`;
    if (!/\p{L}/u.test(text)) return 'Name must contain at least one letter.';
    if (key !== 'name' && !/^[\p{L}\p{M} .’'-]+$/u.test(text)) return 'Use letters, spaces, apostrophes, periods or hyphens.';
  }
  if (key === 'email' && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(text)) return 'Enter a valid email address, such as name@example.com.';
  if (key === 'phone' && (!/^\+?[0-9 ()-]+$/.test(text) || !/^[0-9]{7,15}$/.test(text.replace(/[^0-9]/g, '')))) return 'Enter 7–15 digits; spaces, +, parentheses and hyphens are allowed.';
  if (key === 'website') {
    try {
      const url = new URL(text.includes('://') ? text : `https://${text}`);
      const host = url.hostname.replace(/\.$/, '');
      const labels = host.split('.');
      const validHost = host.length <= 253 && labels.length >= 2 && labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
      if (!['http:', 'https:'].includes(url.protocol) || !validHost || /\s/.test(text)) throw new Error();
    } catch { return 'Enter a valid website, such as https://example.com.'; }
  }
  return '';
}

const bound = new WeakSet();
let messageId = 0;
export function enhanceCrmValidation(root, resource) {
  if (!['leads','contacts','accounts'].includes(resource)) return;
  root.querySelectorAll('input[name]').forEach(input => {
    const key = input.name;
    if (!['name','first_name','last_name','email','phone','website'].includes(key) || bound.has(input)) return;
    bound.add(input);
    const field = input.closest('.field');
    if (!field) return;
    if (key === 'phone') { input.type = 'tel'; input.inputMode = 'tel'; }
    if (['first_name','last_name'].includes(key)) input.maxLength = 100;
    if (key === 'name' && resource === 'leads') input.maxLength = 160;
    const label = field.querySelector('label');
    if (input.required && label && !label.querySelector('.required')) {
      const marker = document.createElement('span'); marker.className = 'required'; marker.textContent = ' *'; label.append(marker);
    }
    const message = document.createElement('small');
    message.id = `crm-field-error-${++messageId}`; message.className = 'crm-field-error'; message.hidden = true;
    message.setAttribute('aria-live', 'polite'); field.append(message);
    input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), message.id].filter(Boolean).join(' '));
    const validate = (show = false) => {
      const error = crmFieldError(key, input.value, input.required, resource);
      input.setCustomValidity(error);
      if (show) {
        if (message.textContent !== error) message.textContent = error;
        message.hidden = !error; input.setAttribute('aria-invalid', String(Boolean(error)));
      }
    };
    input.addEventListener('input', () => validate(true));
    input.addEventListener('blur', () => validate(true));
    input.addEventListener('invalid', () => validate(true));
    validate();
  });
}
