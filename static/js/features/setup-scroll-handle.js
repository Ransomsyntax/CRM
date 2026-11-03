// Visible 24px Setup scroll handle; never changes page overflow or scroll ownership.
export function installSetupScrollHandle() {
  if (document.getElementById("crm-setup-scroll-handle")) return;
  const track=document.createElement("div");
  track.id="crm-setup-scroll-handle";
  track.className="crm-setup-scroll-handle";
  track.setAttribute("aria-label","Setup page scrollbar");
  const thumb=document.createElement("div");
  thumb.className="crm-setup-scroll-thumb";
  thumb.setAttribute("role","scrollbar");
  thumb.setAttribute("aria-label","Scroll Setup page");
  thumb.setAttribute("aria-orientation","vertical");
  thumb.setAttribute("tabindex","0");
  track.appendChild(thumb);
  document.body.appendChild(track);
  let scrolling=null, startY=0, startScroll=0, dragging=false, scheduled=false;
  const range=el=>Math.max(0,el.scrollHeight-el.clientHeight);
  function candidate() {
    const root=document.scrollingElement || document.documentElement;
    const main=document.querySelector(".main-area");
    // Ignore overflow-hidden ancestors: scrollHeight alone does not mean
    // a user can scroll this element.
    const usable=el=>el && range(el)>1 && !["hidden","clip"].includes(getComputedStyle(el).overflowY);
    if (usable(main)) return main;
    return usable(root) ? root : null;
  }
  function update(){
    scheduled=false;
    const setup=/^\/(?:app\/)?setup(?:\/|$)/.test(location.pathname);
    // Setup workspaces provide their own native nav/content scrollbars.
    // An additional document-level handle is misleading and non-functional.
    const split=!!document.querySelector("#app-content .setup-page-shell .setup-workspace") &&
      matchMedia("(min-width:1101px)").matches;
    scrolling=split ? null : candidate();
    const available=scrolling ? range(scrolling) : 0;
    const active=setup && !split && matchMedia("(min-width:769px)").matches && available>1;
    track.hidden=!active;
    if(!active)return;
    const top=Math.max(0,document.querySelector(".topbar")?.getBoundingClientRect().bottom||0);
    track.style.top=top+"px";
    const travel=Math.max(0,track.clientHeight-24);
    thumb.style.transform="translateY("+(scrolling.scrollTop/available*travel)+"px)";
    thumb.setAttribute("aria-valuemin","0");
    thumb.setAttribute("aria-valuemax",String(Math.round(available)));
    thumb.setAttribute("aria-valuenow",String(Math.round(scrolling.scrollTop)));
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update);}}
  document.addEventListener("scroll",schedule,true);
  window.addEventListener("resize",schedule,{passive:true});
  window.addEventListener("popstate",schedule);
  new MutationObserver(schedule).observe(document.getElementById("app-content")||document.body,{childList:true,subtree:true});
  thumb.addEventListener("pointerdown",e=>{
    if(e.button!==0)return;
    scrolling=candidate();if(!scrolling)return;dragging=true;startY=e.clientY;startScroll=scrolling.scrollTop;
    thumb.setPointerCapture(e.pointerId);e.preventDefault();
  });
  thumb.addEventListener("pointermove",e=>{
    if(!dragging||!scrolling)return;
    const travel=Math.max(1,track.clientHeight-24);
    scrolling.scrollTop=Math.max(0,Math.min(range(scrolling),startScroll+(e.clientY-startY)*range(scrolling)/travel));
    schedule();
  });
  const stop=()=>{dragging=false};
  thumb.addEventListener("pointerup",stop);
  thumb.addEventListener("pointercancel",stop);
  track.addEventListener("pointerdown",e=>{
    if(e.target===thumb)return;
    scrolling=candidate();if(!scrolling)return;
    const rect=track.getBoundingClientRect();
    scrolling.scrollTop=Math.max(0,Math.min(range(scrolling),(e.clientY-rect.top-12)/Math.max(1,rect.height-24)*range(scrolling)));
    schedule();
  });
  thumb.addEventListener("keydown",e=>{
    const step=e.key==="ArrowDown"?60:e.key==="ArrowUp"?-60:e.key==="PageDown"?window.innerHeight*.8:e.key==="PageUp"?-window.innerHeight*.8:0;
    if(step){const target=candidate();if(target){target.scrollTop+=step;e.preventDefault();schedule();}}
  });
  schedule();
}
