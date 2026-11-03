import { promptDialog } from "../core/dialogs.js?v=20261027-centered-popups-v1";
// APEX/AI cockpit, assistant and approval UI domain.
export function createAiFeature(ctx) {
  const { state, MODULES, $, $$, esc, titleCase, initials, formatDate, formatDateTime, formatMoney, slug, pathFor, badge, lookupName, api, toast, pageHeader, loading, emptyState, navigate, openRecordModal, openPlatformModal, closeModal, confirmAction, fieldHtml, platformDisplay, platformTable, platformPanel, ensureLookups, ensurePlatformLookup, invalidateLookups, refreshMeta, performanceTable, renderRoute } = ctx;

  async function aiDashboardView() {
    const data = await api("/api/ai/dashboard");
    const totals = data.totals || {};
    const journey = data.journey || [];
    const performance = data.performance || {};
    const insight = data.insight;

    const stat = (label, value, detail, tone = "") => `<article class="card ai-cockpit-stat ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`;
    const journeyHtml = journey.map((item, index) => `<button class="ai-journey-stage" data-go="/${esc(item.key === "leads" ? "leads" : item.key === "conversations" ? "activities/tasks" : item.key)}"><span class="ai-journey-index">${index + 1}</span><strong>${esc(item.label)}</strong><small>${item.count} · ${esc(item.detail)}</small></button>`).join('<span class="ai-journey-arrow" aria-hidden="true">→</span>');
    const people = performance.people || [];
    const attention = performance.attention || {};
    // Use the same borderless record-row design as the main Dashboard queue.
    // Keep per-record links intact; do not send every quotation to the list page.
    const blockers = [
      ...(attention.stuck_leads || []).map((item) => `<button type="button" class="ai-queue-row" data-go="/leads/${Number(item.id)}"><span class="ai-queue-icon" aria-hidden="true">!</span><span class="ai-queue-copy"><strong>${esc(item.name)}</strong><small>Lead stuck at ${esc(item.status)}${item.next_follow_up ? ` · follow-up ${formatDate(item.next_follow_up)}` : ""}</small></span><span class="ai-queue-chevron" aria-hidden="true">›</span></button>`),
      ...(attention.quotes_needing_follow_up || []).map((item) => `<button type="button" class="ai-queue-row" data-go="/quotes/${Number(item.id)}"><span class="ai-queue-icon" aria-hidden="true">₹</span><span class="ai-queue-copy"><strong>${esc(item.name)}</strong><small>${esc(item.status)} · quotation needs follow-up</small></span><span class="ai-queue-chevron" aria-hidden="true">›</span></button>`),
    ].join("");
    const cleanPrefix = value => String(value ?? "").trim().replace(/^(?:(?:[-•*]|\\d+[.)])\\s*)+/,"").trim();
    const assessmentFacts = [
      {id:"performance", label:"Performance", title:"Sales performance", details:[
        ["Team target",formatMoney(performance.totals?.target || 0)],
        ["Achieved",formatMoney(performance.totals?.achieved || 0)],
        ["Sales conversions",String((performance.people||[]).reduce((n,p)=>n+Number(p.conversions||0),0))],
        ["Incentives earned",formatMoney(performance.totals?.incentive||0)]
      ], note:"Achievement is based on the payment and target rules configured in CRM."},
      {id:"near-target",label:"Near Target",title:"Salespeople approaching targets",details:(performance.people||[]).filter(p=>p.target_configured && Number(p.achievement_percent)>=80 && Number(p.achievement_percent)<100).map(p=>[p.name,Number(p.achievement_percent||0).toFixed(1)+"% · "+formatMoney(p.achieved||0)+" achieved"]), note:"Near target means at least 80% but less than 100% of the configured target."},
      {id:"stuck",label:"Stuck Leads",title:"Leads requiring immediate follow-up",details:(attention.stuck_leads||[]).map(p=>["Lead #"+p.id+" · "+p.name, (p.status||"Unknown status")+" · "+(p.next_follow_up?"Follow-up "+formatDate(p.next_follow_up):"Follow-up not scheduled"),"/leads/"+Number(p.id)]),note:"Review assignment, latest activity and next follow-up date."},
      {id:"quotations",label:"Quotations Needing Follow-up",title:"Quotations requiring review",details:(attention.quotes_needing_follow_up||[]).map(p=>["Quotation #"+p.id+" · "+p.name,(p.status||"Unknown status")+" · "+(p.valid_until?"Valid until "+formatDate(p.valid_until):"Validity not set"),"/quotes/"+Number(p.id)]),note:"Prioritize draft, pending approval and expiring quotations."}
    ];
    const assessmentTabs = `<div class="apex-assessment-tabs" role="tablist" aria-label="Executive assessment categories">${assessmentFacts.map((tab,i)=>`<button type="button" role="tab" id="apex-assessment-tab-${tab.id}" aria-controls="apex-assessment-panel-${tab.id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-apex-assessment-tab="${tab.id}">${esc(tab.label)}</button>`).join("")}</div>`;
    const assessmentPanels = assessmentFacts.map((tab,i)=>`<section id="apex-assessment-panel-${tab.id}" class="apex-assessment-panel" role="tabpanel" aria-labelledby="apex-assessment-tab-${tab.id}" ${i?"hidden":""}><h3>${esc(tab.title)}</h3>${tab.details.length?`<div class="apex-assessment-facts">${tab.details.map(([name,value,href])=>href ? `<a class="apex-assessment-fact apex-record-link" href="${esc(href)}"><span>${esc(name)} ↗</span><strong>${esc(value)}</strong></a>` : `<div class="apex-assessment-fact"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>`:"<p>No records currently match this category.</p>"}<p class="apex-assessment-note">${esc(tab.note)}</p></section>`).join("");
    const recordTargets = message => {
      const value = String(message || "");
      const matches = [];
      const seen = new Set();
      const expression = /\b(?:quotation|quote|lead)\s*(?:ids?|#)?\s*#?(\d+)(?:\s*(?:,|and|&)\s*(?:#|id\s*)?(\d+))?/gi;
      for (const found of value.matchAll(expression)) {
        const resource = /lead/i.test(found[0].split(/\s/)[0]) ? "leads" : "quotes";
        for (const number of [found[1],found[2]].filter(Boolean)) {
          const key=resource+":"+number;
          if(!seen.has(key)){seen.add(key);matches.push({label:(resource==="leads"?"Lead #":"Quotation #")+number,url:"/"+resource+"/"+Number(number)});}
        }
      }
      // "stuck leads ID 193 and ID 190" can refer to multiple records.
      const subject=/lead/i.test(value)?"leads":/quot|draft/i.test(value)?"quotes":null;
      if(subject){
        for(const found of value.matchAll(/\b(?:id|#)\s*(\d+)\b/gi)){
          const key=subject+":"+found[1];
          if(!seen.has(key)){seen.add(key);matches.push({label:(subject==="leads"?"Lead #":"Quotation #")+found[1],url:"/"+subject+"/"+Number(found[1])});}
        }
      }
      if(!matches.length){
        if(/target|achiev|revenue|incentive/i.test(value))return [{label:"View sales targets",url:"/sales_targets"}];
        if(/lead|follow.up/i.test(value))return [{label:"View leads",url:"/leads"}];
        if(/quot|draft|approval/i.test(value))return [{label:"View quotations",url:"/quotes"}];
      }
      return matches;
    };
    const listRows = (items, numbered) => items.length ? `<div class="apex-readout-items">${items.map((item,i)=>{
      const description=cleanPrefix(item);
      const links=recordTargets(description);
      return `<div class="apex-readout-item"><span class="apex-readout-marker" aria-hidden="true">${numbered?i+1:"!"}</span><div class="apex-action-copy">${links.length===1 ? `<a class="apex-action-primary-link" href="${esc(links[0].url)}">${esc(description)} ↗</a>` : `<span>${esc(description)}</span>`}${links.length>1 ? `<div class="apex-action-links">${links.map(link=>`<a href="${esc(link.url)}" class="apex-action-record-link">${esc(link.label)} ↗</a>`).join("")}</div>` : ""}</div></div>`;
    }).join("")}</div>` : "<p>Nothing reported.</p>";
    const insightHtml = `<div class="apex-readout"><div class="apex-readout-summary"><h3>Executive assessment</h3><p class="apex-assessment-intro">Review verified CRM performance, outstanding leads and quotations by category.</p>${assessmentTabs}${assessmentPanels}</div><div class="apex-readout-columns"><section><h3>Recommended actions</h3>${listRows(insight?.actions||[],true)}</section><section><h3>Risks and gaps</h3>${listRows(insight?.risks||[],false)}</section></div><small>${insight?"AI recommendations are advisory. Confirm details in CRM records.":"AI analysis unavailable; operational metrics remain available."}</small></div>`;
    const targetTotal = Number(performance.totals?.target || 0);
    const achievedTotal = Number(performance.totals?.achieved || 0);
    const targetRate = targetTotal ? (100 * achievedTotal / targetTotal).toFixed(1) + "%" : "Not configured";
    const maxStage = Math.max(1, ...journey.map(s => Number(s.count || 0)));
    const stagePaths = {leads:"/leads",conversations:"/activities",site_visits:"/site_visits",quotes:"/quotes",invoices:"/invoices",payments:"/payments"};
    const funnelRows = journey.map(s => `<a class="ai-management-funnel-row" href="${esc(stagePaths[s.key] || "/dashboard")}"><span>${esc(s.label)}</span><span class="ai-management-bar"><i style="width:${Math.max(2, Math.min(100, Number(s.count||0)*100/maxStage))}%"></i></span><b>${Number(s.count||0)}</b><small>${esc(s.detail)}</small></a>`).join("");
    const teamRows = [...people].sort((a,b)=>Number(b.achievement_percent||0)-Number(a.achievement_percent||0)).map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${formatMoney(p.target||0)}</td><td>${formatMoney(p.achieved||0)}</td><td><span class="ai-management-bar"><i style="width:${Math.max(0,Math.min(100,Number(p.achievement_percent||0)))}%"></i></span>${Number(p.achievement_percent||0).toFixed(1)}%</td><td>${Number(p.conversions||0)}</td><td>${formatMoney(p.incentive||0)}</td></tr>`).join("");
    const breakdown = data.breakdown || {};
    const segmentLabels = {leads:"Lead stages",activities:"Follow-up activity",site_visits:"Site visits",quotes:"Quotation statuses",invoices:"Invoice statuses",payments:"Payment statuses"};
    const segmentRoutes = {leads:"/leads",activities:"/activities",site_visits:"/site_visits",quotes:"/quotes",invoices:"/invoices",payments:"/payments"};
    const segments = Object.entries(segmentLabels).map(([resource,label])=>{
      const entries = Object.entries(breakdown[resource]||{});
      const total = entries.reduce((n,[,count])=>n+Number(count||0),0);
      return `<a href="${esc(segmentRoutes[resource])}" class="ai-management-segment"><h3>${esc(label)}</h3><strong>${total}</strong>${entries.length ? entries.map(([status,count])=>`<span><small>${esc(status)}</small><b>${Number(count)}</b></span>`).join("") : `<small>No recorded statuses</small>`}</a>`;
    }).join("");
    const managementSegments = `<section class="card ai-management-card"><div class="card-head"><div class="card-head-copy"><h2>Operational status tracking</h2><small>Live breakdown by pipeline and document status</small></div></div><div class="card-body ai-management-segments">${segments}</div></section>`;


    const converted = Object.entries(data.breakdown?.leads || {}).filter(([status]) => /converted/i.test(status)).reduce((n,[,value]) => n + Number(value||0),0);
    const analyticGroups = [
      {key:"received",label:"Leads received",title:"Leads received over time",kind:"line",values:data.trend?.series?.leads||[],labels:data.trend?.months||[]},
      {key:"conversions",label:"Conversions",title:"Lead conversions and stages",kind:"pie",values:data.breakdown?.leads||{}},
      {key:"payments",label:"Payments",title:"Payment activity over time",kind:"line",values:data.trend?.series?.payments||[],labels:data.trend?.months||[]},
      {key:"visits",label:"Visits",title:"Site visits by status",kind:"pie",values:data.breakdown?.site_visits||{}},
      {key:"target",label:"Team target",title:"Sales target by team member",kind:"bar",values:Object.fromEntries((performance.people||[]).map(p=>[p.name||"Unknown",Number(p.target||0)]))},
      {key:"achieved",label:"Achieved",title:"Sales collections by team member",kind:"bar",values:Object.fromEntries((performance.people||[]).map(p=>[p.name||"Unknown",Number(p.achieved||0)]))}
    ];
    const chartMarkup = (group) => {
      if(group.kind==="line"){
        const numbers=group.values.map(v=>Number(v||0));
        if(!numbers.length)return "<p>No historical records.</p>";
        const high=Math.max(1,...numbers);
        const points=numbers.map((n,i)=>[24+i*452/Math.max(1,numbers.length-1),154-n/high*126]);
        return `<svg class="apex-chart-line" viewBox="0 0 500 192" role="img" aria-label="${esc(group.title)}"><polyline points="${points.map(p=>p.join(",")).join(" ")}" fill="none" stroke="currentColor" stroke-width="3"/>${points.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="currentColor"><title>${esc(group.labels[i]||"")}: ${numbers[i]}</title></circle><text x="${p[0]}" y="180" text-anchor="middle" font-size="11" fill="currentColor">${esc((group.labels[i]||"").slice(5))}</text>`).join("")}</svg>`;
      }
      if(group.kind==="pie"){
        const parts=Object.entries(group.values).filter(([,v])=>Number(v)>0);
        const total=parts.reduce((n,[,v])=>n+Number(v),0);
        if(!total)return "<p>No data recorded.</p>";
        let offset=0;
        const segments=parts.map(([name,n],i)=>{const begin=offset;offset+=Number(n)/total*100;return `hsl(${(210+i*47)%360} 65% 55%) ${begin}% ${offset}%`;}).join(",");
        return `<div class="apex-chart-pie" style="background:conic-gradient(${segments})"></div><div class="apex-chart-legend">${parts.map(([name,n])=>`<span>${esc(name)} <b>${Number(n)}</b></span>`).join("")}</div>`;
      }
      const entries=group.kind==="line"?group.values.map((value,i)=>[group.labels[i],value]):Object.entries(group.values);
      const max=Math.max(1,...entries.map(([,n])=>Number(n||0)));
      return `<div class="apex-chart-bars">${entries.map(([name,value])=>`<div class="apex-chart-bar-row"><span>${esc(name||"Unknown")}</span><i style="width:${Math.max(1,Number(value||0)/max*100)}%"></i><b class="apex-chart-value">${Number(value||0).toLocaleString("en-IN")}</b></div>`).join("")}</div>`;
    };

    const monthlyGraph = (kind) => {
      const months = data.trend?.months || [];
      const invoices = (data.trend?.series?.invoices || []).map(Number);
      const payments = (data.trend?.series?.payments || []).map(Number);
      if(!months.length)return "<p>No dated records available.</p>";
      const high = Math.max(1,...invoices,...payments);
      const x = i => 30 + i*455/Math.max(1,months.length-1);
      const y = n => 155 - Number(n||0)/high*125;
      const line = values => values.map((n,i)=>x(i)+","+y(n)).join(" ");
      const area = `M ${x(0)},155 L ${invoices.map((n,i)=>x(i)+","+y(n)).join(" L ")} L ${x(months.length-1)},155 Z`;
      const columns = invoices.map((n,i)=>`<rect x="${x(i)-13}" y="${y(n)}" width="26" height="${155-y(n)}" fill="var(--primary,#3976dd)" opacity=".45"><title>Invoices ${months[i]}: ${n}</title></rect>`).join("");
      const ticks = months.map((m,i)=>`<text x="${x(i)}" y="184" text-anchor="middle" font-size="10" fill="currentColor">${esc(m.slice(5))}</text>`).join("");
      return `<svg class="apex-chart-line" viewBox="0 0 520 202" role="img" aria-label="${kind==="area"?"Monthly invoice activity":"Monthly invoices and payments"}">${kind==="area"?`<path d="${area}" fill="var(--primary,#3976dd)" fill-opacity=".20"/><polyline points="${line(invoices)}" stroke="var(--primary,#3976dd)" stroke-width="3" fill="none"/>`:`${columns}<polyline points="${line(payments)}" fill="none" stroke="#169f89" stroke-width="3"/>`}${ticks}</svg>`;
    };
    const extraVisuals = `<div class="ai-management-chart-grid"><section class="card"><div class="card-head"><h2>Invoice creation trend</h2></div><div class="card-body"><p>Invoice records created each month</p>${monthlyGraph("area")}</div></section><section class="card"><div class="card-head"><h2>Invoices and payments</h2></div><div class="card-body"><p>Monthly record counts · Blue: invoices · Green: payments</p>${monthlyGraph("combo")}</div></section></div>`;
    const analyticTabs = `<section class="card ai-management-card"><div class="card-head"><h2>Visual analytics</h2></div><div class="card-body"><div class="apex-segmented-tabs">${analyticGroups.map((g,i)=>`<button type="button" data-apex-analytic-tab="${g.key}" aria-pressed="${i===0}">${g.label}</button>`).join("")}</div>${analyticGroups.map((g,i)=>`<div class="apex-analytic-panel" data-apex-analytic-panel="${g.key}" ${i?"hidden":""}><h3>${g.title}</h3>${chartMarkup(g)}</div>`).join("")}</div></section>`;
    const managementNav = `<nav class="ai-management-tabs" aria-label="Dashboard sections"><button type="button" data-apex-section="ai-overview">Overview</button><button type="button" data-apex-section="ai-revenue">Revenue journey</button><button type="button" data-apex-section="ai-team">Sales performance</button><button type="button" data-apex-section="ai-attention">Attention</button><button type="button" data-apex-section="ai-analysis">AI readout</button></nav>`;
    const managementFunnel = `<section class="card ai-management-card" id="ai-revenue"><div class="card-head"><div class="card-head-copy"><h2>Revenue journey analytics</h2><small>CRM module volumes; select a stage to drill down. Not cohort conversion rates.</small></div></div><div class="card-body ai-management-funnel">${funnelRows}</div></section>`;
    const managementScorecard = `<section class="card ai-management-card" id="ai-team"><div class="card-head"><div class="card-head-copy"><h2>Salesperson scorecard</h2><small>Target vs collections, achievement, conversions and earned incentive</small></div><button class="card-head-link" data-go="/sales_targets">Manage targets →</button></div><div class="card-body">${teamRows ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Salesperson</th><th>Target</th><th>Achieved</th><th>Progress</th><th>Conversions</th><th>Incentive</th></tr></thead><tbody>${teamRows}</tbody></table></div>` : emptyState("◎","No salespeople returned","Configure targets to start tracking.")}</div></section>`;
    const managementSummary = `<div class="ai-management-highlights"><div><span>Target achievement</span><strong>${esc(targetRate)}</strong></div><div><span>Stuck leads</span><strong>${(attention.stuck_leads||[]).length}</strong></div><div><span>Quotes needing attention</span><strong>${(attention.quotes_needing_follow_up||[]).length}</strong></div></div>`;

    return `${pageHeader("Intelligence", "Apex AI Copilot", "One source of truth for the complete Lead → Visit → Quotation → Invoice → Payment → Incentive journey.", `<button class="button button-ghost" data-go="/ai/exceptions">Quotation exceptions</button><button class="button button-primary" data-go="/settings/general">Settings &amp; General Setup</button>`)}
      <section class="card apex-assistant-card"><div class="card-head"><div class="card-head-copy"><h2>Ask APEX</h2><small>Natural-language CRM search, grounded summaries, and explainable lead scoring.</small></div><span class="ai-model-badge">APEX CRM engine</span></div><div class="card-body"><form data-apex-assistant-form class="apex-assistant-form" novalidate><input class="field-input" name="question" aria-label="Ask APEX about CRM records" required minlength="3" placeholder="Show deals above ₹5 lakh closing this month" /><button class="button button-primary" type="submit">Ask APEX</button></form><div class="apex-quick-prompts"><button class="button button-ghost button-small" data-apex-prompt="Show stale deals">Show stale deals</button><button class="button button-ghost button-small" data-apex-prompt="Which leads have not been contacted for 7 days?">Uncontacted leads</button><button class="button button-ghost button-small" data-apex-prompt="Score all leads">Score leads</button></div><div data-apex-output class="apex-output" role="status" aria-live="polite" aria-atomic="true"><p class="apex-muted">Try a CRM question. Results stay within CONVOSIS CRM and show their uncertainty.</p></div></div></section>
      ${managementNav}<section id="ai-overview" class="ai-cockpit-stats">${stat("Leads received", totals.leads || 0, `${totals.assigned_leads || 0} assigned`)}${stat("Conversations", totals.conversations || 0, `${totals.open_followups || 0} open follow-ups`)}${stat("Team target", formatMoney(performance.totals?.target || 0), "active sales targets", "blue")}${stat("Achieved", formatMoney(performance.totals?.achieved || 0), "from cleared payments", "green")}${stat("Collected", formatMoney(totals.collected || 0), "received and cleared", "green")}${stat("Incentives", formatMoney(performance.totals?.incentive || 0), "earned by performance", "amber")}</section>
      ${managementSummary}${analyticTabs}${extraVisuals}${managementFunnel}${managementSegments}<section class="card ai-journey-card"><div class="card-head"><div class="card-head-copy"><h2>Complete revenue journey</h2><small>Live counts from every connected CRM module</small></div><span class="ai-live-pill"><i></i>Live data</span></div><div class="ai-journey-track">${journeyHtml}</div></section>
      ${managementScorecard}<div class="dashboard-grid management-grid"><section class="card"><div class="card-head"><div class="card-head-copy"><h2 id="ai-analysis">Management readout</h2><small>AI-assisted analysis grounded in CRM records</small></div><span class="ai-model-badge">APEX intelligence</span></div><div class="card-body">${insightHtml}</div></section><section class="card"><div class="card-head"><div class="card-head-copy"><h2 id="ai-attention">Attention queue</h2><small>Where revenue is getting stuck</small></div></div><div class="card-body">${blockers ? `<div class="ai-queue-list" aria-label="Records requiring action">${blockers}</div>` : emptyState("✓", "Nothing urgent", "Leads and quotations are up to date.")}</div></section></div>
      <section class="card"><div class="card-head"><div class="card-head-copy"><h2>Individual sales performance</h2><small>Target vs achievement, conversions and earned incentive</small></div><button class="card-head-link" data-go="/sales_targets">Manage targets →</button></div><div class="card-body">${people.length ? performanceTable(people) : emptyState("◎", "No active salespeople", "Add active users and sales targets to see performance.")}</div></section>`;
  }
  
  function apexAssistantResultHtml(response) {
    const result = response.result || {};
    if (response.intent === "search") {
      const rows = result.results || [];
      return `<div class="apex-answer"><strong>${esc(response.answer)}</strong><small>${esc(response.provider || "APEX")} · ${esc(response.uncertainty || "Grounded in CRM records")}</small></div>${rows.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Record</th><th>Status / stage</th><th>Amount</th><th>Updated</th><th></th></tr></thead><tbody>${rows.map((row) => `<tr><td><a class="table-link" href="/${result.resource}/${row.id}">${esc(row.label)}</a></td><td>${esc(row.status || row.stage || "—")}</td><td>${row.amount != null ? formatMoney(row.amount) : "—"}</td><td>${formatDateTime(row.updated_at)}</td><td><button class="table-action" data-apex-summary-resource="${result.resource}" data-apex-summary-id="${row.id}">Summary</button></td></tr>`).join("")}</tbody></table></div>` : emptyState("◎", "No matching records", "APEX did not find records matching the interpreted filters.")}`;
    }
    if (response.intent === "summary") return `<div class="apex-answer"><strong>${esc(response.answer)}</strong><small>${esc(response.uncertainty || "Grounded in the current record")}</small></div><div class="apex-summary-grid">${(result.highlights || []).map((item) => `<div><span>${esc(item)}</span></div>`).join("")}</div><p class="apex-summary-text">${esc(result.record?.notes || result.record?.description || "No additional narrative is stored on this record.")}</p><a class="button button-ghost button-small" href="/${result.resource}/${result.record.id}">Open record</a>`;
    const leads = result.leads || [];
    return `<div class="apex-answer"><strong>${esc(response.answer)}</strong><small>${esc(result.method || "Explainable scoring")}</small></div>${leads.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Lead</th><th>Score</th><th>Confidence</th><th>Uncertainty</th><th></th></tr></thead><tbody>${leads.slice(0, 25).map((lead) => `<tr><td><a class="table-link" href="/leads/${lead.id}">${esc(lead.name)}</a><small class="table-subtext">${esc(lead.company || "No company")}</small></td><td><span class="score-pill">${lead.score}/100</span></td><td>${badge(lead.confidence)}</td><td>${esc(lead.uncertainty)}</td><td><button class="table-action" data-apex-score-detail='${esc(JSON.stringify(lead))}'>Why?</button></td></tr>`).join("")}</tbody></table></div>` : emptyState("◎", "No leads to score", "Add active leads to calculate explainable scores.")}`;
  }
  
  if (typeof window !== "undefined" && !window.__apexSegmentedBound) {
    window.__apexSegmentedBound=true;
    document.addEventListener("click",event=>{
      const selected=event.target.closest("[data-apex-analytic-tab]");
      if(!selected)return;
      const root=selected.closest(".card");
      root.querySelectorAll("[data-apex-analytic-tab]").forEach(tab=>tab.setAttribute("aria-pressed",String(tab===selected)));
      root.querySelectorAll("[data-apex-analytic-panel]").forEach(panel=>{panel.hidden=panel.dataset.apexAnalyticPanel!==selected.dataset.apexAnalyticTab;});
    });
  }
  if (typeof window !== "undefined" && !window.__apexAssessmentBound) {
    window.__apexAssessmentBound=true;
    document.addEventListener("click",event=>{
      const tab=event.target.closest("[data-apex-assessment-tab]");
      if(!tab)return;
      const root=tab.closest(".apex-readout-summary");
      root.querySelectorAll("[data-apex-assessment-tab]").forEach(button=>{
        const active=button===tab;
        button.setAttribute("aria-selected",String(active));button.tabIndex=active?0:-1;
      });
      root.querySelectorAll(".apex-assessment-panel").forEach(panel=>{
        panel.hidden=panel.id!=="apex-assessment-panel-"+tab.dataset.apexAssessmentTab;
      });
    });
  }
  // Section tabs are in-page controls, not SPA routes. Avoid hash-navigation interception.
  if (typeof document !== "undefined") document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-apex-section]");
    if (!control) return;
    const nav = control.closest(".ai-management-tabs");
    if (!nav) return;
    event.preventDefault();
    event.stopPropagation();
    const target = document.getElementById(control.dataset.apexSection);
    if (!target) return;
    nav.querySelectorAll("[data-apex-section]").forEach(button => {
      button.setAttribute("aria-current", button === control ? "true" : "false");
    });
    target.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"});
  }, true);

  function bindApexAssistant() {
    const form = $(`[data-apex-assistant-form]`), output = $(`[data-apex-output]`);
    if (!form || !output) return;
    $$(`[data-apex-prompt]`).forEach((button) => button.addEventListener("click", () => { form.elements.question.value = button.dataset.apexPrompt; form.requestSubmit(); }));
    let pending = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pending) return;
      const question = form.elements.question.value.trim();
      if (question.length < 3) { output.innerHTML = `<p class="apex-error">Enter a CRM question with at least 3 characters.</p>`; form.elements.question.focus(); return; }
      pending = true;
      const controls = [form.querySelector('[type="submit"]'), ...$$('[data-apex-prompt]')];
      controls.forEach((button) => { button.disabled = true; });
      output.setAttribute("aria-busy", "true");
      output.innerHTML = `<p class="apex-muted">APEX is reading current CRM records…</p>`;
      try {
        const result = await api("/api/ai/assistant", {method:"POST", body:JSON.stringify({question})});
        output.innerHTML = apexAssistantResultHtml(result);
        bindApexAssistantResult();
      } catch (error) {
        output.innerHTML = `<p class="apex-error">${esc(error.message)}. Try again; no CRM action was performed.</p>`;
      } finally {
        pending = false;
        controls.forEach((button) => { button.disabled = false; });
        output.removeAttribute("aria-busy");
      }
    });
  }
  
  function bindApexAssistantResult() {
    $$(`[data-apex-summary-resource]`).forEach((button) => button.addEventListener("click", async () => { try { const result = await api("/api/ai/summary", {method:"POST", body:JSON.stringify({resource:button.dataset.apexSummaryResource, record_id:Number(button.dataset.apexSummaryId)})}); $(`[data-apex-output]`).innerHTML = apexAssistantResultHtml({intent:"summary", answer:`APEX summarized ${result.resource} #${result.record.id}.`, result, uncertainty:"Summary grounded in the current record and related activity counts."}); } catch (error) { toast("Summary unavailable", error.message, "error"); } }));
    $$(`[data-apex-score-detail]`).forEach((button) => button.addEventListener("click", () => { const lead = JSON.parse(button.dataset.apexScoreDetail); toast(`APEX score: ${lead.score}/100`, lead.factors.map((factor) => `${factor.name}: ${factor.points}/${factor.max_points}`).join(" · ")); }));
  }
  
  async function aiView() {
    // Status and readiness are advisory panels: if one fails (anything but a lost sign-in) the
    // deterministic queue must still render, so degrade them instead of failing the whole view.
    const soft = (request, fallback) => request.catch((error) => (error.status === 401 ? Promise.reject(error) : fallback(error)));
    const [status, readiness, deterministic] = await Promise.all([
      soft(api("/api/ai/status"), (error) => ({ configured: false, available: false, model: "unavailable", detail: error.message, csrf_token: state.aiStatus?.csrf_token })),
      soft(api("/api/ai/exceptions/readiness"), (error) => ({ deterministic_ready: false, approval_ready: false, ai_ready: false, checks: [{ key: "readiness", ready: false, detail: error.message }] })),
      api(`/api/ai/exceptions?view=${encodeURIComponent(state.aiExceptionView)}`),
    ]);
    state.aiStatus = status;
    const ranked = state.aiExceptionOrder === "ai_ranked" && state.aiRankedItems;
    const data = ranked ? { ...deterministic, items: state.aiRankedItems, order: "ai_ranked" } : deterministic;
    const viewLabels = { needs_review: "Needs review", acted_on: "Acted on", clarification: "Needs clarification", corrections: "Data corrections", dismissed: "Dismissed", all: "All active" };
    const views = Object.entries(viewLabels).map(([key, label]) => `<button class="ai-view-tab ${state.aiExceptionView === key ? "active" : ""}" data-ai-view="${key}">${esc(label)}</button>`).join("");
    const rows = !readiness.deterministic_ready ? `<div class="ai-empty"><span>!</span><h3>Quotation automation needs setup</h3><p>${esc(readiness.checks.filter((item) => !item.ready && item.key !== "cloud_ai").map((item) => item.detail).join(" · "))}</p></div>` : data.items.length ? data.items.map((item) => {
      const selected = state.aiSelectedException === item.id;
      return `<article class="ai-exception-row ${selected ? "selected" : ""}" data-ai-exception="${esc(item.id)}">
        <div class="ai-trigger"><strong>${esc(item.trigger_label)}</strong><small>${esc(item.actionability.replaceAll("_", " "))}</small></div>
        <div class="ai-quote"><b>${esc(item.quote_label)}</b><small>${esc(item.owner_name || "Owner unavailable")} · ${item.valid_until ? formatDate(item.valid_until) : "No valid date"}</small></div>
        <div class="ai-amount"><strong>${formatMoney(item.amount)}</strong><small>${esc(item.review_state.replaceAll("_", " "))}</small></div>
        <button class="button button-small button-ghost" data-ai-review="${esc(item.id)}">Review</button>
      </article>`;
    }).join("") : `<div class="ai-empty"><span>✓</span><h3>${state.aiExceptionView === "needs_review" ? "No quotation exceptions need review" : "Nothing in this view"}</h3><p>Evaluated using ${esc(data.rule_version)}. Change the view or review the source quotations if this looks wrong.</p></div>`;
    const selected = data.items.find((item) => item.id === state.aiSelectedException) || null;
    const proposal = selected?.proposal;
    const detail = selected ? `<aside class="card ai-exception-detail" aria-labelledby="ai-detail-title">
      <div class="card-head"><div class="card-head-copy"><h2 id="ai-detail-title" tabindex="-1">${esc(selected.quote_label)}</h2><small>${esc(selected.trigger_label)} · ${esc(selected.rule_version)}</small></div><button class="card-head-link" data-ai-close-detail>Close</button></div>
      <div class="card-body ai-detail-body">
        <dl class="ai-facts"><div><dt>Owner</dt><dd>${esc(selected.owner_name || "Unavailable")}</dd></div><div><dt>Amount at risk</dt><dd>${formatMoney(selected.amount)}</dd></div><div><dt>Validity</dt><dd>${selected.valid_until ? formatDate(selected.valid_until) : "Missing"}</dd></div><div><dt>Source updated</dt><dd>${formatDateTime(selected.source_updated_at)}</dd></div></dl>
        <p class="ai-rule-reason">Included because ${esc(selected.trigger_label.toLowerCase())}. The CRM rule determined this exception; AI did not.</p>
        ${selected.rationale ? `<section class="ai-rationale"><strong>Why AI placed it here</strong><p>${esc(selected.rationale)}</p></section>` : ""}
        ${proposal ? `<section class="ai-task-preview"><span class="eyebrow">Exact Task preview</span><h3>${esc(proposal.subject)}</h3><dl><div><dt>Owner</dt><dd>${esc(proposal.owner_name || `#${proposal.owner_id}`)}</dd></div><div><dt>Priority</dt><dd>${esc(proposal.priority)}</dd></div><div><dt>Due</dt><dd>${formatDateTime(proposal.due_at)}</dd></div><div><dt>Status</dt><dd>Open</dd></div><div><dt>Source</dt><dd>${esc(proposal.source)}</dd></div></dl><p>${esc(proposal.description || "No drafted description")}</p><button class="button button-primary" data-ai-approve-proposal="${esc(proposal.id)}">Create Task</button></section>` : selected.actionability === "actionable" ? `<div class="ai-setup"><strong>Generate a Task proposal</strong><p>Switch to AI-ranked order to request a bounded explanation and exact Task draft.</p></div>` : `<div class="ai-setup"><strong>Task creation is blocked</strong><p>Resolve the ${esc(selected.actionability.replaceAll("_", " "))} condition in the source quotation first.</p></div>`}
        <div class="ai-review-actions"><button class="button button-ghost button-small" data-ai-review-state="dismissed">Dismiss for 7 days</button><button class="button button-ghost button-small" data-ai-review-state="corrected">Report data/rule issue</button><button class="button button-ghost button-small" data-ai-review-state="unclear">Mark unclear</button><a class="button button-ghost button-small" href="${esc(selected.quote_path || "/quotes")}">Open quotation</a></div>
      </div>
    </aside>` : "";
    const checks = readiness.checks.map((item) => `<li class="${item.ready ? "ready" : "blocked"}"><b>${item.ready ? "✓" : "!"}</b><span>${esc(titleCase(item.key))}<small>${esc(item.detail)}</small></span></li>`).join("");
    const orderLabel = data.order === "ai_ranked" ? `AI-ranked · ${status.model}` : "Deterministic order";
    return `${pageHeader("Revenue operations", "Quotation Follow-up Exceptions", `Open quotations with missing, elapsed or upcoming validity dates within 7 days. Evaluated ${formatDateTime(data.evaluated_at)} in ${esc(data.timezone)}.`, `<span class="ai-status ${readiness.deterministic_ready ? "ready" : "offline"}"><i></i>${esc(orderLabel)}</span>`)}
      <section class="ai-exception-summary"><div><strong>${data.matching_count}</strong><span>matching exceptions</span></div><div><strong>${data.counts.open || 0}</strong><span>need review</span></div><div><strong>${data.actionable_count}</strong><span>Task eligible</span></div><div><strong>${esc(data.rule_version)}</strong><span>rule version</span></div></section>
      <div class="ai-exception-toolbar card"><div class="ai-view-tabs">${views}</div><div class="ai-order-actions"><button class="button button-ghost button-small ${data.order === "deterministic" ? "active" : ""}" data-ai-deterministic>Deterministic order</button><button class="button button-primary button-small" data-ai-rank ${!readiness.ai_ready || !data.items.length ? "disabled" : ""}>AI-ranked order · 1 request</button></div></div>
      ${!readiness.ai_ready ? `<div class="ai-fallback-note"><strong>${readiness.deterministic_ready ? "Queue ready · AI ranking unavailable" : "Quotation automation needs setup"}</strong><span>${esc(readiness.checks.filter((item) => !item.ready).map((item) => item.detail).join(" · ") || status.detail)}${readiness.deterministic_ready ? ". All deterministic records remain available." : ""}</span></div>` : ""}
      <div class="ai-exception-layout"><section class="card ai-exception-list" aria-live="polite">${rows}</section>${detail}</div>
      <details class="card ai-readiness"><summary>Readiness and cloud boundary</summary><div class="card-body"><ul>${checks}</ul><p>Only opaque references, trigger facts, amount, currency, date and owner-active status are sent for ranking. Customer names, notes, messages, attachments and credentials are excluded.</p></div></details>`;
  }
  
  function aiMessageHtml(message, messageIndex) {
    if (message.role === "user") return `<article class="ai-message user"><span>You</span><p>${esc(message.text)}</p></article>`;
    const result = message.result;
    const actions = (result.actions || []).length ? `<div class="ai-result-list"><strong>Recommended actions</strong><ol>${result.actions.map((item) => `<li>${esc(item)}</li>`).join("")}</ol></div>` : "";
    const risks = (result.risks || []).length ? `<div class="ai-result-list risks"><strong>Risks and gaps</strong><ul>${result.risks.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>` : "";
    const proposals = (result.proposed_activities || []).length ? `<div class="ai-proposals"><div class="ai-proposals-head"><div><strong>Proposed CRM activities</strong><small>Review each item. Approval writes selected activities to the CRM and audit history.</small></div></div>${result.proposed_activities.map((item, index) => `<label class="ai-proposal"><input type="checkbox" data-ai-proposal-index="${index}" checked ${result.approval_result ? "disabled" : ""}/><span><b>${esc(item.activity_type)} · ${esc(item.subject)}</b><small>${esc(titleCase(item.priority))} · due ${formatDateTime(item.due_at)} · ${esc(titleCase(item.related_type))} #${item.related_id}${item.owner_id ? ` · owner #${item.owner_id}` : ""}</small><em>${esc(item.reason)}</em></span></label>`).join("")}<div class="ai-approval-row">${result.approval_result ? `<span class="ai-approved">✓ ${result.approval_result.created.length} created · ${result.approval_result.skipped.length} duplicate${result.approval_result.skipped.length === 1 ? "" : "s"} skipped</span>` : `<button class="button button-primary button-small" data-ai-approve="${messageIndex}">Review and approve selected</button>`}</div></div>` : "";
    const sources = (result.sources || []).map((item) => `<span>${esc(item)}</span>`).join("");
    return `<article class="ai-message assistant" data-ai-message="${messageIndex}"><div class="ai-message-head"><span>Apex AI</span><small>${esc(result.model)} · ${esc(result.confidence)} confidence</small></div><p>${esc(result.answer).replace(/\n/g, "<br>")}</p>${actions}${risks}${proposals}<div class="ai-sources"><strong>CRM context used</strong>${sources}</div><small class="ai-disclaimer">${esc(result.disclaimer)}</small></article>`;
  }
  
  function renderAIConversation() {
    const conversation = $("#ai-conversation");
    if (!conversation) return;
    conversation.innerHTML = state.aiMessages.map(aiMessageHtml).join("");
    bindAIProposalActions();
    conversation.scrollTop = conversation.scrollHeight;
  }
  
  function bindAIProposalActions() {
    $$('[data-ai-approve]').forEach((button) => button.addEventListener("click", async () => {
      const messageIndex = Number(button.dataset.aiApprove);
      const message = state.aiMessages[messageIndex];
      if (!message?.result) return;
      const card = button.closest("[data-ai-message]");
      const indexes = $$('[data-ai-proposal-index]:checked', card).map((input) => Number(input.dataset.aiProposalIndex));
      const activities = indexes.map((index) => message.result.proposed_activities[index]).filter(Boolean);
      if (!activities.length) { toast("Nothing selected", "Select at least one proposed activity.", "error"); return; }
      const confirmed = await confirmAction("Create selected AI activities?", `This will create ${activities.length} open CRM activit${activities.length === 1 ? "y" : "ies"}. Every item will be recorded in audit history.`, "Create activities");
      if (!confirmed) return;
      button.disabled = true;
      try {
        const approval = await api("/api/ai/activities/approve", { method: "POST", body: JSON.stringify({ request_id: message.result.request_id, activities }) });
        message.result.approval_result = approval;
        toast("AI activities processed", `${approval.created.length} created; ${approval.skipped.length} duplicate${approval.skipped.length === 1 ? "" : "s"} skipped.`);
        renderAIConversation();
      } catch (error) { button.disabled = false; toast("Could not create AI activities", error.message, "error"); }
    }));
  }
  
  function bindAI() {
    $$('[data-ai-view]').forEach((button) => button.addEventListener("click", async () => {
      state.aiExceptionView = button.dataset.aiView;
      state.aiExceptionOrder = "deterministic";
      state.aiRankedItems = null;
      state.aiSelectedException = null;
      await renderRoute();
    }));
    $$('[data-ai-review]').forEach((button) => button.addEventListener("click", async () => {
      state.aiSelectedException = button.dataset.aiReview;
      await renderRoute();
      $("#ai-detail-title")?.focus();
    }));
    $("[data-ai-close-detail]")?.addEventListener("click", async () => {
      const previous = state.aiSelectedException;
      state.aiSelectedException = null;
      await renderRoute();
      $(`[data-ai-review="${previous}"]`)?.focus();
    });
    $("[data-ai-deterministic]")?.addEventListener("click", async () => {
      state.aiExceptionOrder = "deterministic";
      await renderRoute();
    });
    $("[data-ai-rank]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Ranking complete set…";
      try {
        const current = await api(`/api/ai/exceptions?view=${encodeURIComponent(state.aiExceptionView)}`);
        const result = await api("/api/ai/exceptions/rank", { method: "POST", body: JSON.stringify({ occurrence_ids: current.items.map((item) => item.id) }) });
        state.aiRankedItems = result.items;
        state.aiExceptionOrder = "ai_ranked";
        if (state.aiSelectedException && !result.items.some((item) => item.id === state.aiSelectedException)) state.aiSelectedException = null;
        await renderRoute();
        toast("AI ranking applied", `Validated all ${result.items.length} exception references. Deterministic order remains available.`);
      } catch (error) {
        state.aiExceptionOrder = "deterministic";
        state.aiRankedItems = null;
        toast("AI ranking unavailable", error.message, "error");
        await renderRoute();
      }
    });
    $("[data-ai-approve-proposal]")?.addEventListener("click", async (event) => {
      const proposalId = event.currentTarget.dataset.aiApproveProposal;
      const confirmed = await confirmAction("Create this Task?", "This creates one persistent CRM Task using the exact owner, due date, priority, source and text shown above. The action is audited.", "Create Task");
      if (!confirmed) return;
      event.currentTarget.disabled = true;
      try {
        const result = await api(`/api/ai/proposals/${encodeURIComponent(proposalId)}/approve`, { method: "POST", body: "{}" });
        state.aiExceptionOrder = "deterministic";
        state.aiRankedItems = null;
        state.aiSelectedException = null;
        await renderRoute();
        toast(result.duplicate ? "Existing Task returned" : "Task created", `${result.activity.subject} · Task #${result.activity.id}`);
      } catch (error) {
        event.currentTarget.disabled = false;
        toast(error.code === "APPROVAL_NEEDS_RECONCILIATION" ? "Task outcome needs checking" : "Task was not created", error.message, "error");
      }
    });
    $$('[data-ai-review-state]').forEach((button) => button.addEventListener("click", async () => {
      const label = titleCase(button.dataset.aiReviewState);
      const reason = (await promptDialog(`${label}: enter a short reason or note.`));
      if (!reason?.trim()) return;
      button.disabled = true;
      try {
        await api(`/api/ai/exceptions/${encodeURIComponent(state.aiSelectedException)}/review`, { method: "PATCH", body: JSON.stringify({ state: button.dataset.aiReviewState, reason: reason.trim() }) });
        state.aiSelectedException = null;
        state.aiRankedItems = null;
        state.aiExceptionOrder = "deterministic";
        await renderRoute();
        toast("Review recorded", `${label} was written to the exception audit history.`);
      } catch (error) { button.disabled = false; toast("Could not record review", error.message, "error"); }
    }));
  }

  return { aiDashboardView, apexAssistantResultHtml, bindApexAssistant, bindApexAssistantResult, aiView, aiMessageHtml, renderAIConversation, bindAIProposalActions, bindAI };
}



