// Shared card presentation uses the same column formatters as the list view.
export function renderGridView(resource, data, {MODULES, emptyState, esc}) {
  const config = MODULES[resource];
  if (!data.items.length) return `<section class="card">${emptyState(config.icon, `No ${config.label.toLowerCase()} found`, "Create a record or change filters.")}</section>`;
  return `<section class="record-grid">${data.items.map((row) => `<article class="card record-grid-card" data-open-record="${resource}" data-id="${row.id}" role="button" tabindex="0" aria-label="Open ${esc(row.name || row.full_name || config.singular)}"><div class="card-body"><span class="eyebrow">${esc(config.singular)} #${row.id}</span><h3>${esc(row.name || row.subject || row.full_name || row.title || `Record ${row.id}`)}</h3>${config.columns.slice(1,5).map((column) => `<p><small>${esc(column.label)}</small><strong>${column.cell ? column.cell(row) : esc(row[column.key] ?? '—')}</strong></p>`).join('')}</div></article>`).join('')}</section>`;
}
