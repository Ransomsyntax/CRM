(() => {
  "use strict";
  const form = document.querySelector("form[data-webform-public]");
  if (!form) return;
  const token = location.pathname.split("/").filter(Boolean).pop();
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return;
  const key = "convosis-webform-visitor:" + token;
  let visitor;
  try {
    visitor = sessionStorage.getItem(key);
    if (!/^[a-f0-9]{32}$/.test(visitor || "")) {
      visitor = Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem(key, visitor);
    }
  } catch (_) { return; }
  const sent = new Set();
  const track = event => {
    if (sent.has(event)) return;
    sent.add(event);
    const payload = JSON.stringify({event, visitor});
    const endpoint = "/public/webform/" + encodeURIComponent(token) + "/track";
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([payload], {type:"application/json"}));
    } else {
      fetch(endpoint, {method:"POST", headers:{"Content-Type":"application/json"},body:payload,keepalive:true}).catch(() => {});
    }
  };
  track("visit");
  form.addEventListener("input", () => {track("start");}, {once:true});
  form.addEventListener("change", () => {track("start");}, {once:true});
  window.addEventListener("pagehide", () => {
    if (sent.has("start") && !form.dataset.submitted) track("partial");
  });
  form.addEventListener("submit", () => {
    if (form.checkValidity()) form.dataset.submitted = "1";
  });
})();