// Template chooser intercepts all supported record PDF links without changing navigation.
const available = new Set(["quotes","invoices","products","price_books","vendors","sales_orders","purchase_orders","payments"]);
const presets = [{id:"classic",name:"Formal Corporate",desc:"Structured business document"},{id:"modern",name:"Executive Blue",desc:"Refined navy professional layout"},{id:"minimal",name:"Executive Minimal",desc:"Premium clean layout"}];
const css = `<style id="crm-pdf-chooser-style">
.crm-pdf-shade{position:fixed;inset:0;background:#0d1b32a8;z-index:2147483001;display:flex;align-items:center;justify-content:center;padding:16px}
.crm-pdf-panel{width:min(1150px,100%);height:min(750px,92vh);background:var(--surface,#fff);border-radius:12px;overflow:hidden;box-shadow:0 24px 75px #06152b80;display:grid;grid-template-columns:285px minmax(0,1fr);color:var(--text,#172747)}
.crm-pdf-controls{padding:22px;overflow:auto;background:var(--surface,#fff);border-right:1px solid #dde4ed}
.crm-pdf-controls h2{font-size:21px;margin:0 0 18px}
.crm-pdf-controls label{display:block;font-weight:600;font-size:13px;margin:13px 0 5px}
.crm-pdf-controls select,.crm-pdf-controls input{display:block;width:100%;box-sizing:border-box;border:1px solid #c9d4e6;border-radius:7px;padding:10px;color:var(--text,#172747);background:var(--surface,#fff)}
.crm-pdf-actions{display:flex;gap:8px;margin-top:22px}
.crm-pdf-actions button{border:1px solid #cbd6e8;border-radius:7px;padding:10px 15px;background:var(--surface,#fff);color:var(--text,#172747);cursor:pointer}
.crm-pdf-actions button:first-child{background:#0f2180;color:white;border-color:#0f2180}
.crm-pdf-preview{background:var(--surface-soft,#cad0d9);display:flex;flex-direction:column;min-width:0}
.crm-pdf-preview-head{padding:13px 17px;background:var(--surface-soft,#f4f7fc);display:flex;gap:10px;align-items:center;justify-content:space-between;font-weight:600}
.crm-pdf-preview iframe{width:100%;flex:1;border:0;background:#929ba9}
.crm-pdf-status{font-size:12px;color:var(--text-soft,#49607e);margin-top:12px;min-height:18px}
@media(max-width:680px){.crm-pdf-panel{display:flex;flex-direction:column;height:95vh}.crm-pdf-controls{max-height:52%;border-right:0;border-bottom:1px solid #ddd}.crm-pdf-preview{min-height:0;flex:1}}
</style>`;
function launchPdfChooser(link,resource,id){
 document.querySelector(".crm-pdf-shade")?.remove();
 if(!document.querySelector("#crm-pdf-chooser-style"))document.head.insertAdjacentHTML("beforeend",css);
 const root=document.createElement("div");root.className="crm-pdf-shade";
 root.innerHTML=`<section class="crm-pdf-panel" role="dialog" aria-modal="true" aria-labelledby="crm-pdf-title">
 <div class="crm-pdf-controls"><h2 id="crm-pdf-title">Export to PDF</h2>
 <label for="crm-pdf-category">Template Category</label><select id="crm-pdf-category"><option value="business">Business Templates</option></select>
 <label for="crm-pdf-template">Choose a Template</label><select id="crm-pdf-template">${presets.map(p=>`<option value="${p.id}">${p.name}</option>`).join("")}</select>
 <label for="crm-pdf-filename">File Name</label><input id="crm-pdf-filename" maxlength="100" value="${resource}-${id}">
 <label for="crm-pdf-orientation">Layout</label><select id="crm-pdf-orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select>
 <label for="crm-pdf-paper">Paper Size</label><select id="crm-pdf-paper"><option value="a4">A4</option><option value="letter">US Letter</option></select>
 <p class="crm-pdf-status" role="status" aria-live="polite">Preparing preview…</p>
 <div class="crm-pdf-actions"><button type="button" data-pdf-export>Export</button><button type="button" data-pdf-cancel>Cancel</button></div></div>
 <div class="crm-pdf-preview"><div class="crm-pdf-preview-head"><span>PDF Preview</span><span data-pdf-template-name>Formal Corporate</span></div><iframe title="PDF preview"></iframe></div>
 </section>`;
 document.body.append(root);
 let previousFocus=document.activeElement,serial=0;
 const template=root.querySelector("#crm-pdf-template"),paper=root.querySelector("#crm-pdf-paper"),orientation=root.querySelector("#crm-pdf-orientation"),status=root.querySelector(".crm-pdf-status"),frame=root.querySelector("iframe");
 const close=()=>{serial++;frame.src="about:blank";root.remove();previousFocus?.focus?.();};
 root.querySelector("[data-pdf-cancel]").addEventListener("click",close);
 root.addEventListener("click",e=>{if(e.target===root)close();});
 root.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();close();}});
 const pdfUrl=(preview=false)=>{const u=new URL(link,location.origin);u.searchParams.set("template",template.value);u.searchParams.set("paper",paper.value);u.searchParams.set("orientation",orientation.value);if(preview)u.searchParams.set("preview","1");return u.toString();};
 async function updatePreview(){
  const current=++serial;status.textContent="Generating PDF preview…";root.querySelector("[data-pdf-export]").disabled=true;
  root.querySelector("[data-pdf-template-name]").textContent=presets.find(p=>p.id===template.value)?.name||"";
  try{
   const response=await fetch(pdfUrl(true),{credentials:"same-origin",cache:"no-store",headers:{Accept:"application/pdf"}});
   if(!response.ok)throw Error("PDF preview failed ("+response.status+")");
   if(current!==serial||!root.isConnected)return;
   frame.src=pdfUrl(true);status.textContent="Preview loaded. Select Export to download.";
  }catch(error){if(current===serial){frame.src="about:blank";status.textContent=error.message;}}
  finally{if(current===serial)root.querySelector("[data-pdf-export]").disabled=false;}
 }
 [template,paper,orientation].forEach(el=>el.addEventListener("change",updatePreview));
 root.querySelector("[data-pdf-export]").addEventListener("click",async()=>{
  const button=root.querySelector("[data-pdf-export]");
  button.disabled=true;status.textContent="Preparing download…";
  try{
   const response=await fetch(pdfUrl(),{credentials:"same-origin",cache:"no-store",headers:{Accept:"application/pdf"}});
   if(!response.ok)throw Error("Download failed ("+response.status+")");
   const blob=await response.blob();
   const name=root.querySelector("#crm-pdf-filename").value.replace(/[^a-zA-Z0-9._ -]/g,"_").trim().replace(/\\.pdf$/i,"")||resource+"-"+id;
   const href=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=href;a.download=name+".pdf";document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(href),60000);
   status.textContent="Download initiated.";
  }catch(error){status.textContent=error.message;}
  finally{button.disabled=false;}
 });
 template.focus();updatePreview();
}
document.addEventListener("click",event=>{
 const a=event.target.closest?.('a[href*="/pdf"]');
 if(!a||!a.hasAttribute("download"))return;
 const u=new URL(a.href,location.href);
 const match=u.pathname.match(/^\/api\/(?:platform\/([a-z_]+)\/|(?:quotes|invoices)\/)(\d+)\/pdf$/);
 if(!match)return;
 const resource=match[1]||u.pathname.split("/")[2];
 if(!available.has(resource))return;
 event.preventDefault();event.stopImmediatePropagation();launchPdfChooser(u.pathname,resource,match[2]);
},true);
