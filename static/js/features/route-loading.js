import { loading } from './loading-view.js';
// Fast work stays quiet. Slow work gets feedback inside the content it affects.
export function createRouteLoading({content, delay = 250, setTimer = setTimeout, cancelTimer = clearTimeout}) {
  let active = null;
  let completedRoute = null;
  return {
    start(route) {
      active?.cancel();
      const refreshing = completedRoute === route && content.children.length > 0;
      if (!refreshing) content.replaceChildren();
      content.setAttribute('aria-busy', 'true');
      let indicator = null;
      const operation = {
        cancel() { cancelTimer(timer); indicator?.remove(); },
      };
      const timer = setTimer(() => {
        if (active !== operation) return;
        indicator = document.createElement('div');
        indicator.className = refreshing ? 'crm-route-updating' : 'crm-route-loading';
        indicator.setAttribute('role', 'status');
        indicator.setAttribute('aria-live', 'polite');
        const spinner = document.createElement('span');
        spinner.className = 'crm-route-spinner'; spinner.setAttribute('aria-hidden', 'true');
        const original = document.createElement('template');
        original.innerHTML = loading();
        spinner.append(original.content.querySelector('.yash-radial-loader'));
        indicator.append(spinner, document.createTextNode(refreshing ? 'Updating…' : 'Loading…'));
        content.prepend(indicator);
      }, delay);
      active = operation;
      return () => {
        operation.cancel();
        if (active !== operation) return;
        active = null;
        completedRoute = route;
        content.removeAttribute('aria-busy');
      };
    },
  };
}
