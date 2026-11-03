(()=>{
"use strict";
const crmDialogService = () => import("/static/js/core/dialogs.js?v=20261027-centered-popups-v1");
const alertDialog = async (...args) => (await crmDialogService()).alertDialog(...args);
const confirmDialog = async (...args) => (await crmDialogService()).confirmDialog(...args);

const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const style=document.createElement("style");
style.textContent='.zw{background:white!important;color:#182b48!important;border:1px solid #dce2ef;border-radius:11px;padding:0 25px 35px;min-height:620px}.zw *{box-sizing:border-box}.zw-tabs{display:flex;gap:30px;border-bottom:1px solid #dce1ee;padding:17px 0;font-weight:600}.zw-tabs span:first-child{border-bottom:3px solid #5366f0;padding-bottom:16px}.zw-toolbar{display:flex;gap:12px;align-items:center;padding:24px 0;flex-wrap:wrap}.zw-toolbar h2{color:#132746;margin:0}.zw-grow{flex:1}.zw button,.zw select{cursor:pointer;padding:8px 12px;background:white;color:#27446d;border:1px solid #cbd4e5;border-radius:5px}.zw button.zw-main{color:white;background:#315ee5}.zw-metrics{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d9e2ef;border-radius:8px;margin:0 0 22px;overflow:hidden}.zw-metrics div{padding:22px;background:linear-gradient(170deg,white,#eaf3ff);border-right:1px solid #dce1eb}.zw-metrics strong{display:block;font-size:24px;margin-top:9px}.zw table{width:100%;border-collapse:collapse}.zw th,.zw td{color:#253a58!important;border-bottom:1px solid #e3e7ee;text-align:left;padding:14px 8px}.zw th{background:#f6f8fc}.zw a{color:#315ee9}.zw-actions{display:flex;flex-wrap:wrap;gap:6px}.zw-actions button{font-size:12px;padding:6px 8px}.zw-status{color:#12a571}.zw-dialog-bg{position:fixed;inset:0;z-index:99999;background:#17213790;display:grid;place-items:center;padding:20px}.zw-dialog{width:min(750px,95vw);background:white;color:#182b48;border-radius:12px;padding:30px}.zw-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.zw-stats div{padding:16px;border:1px solid #ccd6eb;border-radius:7px}.zw-stats strong{display:block;font-size:28px;color:#9179dc;margin:14px 0}@media(max-width:800px){.zw-metrics,.zw-stats{grid-template-columns:1fr}.zw table{font-size:12px}}body:has(.zfw-shell) .field:has(textarea[name="hidden_fields"]),body:has(.zfw-shell) .field:has(textarea[name="defaults"]),body:has(.zfw-shell) .field:has(textarea[name="assignment"]),body:has(.zfw-shell) .field:has(textarea[name="autoresponse"]),body:has(.zfw-shell) .field:has(textarea[name="embed_code"]){display:none!important}body:has(.zfw-shell) .zfw-shell{width:100%!important;max-width:none!important}';
style.textContent += "\n/* Dashboard and analytics inherit CRM theme without light-on-dark collisions. */\nhtml[data-crm-theme=\"dark\"] .zw,\nhtml[data-crm-theme=\"dark\"] .zw-dialog,\nhtml[data-crm-theme=\"dark\"] .zwa {background:#1b2738!important;color:#edf3ff!important;border-color:#40536d!important}\nhtml[data-crm-theme=\"dark\"] .zw :is(h2,h3,th,td,strong,small,label),\nhtml[data-crm-theme=\"dark\"] .zwa :is(h2,h3,th,td,strong,small,label,p,span) {color:#e8f0ff!important}\nhtml[data-crm-theme=\"dark\"] .zw :is(.zw-tabs,.zw-metrics,.zw-metrics div,.zw th,.zw td,.zw-stats div),\nhtml[data-crm-theme=\"dark\"] .zwa :is(.zwa-panel,.zwa-metric,.zwa-head,.zwa-tabs,.zwa-total) {background:#1b2738!important;color:#edf3ff!important;border-color:#40536d!important}\nhtml[data-crm-theme=\"dark\"] .zw .zw-metrics div {background:linear-gradient(170deg,#223349,#1b2738)!important}\nhtml[data-crm-theme=\"dark\"] .zw :is(button,select),\nhtml[data-crm-theme=\"dark\"] .zw-dialog :is(button,select,input),\nhtml[data-crm-theme=\"dark\"] .zwa :is(button,select,input) {background:#18283e!important;color:#eaf1ff!important;border:1px solid #506684!important}\nhtml[data-crm-theme=\"dark\"] .zw select option,\nhtml[data-crm-theme=\"dark\"] .zwa select option {background:#18283e!important;color:#eaf1ff!important}\nhtml[data-crm-theme=\"dark\"] .zw button.zw-main {background:#315ee5!important;color:#fff!important;border-color:#315ee5!important}\nhtml[data-crm-theme=\"dark\"] .zw :is(a,.zw-tabs span:first-child) {color:#9bbcff!important}\nhtml[data-crm-theme=\"dark\"] .zw tbody tr:hover td {background:#263a54!important}\n";
style.textContent += "\n/* Unified Webforms dark surfaces: override legacy forced light declarations. */\nhtml[data-crm-theme=\"dark\"] .zw{background:#172438!important;color:#eaf2ff!important;border-color:#334866!important}\nhtml[data-crm-theme=\"dark\"] .zw .zw-tabs,html[data-crm-theme=\"dark\"] .zw .zw-toolbar{border-color:#344b68!important;background:transparent!important}\nhtml[data-crm-theme=\"dark\"] .zw .zw-toolbar h2,html[data-crm-theme=\"dark\"] .zw :is(h2,h3,p,label,span,small,strong,th,td){color:#e8f0fd!important}\nhtml[data-crm-theme=\"dark\"] .zw .zw-metrics{border-color:#344b68!important;background:#172438!important}\nhtml[data-crm-theme=\"dark\"] .zw .zw-metrics>div{background:linear-gradient(145deg,#1b2c43,#20324b)!important;border-color:#344b68!important}\nhtml[data-crm-theme=\"dark\"] .zw table{background:#172438!important}\nhtml[data-crm-theme=\"dark\"] .zw table th{background:#21324b!important;color:#eaf2ff!important}\nhtml[data-crm-theme=\"dark\"] .zw table td{background:#172438!important;color:#eaf2ff!important}\nhtml[data-crm-theme=\"dark\"] .zw table td,html[data-crm-theme=\"dark\"] .zw table th{border-color:#334966!important}\nhtml[data-crm-theme=\"dark\"] .zw a{color:#78a9ff!important}\nhtml[data-crm-theme=\"dark\"] .zw :is(button,select,input,textarea){background:#101d30!important;color:#f1f6ff!important;border:1px solid #46617f!important;color-scheme:dark}\nhtml[data-crm-theme=\"dark\"] .zw button.zw-main{background:#2d6bea!important;color:#fff!important;border-color:#2d6bea!important}\nhtml[data-crm-theme=\"dark\"] .zw button:hover{border-color:#719df0!important}\nhtml[data-crm-theme=\"dark\"] .zw-dialog,html[data-crm-theme=\"dark\"] .zw-dialog-bg .zw-dialog{background:#1a2a40!important;color:#ebf3ff!important;border:1px solid #415775!important}\nhtml[data-crm-theme=\"dark\"] .zw-dialog :is(h2,h3,p,label,span,small,strong){color:#eaf2ff!important}\nhtml[data-crm-theme=\"dark\"] .zw-dialog :is(input,textarea,select,button:not(.zw-main)){background:#101d30!important;color:#f1f6ff!important;border:1px solid #496383!important;color-scheme:dark}\nhtml[data-crm-theme=\"dark\"] .zw-dialog .zw-main{background:#2d6bea!important;color:white!important}\nhtml[data-crm-theme=\"dark\"] .zwa :is(.zwa-panel,.zwa-metric,.zwa-tabs,.zwa-head){background:#1b2b42!important;border-color:#384f6c!important}\nhtml[data-crm-theme=\"dark\"] .zwa :is(table,tbody,tr,td,th){background:#18263a!important;border-color:#384f6c!important;color:#eaf2ff!important}\n";
document.head.appendChild(style);
const move=url=>{history.pushState({},"",url);window.dispatchEvent(new PopStateEvent("popstate"));};
const call=async(url,options={})=>{const r=await fetch(url,{credentials:"same-origin",headers:{"Content-Type":"application/json"},...options});const d=await r.json();if(!r.ok)throw Error(typeof d.detail==="string"?d.detail:"Request failed");return d;};
function dialog(body){const layer=document.createElement("div");layer.className="zw-dialog-bg";layer.innerHTML='<section role="dialog" aria-modal="true" class="zw-dialog">'+body+'<p><button type="button" data-zw-close>Done</button></p></section>';document.body.append(layer);layer.querySelector("[data-zw-close]").onclick=()=>layer.remove();layer.onclick=e=>{if(e.target===layer)layer.remove()};return layer;}
window.webformAnalyticsPage=async(id)=>{
 const response=await call("/api/webforms/"+encodeURIComponent(id)+"/analytics");
 const n=v=>v===null||v===undefined?"Not tracked":Number(v).toLocaleString();
 const metric=(label,value,help="")=>'<div class="zwa-metric"><span>'+esc(label)+'</span><strong>'+esc(n(value))+'</strong><small>'+esc(help)+'</small></div>';
 const empty='<div class="zwa-empty">No tracking data available</div>';
 const panel=(title,body)=>'<section class="zwa-panel"><h3>'+esc(title)+'</h3>'+body+'</section>';
 const tabs='<nav class="zwa-tabs" aria-label="Analytics views"><button data-zwa-tab="submission" aria-selected="true">Submission</button><button data-zwa-tab="region">Region</button><button data-zwa-tab="leads">Leads</button></nav>';
 const summary='<div class="zwa-metrics">'+metric("Visits",response.visits,"Measured since activation")+metric("Starters",response.starters,"Measured since activation")+metric("Submissions",response.submissions,"Verified CRM Lead records")+metric("Leads created",response.leads,"Verified CRM Lead records")+'</div>';
 const note='<p class="zwa-note">Anonymous event metrics begin at tracking activation; historical traffic cannot be recovered. Country depends on proxy-provided country headers. Deal and revenue attribution remain unavailable.</p>';
 const breakdown=items=>items?.length?'<table><thead><tr><th>Source</th><th>Visits</th></tr></thead><tbody>'+items.map(row=>'<tr><td>'+esc(row.label)+'</td><td>'+esc(n(row.count))+'</td></tr>').join("")+'</tbody></table>':empty;
 const submission=panel("Form Submissions",'<div class="zwa-total">'+esc(n(response.submissions))+'<span> recorded submissions</span></div>')+panel("Submissions Based on URL",'<table><thead><tr><th>Website</th><th>Visits</th><th>Starters</th><th>Submissions</th><th>Conversion rate</th></tr></thead><tbody><tr><td>Published Webform</td><td>—</td><td>—</td><td>'+esc(n(response.submissions))+'</td><td>—</td></tr></tbody></table>')+panel("Partial vs Complete Submissions",'<p>Partial sessions: '+esc(n(response.partial))+' | Leads created: '+esc(n(response.leads))+'</p>')+panel("Submissions Based on Device Source",breakdown(response.devices));
 const region=panel("Submissions Based on Countries",breakdown(response.countries))+panel("Regional Breakdown",breakdown(response.countries));
 const leads=panel("Leads Created",'<div class="zwa-total">'+esc(n(response.leads))+'<span> linked Leads</span></div>')+panel("Deals Created (via Leads)",empty)+panel("Revenue Generated (via Leads)",empty)+panel("Leads Conversion Report",empty);
 return '<section class="zwa"><header class="zwa-head"><a href="/webforms" data-zwa-back aria-label="Back to Webforms">←</a><h2>'+esc(response.name||"Webform")+'</h2><span class="zwa-tag">Leads</span><span class="zwa-spacer"></span><label>Period <select data-zwa-range><option value="all">All Time</option></select></label></header>'+tabs+summary+'<div data-zwa-panel="submission">'+submission+'</div><div data-zwa-panel="region" hidden>'+region+'</div><div data-zwa-panel="leads" hidden>'+leads+'</div>'+note+'</section>';
};
window.webformClone=async(id)=>{const old=await call("/api/platform/webforms/"+encodeURIComponent(id));const name=String(old.name||"Webform")+" Copy";const clone={name,target_module:"Leads",fields:old.fields||[],hidden_fields:old.hidden_fields||[],defaults:old.defaults||[],assignment:old.assignment||[],autoresponse:old.autoresponse||[],spam_protection:old.spam_protection||"Enabled",status:"Inactive"};const record=await call("/api/platform/webforms",{method:"POST",body:JSON.stringify(clone)});move("/webforms/edit/"+record.id);return record;};
window.webformDashboard=data=>{
const rows=data.items||[];
return '<section class="zw"><div class="zw-tabs"><span>Webforms</span></div><div class="zw-toolbar"><h2>Webforms</h2><select aria-label="Module"><option>Leads</option></select><span class="zw-grow"></span><select><option>All Time</option></select><button class="zw-main" data-zw-new>New Form</button></div><div class="zw-metrics"><div>VISITS<strong>Per form</strong><small>Tracking enabled for new public visits</small></div><div>STARTERS<strong>Per form</strong><small>Anonymous form-start tracking</small></div><div>SUBMISSIONS<strong>Per form</strong><small>See Analytics for verified Lead counts</small></div></div><table><thead><tr><th>All Forms</th><th>Created By</th><th>Submissions</th><th>Leads</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+ (rows.length?rows.map(x=>'<tr><td><a href="/webforms/edit/'+Number(x.id)+'">'+esc(x.name||x.title||"Untitled")+'</a><small style="display:block">Standard · '+esc(x.target_module||"Leads")+'</small></td><td>'+esc(x.owner_name||"Administrator")+'</td><td><button data-zw-analytics="'+Number(x.id)+'">View</button></td><td>Lead intake</td><td><select data-zw-status="'+Number(x.id)+'" aria-label="Webform status"><option value="Active" '+(["Active","Enabled"].includes(x.status)?"selected":"")+'>Active</option><option value="Inactive" '+(["Inactive","Draft","Disabled"].includes(x.status)?"selected":"")+'>Inactive</option></select></td><td><div class="zw-actions"><button data-zw-edit="'+Number(x.id)+'">Edit</button><button data-zw-clone="'+Number(x.id)+'">Clone</button><button data-zw-analytics="'+Number(x.id)+'">Analytics</button><button class="zw-delete" data-zw-delete="'+Number(x.id)+'">Delete</button></div></td></tr>').join(""):'<tr><td colspan="6">No forms yet. Choose New Form.</td></tr>')+'</tbody></table></section>';
};
document.addEventListener("change",async event=>{
 const select=event.target.closest(".zw [data-zw-status]");
 if(!select)return;
 const original=select.dataset.lastStatus|| (select.value==="Active"?"Inactive":"Active");
 select.disabled=true;
 try {
  await call("/api/platform/webforms/"+encodeURIComponent(select.dataset.zwStatus),{method:"PATCH",body:JSON.stringify({status:select.value})});
  select.dataset.lastStatus=select.value;
  select.setAttribute("aria-label","Status saved: "+select.value);
 }catch(error){select.value=original;(await alertDialog("Could not change status: "+error.message));}
 finally{select.disabled=false;}
});
document.addEventListener("click",async event=>{
const b=event.target.closest(".zw button");if(!b)return;
if(b.dataset.zwNew!==undefined){window.location.assign("/webforms/create");return;}
if(b.dataset.zwEdit){move("/webforms/edit/"+b.dataset.zwEdit);return;}
if(b.dataset.zwDemo!==undefined){return;}
const id=b.dataset.zwAnalytics||b.dataset.zwClone||b.dataset.zwArchive||b.dataset.zwDelete;if(!id)return;
try{
if(b.dataset.zwAnalytics){move("/webforms/analytics/"+id);}
if(b.dataset.zwDelete){if(!(await confirmDialog("Delete this Webform? It will no longer accept submissions. Existing Leads will be retained.")))return;await call("/api/platform/webforms/"+id,{method:"DELETE"});move("/webforms");}
if(b.dataset.zwClone){await window.webformClone(id);}
}catch(error){(await alertDialog("Operation failed: "+error.message));}
});

style.textContent+=`
.zw select[data-zw-status]{min-width:110px;border-radius:6px}.zw .zw-delete{color:#b72e42;border-color:#ebcbd1}.zw .zw-delete:hover{background:#fff0f2}
.zwa{background:#fff;color:#20304b;border:1px solid #d9e1f0;border-radius:13px;min-height:75vh;padding:0 28px 26px}
.zwa *{box-sizing:border-box}.zwa-head{display:flex;align-items:center;gap:12px;padding:19px 4px;border-bottom:1px solid #dde4ef}
.zwa-head h2{margin:0;font-size:22px;color:#172942}.zwa-head a{font-size:26px;text-decoration:none;color:#234069}
.zwa-tag{font-size:13px;padding:5px 12px;background:#eef2ff;border:1px solid #d7e0fa;border-radius:5px}
.zwa-spacer{flex:1}.zwa-head select{padding:8px 12px;border:1px solid #d3dcec;border-radius:5px;background:#fff;color:#253e62}
.zwa-tabs{display:flex;gap:2px;width:max-content;max-width:100%;margin:20px auto 26px;padding:3px;border:1px solid #dae3f4;border-radius:25px}
.zwa-tabs button{border:0;border-radius:22px;background:transparent;color:#253b5b;padding:7px 23px;cursor:pointer}
.zwa-tabs button[aria-selected=true]{background:#e9efff;box-shadow:inset 0 0 0 1px #9eb4ff;font-weight:700}
.zwa-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-bottom:22px}
.zwa-metric,.zwa-panel{border:1px solid #dce4f0;border-radius:11px;background:#fff}
.zwa-metric{padding:19px}.zwa-metric span,.zwa-metric small{display:block}.zwa-metric strong{display:block;color:#8264d8;font-size:27px;margin:11px 0;overflow-wrap:anywhere}.zwa-metric small{color:#64738d;font-size:12px}
.zwa-panel{margin-bottom:20px;padding:24px 28px;min-height:170px}.zwa-panel h3{color:#1d2d49;font-size:16px;font-weight:600;margin:0 0 25px}
.zwa-empty{display:grid;place-items:center;color:#64738b;min-height:145px;font-size:14px}
.zwa-total{font-size:40px;color:#244678;margin:32px 0}.zwa-total span{font-size:14px;color:#73839a}
.zwa-panel table{width:100%;border-collapse:collapse}.zwa-panel th,.zwa-panel td{text-align:left;padding:12px;border-bottom:1px solid #e1e7f0}
.zwa-note{color:#61718b;font-size:12px;margin:12px 0}
@media(max-width:900px){.zwa-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:570px){.zwa{padding:0 12px 18px}.zwa-head{flex-wrap:wrap}.zwa-metrics{grid-template-columns:1fr}.zwa-panel{padding:18px}.zwa-tabs button{padding:8px 13px}}
`;
document.addEventListener("click",event=>{
 const b=event.target.closest("[data-zwa-tab]");if(!b)return;
 const host=b.closest(".zwa");if(!host)return;
 host.querySelectorAll("[data-zwa-tab]").forEach(x=>x.setAttribute("aria-selected",String(x===b)));
 host.querySelectorAll("[data-zwa-panel]").forEach(x=>x.hidden=x.dataset.zwaPanel!==b.dataset.zwaTab);
});
})();
