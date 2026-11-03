"""Regression tests for delegated setup authorization (MOD-39 to MOD-52)."""
from app.services.security import _setup_capability_for_request, SETUP_CAPABILITIES


def test_every_delegated_setup_capability_is_declared():
    expected = {
        "manage_users", "manage_roles", "manage_profiles", "manage_groups",
        "manage_modules_fields", "manage_layouts", "manage_automation",
        "manage_workflow_rules", "manage_blueprints", "manage_assignment_rules",
        "manage_approval_rules", "manage_templates", "manage_import_settings",
        "manage_backup", "manage_data_administration", "manage_audit_logs",
        "manage_security_configuration",
    }
    assert expected <= set(SETUP_CAPABILITIES)


def test_administration_paths_map_to_dedicated_capabilities():
    paths = {
        "/api/admin/users": "manage_users",
        "/api/admin/security/role-hierarchy": "manage_roles",
        "/api/admin/security/profiles": "manage_profiles",
        "/api/admin/security/module-permissions": "manage_profiles",
        "/api/admin/security/groups": "manage_groups",
        "/api/admin/security/sharing": "manage_security_configuration",
        "/api/admin/security/data-sharing": "manage_security_configuration",
        "/api/admin/security/territories": "manage_assignment_rules",
        "/api/admin/metadata/modules": "manage_modules_fields",
        "/api/admin/metadata/modules/2/layouts": "manage_layouts",
        "/api/admin/standard-layout/leads": "manage_layouts",
        "/api/automation/executions": "manage_automation",
        "/api/platform/workflow_rules": "manage_workflow_rules",
        "/api/platform/assignment_rules": "manage_assignment_rules",
        "/api/platform/approval_processes": "manage_approval_rules",
        "/api/platform/email_templates": "manage_templates",
        "/api/blueprints": "manage_blueprints",
        "/api/admin/privacy": "manage_data_administration",
        "/api/audit": "manage_audit_logs",
        "/api/backup": "manage_backup",
    }
    for path, expected in paths.items():
        assert _setup_capability_for_request(path, "POST") == expected, path


def test_platform_owner_and_organization_routes_not_delegated_by_setup_capability():
    assert _setup_capability_for_request("/api/owner/overview", "GET") is None
    assert _setup_capability_for_request("/api/organization/transfer-ownership", "POST") is None


def test_running_a_record_transition_does_not_require_blueprint_administration():
    assert _setup_capability_for_request("/api/blueprint-records/leads/5/transition", "POST") is None
    assert _setup_capability_for_request("/api/blueprint-designer/5/publish", "POST") == "manage_blueprints"
