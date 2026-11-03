from __future__ import annotations

from typing import Final


ENTITLEMENT_RESOURCE_FEATURES: Final[dict[str, str]] = {
    "protected_fields": "field_level_encryption",
    "contacts": "contact_management",
    "activities": "activities",
    "emails": "email_integration",
    "api_settings": "api_access",
    "api_usage": "api_access",
    "pipelines": "sales_pipeline",
    "telephony": "built_in_calling",
    "calendar_booking": "appointment_scheduling",
    "email_channels": "email_integration",
    "custom_fields": "custom_fields",
    "wizards": "sequential_data_collection",
    "agents": "ai_agents",
    "roles": "reporting_hierarchy",
    "quote_templates": "inventory_management",
    "invoice_templates": "inventory_management",
    "workflow_rules": "workflow_automation",
    "email_templates": "email_templates",
    "webforms": "webforms",
    "command_center": "customer_journeys",
    "apex_agents": "ai_agents",
    "apex_data_enrichment": "data_enrichment",
    "apex_prediction": "predictive_intelligence",
    "apex_studio": "extended_ai",
    "apex_vision": "extended_ai",
    "social_channels": "social_ads_integration",
    "scoring_rules": "predictive_intelligence",
    "product_configurators": "cpq",
    "price_rules": "cpq",
    "guided_selling": "cpq",
    "client_scripts": "custom_functions",
    "teamspaces": "multi_team_management",
    "products": "inventory_management",
    "forecasts": "sales_forecasting",
    "forecast": "sales_forecasting",
    "blueprints": "process_management",
    "functions": "custom_functions",
    "widgets": "custom_functions",
    "circuits": "custom_functions",
    "territory_management": "multi_team_management",
    "teamspace_settings": "multi_team_management",
    "reports": "reports",
    "dashboards": "reports",
    "analytics": "advanced_analytics",
    "ai": "apex",
    "cpq": "cpq",
    "price_books": "inventory_management",
    "vendors": "inventory_management",
    "quotes": "inventory_management",
    "sales_orders": "inventory_management",
    "purchase_orders": "inventory_management",
    "invoices": "inventory_management",
    "payments": "payment_collection",
    "portals": "customer_portals",
    "approval_processes": "approval_process",
    "approvals": "approval_process",
    "sandbox": "developer_sandbox",
    "sandboxes": "developer_sandbox",
}


def request_resource_action(path: str, method: str) -> tuple[str | None, str]:
    method = method.upper()
    action = (
        "read" if method in {"GET", "HEAD"}
        else "create" if method == "POST"
        else "update" if method in {"PATCH", "PUT"}
        else "delete" if method == "DELETE"
        else "read"
    )
    parts = path.strip("/").split("/")
    if parts[:2] == ["api", "v1"]:
        parts.pop(1)
    if len(parts) < 2 or parts[0] != "api":
        return None, action
    if method == "POST" and len(parts) >= 3:
        special = {"convert": "convert", "mass-convert": "mass_convert", "bulk-delete": "mass_delete",
                   "bulk-update": "mass_update", "change-owner": "change_owner", "send-email": "send_email"}
        action = special.get(parts[-1], action)
    if parts[1:3] == ["admin", "standard-layout"] and len(parts) >= 4:
        # Reading a form layout and editing record values obey the CRM module profile.
        return parts[3], action
    if parts[1] in {"import-wizard", "import"} and len(parts) >= 3:
        return parts[2], "import"
    if parts[1] == "export" and len(parts) >= 3:
        return parts[2].removesuffix(".csv"), "export"
    if parts[1] == "custom" and len(parts) >= 3:
        return parts[2], action
    if parts[1] == "platform" and len(parts) >= 3:
        return parts[2], action
    if parts[1] in {"auth", "organization", "owner", "plans", "subscription", "billing", "settings", "security"}:
        return None, action
    if parts[1] == "admin" and len(parts) >= 3 and parts[2] == "metadata":
        return "custom_modules", action
    return parts[1], action


def request_entitlement_feature(path: str) -> str | None:
    parts = path.strip("/").split("/")
    if parts[:2] == ["api", "v1"]:
        parts.pop(1)
    if len(parts) < 2 or parts[0] != "api":
        return None
    if parts[1] in {"import-wizard", "import", "export", "custom"} and len(parts) >= 3:
        resource = parts[2].removesuffix(".csv")
        return "custom_modules" if parts[1] == "custom" else ENTITLEMENT_RESOURCE_FEATURES.get(resource)
    if parts[1:3] == ["admin", "standard-layout"] and len(parts) >= 4:
        return ENTITLEMENT_RESOURCE_FEATURES.get(parts[3])
    if parts[1] == "ai":
        return "apex"
    if parts[1] == "cpq":
        return "cpq"
    if parts[1] in {"reports", "dashboards"}:
        return "reports"
    if parts[1] in {"emails", "email"}:
        return "email_integration"
    if parts[1] == "analytics":
        return "advanced_analytics"
    if parts[1] == "admin" and len(parts) >= 3 and parts[2] == "metadata":
        return "custom_modules"
    if parts[1] == "platform" and len(parts) >= 3:
        return ENTITLEMENT_RESOURCE_FEATURES.get(parts[2]) or ("apex" if parts[2].startswith("apex_") else None)
    if parts[1:3] == ["admin", "security"] and len(parts) >= 4 and parts[3] in {"role-hierarchy", "roles"}:
        return "reporting_hierarchy"
    if parts[1] in {"blueprint", "blueprint-designer", "blueprint-records"}:
        return "process_management"
    if parts[1] == "teamspaces":
        return "multi_team_management"
    return ENTITLEMENT_RESOURCE_FEATURES.get(parts[1])

