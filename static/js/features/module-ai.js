// One module-aware APEX surface shared by lists, details, reports and setup.
export function installModuleAI({ api, state, esc, toast }) {
  let dialog, catalog = {}, scope = "workspace", recordScope = null, recordId = null, recordIds = [], jobId = null, pollTimer = null, actionsEnabled = true;
  const html = (value) => esc(value);
  const label = (value) => String(value ?? "").replaceAll("_", " ");
  const displayValue = (value) => {
    if (Array.isArray(value)) return `<ul>${value.map((item) => `<li>${displayValue(item)}</li>`).join("")}</ul>`;
    if (value && typeof value === "object") return displayFields(value);
    return html(value === true ? "Yes" : value === false ? "No" : value ?? "Not set");
  };
  const displayFields = (values) => `<dl class="module-ai-changes">${Object.entries(values || {}).map(([key, value]) => `<div><dt>${html(label(key).replace(/\b\w/g, (letter) => letter.toUpperCase()))}</dt><dd>${displayValue(value)}</dd></div>`).join("")}</dl>`;
  function confirmDeletion(message, options) {
    return new Promise((resolve) => {
      const confirmation = document.createElement("dialog");
      confirmation.className = "module-ai-dialog module-ai-confirm";
      confirmation.setAttribute("aria-label", options.title);
      confirmation.innerHTML = `<h2>${html(options.title)}</h2><p>${html(message)}</p><div class="module-ai-toolbar"><button type="button" class="button button-ghost" data-delete-cancel>Cancel</button><button type="button" class="button button-primary" data-delete-confirm>${html(options.confirmLabel)}</button></div>`;
      let approved = false;
      confirmation.addEventListener("close", () => { confirmation.remove(); resolve(approved); }, {once:true});
      confirmation.querySelector("[data-delete-cancel]").onclick = () => confirmation.close();
      confirmation.querySelector("[data-delete-confirm]").onclick = () => { approved = true; confirmation.close(); };
      document.body.append(confirmation);
      confirmation.showModal();
      confirmation.querySelector("[data-delete-cancel]").focus();
    });
  }
  function inferScope() {
    const parts = location.pathname.split("/").filter(Boolean);
    const aliases = { tasks: "activities", calls: "activities", meetings: "activities", forecast: "forecasts" };
    const candidate = parts.map((part) => aliases[part] || part.replaceAll("-", "_")).find((part) => catalog[part]);
    scope = candidate || "workspace";
    recordScope = scope;
    const id = Number(parts.at(-1));
    recordId = candidate && Number.isInteger(id) && id > 0 ? id : null;
    const selected = state.moduleState?.[scope]?.selectedIds || state.moduleState?.[`platform:${scope}`]?.selectedIds || [];
    recordIds = recordId ? [recordId] : [...new Set(selected.filter((value) => Number.isInteger(value) && value > 0))].slice(0, 100);
    if (recordIds.length === 1) recordId = recordIds[0];
  }
  function output(message, error = false) {
    const target = dialog?.querySelector("[data-module-ai-output]");
    if (target) target.innerHTML = `<p class="module-ai-message ${error ? "module-ai-error" : ""}" role="status">${html(message)}</p>`;
  }
  async function open() {
    if (dialog?.open) return;
    clearTimeout(pollTimer);
    jobId = null;
    dialog = document.createElement("dialog");
    const opened = dialog;
    dialog.className = "module-ai-dialog";
    dialog.setAttribute("aria-labelledby", "module-ai-title");
    dialog.innerHTML = `<header><div><span class="eyebrow">Your CRM assistant</span><h2 id="module-ai-title">APEX AI</h2></div><button class="button button-ghost" data-module-ai-close aria-label="Close APEX">Close</button></header><p role="status">Loading your permitted modules…</p>`;
    document.body.append(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => { clearTimeout(pollTimer); opened.remove(); });
    dialog.querySelector("[data-module-ai-close]").onclick = () => dialog.close();
    try {
      const data = await api("/api/ai/modules");
      if (dialog !== opened || !opened.open) return;
      catalog = data.modules || {};
      actionsEnabled = data.actions_enabled !== false;
      inferScope();
      render(data);
    } catch (error) { output(error.message, true); dialog.querySelector("p").textContent = error.message; }
  }
  function render(data) {
    dialog.innerHTML = `<header><div><span class="eyebrow">${html(data.provider)} · ${html(data.model)}</span><h2 id="module-ai-title">APEX AI</h2></div><button class="button button-ghost" data-module-ai-close aria-label="Close APEX">Close</button></header>
      <p class="module-ai-note">Analyze records and reports, or create and change linked records across modules here. APEX works with the records and actions permitted by your role, profile and plan. ${actionsEnabled ? "Review exact changes below, or enable specific actions in a recurring run." : "Your plan supports analysis and proposals. Executing actions and recurring automation require the AI agents feature."}</p>
      <form data-module-ai-form><label for="module-ai-scope">Module</label><select id="module-ai-scope" name="scope"><option value="workspace">All permitted modules</option>${Object.entries(catalog).map(([key, module]) => `<option value="${html(key)}" ${key === scope ? "selected" : ""}>${html(module.label)}</option>`).join("")}</select>
      <div data-module-ai-uses></div><label for="module-ai-question">What should APEX do?</label><textarea id="module-ai-question" name="question" rows="3" maxlength="1500" required minlength="3" placeholder="Find business opportunities, review overdue follow-ups and prepare the next actions."></textarea>
      <label class="module-ai-check"><input type="checkbox" name="single" ${recordIds.length ? "checked" : ""} ${!recordIds.length ? "disabled" : ""}> ${recordIds.length > 1 ? `Focus on ${recordIds.length} selected records` : recordId ? `Focus on this record #${recordId}` : "Focus on selected records (select or open records first)"}</label>
      <div class="module-ai-toolbar"><button class="button button-primary" type="submit">Analyze and prepare actions</button><button class="button button-ghost" type="button" data-module-ai-history>Recent runs</button></div></form>
      <details class="module-ai-schedule"><summary>Recurring analysis and automation</summary><p>Run as your user with your current permissions. Changes outside the selected action types stay as proposals. Each page of records uses an AI request from your plan.</p>
      <label for="module-ai-interval">Run every</label><select id="module-ai-interval"><option value="1440">Day</option><option value="60">Hour</option><option value="10080">Week</option></select>
      <label class="module-ai-check"><input type="checkbox" data-auto-kind="task"> Automatically create follow-up tasks</label>
      <label class="module-ai-check"><input type="checkbox" data-auto-kind="draft_email"> Automatically save email drafts</label>
      <label class="module-ai-check"><input type="checkbox" data-auto-kind="send_email" ${data.email_ready ? "" : "disabled"}> Automatically send customer follow-up emails</label>
      <p class="module-ai-note">${data.email_ready ? "Sending uses the customer email on the permitted source record. A 72-hour cooldown prevents repeated actions for the same customer record." : "Email sending needs a configured SMTP connection. You can prepare drafts now."}</p>
      <button type="button" class="button button-ghost" data-module-ai-schedule ${actionsEnabled ? "" : "disabled"}>Enable recurring run</button><div data-module-ai-policies></div></details>
      <section class="module-ai-output" data-module-ai-output aria-live="polite"><p>Choose a request to read the selected scope and prepare actions.</p></section>`;
    dialog.querySelector("[data-module-ai-close]").onclick = () => dialog.close();
    const form = dialog.querySelector("form");
    const updateUses = () => {
      scope = form.elements.scope.value;
      const module = catalog[scope];
      dialog.querySelector("#module-ai-title").textContent = module ? `${module.label} AI actions` : "APEX AI";
      dialog.querySelector("[data-module-ai-uses]").innerHTML = `<div class="module-ai-chips">${([...(module?.uses || ["Find opportunities across modules", "Review risks and follow-ups", "Explain reports and plan next steps"]), ...(!module?.guidance_only && scope !== "workspace" ? ["Create a follow-up task for the selected record", "Schedule a follow-up call for the selected record", "Schedule a meeting for the selected record", "Schedule a site visit linked to the selected record"] : []), ...(module?.actions?.includes("create") ? [`Help me create a ${module.label} record with the details I provide`] : []), ...(module?.actions?.includes("update") ? [`Prepare updates to the selected ${module.label} records based on my instructions`] : []), ...(module?.actions?.includes("delete") ? ["Find records matching my deletion criteria and prepare them for review before deleting"] : [])]).map((use) => `<button type="button" data-module-ai-prompt="${html(use)}">${html(use)}</button>`).join("")}</div>${module?.guidance_only ? `<p class="module-ai-note">This administration module supports analysis and recommendations. Apply access or executable configuration changes through its dedicated controls.</p>` : ""}`;
      dialog.querySelectorAll("[data-module-ai-prompt]").forEach((button) => { button.onclick = () => { form.elements.question.value = button.dataset.moduleAiPrompt; form.elements.question.focus(); }; });
    };
    form.elements.scope.onchange = () => { form.elements.single.checked = false; updateUses(); form.elements.single.disabled = !recordIds.length || scope !== recordScope; loadPolicies(); };
    updateUses();
    form.onsubmit = async (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        state.aiStatus ||= await api("/api/ai/status");
        const job = await api(`/api/ai/modules/${scope}/jobs`, { method: "POST", body: JSON.stringify({question: form.elements.question.value, record_id: form.elements.single.checked && recordIds.length === 1 ? recordId : null, record_ids: form.elements.single.checked && recordIds.length > 1 ? recordIds : [], context_job_id: jobId}) });
        jobId = job.id;
        output("APEX is reading your permitted records. You can close this panel and return to Recent runs.");
        poll();
      } catch (error) { output(error.message, true); }
      finally { submit.disabled = false; }
    };
    dialog.querySelector("[data-module-ai-history]").onclick = loadHistory;
    dialog.querySelector("[data-module-ai-schedule]").onclick = async () => {
      const button = dialog.querySelector("[data-module-ai-schedule]");
      if (form.elements.question.value.trim().length < 3) { form.elements.question.focus(); output("Enter the instructions for this recurring run first.", true); return; }
      button.disabled = true;
      try {
        state.aiStatus ||= await api("/api/ai/status");
        await api(`/api/ai/modules/${scope}/automations`, {method: "POST", body: JSON.stringify({question: form.elements.question.value,
          interval_minutes: Number(dialog.querySelector("#module-ai-interval").value), allowed_actions: [...dialog.querySelectorAll("[data-auto-kind]:checked")].map((input) => input.dataset.autoKind)})});
        await loadPolicies();
        toast("Recurring APEX run enabled", "It will run under your current permissions.");
      } catch (error) { output(error.message, true); }
      finally { button.disabled = false; }
    };
    loadPolicies();
    form.elements.question.focus();
  }
  async function poll() {
    clearTimeout(pollTimer);
    if (!dialog?.open || !jobId) return;
    const requestedId = jobId, opened = dialog;
    try {
      const job = await api(`/api/ai/modules/jobs/${jobId}`);
      if (dialog !== opened || !opened.open || jobId !== requestedId) return;
      showJob(job);
      if (["queued", "running"].includes(job.status)) pollTimer = setTimeout(poll, 3000);
    } catch (error) { output(error.message, true); }
  }
  function showJob(job) {
    const result = job.result || {};
    const coverage = Object.entries(result.coverage || {}).map(([module, item]) => `${catalog[module]?.label || module}: ${item.records_read} records${item.complete ? " · complete" : " · in progress / partial"}`);
    const actionHtml = (job.actions || []).map((op) => {
      const action = op.action;
      const actionLabel = action.kind === "task" ? label(action.target_values?.activity_type || action.values?.activity_type || "Task") : label(action.kind);
      const destination = catalog[action.target_resource]?.label || (action.target_resource === "activities" ? "Activities" : action.target_resource);
      return `<article class="module-ai-action"><div class="module-ai-toolbar"><strong>${html(actionLabel)} · ${html(catalog[action.resource]?.label || action.resource)}${action.record_id ? ` #${action.record_id}` : ""}</strong><span>${html(label(op.status))}</span></div><p>${html(action.reason)}</p>${destination ? `<p><strong>Create in:</strong> ${html(destination)}${action.target_values?.activity_type ? ` · ${html(action.target_values.activity_type)}` : ""} · linked to ${html(catalog[action.resource]?.label || action.resource)} #${action.record_id}</p>` : ""}${action.recipient ? `<p><strong>To:</strong> ${html(action.recipient)}</p>` : ""}${action.kind === "delete" ? `<p>Move ${html(action.record_label || "this record")} to the recycle bin.</p>${op.status === "proposed" && job.status === "completed" ? `<label class="module-ai-check"><input type="checkbox" data-module-ai-delete-select="${op.id}" ${actionsEnabled && catalog[action.resource]?.mass_delete !== false ? "" : "disabled"}> Select for deletion</label>` : ""}` : displayFields(action.values)}${op.status === "proposed" && job.status === "completed" ? `<button class="button button-ghost" data-module-ai-execute="${op.id}" ${actionsEnabled ? "" : "disabled"}>${action.kind === "delete" ? "Delete this record" : action.kind === "send_email" ? "Send this email" : "Execute this action"}</button>` : ""}${op.status === "completed" && op.result ? `<details class="module-ai-result" open><summary>${action.kind === "run_report" ? "Report results" : "Action result"}</summary>${displayFields(op.result)}</details>` : ""}${op.result?.message ? `<p role="status">${html(typeof op.result.message === "string" ? op.result.message : op.result.message.message || label(op.result.message.code || "Action blocked"))}</p>` : ""}</article>`;
    }).join("");
    dialog.querySelector("[data-module-ai-output]").innerHTML = `<div class="module-ai-toolbar"><h3>Analysis</h3><strong>${html(label(job.status))}</strong></div>${job.error ? `<p class="module-ai-error">${html(job.error)}</p>` : ""}<p class="module-ai-answer">${html(result.answer || "Reading permitted records…")}</p>
      ${result.opportunities?.length ? `<h4>Opportunities</h4><ul>${result.opportunities.map((text) => `<li>${html(text)}</li>`).join("")}</ul>` : ""}
      ${result.risks?.length ? `<h4>Risks and gaps</h4><ul>${result.risks.map((text) => `<li>${html(text)}</li>`).join("")}</ul>` : ""}
      ${actionHtml ? `<h4>Proposed actions</h4>${job.status === "completed" && (job.actions || []).some((op) => op.action.kind === "delete" && op.status === "proposed") ? `<p>Review the exact records before deleting. Deletion follows your module permissions.</p><button type="button" class="button button-ghost" data-module-ai-delete-selected ${actionsEnabled ? "" : "disabled"}>Delete selected records</button>` : ""}${actionHtml}` : ""}
      ${result.blocked_actions?.length ? `<details><summary>Actions requiring attention</summary><ul>${result.blocked_actions.map((text) => `<li>${html(text)}</li>`).join("")}</ul></details>` : ""}
      <details><summary>Analysis coverage</summary><ul>${coverage.map((text) => `<li>${html(text)}</li>`).join("")}</ul><p>Report output follows the report's row limit. Interrupted runs show partial coverage.</p></details>`;
    dialog.querySelectorAll("[data-module-ai-execute]").forEach((button) => { button.onclick = async () => {
      const proposal = job.actions.find((op) => op.id === Number(button.dataset.moduleAiExecute));
      if (proposal?.action.kind === "delete" && !(await confirmDeletion(`Move ${catalog[proposal.action.resource]?.label || proposal.action.resource} record #${proposal.action.record_id} to the recycle bin?`, {title:"Delete record",confirmLabel:"Delete record",danger:true}))) return;
      button.disabled = true;
      try {
        state.aiStatus ||= await api("/api/ai/status");
        const action = await api(`/api/ai/modules/actions/${button.dataset.moduleAiExecute}/execute`, {method: "POST", body: "{}"});
        toast(action.status === "completed" ? "APEX action completed" : "APEX action needs attention", action.result?.message || action.status);
        await poll();
      } catch (error) { toast("Action blocked", error.message, "error"); button.disabled = false; }
    }; });
    const bulkDelete = dialog.querySelector("[data-module-ai-delete-selected]");
    if (bulkDelete) bulkDelete.onclick = async () => {
      const ids = [...dialog.querySelectorAll("[data-module-ai-delete-select]:checked")].map((input) => Number(input.dataset.moduleAiDeleteSelect));
      if (!ids.length) { toast("Select records first", "Select the deletion proposals you want to execute."); return; }
      if (!(await confirmDeletion(`Move these ${ids.length} selected records to the recycle bin?`, {title:"Delete selected records",confirmLabel:`Delete ${ids.length} records`,danger:true}))) return;
      bulkDelete.disabled = true;
      try {
        state.aiStatus ||= await api("/api/ai/status");
        const response = await api("/api/ai/modules/actions/delete-selected", {method:"POST",body:JSON.stringify({ids})});
        toast("Deletion results", `${response.items.filter((item) => item.status === "completed").length} of ${ids.length} records deleted. Review any remaining actions.`);
        await poll();
      } catch (error) { toast("Deletion blocked",error.message,"error"); bulkDelete.disabled = false; }
    };
  }
  async function loadHistory() {
    clearTimeout(pollTimer);
    try {
      const history = await api(`/api/ai/modules/${scope}/history`);
      dialog.querySelector("[data-module-ai-output]").innerHTML = `<h3>Recent runs</h3>${history.items.length ? history.items.map((job) => `<button class="module-ai-history" data-module-ai-job="${job.id}"><strong>${html(label(job.status))}</strong><span>${html(job.question)}</span></button>`).join("") : "<p>No runs in this module yet.</p>"}`;
      dialog.querySelectorAll("[data-module-ai-job]").forEach((button) => { button.onclick = () => { jobId = Number(button.dataset.moduleAiJob); poll(); }; });
    } catch (error) { output(error.message, true); }
  }
  async function loadPolicies() {
    const target = dialog.querySelector("[data-module-ai-policies]");
    try {
      const data = await api(`/api/ai/modules/${scope}/automations`);
      if (!dialog.open) return;
      target.innerHTML = data.items.map((policy) => `<article class="module-ai-policy"><strong>${policy.enabled ? "Active" : "Paused"} · every ${policy.interval_minutes / 60} hours</strong><p>${html(policy.question)}</p><small>${html(policy.allowed_actions.map(label).join(", ") || "Analysis and proposals only")}</small>${policy.enabled ? `<button class="button button-ghost" data-module-ai-pause="${policy.id}">Pause</button>` : ""}</article>`).join("");
      target.querySelectorAll("[data-module-ai-pause]").forEach((button) => { button.onclick = async () => {
        button.disabled = true;
        try { state.aiStatus ||= await api("/api/ai/status"); await api(`/api/ai/modules/automations/${button.dataset.moduleAiPause}`, {method: "DELETE"}); await loadPolicies(); }
        catch (error) { output(error.message, true); button.disabled = false; }
      }; });
    } catch (error) { target.textContent = error.message; }
  }
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-module-ai-open]")) { event.preventDefault(); open(); }
  });
  return { open };
}
