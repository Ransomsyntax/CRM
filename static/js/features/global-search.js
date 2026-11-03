export function installGlobalSearch({api, esc, titleCase, MODULES, navigate}) {
  const input = document.querySelector('#global-search');
  const results = document.querySelector('#search-results');
  if (!input || !results) return;
  let timer, revision = 0;
  const close = () => { clearTimeout(timer); revision++; results.classList.remove('open'); results.removeAttribute('aria-busy'); };
  async function search() {
    clearTimeout(timer);
    const term = input.value.trim();
    const request = ++revision;
    if (!term) { close(); return; }
    results.classList.add('open'); results.setAttribute('aria-busy','true');
    results.innerHTML = '<p role="status">Searching…</p>';
    try {
      const data = await api(`/api/search?q=${encodeURIComponent(term)}`);
      if (request !== revision) return;
      results.innerHTML = data.results.length ? data.results.map(item => `<button type="button" class="search-result" data-search-route="/${esc(item.resource)}/${Number(item.id)}"><span class="result-icon">${MODULES[item.resource]?.icon || '◈'}</span><span><strong>${esc(item.label)}</strong><small>${esc(titleCase(item.resource))} · ${esc(item.meta || '')}</small></span></button>`).join('') : '<p role="status">No matching records.</p>';
    } catch (error) {
      if (request !== revision) return;
      results.innerHTML = `<p role="alert">Search unavailable: ${esc(error.message || 'Request failed')}. Press Enter to retry.</p>`;
    } finally { if (request === revision) results.removeAttribute('aria-busy'); }
  }
  input.addEventListener('input', () => { clearTimeout(timer); revision++; if (!input.value.trim()) close(); else timer = setTimeout(search,240); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); search(); }
    if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector('button')?.focus(); }
    if (event.key === 'Escape') close();
  });
  document.querySelector('#global-search-submit')?.addEventListener('click',search);
  document.addEventListener('click', event => {
    const result = event.target.closest('[data-search-route]');
    if (result) { close(); input.value = ''; navigate(result.dataset.searchRoute); }
    else if (!event.target.closest('#global-search-wrap')) close();
  });
  return {search,close};
}
