// Record sharing uses the same server authorization as record APIs.
export async function mountRecordSharing({root, resource, id, api, esc, toast}) {
  const path = `/api/security/records/${encodeURIComponent(resource)}/${Number(id)}/shares`;
  let data;
  try { data = await api(path); } catch { return; }
  if (!root.isConnected || (!data.can_manage && !data.items.length)) return;
  const panel = document.createElement('section');
  panel.className = 'card record-sharing-panel';
  const render = () => {
    panel.innerHTML = `<details><summary class="button button-ghost">${data.can_manage ? 'Share Record' : 'Shared access'}</summary><div class="card-body">
      <h3>Record sharing</h3><p>Access remains limited by each recipient’s profile permissions.</p>
      <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Shared with</th><th scope="col">Type</th><th scope="col">Access</th><th scope="col">Action</th></tr></thead><tbody>${data.items.map(item => {
        const label = data.targets.find(t => t.type === item.target_type && String(t.value) === String(item.target))?.label || item.target;
        return `<tr><td>${esc(label)}</td><td>${esc(item.target_type)}</td><td>${esc(item.grant)}</td><td>${data.can_manage ? `<button type="button" class="button button-ghost" data-revoke-share="${Number(item.id)}">Remove access</button>` : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="4" class="record-share-empty">No direct shares.</td></tr>'}</tbody></table></div>
      ${data.can_manage ? `<form data-share-form class="form-grid"><label class="field">User, role or group<select class="field-select" name="target" required><option value="">Select recipient</option>${data.targets.map(t => `<option value="${esc(JSON.stringify([t.type,t.value]))}">${esc(t.label)} (${esc(t.type)})</option>`).join('')}</select></label><label class="field">Access<select class="field-select" name="grant"><option>Read Only</option><option>Read/Write</option></select></label><div class="record-share-actions" style="grid-column:1/-1;display:flex;justify-content:flex-end;padding:8px 0"><button class="button button-primary" type="submit">Share record</button></div></form>` : ''}
      <p role="status" data-share-status></p></div></details>`;
  };
  render();
  (root.querySelector('.detail-body-scroll') || root).append(panel);
  panel.addEventListener('submit', async event => {
    if (!event.target.matches('[data-share-form]')) return;
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const [target_type, target] = JSON.parse(form.elements.target.value);
      await api(path, {method:'POST',body:JSON.stringify({target_type,target,grant:form.elements.grant.value})});
      data = await api(path); render(); panel.querySelector('details').open = true;
      panel.querySelector('[data-share-status]').textContent = 'Record shared.';
    } catch(error) { button.disabled = false; toast('Could not share record',error.message,'error'); }
  });
  panel.addEventListener('click', async event => {
    const button = event.target.closest('[data-revoke-share]');
    if (!button) return;
    button.disabled = true;
    try {
      await api(`${path}/${Number(button.dataset.revokeShare)}`, {method:'DELETE'});
      data = await api(path); render(); panel.querySelector('details').open = true;
      panel.querySelector('[data-share-status]').textContent = 'Access removed.';
    } catch(error) { button.disabled = false; toast('Could not remove access',error.message,'error'); }
  });
}
