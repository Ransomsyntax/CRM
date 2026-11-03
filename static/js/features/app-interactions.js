import { confirmDialog,promptDialog } from "../core/dialogs.js?v=20261027-centered-popups-v1";
// Interaction and Zoho-style layout editor feature module.
// Injects the application runtime explicitly to keep initialization and routing intact.
export function createAppInteractions(ctx) {
  const {openDealForAccount, api, toast, emptyState, refreshMeta, applyProfile, navigate, renderRoute, platformState, bindCustomModuleAdmin, flatSplitPreview, dataIds, openCreateRecord, fetchStandardLayout, orderedFormFields, openRecordModal, openPlatformModal, readForm, deleteRecord, deletePlatformRecord, state, $, $$, esc, titleCase, pathFor, badge, bindModuleFilters, bindContextCreationActions, standardLayouts, bindBlueprintFeature} = ctx;
function layoutEditorPage(resource, config) {
  const fields = orderedFormFields(resource, config.fields || []);
  const catalog = [["text","Single Line"],["multiline","Multi-Line"],["email","Email"],["phone","Phone"],["picklist","Pick List"],["multi_select","Multi-Select"],["date","Date"],["datetime","Date/Time"],["number","Number"],["currency","Currency"],["percentage","Percent"],["checkbox","Checkbox"],["url","URL"],["decimal","Decimal"],["auto_number","Auto-Number"],["lookup","Lookup"],["formula","Formula"],["user","User"],["file","File Upload"],["image","Image Upload"],["subform","Subform"],["richtext","Rich Text"],["radio","Radio Button"],["address","Address"],["long_integer","Long Integer"]];
  const selectedName = localStorage.getItem("convosis-selected-layout:"+resource) || standardLayouts[resource]?.active_layout || "Standard";
  const layoutName = selectedName === "Standard" || standardLayouts[resource]?.named_layouts?.[selectedName] ? selectedName : "Standard";
  const persisted = standardLayouts[resource]?.named_layouts?.[layoutName]?.sections || standardLayouts[resource]?.sections;
  const sections = persisted?.length ? persisted.map(section=>({...section,fields:[...(section.fields || [])]})) : [{id:"information",title:config.singular+" Information",fields:fields.map(f=>f.key)}];
  // Saved sections are authoritative; never restore removed fields automatically.
  const byKey = new Map(fields.map(f=>[f.key,f]));
  const card = f => '<article class="crm-layout-field" draggable="true" data-layout-key="' + esc(f.key) + '"><span class="crm-layout-grip" aria-hidden="true">⋮⋮</span><input class="crm-layout-inline-name" aria-label="Field label" value="' + esc(f.label) + '" data-layout-field-name="' + esc(f.key) + '" /><small class="crm-layout-field-type">' + esc(f.type || "text") + '</small><details class="crm-layout-action"><summary aria-label="Field options">⋯</summary><div class="crm-layout-action-menu"><button type="button" data-layout-action="required">Mark as required</button><button type="button" data-layout-action="properties">Edit Properties</button><button type="button" data-layout-action="permissions">Set Permissions</button><button type="button" data-layout-action="rules">Create Layout Rule</button><button type="button" data-layout-action="validation">Create Validation Rule</button><button type="button" data-layout-action="remove">Remove Field</button></div></details></article>';
  const section = s => '<section class="crm-layout-section" data-layout-section="' + esc(s.id) + '"><header class="crm-layout-section-head"><input aria-label="Section name" value="' + esc(s.title) + '" data-layout-section-title /><button type="button" data-section-delete title="Remove section">⋯</button></header><div class="crm-layout-field-list" data-section-fields>' + (s.fields||[]).map(key=>byKey.get(key)).filter(Boolean).map(card).join("") + '</div></section>';
  return '<div class="crm-layout-editor crm-layout-studio"><header class="module-builder-topbar"><div class="builder-module-title"><strong>' + esc(config.label) + '</strong><label class="crm-layout-name-label">Layout Name <input type="text" required maxlength="100" data-layout-name value="' + esc(layoutName) + '" readonly aria-label="Layout name" /></label></div><div class="builder-top-actions"><button type="button" class="button button-ghost" data-layout-cancel>Cancel</button><button type="button" class="button button-ghost" data-layout-save-close>Save and Close</button><button type="button" class="button button-primary" data-layout-save>Save</button></div></header>' +
    '<div class="crm-layout-workspace"><aside class="crm-layout-palette"><h3>New Fields</h3><p>Drag fields into the layout</p><div class="crm-layout-palette-grid">' + catalog.map(([type,label])=>'<button type="button" draggable="true" class="crm-layout-palette-item" data-palette-type="'+type+'">'+esc(label)+'</button>').join("")+'</div><button type="button" class="crm-layout-palette-item crm-layout-add-section" draggable="true" data-palette-type="section">▤ NEW SECTION</button></aside>' +
    '<main class="crm-layout-canvas"><nav class="crm-layout-tabs" aria-label="Layout preview"><button class="active" type="button" data-layout-tab="create">Create</button><button type="button" data-layout-tab="quick">Quick Create</button><button type="button" data-layout-tab="detail">Detail View</button></nav><div class="crm-layout-form-head"><h2>Create '+esc(config.singular)+'</h2><p>Click a field name to rename it; drag fields between sections.</p></div><div data-layout-sections>'+sections.map(section).join("")+'</div><div class="crm-layout-inline-editor" data-layout-properties hidden><h3>Field properties</h3><label>Field label<input data-property-label /></label><label>Pick list options (one per line)<textarea data-property-options></textarea></label><button class="button button-primary" type="button" data-property-save>Apply</button><button type="button" class="button" data-property-cancel>Cancel</button></div></main></div></div>';
}

function bindLayoutEditor(resource, config) {
  const back = () => navigate("/" + resource + "/create");
  const root = $(".crm-layout-editor"), sections = root?.querySelector("[data-layout-sections]");
  if (!root || !sections) return;
  const known = new Map(orderedFormFields(resource, config.fields || []).map(f=>[f.key,{...f}]));
  const saveField = async (key, changes) => {
    const field = known.get(key);
    if (!field) return;
    if (!field.custom) {
      toast("System field", "Built-in field names and validation are managed by their module.", "error");
      return;
    }
    const updated = await api("/api/admin/standard-layout/"+resource+"/fields/"+field.id,{method:"PATCH",body:JSON.stringify(changes)});
    Object.assign(field,updated);
    await fetchStandardLayout(resource);
    toast("Field updated",updated.label);
  };
  const inlineEditor = root.querySelector("[data-layout-properties]");
  let preferredZone = sections.querySelector("[data-section-fields]");
  let activeField = null;
  const openProperties = key => {
    activeField = key;
    const f=known.get(key);
    inlineEditor.hidden=false;
    inlineEditor.querySelector("[data-property-label]").value=f.label;
    inlineEditor.querySelector("[data-property-options]").value=(f.options||[]).join("\n");
    inlineEditor.querySelector("[data-property-options]").parentElement.hidden= !["picklist","multi_select"].includes(f.type);
    inlineEditor.scrollIntoView({block:"nearest",behavior:"smooth"});
  };
  root.querySelector("[data-property-cancel]").addEventListener("click",()=>inlineEditor.hidden=true);
  root.querySelector("[data-property-save]").addEventListener("click",async()=>{
    if (!activeField)return;
    const label=inlineEditor.querySelector("[data-property-label]").value.trim();
    if(!label)return toast("Field label required","","error");
    const field=known.get(activeField), payload={label};
    if(["picklist","multi_select"].includes(field.type))payload.options=inlineEditor.querySelector("[data-property-options]").value.split("\n").map(v=>v.trim()).filter(Boolean);
    try {await saveField(activeField,payload);root.querySelectorAll("[data-layout-field-name]").forEach(i=>{if(i.dataset.layoutFieldName===activeField)i.value=label;});inlineEditor.hidden=true;}catch(e){toast("Field update failed",e.message,"error");}
  });
  root.querySelector("[data-layout-cancel]").addEventListener("click",back);
  root.querySelectorAll("[data-layout-tab]").forEach(tab=>tab.addEventListener("click",()=>{root.querySelectorAll("[data-layout-tab]").forEach(t=>t.classList.toggle("active",t===tab));}));
  const addSection = () => {
    const id="section_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7);
    const el=document.createElement("section");el.className="crm-layout-section";el.dataset.layoutSection=id;
    el.innerHTML='<header class="crm-layout-section-head"><input aria-label="Section name" value="New Section" data-layout-section-title /><button type="button" data-section-delete title="Remove section">⋯</button></header><div class="crm-layout-field-list" data-section-fields></div>';
    sections.appendChild(el);
    el.querySelector("input").focus();el.querySelector("input").select();
  };
  root.querySelectorAll("[data-palette-type]").forEach(button=>{
    button.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/x-convosis-field-type",button.dataset.paletteType);e.dataTransfer.effectAllowed="copy";});
    button.addEventListener("click",()=>{if(button.dataset.paletteType==="section")addSection();else openNewField(button.dataset.paletteType);});
  });
  let pendingType=null;
  const openNewField = async (type, dropZone = null) => {
    if(type==="section")return addSection();
    const supported = new Set(["text","multiline","email","phone","picklist","multi_select","date","datetime","number","currency","percentage","checkbox","url","decimal","auto_number","lookup","formula","user","file","image","subform","richtext","radio","address","long_integer"]);
    if(!supported.has(type))return toast("Unsupported field type",type,"error");
    const count=[...known.values()].filter(f=>f.custom && f.type===type).length + 1;
    const label=({text:"Single Line",multiline:"Multi-Line",picklist:"Pick List",multi_select:"Multi-Select",checkbox:"Checkbox",auto_number:"Auto-Number",richtext:"Rich Text"}[type] || type.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()))+" "+count;
    const key="custom_"+type+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,6);
    try {
      const field=await api("/api/admin/standard-layout/"+resource+"/fields",{method:"POST",body:JSON.stringify({label,key,type,options:[]})});
      known.set(field.key,{...field,custom:true});
      const target=dropZone || preferredZone || sections.querySelector("[data-section-fields]");
      const div=document.createElement("article");div.className="crm-layout-field";div.draggable=true;div.dataset.layoutKey=field.key;
      div.innerHTML='<span class="crm-layout-grip">⋮⋮</span><input aria-label="Field label" class="crm-layout-inline-name" data-layout-field-name="'+esc(field.key)+'" value="'+esc(field.label)+'"/><small class="crm-layout-field-type">'+esc(field.type)+'</small><details class="crm-layout-action"><summary aria-label="Field options">⋯</summary><div class="crm-layout-action-menu"><button type="button" data-layout-action="required">Mark as required</button><button type="button" data-layout-action="properties">Edit Properties</button><button type="button" data-layout-action="remove">Remove Field</button></div></details>';
      target.appendChild(div);
      await fetchStandardLayout(resource);
      const name=div.querySelector("[data-layout-field-name]");name.focus();name.select();
      toast("Field added","Rename it directly in the layout.");
    }catch(e){toast("Field creation failed",e.message,"error");}
  };
  sections.addEventListener("change",async e=>{
    const input=e.target.closest("[data-layout-field-name]");if(!input)return;
    const field=known.get(input.dataset.layoutFieldName);if(!field || input.value.trim()===field.label)return;
    try{await saveField(field.key,{label:input.value.trim()});}catch(error){input.value=field.label;toast("Rename failed",error.message,"error");}
  });
  sections.addEventListener("click",async e=>{
    const removeSection=e.target.closest("[data-section-delete]");
    if(removeSection){
      const section=removeSection.closest("[data-layout-section]");
      if(sections.children.length===1)return toast("Keep one section","","error");
      sections.firstElementChild.querySelector("[data-section-fields]").append(...section.querySelectorAll("[data-layout-key]"));
      section.remove();return;
    }
    const action=e.target.closest("[data-layout-action]");if(!action)return;
    const item=action.closest("[data-layout-key]"),key=item?.dataset.layoutKey,field=known.get(key);
    if(!field)return;
    if(action.dataset.layoutAction==="properties")return openProperties(key);
    if(action.dataset.layoutAction==="remove"){if(!field.custom)return toast("System field","System fields cannot be removed","error");item.remove();return;}
    if(action.dataset.layoutAction==="required"){
      try{await saveField(key,{required:!field.required});action.textContent=field.required?"Mark as optional":"Mark as required";}catch(err){toast("Update failed",err.message,"error");}
      return;
    }
    toast("Not configured","This rule requires a separate automation or security setup screen.");
  });
  let moving=null;
  sections.addEventListener("dragstart",e=>{moving=e.target.closest("[data-layout-key]");if(moving){e.dataTransfer.setData("text/x-convosis-layout-key",moving.dataset.layoutKey);e.dataTransfer.effectAllowed="move";}});
  sections.addEventListener("dragover",e=>{const zone=e.target.closest("[data-section-fields]") || e.target.closest("[data-layout-section]")?.querySelector("[data-section-fields]");if(zone){e.preventDefault();sections.querySelectorAll(".drag-target").forEach(el=>el.classList.remove("drag-target"));zone.classList.add("drag-target");zone.closest("[data-layout-section]")?.classList.add("drag-target");}});
  sections.addEventListener("dragleave",e=>{if(!sections.contains(e.relatedTarget))sections.querySelectorAll(".drag-target").forEach(el=>el.classList.remove("drag-target"));});
  sections.addEventListener("drop",e=>{
    const zone=e.target.closest("[data-section-fields]") || e.target.closest("[data-layout-section]")?.querySelector("[data-section-fields]");if(!zone)return;
    sections.querySelectorAll(".drag-target").forEach(el=>el.classList.remove("drag-target"));
    e.preventDefault();
    const type=e.dataTransfer.getData("text/x-convosis-field-type");
    if(type){if(type==="section")addSection();else openNewField(type,zone);return;}
    if(!moving)return;
    const target=e.target.closest("[data-layout-key]");
    if(target && target!==moving)zone.insertBefore(moving,target);
    else zone.appendChild(moving);
    moving=null;
  });
  sections.addEventListener("dragend",()=>moving=null);
  const save=async close=>{
    const data=[...sections.querySelectorAll("[data-layout-section]")].map(s=>({id:s.dataset.layoutSection,title:s.querySelector("[data-layout-section-title]").value.trim(),fields:[...s.querySelectorAll("[data-layout-key]")].map(f=>f.dataset.layoutKey)}));
    if(data.some(s=>!s.title))return toast("Section name required","","error");
    const name=root.querySelector("[data-layout-name]").value.trim();
    if(!name){root.querySelector("[data-layout-name]").focus();return toast("Layout name required","Enter a name before saving.","error");}
    try{
      await api("/api/admin/standard-layout/"+resource+"/named",{method:"PUT",body:JSON.stringify({name,sections:data,mode:"edit"})});
      await fetchStandardLayout(resource);toast("Layout saved","Sections and field positions saved.");
      if(close)back();
    }catch(err){toast("Layout save failed",err.message,"error");}
  };
  root.querySelector("[data-layout-save]").addEventListener("click",()=>save(false));
  root.querySelector("[data-layout-save-close]").addEventListener("click",()=>save(true));
}

function syncSelection(current, platform = false) {
  if (!current) return;
  const rows = $$(platform ? '[data-platform-select-record]' : '[data-select-record]');
  rows.forEach(input => { input.checked = current.selectedIds.includes(Number(input.dataset.id)); });
  const all = $(platform ? '[data-platform-select-all]' : '[data-select-all]');
  if (all) {
    const selected = rows.filter(input => input.checked).length;
    all.checked = rows.length > 0 && selected === rows.length;
    all.indeterminate = selected > 0 && selected < rows.length;
  }
  const count = current.selectedIds.length;
  const bulk = $(platform ? '[data-platform-bulk-delete]' : '[data-bulk-delete]');
  if (bulk) { bulk.disabled = !count; bulk.textContent = platform ? `Delete selected (${count})` : `Delete selected${count ? ` (${count})` : ''}`; }
  const clear = $('[data-clear-selection]');
  if (clear) clear.disabled = !count;
  const accountDeal = $('[data-selected-account-deal]');
  if (accountDeal) { accountDeal.disabled = count !== 1; accountDeal.textContent = `Convert to Deal${count === 1 ? ' (1 selected)' : ''}`; }
}

function bindPlatform(resource) {
  if (["personal_settings", "users", "approval_processes", "blueprints", "search_setup", "customize_setup"].includes(resource)) bindSettings();
  $$('[data-platform-create]').forEach((button) => button.addEventListener("click", () => openPlatformModal(button.dataset.platformCreate)));
  $$('[data-platform-open]').forEach(button => button.addEventListener("click", () => navigate(`/${button.dataset.platformOpen}/${Number(button.dataset.id)}`)));
  $$('[data-platform-edit]').forEach((button) => button.addEventListener("click", () => navigate("/" + button.dataset.platformEdit + "/edit/" + encodeURIComponent(button.dataset.id))));
  $$('[data-platform-delete]').forEach((button) => button.addEventListener("click", () => deletePlatformRecord(button.dataset.platformDelete, Number(button.dataset.id))));
  const current = state.platformCatalog.resources[resource] ? platformState(resource) : null;
  $$('[data-platform-select-record]').forEach(input => input.addEventListener("change", event => {
    const id = Number(input.dataset.id);
    current.selectedIds = event.target.checked ? [...new Set([...current.selectedIds, id])] : current.selectedIds.filter(value => value !== id);
    syncSelection(current, true);
  }));
  $('[data-platform-select-all]')?.addEventListener("change", event => {
    const ids = $$('[data-platform-select-record]').map(el => Number(el.dataset.id));
    current.selectedIds = event.target.checked ? [...new Set([...current.selectedIds, ...ids])] : current.selectedIds.filter(id => !ids.includes(id));
    syncSelection(current, true);
  });
  syncSelection(current, true);
  $('[data-platform-bulk-delete]')?.addEventListener("click",async()=>{
    if (!current.selectedIds.length || !(await confirmDialog("Move selected records to the 30-day Recycle Bin?"))) return;
    try {
      const result=await api("/api/administration/bulk-delete",{method:"POST",body:JSON.stringify({resource,ids:current.selectedIds})});
      current.selectedIds=[];
      toast("Records deleted",result.deleted+" records moved to Recycle Bin.");
      await renderRoute();
    } catch(error){toast("Bulk delete failed",error.message,"error");}
  });
  let timer;
  (function () {
    const input = $('[data-platform-search]');
    input?.addEventListener('input', (event) => {
      clearTimeout(timer);
      const value = event.currentTarget.value;
      current.search = value;
      current.offset = 0;
      timer = setTimeout(async () => {
        await renderRoute();
        const replacement = $('[data-platform-search]');
        if (replacement && document.activeElement !== replacement) {
          replacement.focus({preventScroll:true});
          const pos = Math.min(value.length, replacement.value.length);
          replacement.setSelectionRange?.(pos, pos);
        }
      }, 320);
    });
  })();
  $('[data-platform-status]')?.addEventListener("change", (event) => { current.status = event.target.value; current.offset = 0; renderRoute(); });
  $('[data-platform-owner]')?.addEventListener("change", (event) => { current.owner_id = event.target.value; current.offset = 0; renderRoute(); });
  $('[data-platform-sort]')?.addEventListener("change", (event) => { current.sort = event.target.value; current.offset = 0; renderRoute(); });
  $$('[data-page]').forEach((button) => button.addEventListener("click", () => { if (!current) return; current.offset += button.dataset.page === "next" ? 25 : -25; renderRoute(); }));
  const recycleSelection = () => $$('[data-recycle-select]:checked').map(el=>({resource:el.dataset.resource,id:Number(el.dataset.id)}));
  function syncRecycleButtons() {
    const checked=recycleSelection();
    const all=$('[data-recycle-select-all]');
    const rows=$$('[data-recycle-select]');
    if(all) { all.checked=rows.length>0 && checked.length===rows.length; all.indeterminate=checked.length>0 && checked.length<rows.length; }
    const restore=$('[data-recycle-restore-selected]');
    const permanent=$('[data-recycle-permanent-selected]');
    if(restore) restore.disabled=!checked.length;
    if(permanent) permanent.disabled=!checked.length;
  }
  $$('[data-recycle-select]').forEach(el=>el.addEventListener('change',syncRecycleButtons));
  $('[data-recycle-select-all]')?.addEventListener('change',event=>{
    $$('[data-recycle-select]').forEach(el=>{el.checked=event.target.checked;});
    syncRecycleButtons();
  });
  async function recycleBatch(restore) {
    const entries=recycleSelection();
    if(!entries.length)return;
    if(!restore && !(await confirmDialog("Permanently delete selected records? This cannot be undone.")))return;
    const grouped={};
    for(const item of entries)(grouped[item.resource]??=[]).push(item.id);
    try{
      for(const [resource,ids] of Object.entries(grouped)){
        await api(restore?'/api/administration/recycle-bin/bulk-restore':'/api/administration/recycle-bin/permanent-delete',{
          method:'POST',body:JSON.stringify({resource,ids})
        });
      }
      toast(restore?'Records restored':'Records permanently deleted',entries.length+' records processed.');
      await renderRoute();
    }catch(error){toast('Recycle Bin operation failed',error.message,'error');}
  }
  $('[data-recycle-restore-selected]')?.addEventListener('click',()=>recycleBatch(true));
  $('[data-recycle-permanent-selected]')?.addEventListener('click',()=>recycleBatch(false));
  $$('[data-recycle-permanent]').forEach(button=>button.addEventListener('click',async()=>{
    if(!(await confirmDialog('Permanently delete this record? This cannot be undone.')))return;
    try{
      await api('/api/administration/recycle-bin/permanent-delete',{method:'POST',body:JSON.stringify({resource:button.dataset.resource,ids:[Number(button.dataset.id)]})});
      toast('Record permanently deleted');await renderRoute();
    }catch(error){toast('Permanent delete failed',error.message,'error');}
  }));
  $('[data-recycle-purge-expired]')?.addEventListener('click',async()=>{
    try{
      const result=await api('/api/administration/recycle-bin/purge-expired',{method:'POST'});
      toast('Cleanup finished',result.purged+' expired records purged.');
      await renderRoute();
    }catch(error){toast('Cleanup failed',error.message,'error');}
  });
  $$('[data-restore-resource]').forEach((button) => button.addEventListener("click", async () => { try { await api("/api/administration/restore", { method: "POST", body: JSON.stringify({ resource: button.dataset.restoreResource, record_id: Number(button.dataset.id) }) }); toast("Record restored"); await renderRoute(); } catch (error) { toast("Could not restore record", error.message, "error"); } }));
  $('[data-import-form]')?.addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; const file = form.querySelector('[name="file"]').files[0]; if (!file) return; const body = new FormData(); body.append("file", file); try { const response = await fetch(`/api/import/${form.elements.resource.value}`, { method: "POST", body }); const result = await response.json(); if (!response.ok) throw new Error(result.detail || "Import failed"); toast("Import complete", `${result.imported} rows imported; ${result.errors.length} errors.`); form.reset(); } catch (error) { toast("Could not import CSV", error.message, "error"); } });
  $('[data-duplicate-form]')?.addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; const target = $('[data-duplicate-results]'); try { const result = await api(`/api/administration/duplicates?resource=${encodeURIComponent(form.elements.resource.value)}`); target.innerHTML = result.groups.length ? result.groups.map((group) => `<div class="rule-row"><div class="rule-info"><strong>${esc(group.value)}</strong><small>${group.count} records match on ${esc(group.match_on)}</small></div>${badge("Review")}</div>`).join("") : emptyState("✓", "No duplicates found", "No exact normalized matches were detected."); } catch (error) { toast("Duplicate scan failed", error.message, "error"); } });
}

function bindModule(resource) {
  const current = state.moduleState[resource];
  bindModuleFilters({resource, current, renderRoute, toast});
  $$("[data-start-import]").forEach(button => button.addEventListener("click", () => navigate("/import/" + button.dataset.startImport)));
  $$('[data-create]').forEach((button) => button.addEventListener("click", () => openCreateRecord(button.dataset.create, button.dataset.activityType ? { activity_type: button.dataset.activityType } : {})));
  $$('[data-open-record]').forEach((button) => button.addEventListener("click", () => navigate(pathFor(button.dataset.openRecord, button.dataset.id))));
  const splitRoot = $(".module-split-flat");
  splitRoot?.addEventListener("click", event => {
    const open = event.target.closest("[data-split-open]");
    if (open) { navigate(pathFor(open.dataset.splitOpen, open.dataset.id)); return; }
    const button = event.target.closest("[data-split-select]");
    if (!button) return;
    const record = current.splitRows?.find(row => String(row.id) === button.dataset.id);
    if (!record) return;
    current.splitSelectedId = record.id;
    $$("[data-split-select]", splitRoot).forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    const preview = $("[data-split-preview]", splitRoot);
    if (preview) preview.innerHTML = flatSplitPreview(resource, record);
  });
  bindContextCreationActions();
  $("[data-selected-account-deal]")?.addEventListener("click", () => {
    if (current.selectedIds.length === 1) openDealForAccount(current.selectedIds[0]);
  });
  $$('[data-edit-record]').forEach((button) => button.addEventListener("click", () => navigate("/" + button.dataset.editRecord + "/edit/" + encodeURIComponent(button.dataset.id))));
  $$('[data-delete-record]').forEach((button) => button.addEventListener("click", () => deleteRecord(button.dataset.deleteRecord, Number(button.dataset.id))));
  const search = $("[data-module-search]");
  let searchTimer;
  (function () {
    const input = $('[data-module-search]');
    input?.addEventListener('input', (event) => {
      clearTimeout(searchTimer);
      const value = event.currentTarget.value;
      current.search = value;
      current.offset = 0;
      searchTimer = setTimeout(async () => {
        await renderRoute();
        const replacement = $('[data-module-search]');
        if (replacement && document.activeElement !== replacement) {
          replacement.focus({preventScroll:true});
          const pos = Math.min(value.length, replacement.value.length);
          replacement.setSelectionRange?.(pos, pos);
        }
      }, 320);
    });
  })();
  $("[data-module-status]")?.addEventListener("change", (event) => { current.status = event.target.value; current.offset = 0; renderRoute(); });
  $("[data-module-owner]")?.addEventListener("change", (event) => { current.owner_id = event.target.value; current.offset = 0; renderRoute(); });
  $("[data-module-sort]")?.addEventListener("change", (event) => { current.sort = event.target.value; current.offset = 0; renderRoute(); });
  $$('[data-deal-filter]').forEach(input => {
    let timer;
    const apply = () => {
      clearTimeout(timer);
      if (!input.isConnected) return;
      current[input.dataset.dealFilter] = input.value;
      current.offset = 0;
      renderRoute();
    };
    input.addEventListener("input", () => {
      current[input.dataset.dealFilter] = input.value;
      clearTimeout(timer);
      timer = setTimeout(apply, 350);
    });
    input.addEventListener("change", apply);
  });
  $$('[data-open-record][role="button"]').forEach(card => card.addEventListener("keydown", event => {
    if (event.target === card && ["Enter", " "].includes(event.key)) { event.preventDefault(); card.click(); }
  }));
  $("[data-clear-filters]")?.addEventListener("click", () => { Object.assign(current, { search: "", status: "", owner_id: "", sort: "created_desc", min_amount: "", max_amount: "", close_from: "", close_to: "", offset: 0, advancedFilters: {join:"all", rules:[]}, selectedIds: [] }); renderRoute(); });
  $$('[data-select-record]').forEach(input => input.addEventListener("change", event => {
    const id = Number(event.target.dataset.id);
    current.selectedIds = event.target.checked ? [...new Set([...current.selectedIds, id])] : current.selectedIds.filter(selected => selected !== id);
    syncSelection(current);
  }));
  $('[data-clear-selection]')?.addEventListener("click", () => { current.selectedIds = []; syncSelection(current); });
  $('[data-select-all]')?.addEventListener("change", event => {
    const displayed = dataIds(resource);
    current.selectedIds = event.target.checked ? [...new Set([...current.selectedIds, ...displayed])] : current.selectedIds.filter(id => !displayed.includes(id));
    syncSelection(current);
  });
  syncSelection(current);
  $("[data-bulk-delete]")?.addEventListener("click", async () => {
    if (!current.selectedIds.length || !(await confirmDialog("Move selected records to Recycle Bin for 30 days?"))) return;
    try {
      const result = await api("/api/administration/bulk-delete",{method:"POST",body:JSON.stringify({resource,ids:current.selectedIds})});
      current.selectedIds=[];
      toast("Records deleted",result.deleted+" records moved to Recycle Bin.");
      await renderRoute();
    } catch(error) {toast("Bulk delete failed",error.message,"error");}
  });
  $$('[data-toggle-view]').forEach((button) => button.addEventListener("click", () => { current.view = button.dataset.toggleView; renderRoute(); }));
  $$('[data-complete-activity]').forEach((button) => button.addEventListener("click", async () => { try { await api(`/api/activities/${button.dataset.completeActivity}`, { method: "PATCH", body: JSON.stringify({ status: "Completed" }) }); toast("Activity completed", "Nice work — it has been marked as done."); await renderRoute(); } catch (error) { toast("Could not update activity", error.message, "error"); } }));
  $$('[data-page]').forEach((button) => button.addEventListener("click", () => { current.offset += button.dataset.page === "next" ? 25 : -25; renderRoute(); }));
}

function bindSettings() {
  bindCustomModuleAdmin();
  bindBlueprintFeature?.();
  const setupSearch = $('[data-setup-search-input]');
  setupSearch?.addEventListener('input', () => {
    const query = setupSearch.value.trim().toLocaleLowerCase();
    let matches = 0;
    $$('.settings-nav [data-setup-group]').forEach(group => {
      let groupMatches = 0;
      $$('a[href^="/setup/"]', group).forEach(link => {
        const visible = !query || link.textContent.toLocaleLowerCase().includes(query);
        link.hidden = !visible;
        link.style.display = visible ? '' : 'none';
        if (visible) { groupMatches++; matches++; }
      });
      const show = !query || groupMatches > 0;
      group.hidden = !show;
      group.style.display = show ? '' : 'none';
    });
    $$('.settings-nav .setup-quick-actions a').forEach(link => {
      const show = !query || link.textContent.toLocaleLowerCase().includes(query);
      link.hidden = !show;
      link.style.display = show ? '' : 'none';
      if (show) matches++;
    });
    $$('.setup-search-item').forEach(item => {
      const show = !query || (item.dataset.searchText || item.textContent || '').toLocaleLowerCase().includes(query);
      item.hidden = !show;
      item.style.display = show ? '' : 'none';
    });
    $$('.setup-search-group').forEach(group => {
      const show = !query || $$('[data-search-text]', group).some(item => !item.hidden);
      group.hidden = !show;
      group.style.display = show ? '' : 'none';
    });
    let feedback = $('[data-setup-search-feedback]');
    if (!feedback) {
      feedback = document.createElement('p');
      feedback.dataset.setupSearchFeedback = 'true';
      feedback.setAttribute('role','status');
      feedback.className = 'setup-search-feedback';
      setupSearch.closest('.setup-toolbar')?.appendChild(feedback);
    }
    if (feedback) {
      feedback.hidden = !query;
      feedback.textContent = query ? (matches ? matches + ' matching Setup option' + (matches === 1 ? '' : 's') + ' in the navigation' : 'No matching Setup options') : '';
    }
    const count = $('[data-setup-search-count]');
    if (count) count.textContent = matches + ' matching Setup options';
  });
  $('[data-setup-import-selector]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = event.currentTarget.elements.resource.value;
    if (!["leads", "deals", "accounts", "contacts"].includes(selected)) {
      toast("Unsupported module", "Choose Leads, Deals, Accounts or Contacts.", "error");
      return;
    }
    navigate("/import/" + selected);
  });
  $('[data-customize-setup-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const hidden_groups = $$('[data-setup-group-visible]', form).filter((input) => !input.checked).map((input) => input.dataset.setupGroupVisible);
    const hidden_items = $$('[data-setup-item-visible]', form).filter((input) => !input.checked).map((input) => input.dataset.setupItemVisible);
    const payload = {name:'Default Setup Navigation', hidden_groups, hidden_items, group_order:Object.keys(state.platformCatalog.setup_navigation || {})};
    try {
      const id = form.dataset.prefId;
      await api(`/api/platform/setup_preferences${id ? `/${id}` : ''}`, {method:id ? 'PATCH' : 'POST', body:JSON.stringify(payload)});
      localStorage.setItem('yash.setup.hidden_groups', JSON.stringify(hidden_groups));
      localStorage.setItem('yash.setup.hidden_items', JSON.stringify(hidden_items));
      toast('Setup navigation saved', 'Visibility preferences were saved without deleting configuration.'); await renderRoute();
    } catch (error) { toast('Could not save Setup navigation', error.message, 'error'); }
  });
  $$('[data-create]').forEach((button) => button.addEventListener("click", () => openRecordModal(button.dataset.create)));
  $$('[data-run-workflow]').forEach((button) => button.addEventListener("click", async () => { button.disabled = true; try { await api(`/api/automation/executions/${button.dataset.runWorkflow}/run`, { method: "POST" }); toast("Workflow executed", "The queued actions completed successfully."); await renderRoute(); } catch (error) { button.disabled = false; toast("Workflow failed", error.message, "error"); } }));
  $$('[data-approval-action]').forEach((button) => button.addEventListener("click", async () => { const action = button.dataset.approvalAction; try { if (action === "delegate") { const delegateTo = (await promptDialog("Delegate to active user ID:")); if (!delegateTo) return; await api(`/api/approvals/requests/${button.dataset.approvalId}/delegate`, { method: "POST", body: JSON.stringify({ delegate_to: Number(delegateTo) }) }); toast("Approval delegated", `Approval #${button.dataset.approvalId} was delegated.`); } else { const answer = await promptDialog(`${titleCase(action)} comment (optional):`); if(answer === null) return; const comment = answer || undefined; await api(`/api/approvals/requests/${button.dataset.approvalId}/${action}`, { method: "POST", body: JSON.stringify({ comment }) }); toast(`Approval ${action}d`, `Approval #${button.dataset.approvalId} was updated.`); } await renderRoute(); } catch (error) { toast("Approval action failed", error.message, "error"); } }));
  $$('[data-edit-record]').forEach((button) => button.addEventListener("click", () => navigate("/" + button.dataset.editRecord + "/edit/" + encodeURIComponent(button.dataset.id))));
  $$('[data-delete-record]').forEach((button) => button.addEventListener("click", () => deleteRecord(button.dataset.deleteRecord, Number(button.dataset.id))));
  $$('[data-platform-create]').forEach((button) => button.addEventListener("click", () => openPlatformModal(button.dataset.platformCreate)));
  $$('[data-platform-edit]').forEach((button) => button.addEventListener("click", () => navigate("/" + button.dataset.platformEdit + "/edit/" + encodeURIComponent(button.dataset.id))));
  $$('[data-platform-delete]').forEach((button) => button.addEventListener("click", () => deletePlatformRecord(button.dataset.platformDelete, Number(button.dataset.id))));
  $$('[data-setting-toggle]').forEach((button) => button.addEventListener("click", () => button.classList.toggle("on")));
  $$('[data-toggle-user]').forEach((button) => button.addEventListener("click", async () => { try { const status = button.dataset.status === "Active" ? "Inactive" : "Active"; await api(`/api/users/${button.dataset.toggleUser}`, { method: "PATCH", body: JSON.stringify({ status }) }); await refreshMeta(); toast("User status updated", `${status} user`); await renderRoute(); } catch (error) { toast("Could not update user", error.message, "error"); } }));
  $$('[data-toggle-blueprint]').forEach((button) => button.addEventListener("click", async () => { try { const active = button.dataset.active !== "true"; await api(`/api/blueprints/${button.dataset.toggleBlueprint}`, { method: "PATCH", body: JSON.stringify({ active }) }); toast("Blueprint updated", active ? "Blueprint is active" : "Blueprint is inactive"); await renderRoute(); } catch (error) { toast("Could not update blueprint", error.message, "error"); } }));
  $$('[data-settings-form]').forEach((form) => form.addEventListener("submit", async (event) => { event.preventDefault(); const kind = form.dataset.settingsForm; try { if (kind === "general") { const data = readForm(form); data.notifications = {}; $$('[data-setting-toggle]', form).forEach((toggle) => { data.notifications[toggle.dataset.settingToggle] = toggle.classList.contains("on"); }); await api("/api/settings/general", { method: "PUT", body: JSON.stringify(data) }); state.settingsCache = { ...state.settingsCache, ...data }; toast("Settings saved", "Your workspace defaults are up to date."); } else { state.profile = await api("/api/settings/profile", { method: "PUT", body: JSON.stringify(readForm(form)) }); applyProfile(); await refreshMeta(); toast("Profile saved", "Your profile details have been updated."); } } catch (error) { toast("Could not save settings", error.message, "error"); } }));
}

  return { layoutEditorPage, bindLayoutEditor, bindPlatform, bindModule, bindSettings };
}


