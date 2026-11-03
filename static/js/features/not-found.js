const icons = {
  leads: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M17 8h4m-2-2v4"/>',
  contacts: '<circle cx="12" cy="8" r="3"/><path d="M5 20v-1a7 7 0 0 1 14 0v1"/>',
  reports: '<path d="M4 20V10m5 10V4m5 16v-7m5 7V7M3 20h18"/>',
  deals: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  tasks: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="m8 12 2 2 5-5M8 17h8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-14 4h3m4 0h3"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const cards = [ ['leads','Leads','Manage your pipeline'], ['contacts','Contacts','Find your people'], ['reports','Reports','Explore your insights'], ['deals','Deals','Track your opportunities'] ];
export function notFoundView() {
  return `<section class="nf-page" aria-labelledby="nf-heading">
    <div class="nf-scene" role="img" aria-label="404 illustration">
      <div class="nf-halo" aria-hidden="true"></div><div class="nf-orbit nf-orbit-one" aria-hidden="true"><i></i></div><div class="nf-orbit nf-orbit-two" aria-hidden="true"><i></i></div><div class="nf-orbit nf-orbit-three" aria-hidden="true"><i></i></div>
      <div class="nf-art-reveal"><div class="nf-art"></div></div>
      ${Object.keys(icons).map((name,i)=>`<div class="nf-float nf-float-${i+1}" aria-hidden="true">${icon(name)}</div>`).join('')}
    </div>
    <div class="nf-copy"><div class="nf-eyebrow">Something went off route</div><h1 id="nf-heading">Page not found</h1><p>The page you're looking for doesn't exist or may have been moved. Let's get you back on track.</p></div>
    <div class="nf-actions"><a class="nf-button nf-primary" href="/dashboard">Go to Dashboard <span aria-hidden="true">→</span></a><button class="nf-button nf-secondary" type="button" data-not-found-back>← &nbsp; Go Back</button></div>
    <nav class="nf-quick" aria-label="Quick navigation">${cards.map(([name,label,description])=>`<a href="/${name}"><span class="nf-card-icon">${icon(name)}</span><span><strong>${label}</strong><small>${description}</small></span><span class="nf-arrow" aria-hidden="true">↗</span></a>`).join('')}</nav>
  </section>`;
}
