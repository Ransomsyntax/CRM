// Compact, draggable scroll indicator for the Setup directory only.
export function installSetupCompactScrollbar() {
  const shell = document.querySelector(".app-shell");
  const pane = shell?.querySelector(".main-area");
  const content = document.querySelector("#app-content");
  if (!shell || !pane || !content) return;
  const track = document.createElement("div");
  track.className = "setup-compact-scroll-track";
  track.setAttribute("aria-hidden", "true");
  const thumb = document.createElement("div");
  thumb.className = "setup-compact-scroll-thumb";
  track.append(thumb);
  document.body.append(track);
  let enabled = false, dragging = false, dragStart = 0, scrollStart = 0;
  const maxScroll = () => Math.max(0, pane.scrollHeight - pane.clientHeight);
  const span = () => Math.max(1, track.clientHeight - thumb.offsetHeight);
  function update() {
    const setupRoute = /^\/(?:app\/)?setup(?:\/|$)/.test(window.location.pathname);
    const active = window.matchMedia("(min-width: 769px)").matches &&
      setupRoute && maxScroll() > 1;
    enabled = active;
    document.documentElement.classList.toggle("crm-setup-compact-scroll", active);
    document.body.classList.toggle("crm-setup-compact-scroll", active);
    track.hidden = !active;
    if (!active) return;
    const header = shell.querySelector(".topbar");
    const top = header ? Math.round(header.getBoundingClientRect().bottom) : 0;
    track.style.top = Math.max(0, top) + "px";
    track.style.bottom = "8px";
    const height = Math.max(24, Math.min(38, track.clientHeight * 0.07));
    thumb.style.height = height + "px";
    thumb.style.transform = `translateY(${(pane.scrollTop / maxScroll()) * span()}px)`;
  }
  pane.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  window.addEventListener("popstate", () => requestAnimationFrame(update));
  const observer = new MutationObserver(() => requestAnimationFrame(update));
  observer.observe(content, {childList:true, subtree:true});
  const resize = new ResizeObserver(update);
  resize.observe(content);
  resize.observe(pane);
  resize.observe(document.documentElement);
  thumb.addEventListener("pointerdown", event => {
    if (!enabled || event.button !== 0) return;
    dragging = true;
    dragStart = event.clientY;
    scrollStart = pane.scrollTop;
    thumb.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  thumb.addEventListener("pointermove", event => {
    if (!dragging) return;
    pane.scrollTop = Math.max(0, Math.min(maxScroll(), scrollStart + (event.clientY-dragStart) * maxScroll()/span()));
  });
  const stop = () => { dragging=false; };
  thumb.addEventListener("pointerup", stop);
  thumb.addEventListener("pointercancel", stop);
  track.addEventListener("pointerdown", event => {
    if (!enabled || event.target===thumb) return;
    const bounds=track.getBoundingClientRect();
    pane.scrollTop=Math.max(0,Math.min(maxScroll(), ((event.clientY-bounds.top-thumb.offsetHeight/2)/span())*maxScroll()));
  });
  requestAnimationFrame(update);
}
