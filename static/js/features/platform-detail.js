import "./pdf-template-selector.js";
import { quoteDetail, renderDocumentRelated, documentRelatedStyles, calculateQuote } from "./quote-layout.js?v=20261028-detail-grid-v1";
// Shared accessible record-detail page for all platform modules.
export function createPlatformDetailFeature({ api, state, esc, formatDateTime, formatMoney, navigate, openPlatformModal, deletePlatformRecord, selectAll }) {
  function valueFor(field, value) {
    if (value === null || value === undefined || value === "") return "—";
    if (field.type === "number" && ["amount", "target_amount"].includes(field.key)) return formatMoney(value);
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  const relatedLists = {"invoices":["notes","connected","payments","attachments","open_activities","emails","closed_activities","zoho_sign"],"sales_orders":["notes","connected","attachments","invoices","open_activities","closed_activities","emails","zoho_sign"],"purchase_orders":["notes","connected","attachments","open_activities","closed_activities","emails","zoho_sign"],"price_books":["notes","products","attachments"],"vendors":["notes","connected","purchase_orders","attachments","open_activities","closed_activities","emails"],"payments":["notes","connected","invoices","attachments","open_activities","closed_activities","emails"]};
  const labels = {"notes":"Notes","connected":"Connected Records","attachments":"Attachments","open_activities":"Open Activities","closed_activities":"Closed Activities","emails":"Emails","zoho_sign":"Zoho Sign Documents","invoices":"Invoices","products":"Products","sales_orders":"Sales Orders","purchase_orders":"Purchase Orders","payments":"Payments"};
  const keysFor = resource => relatedLists[resource] || ["notes","connected","sales_orders","attachments","open_activities","closed_activities","emails"];
  const renderNav = resource => keysFor(resource).map(key => '<a href="#q-related-' + key + '">' + labels[key] + '</a>').join("");
  const renderPanels = (resource,related) => renderDocumentRelated(related,esc,keysFor(resource));
  async function platformDetailView(resource, id) {
    const config = state.platformCatalog.resources[resource];
    const [record, related] = await Promise.all([
      api(`/api/platform/${resource}/${id}`),
      api(`/api/platform/${resource}/${id}/related`),
    ]);
    if (resource === "quotes") return quoteDetail(record, related, {esc, formatDateTime, id});
    if (resource === "invoices") {
      const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
      const subtotal = record.subtotal == null ? n(record.amount) : n(record.subtotal);
      const discount = n(record.discount_percent), tax = n(record.tax_percent), adjustment = n(record.adjustment);
      const discounted = subtotal * (1 - discount / 100);
      const money = value => esc(formatMoney(value));
      const field = (name, value, limits = "") => '<input class="field-input" type="number" name="' + name + '" aria-label="' + name.replaceAll("_", " ") + '" step="0.01" ' + limits + ' value="' + esc(String(value)) + '" required>';
      const line = (key, label, value, input = "") => '<div data-total-key="' + key + '"><span>' + label + '</span><span class="qtotal-edit">' + input + '<strong>' + money(value) + '</strong></span></div>';
      const lookupName = (key, value) => {
        const resource = {account_id:"accounts",contact_id:"contacts",deal_id:"deals",sales_order_id:"sales_orders",quote_id:"quotes"}[key];
        if (!resource || !value) return value;
        const linked = resource === "sales_orders" || resource === "quotes"
          ? (related.platform_records || []).filter(item => item.resource === resource)
          : (related[resource] || []);
        const match = linked.find(item => Number(item.id) === Number(value));
        return match ? (match.name || match.full_name || match.record_number || value) : value;
      };
      const meta = new Map((config.fields || []).map(fieldInfo => [fieldInfo.key,fieldInfo]));
      const detailLabel = key => meta.get(key)?.label || key.replace(/_/g," ").replace(/\\b\\w/g,letter=>letter.toUpperCase());
      const pair = key => {
        const value = lookupName(key,record[key]);
        return '<div class="qpair"><dt>' + esc(detailLabel(key)) + '</dt><dd>' + esc(valueFor(meta.get(key) || {},value)) + '</dd></div>';
      };
      const details = (title,keys,index) => '<section class="qpanel" id="invoice-info-' + index + '"><h3>' + title + '</h3><div class="qfields"><dl>' + keys.filter((_,i)=>i%2===0).map(pair).join("") + '</dl><dl>' + keys.filter((_,i)=>i%2===1).map(pair).join("") + '</dl></div></section>';
      const initial = ["invoice_number","name","status","account_id","contact_id","sales_order_id","quote_id","deal_id","invoice_date","due_date","currency","exchange_rate","amount"];
      const addresses = ["billing_street","shipping_street","billing_city","shipping_city","billing_state","shipping_state","billing_code","shipping_code","billing_country","shipping_country"];
      const known = new Set([...initial,...addresses,"line_items","subtotal","discount_percent","tax_percent","adjustment","notes","terms","description"]);
      const extra = [...(config.fields || []).map(fieldInfo=>fieldInfo.key),...Object.keys(record)].filter((key,i,array)=>!known.has(key)&&!key.startsWith("_")&&!["id","resource","archived","created_at","updated_at","created_by","modified_by","organization_id","owner_id","related_id","related_type","record_number"].includes(key)&&array.indexOf(key)===i&&typeof record[key]!=="object");
      const panels = [
        details("Invoice Information",initial,0),
        details("Address Information",addresses,1),
        details("Additional Information",["notes","terms","description",...extra],2)
      ];
      const invoiceLines = Array.isArray(record.line_items) ? record.line_items : [];
      const itemHeaders = ["S.NO","Product Name","Quantity","Rate","Amount","Discount (%)","Tax (%)","Total"];
      const itemRow = (item,index) => {
        const qty=n(item.quantity),rate=n(item.unit_price),discountRate=n(item.discount_percent),taxRate=n(item.tax_percent);
        const raw=qty*rate;
        const calculated=raw*(1-discountRate/100)*(1+taxRate/100);
        const cells=[index+1,item.name||item.product_name||"—",qty,formatMoney(rate),formatMoney(raw),discountRate+"%",taxRate+"%",formatMoney(item.total??calculated)];
        return "<tr>" + cells.map(value=>"<td>"+esc(String(value))+"</td>").join("") + "</tr>";
      };
      const itemsTable = '<section class="qpanel" id="invoice-items"><h3>Invoiced Items</h3><div class="qscroll"><table class="qtable"><thead><tr>' + itemHeaders.map(label=>"<th>"+label+"</th>").join("") + '</tr></thead><tbody>' + (invoiceLines.length?invoiceLines.map(itemRow).join(""):'<tr><td colspan="8">No invoiced items recorded. Edit the invoice to add line items.</td></tr>') + '</tbody></table></div></section>';
      const nav = [["invoice-info-0","Invoice Information"],["invoice-info-1","Address Information"],["invoice-items","Invoiced Items"],["invoice-pricing","Invoice Totals"],["invoice-info-2","Additional Information"],...keysFor("invoices").map(key => ["q-related-" + key,labels[key]])];
            return documentRelatedStyles() + '<div class="page-heading"><div><span class="eyebrow">Invoices</span><h1>' + esc(record.name || "Invoice") + '</h1><p class="subheading">' + esc(record.invoice_number || record.record_number || "") + '</p></div><div class="heading-actions"><button type="button" class="button button-ghost" data-platform-return>← Back to Invoices</button><button type="button" class="button button-primary" data-platform-detail-edit="' + Number(id) + '">Edit Invoice</button><a class="button button-ghost" href="/api/invoices/' + Number(id) + '/pdf" download>Download PDF ↓</a></div></div>' +
        '<div class="quote-zoho"><aside><strong>Related List</strong>' + nav.map(([href,label]) => '<a href="#' + href + '">' + label + '</a>').join("") + '</aside><main>' + panels[0] + panels[1] + itemsTable +
        '<section class="qpanel" id="invoice-pricing"><h3>Invoice Totals</h3><form class="qtotals quote-invoice-totals" data-invoice-inline-totals>' +
        line("subtotal","Sub Total",subtotal,field("subtotal",subtotal,'min="0"')) +
        line("discount","Discount (%)",subtotal * discount / 100,field("discount_percent",discount,'min="0" max="100"')) +
        line("tax","Tax (%)",discounted * tax / 100,field("tax_percent",tax,'min="0" max="100"')) +
        line("adjustment","Adjustment",adjustment,field("adjustment",adjustment)) +
        line("grand","Grand Total",discounted * (1 + tax / 100) + adjustment) +
        '<footer><span data-invoice-total-preview aria-live="polite"></span><button type="submit" class="button button-primary">Save totals</button></footer></form></section>' +
        panels[2] + renderPanels("invoices",related) + '<p class="caption">Last updated: ' + esc(formatDateTime(record.updated_at)) + '</p></main></div>';
    }
    const fields = (config.fields || []).filter(f => f.type !== "file");
    const visible = fields.map(field => {
      const module = {account_id:"accounts", contact_id:"contacts", deal_id:"deals"}[field.key];
      const item = module && (related[module] || []).find(item => Number(item.id) === Number(record[field.key]));
      const value = item ? `<a href="/${module}/${Number(item.id)}" data-platform-related="${module}" data-id="${Number(item.id)}">${esc(item.name || item.full_name || [item.first_name,item.last_name].filter(Boolean).join(" "))}</a>` : esc(valueFor(field, record[field.key]));
      return `<div><span class="meta-label" style="font-weight:700">${esc(field.label)}</span><span class="meta-value">${value}</span></div>`;
    }).join("");
    const connected = ["accounts","contacts","deals"].flatMap(module =>
      (related[module] || []).map(item =>
        `<button type="button" class="detail-related-row" data-platform-related="${module}" data-id="${item.id}">${esc(item.name || item.full_name || "Open related record")} ›</button>`
      )
    ).join("");
    const linked = (related.platform_records || []).map(item =>
      `<button type="button" class="detail-related-row" data-platform-related="${esc(item.resource)}" data-id="${Number(item.id)}">${esc(item.record_number || item.name || "Open record")} ›</button>`
    ).join("");
    return `<div class="page-heading"><div><span class="eyebrow">${esc(config.label)}</span>
      <h1>${esc(record.name || config.singular)}</h1>
      <p class="subheading">${esc(record.record_number || "Record detail")}</p></div>
      <div class="heading-actions">
        <button class="button button-ghost" type="button" data-platform-return>← Back to ${esc(config.label)}</button>
        ${resource === "quotes" ? `<a class="button button-ghost" href="/api/quotes/${Number(id)}/pdf" download>Download PDF ↓</a>` : ""}
        ${["products","price_books","vendors","sales_orders","purchase_orders","payments"].includes(resource) ? `<a class="button button-ghost" href="/api/platform/${resource}/${Number(id)}/pdf" download>Download PDF</a>` : ""}
        <button class="button button-primary" type="button" data-platform-detail-edit="${id}">Edit ${esc(config.singular)}</button>
        ${resource === "sales_orders" ? `<div style="position:relative;display:inline-block"><button type="button" class="button button-ghost" data-so-convert-toggle aria-expanded="false" aria-haspopup="true">Convert ▾</button><div data-so-convert-menu hidden style="position:fixed;z-index:2147482999;background:white;border:1px solid #cdd8e8;border-radius:9px;padding:8px;box-shadow:0 8px 22px #17274533"><button type="button" class="button button-ghost" data-so-convert-invoice>Invoice</button><span role="status" data-so-convert-status></span></div></div>` : ""}
        <button class="button button-ghost" type="button" data-platform-detail-delete="${id}">Delete</button>
      </div></div>
      <section class="card detail-summary"><div class="detail-meta-grid">${visible}</div></section>

      ${["payments","products","vendors","price_books","purchase_orders","sales_orders"].includes(resource) ? `${documentRelatedStyles()}<div class="quote-zoho"><aside><strong>Related List</strong>${renderNav(resource)}</aside><main>${renderPanels(resource,related)}</main></div>` : ""}
      <div class="caption">Last updated: ${esc(formatDateTime(record.updated_at))}</div>`;
  }

  function bindPlatformDetail(resource, id) {
    document.querySelectorAll('[data-quote-convert-portal]').forEach(node => node.remove());
    const convertToggle = document.querySelector("[data-quote-convert-toggle]");
    if (resource === "quotes" && convertToggle) {
      const options = document.querySelector("[data-quote-convert-options]");
      // Move the popup outside page headers/cards, whose overflow and transforms
      // can clip fixed-position descendants or create a lower stacking context.
      options.dataset.quoteConvertPortal = "true";
      document.body.appendChild(options);
      options.style.position = "fixed";
      options.style.zIndex = "2147483000";
      options.style.display = "none";
      const closeMenu = () => {
        options.hidden = true;
        options.style.display = "none";
        convertToggle.setAttribute("aria-expanded", "false");
      };
      const positionMenu = () => {
        if (options.hidden) return;
        const rect = convertToggle.getBoundingClientRect();
        const width = Math.max(170, options.offsetWidth || 170);
        const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
        const below = rect.bottom + 6;
        const above = rect.top - options.offsetHeight - 6;
        options.style.left = left + "px";
        options.style.top = ((below + options.offsetHeight > window.innerHeight && above >= 8) ? above : below) + "px";
      };
      window.addEventListener("resize", positionMenu, {passive:true});
      window.addEventListener("scroll", positionMenu, {passive:true, capture:true});
      convertToggle.addEventListener("click", () => {
        const opening = options.hidden;
        options.hidden = !opening;
        options.style.display = opening ? "block" : "none";
        if (opening) positionMenu();
        convertToggle.setAttribute("aria-expanded", String(opening));
      });
      document.addEventListener("pointerdown", event => {
        if (!options.contains(event.target) && !convertToggle.contains(event.target)) closeMenu();
      });
      selectAll("[data-quote-convert]").forEach(button => button.addEventListener("click", async () => {
        const destination = button.dataset.quoteConvert;
        if (!["sales_orders","invoices"].includes(destination)) return;
        const status = document.querySelector("[data-quote-convert-status]");
        button.disabled = true;
        try {
          const quote = await api("/api/platform/quotes/" + Number(id));
          const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
          const lines = Array.isArray(quote.line_items) ? quote.line_items : [];
          const subtotal = lines.length ? lines.reduce((sum,line) => sum + n(line.total ?? (n(line.quantity) * n(line.unit_price) * (1-n(line.discount_percent)/100)*(1+n(line.tax_percent)/100))), 0) : n(quote.amount);
          const payload = {name:quote.name || "Converted Quote",account_id:quote.account_id || null,deal_id:quote.deal_id || null,quote_id:Number(id),related_type:"quotes",related_id:Number(id),line_items:lines.map(line=>({...line})),amount:n(quote.amount),status:"Draft"};
          if (destination === "invoices") Object.assign(payload, {subtotal,discount_percent:n(quote.discount_percent),tax_percent:n(quote.tax_percent),adjustment:n(quote.adjustment)});
          if (destination === "sales_orders") payload.due_date = quote.valid_until || null;
          const created = await api("/api/platform/" + destination,{method:"POST",body:JSON.stringify(payload)});
          if (!created?.id) throw new Error("Conversion did not return a record ID");
          closeMenu();
          options.remove();
          await navigate("/" + destination + "/" + Number(created.id));
        } catch(error) {
          if (status) status.textContent = error.message || "Conversion failed";
          button.disabled = false;
        }
      }));
    }
    selectAll("[data-invoice-inline-totals]").forEach(form => {
      const preview = form.querySelector("[data-invoice-total-preview]");
      const format = new Intl.NumberFormat("en-IN", {style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2});
      const values = () => Object.fromEntries(["subtotal","discount_percent","tax_percent","adjustment"].map(key => [key, Number(form.elements[key].value)]));
      const redraw = () => {
        const data = values();
        const valid = Object.keys(data).every(key => form.elements[key].value !== "" && Number.isFinite(data[key])) && data.subtotal >= 0 && data.discount_percent >= 0 && data.discount_percent <= 100 && data.tax_percent >= 0 && data.tax_percent <= 100;
        if (!valid) { preview.textContent = "Check the amounts and percentages"; return false; }
        const discount = data.subtotal * data.discount_percent / 100;
        const tax = (data.subtotal - discount) * data.tax_percent / 100;
        const totals = {subtotal:data.subtotal, discount, tax, adjustment:data.adjustment,grand:data.subtotal-discount+tax+data.adjustment};
        for (const [key,value] of Object.entries(totals)) {
          const node = form.querySelector('[data-total-key="'+key+'"] strong');
          if (node) node.textContent = format.format(value);
        }
        preview.textContent = totals.grand < 0 ? "Grand total cannot be negative" : "Preview — save to apply";
        return totals.grand >= 0;
      };
      form.addEventListener("input", redraw); redraw();
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!redraw()) return;
        const button = form.querySelector('button[type="submit"]'); button.disabled = true;
        try {
          await api('/api/platform/invoices/' + Number(id), {method:"PATCH",body:JSON.stringify(values())});
          await navigate('/invoices/' + Number(id));
        } catch (error) { preview.textContent = error.message || "Unable to save totals"; button.disabled = false; }
      });
    });
    selectAll("[data-quote-inline-rates]").forEach(form => {
      const preview=form.querySelector("[data-quote-rate-preview]");
      const numbers=()=>({discount_percent:Number(form.elements.discount_percent.value),tax_percent:Number(form.elements.tax_percent.value),adjustment:Number(form.elements.adjustment.value)});
      const totals=form;
      const items=totals?JSON.parse(totals.dataset.lineItems||"[]"):[];
      const currency=totals?.dataset.currency||"INR";
      const formatter=new Intl.NumberFormat("en-IN",{style:"currency",currency:["INR","USD","EUR"].includes(currency)?currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2});
      const redraw=()=>{
        const rates=numbers();
        const valid=form.elements.discount_percent.value!==""&&form.elements.tax_percent.value!==""&&form.elements.adjustment.value!==""&&[rates.discount_percent,rates.tax_percent].every(v=>Number.isFinite(v)&&v>=0&&v<=100)&&Number.isFinite(rates.adjustment);
        if(!valid){if(preview)preview.textContent="Enter rates from 0 to 100";return;}
        const next=calculateQuote(items,rates.discount_percent,rates.tax_percent,rates.adjustment);
        for(const [key,value] of Object.entries(next)){
          const element=totals?.querySelector('[data-total-key="'+key+'"] strong');
          if(element)element.textContent=formatter.format(value);
        }
        if(preview)preview.textContent="Preview — save to apply";
      };
      form.addEventListener("input",redraw);
      redraw();
      form.addEventListener("submit",async event=>{
        event.preventDefault();const rates=numbers();
        if([rates.discount_percent,rates.tax_percent].some(v=>!Number.isFinite(v)||v<0||v>100)||!Number.isFinite(rates.adjustment)){if(preview)preview.textContent="Rates must be from 0 to 100";return;}
        const button=form.querySelector('button[type="submit"]');button.disabled=true;
        try{await api('/api/platform/quotes/'+Number(id),{method:"PATCH",body:JSON.stringify({...rates,line_items:items})});await navigate('/quotes/'+Number(id));}
        catch(error){if(preview)preview.textContent=error.message||"Unable to save";button.disabled=false;}
      });
    });
    if (resource === "sales_orders") {
      const toggle=document.querySelector("[data-so-convert-toggle]");
      const menu=document.querySelector("[data-so-convert-menu]");
      if(toggle&&menu){
        document.body.appendChild(menu);
        const position=()=>{if(menu.hidden)return;const rect=toggle.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(window.innerWidth-180,rect.right-170))+"px";menu.style.top=rect.bottom+6+"px";};
        toggle.addEventListener("click",()=>{menu.hidden=!menu.hidden;toggle.setAttribute("aria-expanded",String(!menu.hidden));position();});
        document.addEventListener("pointerdown",e=>{if(!toggle.contains(e.target)&&!menu.contains(e.target)){menu.hidden=true;toggle.setAttribute("aria-expanded","false");}});
        const convert=menu.querySelector("[data-so-convert-invoice]");
        convert.addEventListener("click",async()=>{
          convert.disabled=true;
          const status=menu.querySelector("[data-so-convert-status]");
          try{
            const order=await api("/api/platform/sales_orders/"+Number(id));
            const num=x=>Number.isFinite(Number(x))?Number(x):0;
            const lines=Array.isArray(order.line_items)?order.line_items:[];
            const payload={
              name:order.name||"Converted Sales Order",
              sales_order_id:Number(id),
              account_id:order.account_id||null,
              deal_id:order.deal_id||null,
              quote_id:order.quote_id||null,
              line_items:lines.map(line=>({...line})),
              amount:num(order.amount),
              subtotal:order.subtotal==null?(lines.length?lines.reduce((sum,line)=>sum+num(line.quantity)*num(line.unit_price),0):num(order.amount)):num(order.subtotal),
              discount_percent:num(order.discount_percent),
              tax_percent:num(order.tax_percent),
              adjustment:num(order.adjustment),
              status:"Draft"
            };
            const created=await api("/api/platform/invoices",{method:"POST",body:JSON.stringify(payload)});
            if(!created?.id)throw new Error("Invoice creation returned no ID");
            menu.remove();
            await navigate("/invoices/"+Number(created.id));
          }catch(e){status.textContent=e.message||"Invoice conversion failed";convert.disabled=false;}
        });
      }
    }
    selectAll("[data-platform-return]").forEach(button => button.addEventListener("click", () => navigate(`/${resource}`)));
    selectAll("[data-platform-detail-edit]").forEach(button => button.addEventListener("click", () => navigate(`/${resource}/edit/${id}`)));
    selectAll("[data-platform-detail-delete]").forEach(button => button.addEventListener("click", () => deletePlatformRecord(resource, id)));
    selectAll("[data-platform-related]").forEach(button => button.addEventListener("click", () =>
      navigate(`/${button.dataset.platformRelated}/${Number(button.dataset.id)}`)
    ));
  }
  return { platformDetailView, bindPlatformDetail };
}
