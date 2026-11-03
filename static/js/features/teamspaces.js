import { confirmDialog,promptDialog } from "../core/dialogs.js?v=20261027-centered-popups-v1";
// Teamspace management and sidebar workspace selector.
export function createTeamspacesFeature({ api, pageHeader, esc, emptyState, $, $$, toast, navigate, onSaved = () => {} }) {
  const modules = [
    ["leads","Leads"],["contacts","Contacts"],["accounts","Accounts"],["deals","Deals"],
    ["products","Products"],["campaigns","Campaigns"],["vendors","Vendors"],
    ["price_books","Price Books"],["activities","Activities"],["quotes","Quotes"],
    ["sales_orders","Sales Orders"],["purchase_orders","Purchase Orders"],["invoices","Invoices"],
    ["payments","Payments"],["site_visits","Site Visits"],["cases","Cases"],["solutions","Solutions"],
    ["documents","Documents"],["forecasts","Forecasts"],["reports","Reports"],
    ["dashboards","Dashboards"],["sales_targets","Sales Targets & Incentives"]
  ];
  const chosen = { id: null };
  let cache = [], editing = null, folderToAdd = null;
  const list = () => cache.map(t=>({ ...t, folders: t.folders || [], modules: t.modules || [] }));
  async function load() { cache = (await api("/api/teamspaces")).items || []; return list(); }
  function folderItems(t) {
    return (t.folders||[]).map(f=>`<div class="ts-folder"><span>▣ ${esc(f.name)}</span><small>${(f.modules||[]).length} modules</small><button type="button" data-ts-folder-assign="${esc(f.id)}">Modules</button><button type="button" data-ts-folder-edit="${esc(f.id)}">Rename</button><button type="button" data-ts-folder-delete="${esc(f.id)}">Delete</button></div>`).join("");
  }
  function workspaceMarkup() {
    return `<div class="ts-workspace-control">
      <div class="ts-workspace-bar"><button type="button" data-ts-switch aria-haspopup="true" aria-expanded="false"><span data-ts-current>Teamspaces</span><span aria-hidden="true">⌄</span></button>
      <button type="button" class="ts-create-shortcut" aria-label="Create Teamspace" title="Create Teamspace" data-ts-create>＋</button>
      <button type="button" aria-label="Teamspace options" data-ts-actions><span class="ts-action-dots" aria-hidden="true">⋯</span></button></div>
      <div class="ts-popup" data-ts-switch-menu hidden></div><div class="ts-popup" data-ts-actions-menu hidden>
        <button type="button" data-ts-create>＋ New Teamspace</button>
        <button type="button" data-ts-new-folder>▣ Create Folder</button>
        <button type="button" data-ts-add-modules>⊞ Add Modules</button>
        <button type="button" data-ts-manage>⚙ Manage Teamspace</button>
        <button type="button" data-ts-list>View All Teamspaces</button>
      </div></div>`;
  }
  function ensureStyle() {
    if ($("#teamspace-style")) return;
    const css = document.createElement("style");css.id="teamspace-style";css.textContent=`
      .ts-workspace-control{position:relative;margin:10px 7px 14px;color:var(--text,#dae2ef);font-size:13px}
      .ts-workspace-bar{display:flex;align-items:center;gap:4px}.ts-workspace-bar button{min-width:0;display:flex;align-items:center;gap:8px;border:1px solid var(--border,rgba(135,150,175,.24));border-radius:9px;background:transparent;color:inherit;padding:10px;cursor:pointer}
      /* Keep Teamspace creation visible beside the selector when sidebar is expanded. */
      .ts-workspace-bar .ts-create-shortcut{flex:0 0 28px!important;width:28px!important;min-width:28px!important;height:30px!important;padding:0!important;display:grid!important;place-items:center!important;font-size:19px!important;color:#eaf2ff!important;border-color:#6b82ab!important}
      html.crm-sidebar-collapsed:not(.crm-sidebar-peek) #sidebar .ts-create-shortcut{display:none!important}
      html.crm-sidebar-collapsed.crm-sidebar-peek #sidebar .ts-create-shortcut{display:grid!important}
      .ts-workspace-control .ts-popup:not([hidden]){z-index:20000!important;visibility:visible!important;opacity:1!important}
      .ts-workspace-section{margin:5px 0 14px;padding:12px 0 7px;border-top:1px solid rgba(143,167,202,.18)}
      .ts-workspace-section .ts-created-heading{font-size:10px;font-weight:750;letter-spacing:.105em;color:#8297b6;margin:0 9px 7px}
      .ts-workspace-section .ts-workspace-control{margin:0 5px 6px}
      .ts-workspace-bar [data-ts-switch]{padding:7px 5px!important;gap:4px!important}
      .ts-workspace-bar [data-ts-actions]{width:26px;min-width:26px;padding:4px!important;justify-content:center!important}
      .ts-workspace-control .ts-action-dots{font-size:18px!important;letter-spacing:0!important;font-weight:650!important;line-height:1!important}
      html.crm-sidebar-collapsed:not(.crm-sidebar-peek) .ts-workspace-section .ts-workspace-control{display:none!important}
      html.crm-sidebar-collapsed:not(.crm-sidebar-peek) .ts-workspace-section .ts-created-heading{font-size:0!important;height:1px;margin:4px 0}
      .ts-workspace-bar [data-ts-switch]{flex:1;justify-content:space-between}.ts-workspace-bar [data-ts-current]{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:left}.ts-workspace-badge{font-size:17px;color:#6f85ef}
      /* Sidebar uses a navy surface in both app themes; never inherit page text color. */
      .ts-workspace-control .ts-workspace-bar>button,
      .ts-workspace-control .ts-workspace-bar [data-ts-current],
      .ts-workspace-control .ts-workspace-bar [data-ts-actions],
      .ts-workspace-control .ts-workspace-bar [data-ts-switch] span {color:#f2f6ff!important;opacity:1!important;font-weight:750!important}
      .ts-workspace-control .ts-workspace-bar .ts-workspace-badge{color:#a8c1ff!important;font-weight:900!important}
      .ts-workspace-control .ts-workspace-bar>button:hover,
      .ts-workspace-control .ts-workspace-bar>button:focus-visible{background:rgba(147,173,230,.17)!important;color:#fff!important}
      html[data-crm-theme="light"] .ts-workspace-control .ts-workspace-bar>button,
      html[data-crm-theme="dark"] .ts-workspace-control .ts-workspace-bar>button{color:#f2f6ff!important}
      .ts-workspace-control .ts-popup{color:var(--text,#1d293c)}
      html[data-crm-theme="dark"] .ts-workspace-control .ts-popup{color:#f0f4fb}
      /* Silver-gray Teamspace caption and overflow dots on the navy sidebar. */
      .ts-workspace-control .ts-workspace-bar [data-ts-current],
      .ts-workspace-control .ts-workspace-bar [data-ts-actions] {color:#d6dbe4!important;opacity:1!important}
      .ts-workspace-control .ts-workspace-bar [data-ts-actions]:hover,
      .ts-workspace-control .ts-workspace-bar [data-ts-actions]:focus-visible {color:#edf0f5!important}
      /* Sidebar navy surface is constant regardless of main-page theme. */
      html[data-crm-theme="light"] .ts-workspace-control .ts-workspace-bar [data-ts-current],
      html[data-crm-theme="dark"] .ts-workspace-control .ts-workspace-bar [data-ts-current],
      .ts-workspace-control .ts-workspace-bar [data-ts-current] {color:#aeb9c9!important;-webkit-text-fill-color:#aeb9c9!important;opacity:1!important;font-weight:650!important}
      html[data-crm-theme="light"] .ts-workspace-control .ts-workspace-bar button[data-ts-actions],
      html[data-crm-theme="dark"] .ts-workspace-control .ts-workspace-bar button[data-ts-actions],
      .ts-workspace-control .ts-workspace-bar button[data-ts-actions],
      .ts-workspace-control .ts-workspace-bar button[data-ts-actions] .ts-action-dots {color:#b7c1d0!important;-webkit-text-fill-color:#b7c1d0!important;opacity:1!important}
      .ts-workspace-control .ts-workspace-bar button[data-ts-actions] .ts-action-dots{display:inline-block;font-size:17px;font-weight:800;line-height:1;letter-spacing:2px}
      .ts-popup{position:absolute;z-index:150;top:47px;left:0;min-width:220px;max-height:350px;overflow:auto;background:var(--surface,#202329);border:1px solid var(--border,#464b5a);border-radius:10px;padding:6px;box-shadow:0 15px 35px #0005;color:var(--text,#e6e9ee)}
      .ts-popup[hidden]{display:none!important}.ts-popup button{width:100%;display:block;text-align:left;border:0;border-radius:7px;background:transparent;color:inherit;padding:10px;cursor:pointer}.ts-popup button:hover{background:rgba(100,116,210,.2)}
      .ts-sidebar-members{display:flex;flex-direction:column;gap:3px;max-height:260px;overflow-y:auto}.ts-sidebar-members a,.ts-sidebar-members .ts-sidebar-folder{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;color:inherit;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ts-sidebar-members a:hover{background:rgba(100,116,210,.15)}
      .ts-page{display:grid;gap:18px}.ts-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}.ts-card{border:1px solid var(--border,#404758);border-radius:13px;padding:22px;background:var(--surface,#222630);color:var(--text,#e4e9f1);text-align:left;cursor:pointer;min-height:170px}.ts-card:hover{border-color:#6578e8}.ts-card strong,.ts-card small{display:block;margin-top:9px}.ts-form{display:grid;gap:14px;max-width:760px}.ts-form label{display:grid;gap:6px;font-weight:600}.ts-form input,.ts-form textarea{width:100%;background:var(--surface,#202329);color:var(--text,#e4e9f1);border:1px solid var(--border,#505667);border-radius:8px;padding:11px;box-sizing:border-box}.ts-form-actions{display:flex;gap:9px;flex-wrap:wrap}.ts-modules{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:9px;max-height:280px;overflow:auto}.ts-modules label{display:flex;align-items:center;gap:8px;border:1px solid var(--border,#414858);border-radius:8px;padding:9px;font-weight:400}.ts-modules input{width:auto}.ts-folder{display:flex;align-items:center;gap:10px;padding:10px;margin:5px 0;border:1px solid var(--border,#414858);border-radius:8px}.ts-folder span{flex:1}.ts-folder button{background:transparent;border:0;color:inherit;cursor:pointer}.ts-section{padding:22px;border:1px solid var(--border,#414858);border-radius:12px;background:var(--surface,#20232c)}.ts-section h3{margin:0 0 12px}
      .ts-created-section{border-top:1px solid var(--border,rgba(135,150,175,.22));margin:16px 7px 12px;padding-top:12px;min-width:0}
      .ts-created-heading{padding:0 10px 9px;font-size:10px;letter-spacing:.09em;font-weight:700;opacity:.65}
      .ts-created-section .ts-sidebar-members{display:flex;flex-direction:column;gap:3px}
      .ts-created-section .ts-sidebar-members>a{min-height:34px}
      .ts-workspace-control{margin:7px 7px 14px;padding-bottom:12px;border-bottom:1px solid var(--border,rgba(135,150,175,.22))}
      /* Use the actual root layout state: body may retain a stale collapsed class. */
      html.crm-sidebar-collapsed:not(.crm-sidebar-peek) #sidebar .ts-workspace-control,
      html.crm-sidebar-collapsed:not(.crm-sidebar-peek) #sidebar .ts-created-section{display:none!important}
      html:not(.crm-sidebar-collapsed) #sidebar .ts-workspace-control,
      html.crm-sidebar-collapsed.crm-sidebar-peek #sidebar .ts-workspace-control{display:block!important}
      html:not(.crm-sidebar-collapsed) #sidebar .ts-created-section,
      html.crm-sidebar-collapsed.crm-sidebar-peek #sidebar .ts-created-section{display:block!important}
      #sidebar .ts-workspace-bar{display:flex!important;width:100%!important}
      #sidebar .ts-workspace-bar [data-ts-switch]{min-width:0!important;flex:1 1 auto!important}
      #sidebar .ts-workspace-bar [data-ts-create],
      #sidebar .ts-workspace-bar [data-ts-actions]{flex-shrink:0!important}
      .ts-sidebar-folder-group{display:block;min-width:0;position:relative}.ts-sidebar-folder-group>summary{padding-right:40px!important}.ts-sidebar-folder-group>.ts-folder-plus{position:absolute;right:4px;top:4px}.ts-folder-header{display:flex;align-items:center;gap:4px;border-radius:8px}.ts-folder-header summary{flex:1;min-width:0;cursor:pointer;list-style:none}.ts-folder-header summary::-webkit-details-marker{display:none}.ts-folder-header:hover{background:rgba(110,130,220,.13)}
      .ts-folder-plus{appearance:none;background:transparent;border:0;color:inherit;cursor:pointer;border-radius:6px;padding:4px 8px;font-size:19px;line-height:1}.ts-folder-plus:hover{background:rgba(110,130,220,.24)}
      .ts-module-dialog{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.65);display:flex;justify-content:center;align-items:center;padding:16px}
      .ts-module-dialog[hidden]{display:none!important}.ts-module-panel{width:min(490px,96vw);max-height:min(700px,90vh);display:flex;flex-direction:column;border-radius:14px;border:1px solid var(--border,#474d5b);background:var(--surface,#202329);color:var(--text,#e8ebf2);box-shadow:0 20px 60px #0008;padding:24px;gap:15px}
      .ts-module-panel h2{margin:0;font-size:20px}.ts-module-search,.ts-folder-choice{background:var(--surface,#202329);color:inherit;border:1px solid var(--border,#596070);border-radius:8px;padding:10px;width:100%;box-sizing:border-box}
      .ts-module-list{overflow-y:auto;min-height:90px;max-height:390px;display:grid;align-content:start;gap:4px}.ts-module-list label{display:flex;align-items:center;gap:10px;padding:8px;border-radius:7px;cursor:pointer}.ts-module-list label:hover{background:rgba(110,130,220,.14)}.ts-dialog-actions{display:flex;justify-content:flex-end;gap:10px}
      .ts-sidebar-members{max-height:none;overflow:visible}.ts-workspace-control{margin-bottom:0}

    `;document.head.append(css);
  }
  function modulePicker(selected=[]) {
    return `<div class="ts-modules">${modules.map(([id,label])=>`<label><input type="checkbox" name="module" value="${id}" ${selected.includes(id)?"checked":""} />${esc(label)}</label>`).join("")}</div>`;
  }
  async function teamspacesView() {
    await load();
    const id = Number(new URLSearchParams(location.search).get("id")) || editing;
    const item = cache.find(t=>t.id === id);
    if(!item) return `${pageHeader("Customization","Teamspaces","Create and manage focused module workspaces for your organization.",'<button type="button" class="button button-primary" data-ts-create>＋ Create Teamspace</button>')}<div class="ts-page"><div class="ts-card-grid">${cache.length?cache.map(t=>`<button type="button" class="ts-card" data-ts-open="${t.id}"><div style="font-size:30px">${esc(t.icon||"▦")}</div><strong>${esc(t.name)}</strong><small>${esc(t.description||"No description")}</small><small>${(t.modules||[]).length} modules · ${(t.folders||[]).length} folders</small></button>`).join(""):emptyState("▦","No teamspaces","Create your first teamspace to organize CRM modules.")}</div></div>`;
    editing = item.id;
    return `${pageHeader("Customization","Manage "+item.name,"Teamspace settings, modules and folders.",'<button type="button" class="button" data-ts-list>All Teamspaces</button>')}
      <div class="ts-page"><section class="ts-section"><form class="ts-form" data-ts-edit-form>
      <label>Teamspace name<input name="name" required maxlength="160" value="${esc(item.name)}"></label>
      <label>Icon<input name="icon" maxlength="40" value="${esc(item.icon||"▦")}"></label>
      <label>Description<textarea name="description" rows="2">${esc(item.description||"")}</textarea></label>
      <label>Available modules</label>${modulePicker(item.modules)}
      <div class="ts-form-actions"><button class="button button-primary" type="submit">Save changes</button><button class="button" type="button" data-ts-new-folder>＋ Create folder</button><button class="button" type="button" data-ts-delete>Delete Teamspace</button></div></form></section>
      <section class="ts-section"><h3>Folders</h3><div data-ts-folders>${folderItems(item)||"<p>No folders yet.</p>"}</div></section>
      <section class="ts-section"><h3>Members</h3><p>${(item.members||[]).map(m=>esc(m.name||"User")+" ("+esc(m.role)+")").join(", ")||"No members"}</p><p>Only the teamspace administrator can edit this workspace.</p></section></div>`;
  }
  async function updateSide() {
    const root = $("[data-ts-workspace]");
    if(!root)return;
    await load();
    let active = cache.find(t=>t.id===chosen.id)||cache[0];
    chosen.id=active?.id||null;
    root.querySelector("[data-ts-current]").textContent=active?.name||"Teamspaces";
    root.querySelector("[data-ts-switch-menu]").innerHTML=cache.map(t=>`<button type="button" data-ts-choose="${t.id}">${esc(t.icon||"▦")} ${esc(t.name)}</button>`).join("")+'<button type="button" data-ts-create>＋ New Teamspace</button>';
    const members = $("[data-ts-sidebar-members]");
    if (!members) return;
    const previouslyOpen = new Set(Array.from(members.querySelectorAll(".ts-sidebar-folder-group[open]")).map(x=>x.dataset.folderId));
    const assigned = new Set(active ? active.folders.flatMap(f=>f.modules||[]) : []);
    members.innerHTML=active?[
      ...active.modules.filter(m=>!assigned.has(m)).map(m=>{const found=modules.find(x=>x[0]===m);return found?`<a href="/${m}" data-ts-module-link="${m}">◦ ${esc(found[1])}</a>`:"";}),
      ...active.folders.map(f=>`<details class="ts-sidebar-folder-group" data-folder-id="${esc(f.id)}" ${previouslyOpen.has(String(f.id))?"open":""}><summary class="ts-sidebar-folder">▣ ${esc(f.name)}</summary><button type="button" class="ts-folder-plus" data-ts-folder-plus="${esc(f.id)}" aria-label="Add modules to ${esc(f.name)}" title="Add modules">＋</button>${(f.modules||[]).filter(m=>active.modules.includes(m)).map(m=>{const found=modules.find(x=>x[0]===m);return found?`<a href="/${m}" data-ts-module-link="${m}" style="padding-left:24px">◦ ${esc(found[1])}</a>`:"";}).join("")}</details>`)
    ].join(""):"";
  }
  async function refresh() { await updateSide(); await navigate("/teamspaces",true); }
  async function promptName(title, initial="") {
    const value=(await promptDialog(title,initial,{title,required:!title.startsWith("Enter module IDs"),maxLength:title.startsWith("Enter module IDs")?undefined:160}));
    return value===null?null:value.trim();
  }
  async function createWorkspace() {
    const name=await promptName("Teamspace name");
    if(name===null)return;if(!name){toast("Name required","Enter a teamspace name","error");return;}
    try {const row=await api("/api/teamspaces",{method:"POST",body:JSON.stringify({name,icon:"▦",modules:[],folders:[]})});chosen.id=row.id;editing=row.id;toast("Teamspace created",name);onSaved();await updateSide();await navigate("/teamspaces?id="+row.id,true);}
    catch(e){toast("Creation failed",e.message,"error");}
  }
  async function createFolder() {
    const active=cache.find(t=>t.id===chosen.id)||cache.find(t=>t.id===editing);
    if(!active){toast("Select a teamspace","Create or select a teamspace first","error");return;}
    const name=await promptName("Folder name");if(name===null)return;if(!name){toast("Name required","Enter a folder name","error");return;}
    try{await api(`/api/teamspaces/${active.id}`,{method:"PATCH",body:JSON.stringify({folders:[...(active.folders||[]),{id:crypto.randomUUID(),name,modules:[]}]})});toast("Folder created",name);editing=active.id;await refresh();}
    catch(e){toast("Unable to create folder",e.message,"error");}
  }
  function openModuleDialog(folderId=null) {
    const active=cache.find(t=>t.id===chosen.id)||cache.find(t=>t.id===editing);
    if(!active){toast("Select a teamspace","Create a teamspace first","error");return;}
    folderToAdd=folderId;
    document.querySelector("#ts-module-dialog")?.remove();
    const dialog=document.createElement("div");dialog.id="ts-module-dialog";dialog.className="ts-module-dialog";
    const folder=active.folders.find(f=>String(f.id)===String(folderId));
    dialog.innerHTML=`<div class="ts-module-panel" role="dialog" aria-modal="true" aria-labelledby="ts-picker-title">
      <h2 id="ts-picker-title">Add Modules to Teamspace</h2>
      <input class="ts-module-search" data-ts-module-search placeholder="Search Module" aria-label="Search modules"/>
      <div class="ts-module-list">${modules.map(([id,label])=>`<label data-ts-module-row="${id}"><input type="checkbox" value="${id}" ${(folder?(folder.modules||[]):active.modules).includes(id)?"checked":""}/> ${esc(label)}</label>`).join("")}</div>
      <label>Destination folder<select class="ts-folder-choice" data-ts-folder-choice><option value="">Root (without folder)</option>${active.folders.map(f=>`<option value="${esc(f.id)}" ${String(f.id)===String(folderId)?"selected":""}>${esc(f.name)}</option>`).join("")}</select></label>
      <div class="ts-dialog-actions"><button type="button" class="button" data-ts-dialog-cancel>Cancel</button><button type="button" class="button button-primary" data-ts-dialog-save>Done</button></div></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-ts-module-search]").focus();
  }
  async function bindTeamspaces() {
    const nav=$("#sidebar .primary-nav");
    ensureStyle();
    if(nav&&!$("[data-ts-workspace]")){
      const holder=document.createElement("div");holder.dataset.tsWorkspace="";holder.innerHTML=workspaceMarkup();
      const customerHeading=Array.from(nav.querySelectorAll(".nav-label")).find(el=>el.textContent.trim().toLowerCase().includes("customer & marketing"));
      const boundary=customerHeading || nav.lastElementChild;
      const section=document.createElement("section");section.className="ts-workspace-section";section.setAttribute("aria-label","Teamspaces");
      const title=document.createElement("div");title.className="ts-created-heading";title.textContent="TEAMSPACES";section.appendChild(title);section.appendChild(holder);
      nav.insertBefore(section,boundary);
    }
    if(nav&&!$("[data-ts-sidebar-members]")){
      const section=document.createElement("section");section.className="ts-created-section";
      section.setAttribute("aria-label","Teamspace folders and modules");
      section.innerHTML='<div class="ts-created-heading">TEAMSPACE MODULES & FOLDERS</div><div class="ts-sidebar-members" data-ts-sidebar-members></div>';
      nav.appendChild(section);
    }
    try{await updateSide();}catch(e){console.warn("Teamspaces could not be loaded",e);}
    if(document.body.dataset.teamspaceBound)return;
    document.body.dataset.teamspaceBound="true";
    // Dismiss open Teamspace popovers on outside pointer interaction, including
    // clicks on navigation links and other controls. Preserve clicks within menus.
    const closeMenus = () => {
      document.querySelectorAll("[data-ts-switch-menu],[data-ts-actions-menu]").forEach(menu => { menu.hidden = true; });
      document.querySelectorAll("[data-ts-switch],[data-ts-actions]").forEach(button => button.setAttribute("aria-expanded", "false"));
    };
    document.addEventListener("pointerdown", event => {
      if (!event.target.closest("[data-ts-workspace]")) closeMenus();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeMenus();
        document.querySelector("#ts-module-dialog")?.remove();
      }
    });
    window.addEventListener("popstate", closeMenus);
    document.body.addEventListener("click",async(e)=>{
      const hit=e.target.closest("[data-ts-folder-plus],[data-ts-dialog-cancel],[data-ts-dialog-save],[data-ts-create],[data-ts-list],[data-ts-open],[data-ts-choose],[data-ts-switch],[data-ts-actions],[data-ts-manage],[data-ts-new-folder],[data-ts-add-modules],[data-ts-delete],[data-ts-folder-delete],[data-ts-folder-edit],[data-ts-folder-assign]");
      if(!hit)return;
      e.preventDefault();
      const key=Object.keys(hit.dataset).find(k=>k.startsWith("ts"));if(!key)return;
      if(key==="tsDialogCancel"){document.querySelector("#ts-module-dialog")?.remove();return;}
      if(key==="tsFolderPlus"||key==="tsAddModules"||key==="tsFolderAssign"){openModuleDialog(key==="tsFolderPlus"||key==="tsFolderAssign"?hit.dataset[key]:null);return;}
      if(key==="tsDialogSave"){
        const dlg=document.querySelector("#ts-module-dialog");const active=cache.find(t=>t.id===chosen.id)||cache.find(t=>t.id===editing);
        if(!dlg||!active)return;
        const chosenIds=Array.from(dlg.querySelectorAll('.ts-module-list input:checked')).map(x=>x.value);
        const dest=dlg.querySelector("[data-ts-folder-choice]").value;
        const folders=active.folders.map(f=>({...f,modules:(f.modules||[]).filter(m=>dest===String(f.id)?chosenIds.includes(m):!chosenIds.includes(m))}));
        if(dest){const target=folders.find(f=>String(f.id)===dest);if(!target){toast("Invalid folder","Folder not found","error");return;}target.modules=[...chosenIds];}
        const allModules=[...new Set([...active.modules,...chosenIds])];
        try{await api(`/api/teamspaces/${active.id}`,{method:"PATCH",body:JSON.stringify({modules:allModules,folders})});dlg.remove();editing=active.id;toast("Modules saved","Folder assignments updated");await updateSide();if(location.pathname==="/teamspaces")await navigate("/teamspaces?id="+active.id,true);}
        catch(err){toast("Could not save modules",err.message,"error");}
        return;
      }
      if(key==="tsSwitch"||key==="tsActions"){
        const menu=$(`[data-ts-${key==="tsSwitch"?"switch":"actions"}-menu]`);
        if(menu){const shouldOpen=menu.hidden;closeMenus();menu.hidden=!shouldOpen;hit.setAttribute("aria-expanded",String(shouldOpen));}
        return;
      }
      $$("[data-ts-switch-menu],[data-ts-actions-menu]").forEach(m=>m.hidden=true);
      if(key==="tsCreate")return createWorkspace();
      if(key==="tsList"){editing=null;return navigate("/teamspaces");}
      if(key==="tsOpen"||key==="tsChoose"){editing=chosen.id=Number(hit.dataset[key]);await updateSide();return navigate("/teamspaces?id="+editing);}
      if(key==="tsManage"){editing=chosen.id;return navigate("/teamspaces?id="+editing);}
      if(key==="tsNewFolder")return createFolder();

      const row=cache.find(t=>t.id===editing);if(!row)return;
      if(key==="tsDelete"){if(!(await confirmDialog(`Delete teamspace "${row.name}"? CRM records will not be deleted.`)))return;try{await api(`/api/teamspaces/${row.id}`,{method:"DELETE"});editing=chosen.id=null;toast("Teamspace deleted",row.name);await refresh();}catch(err){toast("Delete failed",err.message,"error");}return;}
      if(key==="tsFolderDelete"||key==="tsFolderEdit"){
        const folder=(row.folders||[]).find(f=>String(f.id)===hit.dataset[key]);if(!folder)return;
        const name=key==="tsFolderEdit"?await promptName("Rename folder",folder.name):null;
        const moduleIds=key==="tsFolderAssign"?await promptName("Enter module IDs for this folder, comma-separated. Available: "+modules.filter(x=>row.modules.includes(x[0])).map(x=>x[0]).join(", "), (folder.modules||[]).join(", ")):null;
        if(key==="tsFolderAssign"&&moduleIds===null)return;
        const assigned=key==="tsFolderAssign"?[...new Set(moduleIds.split(",").map(x=>x.trim()).filter(Boolean))]:[];
        if(key==="tsFolderAssign"&&assigned.some(x=>!row.modules.includes(x))){toast("Invalid modules","Assign modules to the teamspace first","error");return;}
        if(key==="tsFolderEdit"&&(name===null||!name))return;
        if(key==="tsFolderDelete"&&!(await confirmDialog(`Delete folder "${folder.name}"? Assigned modules remain in the teamspace.`)))return;
        const folders=key==="tsFolderEdit"?row.folders.map(f=>f===folder?{...f,name}:f):key==="tsFolderAssign"?row.folders.map(f=>f===folder?{...f,modules:assigned}:f):row.folders.filter(f=>f!==folder);
        try{await api(`/api/teamspaces/${row.id}`,{method:"PATCH",body:JSON.stringify({folders})});toast("Folder updated");await refresh();}catch(err){toast("Folder update failed",err.message,"error");}
      }
    });
    document.body.addEventListener("input",e=>{
      if(!e.target.matches("[data-ts-module-search]"))return;
      const q=e.target.value.toLowerCase().trim();
      document.querySelectorAll("[data-ts-module-row]").forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(q);});
    });
    document.body.addEventListener("submit",async(e)=>{
      if(!e.target.matches("[data-ts-edit-form]"))return;e.preventDefault();
      const row=cache.find(t=>t.id===editing);if(!row)return;
      const form=e.target;const payload={name:form.elements.name.value.trim(),icon:form.elements.icon.value.trim(),description:form.elements.description.value,modules:Array.from(form.querySelectorAll('input[name="module"]:checked')).map(x=>x.value)};
      try{await api(`/api/teamspaces/${row.id}`,{method:"PATCH",body:JSON.stringify(payload)});onSaved();toast("Teamspace saved",payload.name);await updateSide();await navigate("/teamspaces?id="+row.id,true);}catch(err){toast("Save failed",err.message,"error");}
    });
  }
  return {teamspacesView,bindTeamspaces};
}

