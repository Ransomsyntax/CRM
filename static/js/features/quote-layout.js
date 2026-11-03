
const labelMap={name:"Subject",quote_number:"Quote Number",status:"Quote Stage",owner_id:"Quote Owner",deal_id:"Deals Name",account_id:"Account Name",contact_id:"Contact Name",valid_until:"Valid Until",amount:"Total",terms:"Terms and Conditions"};
const addressKeys=["street","city","state","code","country"];
const infoLeft=["owner_id","name","status","team","carrier","currency"];
const infoRight=["quote_number","deal_id","valid_until","contact_id","account_id","exchange_rate","amount"];
const addressLeft=addressKeys.map(k=>"billing_"+k),addressRight=addressKeys.map(k=>"shipping_"+k);
// Keep the legacy combined address for PDFs/API compatibility, with one
// visible editor per address. Never try to split old free-form addresses.
export function prepareQuoteAddresses(root) {
 for (const prefix of ["billing","shipping"]) {
  const controls=addressKeys.map(key=>root.querySelector('[name="'+prefix+'_'+key+'"]'));
  const summary=root.querySelector('[name="'+prefix+'_address"]');
  if(!summary || controls.some(control=>!control))continue;
  if(!controls.some(control=>control.value.trim()) && summary.value.trim())controls[0].value=summary.value;
  const field=summary.closest('.field');
  if(field)field.hidden=true;
  else summary.hidden=true;
  const sync=()=>{summary.value=controls.map(control=>control.value.trim()).filter(Boolean).join(', ');};
  controls.forEach(control=>{control.addEventListener('input',sync);control.addEventListener('change',sync);});
 }
}
export function fillQuoteAccountAddresses(root,account) {
 const billing=addressKeys.map(key=>account['billing_'+(key==='code'?'postal_code':key)] || '');
 const shipping=addressKeys.map(key=>account['shipping_'+(key==='code'?'postal_code':key)] || '');
 for(const [prefix,values] of [["billing",billing],["shipping",shipping.some(Boolean)?shipping:billing]]) {
  const controls=addressKeys.map(key=>root.querySelector('[name="'+prefix+'_'+key+'"]'));
  const summary=root.querySelector('[name="'+prefix+'_address"]');
  if(controls.some(control=>control?.value.trim()) || summary?.value.trim())continue;
  controls.forEach((control,index)=>{if(control)control.value=values[index];});
  if(summary)summary.value=values.filter(Boolean).join(', ');
 }
}
const asNum=x=>Number.isFinite(Number(x))?Number(x):0;
const money=(n,c="INR")=>new Intl.NumberFormat("en-IN",{style:"currency",currency:c==="USD"||c==="EUR"?c:"INR",maximumFractionDigits:2}).format(asNum(n));
const cell=(s,esc)=>'<td>'+esc(s??"—")+'</td>';
const css=`<style>
.quote-zoho{display:grid;grid-template-columns:205px minmax(0,1fr);gap:16px}.quote-zoho aside{background:var(--surface);padding:16px;border-radius:12px;align-self:start;position:sticky;top:90px}.quote-zoho aside a{display:block;color:var(--text);padding:8px 4px;text-decoration:none}.quote-zoho main{min-width:0}.quote-zoho .qpanel{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:23px;margin-bottom:14px}.quote-zoho h3{font-size:15px;margin:12px 0 21px;color:var(--text)}.quote-zoho .qfields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:36px}.quote-zoho .qfields>dl{min-width:0}.quote-zoho .qpair{display:grid;grid-template-columns:minmax(0,.36fr) minmax(0,.64fr);padding:10px 0;gap:8px;font-size:14px}.quote-zoho .qpair dt{min-width:0;overflow-wrap:anywhere;text-align:right;color:var(--text-soft);font-weight:700}.quote-zoho .qpair dd{min-width:0;margin:0;color:var(--text);overflow-wrap:anywhere}.quote-zoho .qtable{width:100%;border-collapse:collapse;min-width:920px}.quote-zoho .qscroll{overflow-x:auto}.quote-zoho th,.quote-zoho td{border:1px solid var(--border);text-align:left;padding:12px;font-size:13px;white-space:nowrap}.quote-zoho th{background:var(--surface-soft);font-weight:700}.quote-zoho .qtotals{width:min(410px,100%);margin:22px 0 20px auto;border:1px solid var(--border);border-radius:10px;overflow:hidden}.quote-zoho .qtotals>div{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px;border-bottom:1px solid var(--border)}.quote-zoho .qtotals>div[data-total-key="grand"]{font-weight:700;border-bottom:0;background:var(--surface-soft)}.quote-zoho .qtotal-edit{display:flex;align-items:center;gap:12px;min-width:0}.quote-zoho .qtotal-edit input{width:100px;max-width:100%;padding:8px;border:1px solid var(--border);border-radius:7px;color:var(--text);background:var(--surface);font:inherit}.quote-zoho .qtotal-edit strong{min-width:100px;text-align:right}.quote-zoho .qtotals footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 15px;border-top:1px solid var(--border)}.quote-zoho .qtotals footer span{font-size:12px;color:var(--text-soft)}.quote-zoho .qtotals footer button{flex-shrink:0}@media(max-width:480px){.quote-zoho .qtotal-edit{flex-direction:column;align-items:flex-end;gap:4px}.quote-zoho .qtotal-edit strong{min-width:0}}.quote-editor-layout{display:block!important}.quote-editor-layout .qform-section{border-top:1px solid var(--border);padding:16px 0 24px}.quote-editor-layout h3{font-size:15px;margin:8px 0 20px}.quote-editor-layout .qform-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 32px}.quote-editor-layout .qform-grid>.field{min-width:0}.quote-editor-layout .qrow-table{overflow-x:auto;margin-top:16px}.quote-editor-layout table{width:100%;border-collapse:collapse;min-width:970px}.quote-editor-layout th,.quote-editor-layout td{padding:8px;border:1px solid var(--border);font-size:13px}.quote-editor-layout td .field-input{min-width:80px;width:100%}.quote-editor-layout .qt-summary{max-width:390px;margin:16px 0 10px auto;border:1px solid var(--border);border-radius:8px;padding:16px}.quote-editor-layout .qt-summary p{display:flex;justify-content:space-between;margin:8px 0}.quote-editor-layout .qt-summary .qt-edit-row{align-items:center;gap:12px}.quote-editor-layout .qt-summary .qt-edit-row .field{display:flex;align-items:center;gap:8px;min-width:0;margin:0}.quote-editor-layout .qt-summary .qt-edit-row .field label{font-size:13px;white-space:nowrap}.quote-editor-layout .qt-summary .qt-edit-row input{width:90px;max-width:100%;padding:6px 8px}.quote-editor-layout .qt-summary .qt-edit-row strong{white-space:nowrap}.quote-editor-layout .qt-summary .final{border-top:1px solid var(--border);padding-top:10px;font-weight:700}@media(max-width:850px){.quote-zoho{display:block}.quote-zoho aside{position:static}.quote-zoho .qfields,.quote-editor-layout .qform-grid{grid-template-columns:1fr}}
</style>`;
export function quoteDetail(record,related,{esc,formatDateTime,id}){
 const display=(key)=>{let value=record[key];if(["deal_id","contact_id","account_id"].includes(key)){const kind=key.split("_")[0]+"s";const linked=(related[kind]||[]).find(x=>Number(x.id)===Number(value));if(linked)value=linked.name||linked.full_name||value;}return value===null||value===undefined||value===""?"—":String(value);};
 const pair=key=>'<div class="qpair"><dt>'+esc(labelMap[key]||key.replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase()))+'</dt><dd>'+esc(display(key))+'</dd></div>';
 const two=(left,right)=>'<div class="qfields"><dl>'+left.map(pair).join("")+'</dl><dl>'+right.map(pair).join("")+'</dl></div>';
 const lines=Array.isArray(record.line_items)?record.line_items:[];
 const totals=calculateQuote(lines,record.discount_percent,record.tax_percent,record.adjustment);
 const curr=record.currency||"INR";
 const linkedSections=renderDocumentRelated(related,esc,["notes","connected","sales_orders","attachments","open_activities","closed_activities","emails","zoho_sign"]);
 return css+`<div class="page-heading"><div><span class="eyebrow">Quotes</span><h1>${esc(record.name||"Quote")}</h1><p class="subheading">${esc(record.quote_number||record.record_number||"")}</p></div><div class="heading-actions"><button type="button" class="button button-ghost" data-platform-return>← Back to Quotes</button><button type="button" class="button button-primary" data-platform-detail-edit="${Number(id)}">Edit</button><div class="quote-convert-menu" style="position:relative;z-index:100"><button type="button" class="button button-ghost" data-quote-convert-toggle aria-expanded="false">Convert ▾</button><div data-quote-convert-options hidden style="position:fixed;z-index:10000;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px #15284822;min-width:170px;padding:6px"><button type="button" class="button button-ghost" data-quote-convert="sales_orders" style="width:100%;text-align:left">Sales Order</button><button type="button" class="button button-ghost" data-quote-convert="invoices" style="width:100%;text-align:left">Invoice</button><small data-quote-convert-status role="status"></small></div></div><a class="button button-ghost" href="/api/quotes/${Number(id)}/pdf" download>Download PDF</a></div></div>
<div class="quote-zoho"><aside><strong>Related List</strong><a href="#q-information">Quote Information</a><a href="#q-address">Address Information</a><a href="#q-items">Quoted Items</a><a href="#q-terms">Terms and Conditions</a>${[["notes","Notes"],["connected","Connected Records"],["sales_orders","Sales Orders"],["attachments","Attachments"],["open_activities","Open Activities"],["closed_activities","Closed Activities"],["emails","Emails"],["zoho_sign","Zoho Sign Documents"]].map(([key,label])=>`<a href="#q-related-${key}">${label}</a>`).join("")}<strong>Connected Records</strong>${["accounts","contacts","deals"].map(kind=>(related[kind]||[]).map(x=>'<button class="detail-related-row" data-platform-related="'+kind+'" data-id="'+Number(x.id)+'">'+esc(x.name||x.full_name||kind)+'</button>').join("")).join("")}</aside>
<main><div class="qpanel"><div style="display:flex;gap:12px;margin-bottom:18px"><strong>Overview</strong><span>Timeline</span></div>${two(["quote_number","status","owner_id","valid_until"],["contact_id","deal_id","account_id"])}</div>
<section class="qpanel" id="q-information"><h3>Quote Information</h3>${two(infoLeft,infoRight)}</section>
<section class="qpanel" id="q-address"><h3>Address Information</h3>${two(addressLeft,addressRight)}</section>
<section class="qpanel" id="q-items"><h3>Quoted Items</h3><div class="qscroll"><table class="qtable"><thead><tr>${["S.NO","Product Name","Quantity","Rate ("+curr+")","Amount ("+curr+")","Discount","Tax","Total ("+curr+")"].map(x=>'<th>'+esc(x)+'</th>').join("")}</tr></thead><tbody>${lines.length?lines.map((l,i)=>'<tr>'+cell(i+1,esc)+cell(l.name,esc)+cell(l.quantity,esc)+cell(money(l.unit_price,curr),esc)+cell(money(asNum(l.quantity)*asNum(l.unit_price),curr),esc)+cell(asNum(l.discount_percent)+"%",esc)+cell(asNum(l.tax_percent)+"%",esc)+cell(money(l.total,curr),esc)+'</tr>').join(""):'<tr><td colspan="8">No quoted items</td></tr>'}</tbody></table></div>
<form class="qtotals" data-quote-inline-rates data-quote-totals data-line-items="${esc(JSON.stringify(lines))}" data-currency="${esc(curr)}">
<div data-total-key="subtotal"><span>Sub Total</span><strong>${esc(money(totals.subtotal,curr))}</strong></div>
<div data-total-key="discount"><label for="quote-discount-rate">Discount (%)</label><span class="qtotal-edit"><input id="quote-discount-rate" aria-label="Discount percentage" type="number" name="discount_percent" min="0" max="100" step="0.01" value="${esc(asNum(record.discount_percent))}" required><strong>${esc(money(totals.discount,curr))}</strong></span></div>
<div data-total-key="tax"><label for="quote-tax-rate">Tax (%)</label><span class="qtotal-edit"><input id="quote-tax-rate" aria-label="Tax percentage" type="number" name="tax_percent" min="0" max="100" step="0.01" value="${esc(asNum(record.tax_percent))}" required><strong>${esc(money(totals.tax,curr))}</strong></span></div>
<div data-total-key="adjustment"><label for="quote-adjustment">Adjustment</label><span class="qtotal-edit"><input id="quote-adjustment" aria-label="Adjustment amount" type="number" name="adjustment" step="0.01" value="${esc(asNum(record.adjustment))}" required><strong>${esc(money(totals.adjustment,curr))}</strong></span></div>
<div data-total-key="grand"><span>Grand Total</span><strong>${esc(money(totals.grand,curr))}</strong></div>
<footer><span data-quote-rate-preview aria-live="polite"></span><button type="submit" class="button button-primary">Save totals</button></footer></form></section><section class="qpanel" id="q-terms"><h3>Terms and Conditions</h3><p>${esc(record.terms||"—")}</p></section>${linkedSections}<p class="caption">Last updated: ${esc(formatDateTime(record.updated_at))}</p></main></div>`;
}
export function calculateQuote(items,discountRate=0,taxRate=0,adjustment=0){
 const subtotal=items.reduce((sum,x)=>sum+asNum(x.quantity)*asNum(x.unit_price),0);
 const lineDiscount=items.reduce((sum,x)=>sum+asNum(x.quantity)*asNum(x.unit_price)*asNum(x.discount_percent)/100,0);
 const lineTax=items.reduce((sum,x)=>sum+asNum(x.quantity)*asNum(x.unit_price)*(1-asNum(x.discount_percent)/100)*asNum(x.tax_percent)/100,0);
 // Overall rates apply to the line totals, matching server calculation.
 const lineTotal=subtotal-lineDiscount+lineTax;
 const overallDiscount=lineTotal*asNum(discountRate)/100;
 const overallTax=(lineTotal-overallDiscount)*asNum(taxRate)/100;
 const discount=lineDiscount+overallDiscount, tax=lineTax+overallTax;
 return {subtotal,discount,tax,adjustment:asNum(adjustment),grand:Math.round((subtotal-discount+tax+asNum(adjustment))*100)/100};
}
export function layoutQuoteForm(record,{esc,formatMoney,products=[]}){
 const root=document.querySelector("#modal-body"),grid=root?.querySelector(".form-grid");
 if(!grid)return;
 prepareQuoteAddresses(root);
 root.insertAdjacentHTML("afterbegin",css+`<style>#modal-backdrop{z-index:1000}#modal-backdrop > #modal.quote-form-active{box-sizing:border-box;width:min(1080px,calc(100vw - 48px));max-width:calc(100vw - 48px);margin-inline:auto;max-height:calc(100dvh - 32px)}#modal.quote-form-active .modal-body{min-width:0;overflow-y:auto;overflow-x:hidden}#modal.quote-form-active .modal-head,#modal.quote-form-active .modal-foot{position:relative;background:var(--surface);color:var(--text);z-index:2}@media(max-width:700px){#modal-backdrop > #modal.quote-form-active{width:100%;max-width:100%;max-height:calc(100dvh - 16px)}}</style>`);
 root.closest(".modal")?.classList.add("quote-form-active");
 grid.classList.add("quote-editor-layout");
 const byKey=key=>root.querySelector('[name="'+key+'"]')?.closest(".field")||root.querySelector('[name="'+key+'"]')?.parentElement;
 const section=(title,keys)=>{const node=document.createElement("section");node.className="qform-section";node.innerHTML='<h3>'+title+'</h3><div class="qform-grid"></div>';const place=node.querySelector(".qform-grid");keys.forEach(key=>{const el=byKey(key);if(el)place.append(el)});grid.append(node);return node;};
 section("Quote Information",["owner_id","quote_number","name","deal_id","status","valid_until","contact_id","account_id","team","exchange_rate","carrier","currency","amount"]);
 const address=section("Address Information",["billing_street","billing_city","billing_state","billing_code","billing_country","shipping_street","shipping_city","shipping_state","shipping_code","shipping_country"]);
 const addressGrid=address.querySelector(".qform-grid");
 const billingGroup=document.createElement("div"),shippingGroup=document.createElement("div");
 billingGroup.className="crm-address-group";shippingGroup.className="crm-address-group";
 billingGroup.innerHTML="<h4>Billing Address</h4>";shippingGroup.innerHTML="<h4>Shipping Address</h4>";
 for(const key of addressKeys){
   const billing=byKey("billing_"+key),shipping=byKey("shipping_"+key);
   if(billing)billingGroup.append(billing);
   if(shipping)shippingGroup.append(shipping);
 }
 addressGrid.append(billingGroup,shippingGroup);
 ["billing_address","shipping_address"].forEach((key,index)=>{const field=byKey(key);if(field){(index===0?billingGroup:shippingGroup).append(field);}});
 const copy=document.createElement("button");copy.type="button";copy.className="button button-ghost";copy.textContent="Copy Address";copy.classList.add("crm-copy-address");copy.addEventListener("click",()=>{for(const k of addressKeys){const from=root.querySelector('[name="billing_'+k+'"]'),to=root.querySelector('[name="shipping_'+k+'"]');if(from&&to){to.value=from.value;to.dispatchEvent(new Event('change',{bubbles:true}));}}});address.insertBefore(copy,address.querySelector(".qform-grid"));
 const items=section("Quoted Items",["line_items"]);
 const source=root.querySelector('[name="line_items"]');if(!source)return;
 source.closest(".field")?.setAttribute("hidden","");
 const wrapper=document.createElement("div");wrapper.className="qrow-table";
 items.append(wrapper);
 let rows=Array.isArray(record.line_items)?record.line_items.map(x=>({...x})):[];
 if(!rows.length)rows=[{name:"",quantity:1,unit_price:0,discount_percent:0,tax_percent:0}];
 const numeric=["quantity","unit_price","discount_percent","tax_percent"];
 const calculate=()=>{const amounts=calculateQuote(rows,root.querySelector('[name="discount_percent"]')?.value,root.querySelector('[name="tax_percent"]')?.value,root.querySelector('[name="adjustment"]')?.value); const total=root.querySelector('[name="amount"]');if(total){total.value=String(amounts.grand);total.readOnly=true;}source.value=JSON.stringify(rows);const summary=wrapper.querySelector("[data-quote-totals]");if(summary){for(const [key,value] of Object.entries({subtotal:amounts.subtotal,discount:amounts.discount,tax:amounts.tax,adjustment:amounts.adjustment,grand:amounts.grand})){const target=summary.querySelector('[data-summary-value="'+key+'"]');if(target)target.textContent=formatMoney(value);}}};
 const draw=()=>{for(const key of ["discount_percent","tax_percent","adjustment"]){const field=byKey(key);if(field&&wrapper.contains(field))items.append(field);}wrapper.innerHTML='<table><thead><tr>'+["S.NO","Product Name","Quantity","Rate","Amount","Discount %","Tax %","Total",""].map(v=>'<th>'+v+'</th>').join("")+'</tr></thead><tbody>'+rows.map((row,i)=>'<tr data-qrow="'+i+'"><td>'+(i+1)+'</td><td><select class="field-select" aria-label="Product" data-qfield="product_id" data-quote-key="product_id"><option value="">Select product</option>'+products.map(product=>'<option value="'+esc(String(product.id))+'" '+(String(row.product_id||"")===String(product.id)||(!row.product_id&&row.name===product.name)?"selected":"")+'>'+esc(product.name||product.record_number||String(product.id))+'</option>').join("")+'</select></td>'+numeric.slice(0,2).map(k=>'<td><input class="field-input" type="number" min="0" step="0.01" aria-label="'+esc(({quantity:"Quantity",unit_price:"Rate",discount_percent:"Discount percentage",tax_percent:"Tax percentage"})[k])+' for line '+(i+1)+'" data-qfield="'+k+'" data-quote-key="'+k+'" '+(k==="quantity"?'max="1000" step="1"':"")+' value="'+esc(row[k]??(k==="quantity"?1:0))+'"></td>').join("")+'<td data-qamount>'+esc(formatMoney(asNum(row.quantity)*asNum(row.unit_price)))+'</td>'+numeric.slice(2).map(k=>'<td><input class="field-input" type="number" min="0" step="0.01" aria-label="'+esc(({quantity:"Quantity",unit_price:"Rate",discount_percent:"Discount percentage",tax_percent:"Tax percentage"})[k])+' for line '+(i+1)+'" data-qfield="'+k+'" data-quote-key="'+k+'" value="'+esc(row[k]??0)+'"></td>').join("")+'<td data-qtotal>'+esc(formatMoney(row.total||0))+'</td><td><button type="button" class="button button-ghost" aria-label="Remove line item '+(i+1)+'" data-qremove="'+i+'">×</button></td></tr>').join("")+'</tbody></table><button type="button" class="button button-ghost" data-qadd>Add row</button><div class="qt-summary" data-quote-totals><p><span>Sub Total</span><strong data-summary-value="subtotal"></strong></p>'+["discount_percent","tax_percent","adjustment"].map((key,i)=>'<p class="qt-edit-row"><span data-summary-field="'+key+'"></span><strong data-summary-value="'+["discount","tax","adjustment"][i]+'"></strong></p>').join("")+'<p class="final"><span>Grand Total</span><strong data-summary-value="grand"></strong></p></div>';wrapper.querySelectorAll("[data-qfield]").forEach(input=>input.addEventListener("input",()=>{let i=+input.closest("[data-qrow]").dataset.qrow;let k=input.dataset.qfield;if(k==="quantity" && (!Number.isInteger(Number(input.value)) || Number(input.value)<1 || Number(input.value)>1000)){input.setCustomValidity("Quantity must be a whole number between 1 and 1000");input.reportValidity();return;}input.setCustomValidity("");rows[i][k]=k==="name"?input.value:+input.value;const x=rows[i];if(k==="product_id"){const product=products.find(p=>Number(p.id)===Number(input.value));x.name=product?.name||"";x.product_id=product?.id||null;if(product?.unit_price!=null)x.unit_price=Number(product.unit_price);input.closest("tr").querySelector('[data-qfield="unit_price"]').value=x.unit_price||0;}x.total=Math.round(asNum(x.quantity)*asNum(x.unit_price)*(1-asNum(x.discount_percent)/100)*(1+asNum(x.tax_percent)/100)*100)/100;input.closest("tr").querySelector("[data-qamount]").textContent=formatMoney(asNum(x.quantity)*asNum(x.unit_price));input.closest("tr").querySelector("[data-qtotal]").textContent=formatMoney(x.total);calculate();}));wrapper.querySelectorAll("[data-qremove]").forEach(b=>b.addEventListener("click",()=>{rows.splice(+b.dataset.qremove,1);draw()}));wrapper.querySelector("[data-qadd]").addEventListener("click",()=>{rows.push({name:"",quantity:1,unit_price:0,discount_percent:0,tax_percent:0});draw()});moveRates();calculate();};
 draw();
 // Keep the original bound inputs in the totals card, not in a separate section.
 function moveRates(){for(const key of ["discount_percent","tax_percent","adjustment"]){const field=byKey(key),slot=wrapper.querySelector('[data-summary-field="'+key+'"]');if(field&&slot){slot.append(field);const input=field.querySelector("input");if(input&&!input.dataset.totalsBound){input.addEventListener("input",calculate);input.dataset.totalsBound="true";}}}}
 moveRates();calculate();
 section("Terms and Conditions",["terms"]);
 for(const field of [...grid.children])if(field.classList?.contains("field")&&!field.hidden){const extras=grid.querySelector(".qform-section:last-child .qform-grid");extras.append(field);}
}

export function renderDocumentRelated(related,esc,visibleKeys=null){
 const items=(related.platform_records||[]);
 const group=(resource)=>items.filter(x=>x.resource===resource);
 const sections=[
  ["notes","Notes",[...(related.notes||[]),...group("notes")]],
  ["connected","Connected Records",[...(related.accounts||[]).map(item=>({...item,resource:"accounts"})),...(related.contacts||[]).map(item=>({...item,resource:"contacts"})),...(related.deals||[]).map(item=>({...item,resource:"deals"}))]],
  ["sales_orders","Sales Orders",group("sales_orders")],
  ["invoices","Invoices",group("invoices")],
  ["products","Products",group("products")],
  ["purchase_orders","Purchase Orders",group("purchase_orders")],
  ["payments","Payments",group("payments")],
  ["attachments","Attachments",[...(related.attachments||[]),...group("attachments"),...group("documents")]],
  ["open_activities","Open Activities",(related.activities||[]).filter(x=>x.status!=="Completed"&&x.status!=="Closed")],
  ["closed_activities","Closed Activities",(related.activities||[]).filter(x=>x.status==="Completed"||x.status==="Closed")],
  ["emails","Emails",[...(related.emails||[]),...group("emails")]],
  ["zoho_sign","Zoho Sign Documents",group("zoho_sign")],
 ];
  const links={notes:"notes",sales_orders:"sales_orders",purchase_orders:"purchase_orders",payments:"payments",invoices:"invoices",products:"products",attachments:"attachments",emails:"emails"};
 return sections.filter(([key])=>!visibleKeys||visibleKeys.includes(key)).map(([key,title,rows])=>'<section class="qpanel" id="q-related-'+key+'"><h3>'+title+'</h3>'+(rows.length?rows.map(x=>{const resource=x.resource||(["open_activities","closed_activities"].includes(key)?"activities":key==="connected"?(x.full_name?"contacts":x.stage?"deals":"accounts"):links[key]);const name=x.title||x.name||x.subject||x.full_name||x.record_number||"Open record";const link=resource&&Number.isSafeInteger(Number(x.id))&&Number(x.id)>0?'<button type="button" class="detail-related-row" data-platform-related="'+esc(resource)+'" data-id="'+Number(x.id)+'">'+esc(name)+' ›</button>':'<span>'+esc(name)+'</span>';return link;}).join(""):'<p class="related-empty">No related '+esc(title.toLowerCase())+' yet.</p>')+'</section>').join("");
}

export function documentRelatedStyles(){return css;}

export function layoutProductLineItems(record,{esc,formatMoney,products=[]}){
 const root=document.querySelector("#modal-body");
 const source=root?.querySelector('[name="line_items"]');
 if(!source)return;
 const field=source.closest(".field");
 if(!field)return;
 source.setAttribute("aria-hidden","true");
 source.style.display="none";
 const panel=document.createElement("div");
 panel.className="qrow-table";
 panel.setAttribute("data-product-lines-editor","");
 field.append(panel);
 let rows=Array.isArray(record.line_items)?record.line_items.map(item=>({...item})):[];
 const num=value=>Number.isFinite(Number(value))?Number(value):0;
 const sync=()=>{source.value=JSON.stringify(rows);source.dispatchEvent(new Event("change",{bubbles:true}));};
 const render=()=>{
  panel.innerHTML='<div class="qscroll"><table class="qtable"><thead><tr><th>Product</th><th>Quantity</th><th>Rate</th><th>Discount %</th><th>Tax %</th><th>Line Total</th><th></th></tr></thead><tbody>'+
   rows.map((line,index)=>'<tr data-product-line="'+index+'"><td><select class="field-select" data-product-key="product_id" aria-label="Product"><option value="">Select product</option>'+
    products.map(item=>'<option value="'+esc(String(item.id))+'" '+(String(line.product_id||"")===String(item.id)||(!line.product_id&&line.name===item.name)?"selected":"")+'>'+esc(item.name||String(item.id))+'</option>').join("")+'</select></td>'+
    ["quantity","unit_price","discount_percent","tax_percent"].map(key=>'<td><input class="field-input" type="number" min="0" step="0.01" data-product-key="'+key+'" '+(key==="quantity"?'max="1000" step="1"':"")+' aria-label="'+({quantity:"Quantity",unit_price:"Rate",discount_percent:"Discount percentage",tax_percent:"Tax percentage"}[key])+' for line '+(index+1)+'" value="'+esc(String(line[key]??(key==="quantity"?1:0)))+'"></td>').join("")+
    '<td data-line-amount>'+esc(formatMoney(line.total??0))+'</td><td><button type="button" class="button button-ghost" data-remove-product-line="'+index+'" aria-label="Remove product">×</button></td></tr>').join("")+
    '</tbody></table></div><button class="button button-ghost" type="button" data-add-product-line>Add product</button>';
  panel.querySelectorAll("[data-product-key]").forEach(input=>input.addEventListener("change",()=>{
    const index=Number(input.closest("[data-product-line]").dataset.productLine);
    const key=input.dataset.productKey;
    const line=rows[index];
    if(key==="product_id"){
      const product=products.find(item=>Number(item.id)===Number(input.value));
      line.product_id=product?.id||null;
      line.name=product?.name||"";
      if(product?.unit_price!=null)line.unit_price=num(product.unit_price);
    }else {if(key==="quantity" && (!Number.isInteger(Number(input.value)) || num(input.value)<1 || num(input.value)>1000)){input.setCustomValidity("Quantity must be between 1 and 1000");input.reportValidity();return;}input.setCustomValidity("");line[key]=num(input.value);}
    line.total=Math.round(num(line.quantity)*num(line.unit_price)*(1-num(line.discount_percent)/100)*(1+num(line.tax_percent)/100)*100)/100;
    sync();render();
  }));
  panel.querySelectorAll("[data-remove-product-line]").forEach(button=>button.addEventListener("click",()=>{rows.splice(Number(button.dataset.removeProductLine),1);sync();render();}));
  panel.querySelector("[data-add-product-line]").addEventListener("click",()=>{rows.push({product_id:null,name:"",quantity:1,unit_price:0,discount_percent:0,tax_percent:0,total:0});sync();render();});
 };
 render();sync();
}

