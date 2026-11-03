import { confirmDialog } from "../core/dialogs.js?v=20261027-centered-popups-v1";
export function createOrganizationSettings({api,state,esc,$,$$,toast,renderRoute}) {
async function organizationManagementView() {
  const org = await api("/api/organization");
  const members = await api("/api/organization/members");
  const canAdmin = ["owner", "admin", "administrator"].includes(String(org.membership_role || "").toLowerCase());
  let invitations = {items: []};
  if (canAdmin) invitations = await api("/api/organization/invitations");
  const roleOptions = (value) => ["Member", "Admin"].map(role => `<option value="${role}" ${value === role ? "selected" : ""}>${role}</option>`).join("");
  const memberRows = (members.items || []).map(member => {
    const selfOwner = member.membership_role === "Owner";
    const actions = canAdmin && !selfOwner ? `<select class="field-select" aria-label="Role for ${esc(member.name)}" data-org-role="${member.user_id}">${roleOptions(member.membership_role)}</select><button class="button button-small" data-org-member-save="${member.user_id}">Save role</button><button class="button button-small" data-org-member-status="${member.user_id}" data-next-status="${member.status === "Active" ? "Inactive" : "Active"}">${member.status === "Active" ? "Deactivate" : "Activate"}</button>` : "";
    return `<tr><td>${esc(member.name)}<br><small>${esc(member.email)}</small></td><td>${esc(member.membership_role)}</td><td>${esc(member.status)}</td><td>${actions}</td></tr>`;
  }).join("");
  const invitationRows = (invitations.items || []).map(invite => `<tr><td>${esc(invite.email)}</td><td>${esc(invite.membership_role)}</td><td>${esc(invite.status)}</td><td>${canAdmin && invite.status === "Pending" ? `<button class="button button-small" data-org-invite-revoke="${invite.id}">Revoke</button>` : ""}</td></tr>`).join("");
  return `<section class="card settings-section"><div class="settings-section-head"><h2>Organization Profile</h2><p>Workspace identity and organization membership.</p><p>Your CRM role: ${esc(state.profile?.role || "Member")} · Organization membership: ${esc(org.membership_role || "Member")}</p></div>
    <form data-org-profile><div class="form-grid"><div class="field"><label>Organization name</label><input name="name" class="field-input" required minlength="2" maxlength="160" value="${esc(org.name)}" ${canAdmin ? "" : "disabled"} /></div><div class="field"><label>Organization ID</label><input class="field-input" value="${org.public_id ?? org.id}" disabled /></div><div class="field"><label>Slug</label><input class="field-input" value="${esc(org.slug)}" disabled /></div></div>${canAdmin ? '<div class="form-actions"><button type="submit" class="button button-primary">Save organization</button></div>' : ""}</form></section>
    <section class="card settings-section"><div class="settings-section-head"><h2>Members</h2><p>Manage organization membership and roles.</p></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Member</th><th>Organization role</th><th>Status</th><th>Actions</th></tr></thead><tbody>${memberRows}</tbody></table></div></section>
    ${canAdmin ? `<section class="card settings-section"><div class="settings-section-head"><h2>Invite member</h2><p>Invitations expire after seven days. Delivery requires configured email settings.</p></div><form data-org-invite><div class="form-grid"><div class="field"><label>Email address</label><input name="email" type="email" class="field-input" required /></div><div class="field"><label>Member role</label><select name="membership_role" class="field-select"><option>Member</option><option>Admin</option></select></div></div><div class="form-actions"><button class="button button-primary" type="submit">Send invitation</button></div></form><div class="table-wrap"><table class="data-table"><thead><tr><th>Email</th><th>Organization role</th><th>Status</th><th>Actions</th></tr></thead><tbody>${invitationRows}</tbody></table></div></section>` : ""}`;
}
function bindOrganizationManagement() {
  const perform = async (request, success) => { try { await request(); toast("Organization updated", success); await renderRoute(); } catch (error) { toast("Organization update failed", error.message, "error"); } };
  $('[data-org-profile]')?.addEventListener('submit', event => {
    event.preventDefault();
    perform(() => api("/api/organization", {method:"PATCH", body:JSON.stringify({name: event.currentTarget.elements.name.value.trim()})}), "Organization profile saved.");
  });
  $('[data-org-invite]')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    perform(async () => {
      const result = await api("/api/organization/invitations", {method:"POST", body:JSON.stringify({email:form.elements.email.value.trim(),membership_role:form.elements.membership_role.value})});
      if (result.delivery === "not_configured") toast("Email delivery unavailable", "Configure SMTP to send invitations.", "error");
    }, "Invitation created.");
  });
  $$('[data-org-member-save]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.orgMemberSave;
    const role = $('[data-org-role="' + id + '"]')?.value;
    perform(() => api("/api/organization/members/" + id, {method:"PATCH", body:JSON.stringify({membership_role:role})}), "Member role updated.");
  }));
  $$('[data-org-member-status]').forEach(button => button.addEventListener('click', async () => {
    const id = button.dataset.orgMemberStatus;
    const status = button.dataset.nextStatus;
    if (!(await confirmDialog(status + " this member?"))) return;
    perform(() => api("/api/organization/members/" + id, {method:"PATCH", body:JSON.stringify({status})}), "Member status updated.");
  }));
  $$('[data-org-invite-revoke]').forEach(button => button.addEventListener('click', async () => {
    if (!(await confirmDialog("Revoke this invitation?"))) return;
    perform(() => api("/api/organization/invitations/" + button.dataset.orgInviteRevoke, {method:"DELETE"}), "Invitation revoked.");
  }));

}

return {organizationManagementView,bindOrganizationManagement};
}

