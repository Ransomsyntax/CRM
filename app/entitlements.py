"""Machine-readable pricing capabilities. Higher tiers inherit except explicit exceptions."""
PLAN_CODES = ("free", "bigin_express", "standard", "professional", "enterprise")
FEATURE_TIERS = {
    "contact_management": 0, "follow_up_reminders": 0, "workflow_automation": 0,
    "email_templates": 0, "activities": 0, "import_export": 0,
    "reports": 0, "api_access": 0, "mobile_apps": 0,
    "sales_pipeline": 1, "built_in_calling": 1, "appointment_scheduling": 1,
    "payment_collection": 1, "tags": 1, "email_integration": 1,
    "calendar_integration": 1, "social_ads_integration": 1, "custom_fields": 1,
    "mass_email": 2, "multiple_pipelines": 2, "webforms": 2,
    "sales_forecasting": 2, "data_enrichment": 2,
    "gmail_outlook_integration": 2, "collaboration_integrations": 2,
    "apex": 2,
    "ai_agents": 3, "process_management": 3, "inventory_management": 3,
    "predictive_intelligence": 3, "unlimited_reports": 3, "cpq": 3,
    "customer_portals": 3, "customer_journeys": 3, "web_to_case": 3,
    "google_ads_integration": 3,
    "multi_team_management": 4, "reporting_hierarchy": 4, "custom_functions": 4,
    "extended_field_types": 4, "sequential_data_collection": 4,
    "approval_process": 4, "account_based_marketing": 4,
    "developer_sandbox": 4, "field_level_encryption": 4,
    "extended_ai": 4,
}


def plan_capabilities(code: str) -> dict[str, bool]:
    tier = PLAN_CODES.index(code)
    return {
        **{key: tier >= minimum for key, minimum in FEATURE_TIERS.items()},
        "custom_modules": code != "bigin_express",
        "quickbooks_integration": code in {"bigin_express", "enterprise"},
    }


SETUP_FEATURES = {
    "manage_workflow_rules": "workflow_automation",
    "manage_templates": "email_templates",
    "manage_blueprints": "process_management",
    "manage_approval_rules": "approval_process",
    "manage_roles": "reporting_hierarchy",
    "manage_ai": "ai_agents", "manage_cpq": "cpq",
    "manage_webforms": "webforms", "manage_functions": "custom_functions",
    "manage_sandbox": "developer_sandbox",
    "manage_encryption": "field_level_encryption",
}
