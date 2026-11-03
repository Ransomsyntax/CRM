// UI guidance only: every API request is independently authorized on the server.
export function blockedPlanRoute(path, subscription) {
  if (!subscription || subscription.owner_unrestricted) return false;
  const parts = path.replace(/^\/app(?=\/|$)/,'').split('/').filter(Boolean);
  if (['subscriptions','settings','owner','login'].includes(parts[0])) return false;
  if (subscription.access_active === false) return true;
  const resource = ['setup','setup-console'].includes(parts[0]) ? parts[1] : parts[0];
  const feature = parts[0] === 'custom' ? 'custom_modules' : subscription.resource_features?.[resource];
  return Boolean(feature && !subscription.features?.[feature]);
}
export function applyPlanNavigation(profile) {
  const subscription = profile?.subscription;
  document.querySelectorAll('#sidebar a[href]').forEach(link => {
    const blocked = blockedPlanRoute(new URL(link.href,location.origin).pathname,subscription);
    link.classList.toggle('crm-plan-restricted',blocked);
    if (blocked) {
      link.dataset.planRestricted='true';
      link.title='Not included in your plan. Open Upgrade plan to see available access.';
    } else if (link.dataset.planRestricted) {
      delete link.dataset.planRestricted; link.removeAttribute('title');
    }
  });
}
