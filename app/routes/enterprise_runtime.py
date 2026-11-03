"""Provider connections, protected fields and configuration sandbox operations."""
import hashlib
import json
import math
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models import Account, Activity, AuditEvent, Email, MetadataField, MetadataModule, Organization, PlatformRecord, RuntimeConnection, RuntimeIntegrationAction, RuntimeIntegrationItem, RuntimeSandbox, User
from app.platform_catalog import PLATFORM_RESOURCES
from app.services.core import add_audit, sync_platform_columns, validate_platform_values, workflow_criteria_match
from app.services.security import can_access_record, current_actor, _enforce_plan_feature, _enforce_record_limit, _enforce_request_access, _organization_id_required, _profile_action_allowed, _setup_capability_allowed
from app.services.vault import cipher, configured, seal, unseal
from app.services.provider_runtime import PROVIDERS, fetch_batch, refresh, prepare_write, request_json
from app.services.field_encryption import MASK, context, scrub

router = APIRouter(prefix="/api/runtime", tags=["Enterprise runtime"])
SANDBOX_RESOURCES = {"workflow_rules", "email_templates", "pipelines", "validation_rules", "custom_views"}


def access(db, actor, capability, feature=None):
    if not actor or not _setup_capability_allowed(db, actor, capability):
        raise HTTPException(403, "This operation requires an assigned administrator permission")
    if feature:
        _enforce_plan_feature(db, actor, feature)
    return _organization_id_required(db, actor)


def connection(db, actor, connection_id):
    organization_id = access(db, actor, "manage_integrations")
    row = db.scalar(select(RuntimeConnection).where(RuntimeConnection.id == connection_id, RuntimeConnection.organization_id == organization_id))
    if not row:
        raise HTTPException(404, "Connection not found")
    _enforce_plan_feature(db, actor, PROVIDERS[row.provider]["feature"])
    return row


def public_connection(row):
    return {key: getattr(row, key) for key in ("id", "name", "provider", "status", "last_sync_at", "last_error")}


@router.get("/integrations")
def integrations(db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    org = access(db, actor, "manage_integrations")
    available = []
    for key, provider in PROVIDERS.items():
        try:
            _enforce_plan_feature(db, actor, provider["feature"])
            allowed = True
        except HTTPException:
            allowed = False
        available.append({"id": key, **provider, "available": allowed})
    return {"providers": available, "items": [public_connection(row) for row in db.scalars(select(RuntimeConnection).where(RuntimeConnection.organization_id == org)).all()],
            "encryption_ready": configured()}


@router.post("/integrations", status_code=201)
def connect_provider(payload: dict, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    org = access(db, actor, "manage_integrations")
    provider = payload.get("provider")
    if provider not in PROVIDERS:
        raise HTTPException(422, "Choose a supported provider")
    _enforce_plan_feature(db, actor, PROVIDERS[provider]["feature"])
    credentials = payload.get("credentials")
    keys = {"access_token", "refresh_token", "client_id", "client_secret", "developer_token", "expires_at"}
    if not isinstance(credentials, dict) or set(credentials) - keys or not isinstance(credentials.get("access_token"), str) or not credentials["access_token"].strip():
        raise HTTPException(422, "Provider access credentials are required")
    if any(not isinstance(value, (str, int, float)) or isinstance(value, bool) or len(str(value)) > 16000 for value in credentials.values()):
        raise HTTPException(422, "Invalid credentials")
    if any(not isinstance(value, str) or any(character in value for character in ('\r', '\n')) for key, value in credentials.items() if key != "expires_at"):
        raise HTTPException(422, "OAuth credentials must be single-line strings")
    try:
        if credentials.get("expires_at") is not None:
            if not math.isfinite(float(credentials["expires_at"])):
                raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(422, "Token expiry must be a Unix timestamp")
    configuration = payload.get("configuration") or {}
    allowed_configuration = {"calendar_id", "realm_id", "sandbox", "customer_id", "login_customer_id", "ad_account_id", "api_version"}
    if not isinstance(configuration, dict) or set(configuration) - allowed_configuration:
        raise HTTPException(422, "Unsupported connection settings")
    if any(not isinstance(value, (str, int, bool)) or len(str(value)) > 500 for value in configuration.values()):
        raise HTTPException(422, "Invalid provider settings")
    name = str(payload.get("name") or PROVIDERS[provider]["label"]).strip()
    if not 1 <= len(name) <= 160:
        raise HTTPException(422, "Connection name must be 1–160 characters")
    cipher()
    row = RuntimeConnection(organization_id=org, owner_id=actor.id, name=name, provider=provider, configuration=configuration, credentials={}, status="Not tested")
    db.add(row); db.flush()
    row.credentials = seal(credentials, [org, "connection", row.id])
    add_audit(db, "integration_connected", "runtime_connections", row.id, f"Configured {provider}; credentials omitted", actor_id=actor.id)
    db.commit()
    return public_connection(row)


def provider_batch(db, actor, connection_id):
    row = connection(db, actor, connection_id)
    row = db.scalar(select(RuntimeConnection).where(RuntimeConnection.id == row.id,
        RuntimeConnection.organization_id == row.organization_id).with_for_update().execution_options(populate_existing=True))
    credentials = unseal(row.credentials, [row.organization_id, "connection", row.id])
    try:
        credentials = refresh(row.provider, credentials)
        row.credentials = seal(credentials, [row.organization_id, "connection", row.id])
        items, cursor = fetch_batch(row.provider, credentials, row.configuration, row.cursor)
        row.credentials = seal(credentials, [row.organization_id, "connection", row.id])
        row.status, row.last_error = "Connected", None
        return row, items, cursor
    except HTTPException as error:
        row.status, row.last_error = "Error", str(error.detail)[:250]
        db.commit()
        raise


@router.post("/integrations/{connection_id}/test")
def test_provider(connection_id: int, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    row, items, cursor = provider_batch(db, actor, connection_id)
    db.commit()
    return {"ok": True, "status": row.status, "sample_count": len(items)}


@router.post("/integrations/{connection_id}/sync")
def sync_provider(connection_id: int, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    row, items, cursor = provider_batch(db, actor, connection_id)
    # A batch is applied atomically and repeated remote IDs update the same inbox item.
    db.execute(select(RuntimeConnection.id).where(RuntimeConnection.id == row.id).with_for_update()).scalar_one()
    if not isinstance(items, list) or len(items) > 100:
        raise HTTPException(502, "Provider returned too many records in one batch")
    for item in items:
        external_id = str(item.get("id") or "")
        if not external_id or len(external_id) > 250:
            raise HTTPException(502, "Provider returned an invalid record identifier")
        stored = db.scalar(select(RuntimeIntegrationItem).where(RuntimeIntegrationItem.connection_id == row.id, RuntimeIntegrationItem.external_id == external_id))
        if not stored:
            stored = RuntimeIntegrationItem(organization_id=row.organization_id, connection_id=row.id, external_id=external_id)
            db.add(stored)
        stored.payload = seal(item, [row.organization_id, "sync", row.id, external_id])
        db.flush()
    row.cursor, row.last_sync_at = cursor, datetime.utcnow()
    add_audit(db, "integration_synced", "runtime_connections", row.id, f"Synced {len(items)} {row.provider} items", actor_id=actor.id)
    db.commit()
    return {"synced": len(items), "has_more": bool(cursor)}


@router.get("/integrations/{connection_id}/items")
def integration_items(connection_id: int, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    row = connection(db, actor, connection_id)
    items = db.scalars(select(RuntimeIntegrationItem).where(RuntimeIntegrationItem.connection_id == row.id).order_by(RuntimeIntegrationItem.id.desc()).limit(100)).all()
    return {"items": [{"id": item.id, "data": unseal(item.payload, [row.organization_id, "sync", row.id, item.external_id]), "crm_resource": item.crm_resource, "crm_record_id": item.crm_record_id} for item in items], "entity": PROVIDERS[row.provider]["entity"]}


@router.post("/integrations/{connection_id}/items/{item_id}/import")
def import_integration_item(connection_id: int, item_id: int, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    row = connection(db, actor, connection_id)
    item = db.scalar(select(RuntimeIntegrationItem).where(RuntimeIntegrationItem.connection_id == row.id, RuntimeIntegrationItem.id == item_id).with_for_update())
    if not item:
        raise HTTPException(404, "Synced item not found")
    if item.crm_record_id:
        return {"resource": item.crm_resource, "id": item.crm_record_id, "already_imported": True}
    resource = PROVIDERS[row.provider]["entity"]
    if not resource:
        raise HTTPException(422, "This provider is available in the integration inbox and does not map to a CRM record")
    _enforce_request_access(db, actor, "/api/" + resource, "POST")
    _enforce_record_limit(db, actor)
    values = unseal(item.payload, [row.organization_id, "sync", row.id, item.external_id])
    common = {"organization_id": row.organization_id, "owner_id": actor.id}
    if resource == "emails":
        sender = values.get("from", "")
        if isinstance(sender, dict):
            sender = sender.get("emailAddress", {}).get("address", "")
        target = values.get("to") or ", ".join(r.get("emailAddress", {}).get("address", "") for r in values.get("toRecipients", []))
        record = Email(**common, subject=str(values.get("title") or "(No subject)")[:220], from_email=str(sender)[:180], to_email=str(target)[:180], body=str(values.get("body") or values.get("bodyPreview") or ""), status="Received")
    elif resource == "activities":
        start = values.get("start") or values.get("start_time")
        if isinstance(start, dict):
            start = start.get("dateTime") or start.get("date")
        try:
            start = datetime.fromisoformat(start.replace("Z", "+00:00")) if start else None
            if start and start.tzinfo:
                start = start.astimezone(timezone.utc).replace(tzinfo=None)
        except (ValueError, AttributeError):
            start = None
        record = Activity(**common, subject=str(values.get("title") or "Meeting")[:180], activity_type="Meeting", start_at=start, description=str(values.get("description") or values.get("bodyPreview") or values.get("agenda") or ""), status="Open")
    else:
        record = Account(**common, name=str(values.get("title") or "Customer")[:160])
    db.add(record); db.flush()
    item.crm_resource, item.crm_record_id = resource, record.id
    add_audit(db, "integration_imported", resource, record.id, f"Imported a selected {row.provider} item", actor_id=actor.id)
    db.commit()
    return {"resource": resource, "id": record.id}


@router.delete("/integrations/{connection_id}")
def disconnect_provider(connection_id: int, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    row = connection(db, actor, connection_id)
    for item in db.scalars(select(RuntimeIntegrationItem).where(RuntimeIntegrationItem.connection_id == row.id)).all():
        db.delete(item)
    for action in db.scalars(select(RuntimeIntegrationAction).where(RuntimeIntegrationAction.connection_id == row.id)).all():
        db.delete(action)
    db.delete(row)
    add_audit(db, "integration_disconnected", "runtime_connections", connection_id, "Removed connection credentials and sync inbox; imported CRM records retained", actor_id=actor.id)
    db.commit()
    return {"ok": True}


@router.post("/integrations/{connection_id}/action")
def provider_action(connection_id: int, payload: dict, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    row = connection(db, actor, connection_id)
    if payload.get("confirmed") is not True:
        raise HTTPException(422, "Confirm the external action before submitting")
    request_key = payload.get("request_key")
    if not isinstance(request_key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{8,80}", request_key):
        raise HTTPException(422, "Provide a unique action request key")
    values = payload.get("values")
    url, body = prepare_write(row.provider, row.configuration, values)
    resource = PROVIDERS[row.provider]["entity"] or "marketplace_integrations"
    if resource == "emails":
        if not _profile_action_allowed(db, actor, "emails", "send_email"):
            raise HTTPException(403, "Send Email permission is required")
        _enforce_plan_feature(db, actor, "email_integration")
    else:
        _enforce_request_access(db, actor, "/api/platform/" + resource if resource == "marketplace_integrations" else "/api/" + resource, "POST")
    request_digest = digest({"provider": row.provider, "values": values})
    previous = db.scalar(select(RuntimeIntegrationAction).where(RuntimeIntegrationAction.connection_id == row.id, RuntimeIntegrationAction.request_key == request_key))
    if previous:
        if previous.request_digest != request_digest:
            raise HTTPException(409, "This action key was already used with different content")
        if previous.status == "Completed":
            return {"accepted": True, "reference": previous.reference, "already_submitted": True}
        raise HTTPException(409, "An action with this key was attempted. Check the provider before retrying.")
    credentials = refresh(row.provider, unseal(row.credentials, [row.organization_id, "connection", row.id]))
    row.credentials = seal(credentials, [row.organization_id, "connection", row.id])
    action = RuntimeIntegrationAction(organization_id=row.organization_id, connection_id=row.id, request_key=request_key, request_digest=request_digest, status="Pending")
    db.add(action)
    try:
        db.flush()
        add_audit(db, "integration_action_requested", "runtime_connections", row.id, f"Confirmed {row.provider} action; content omitted", actor_id=actor.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This action request is already being processed") from None
    try:
        result = request_json(url, credentials["access_token"], data=body)
    except HTTPException:
        action.status = "Unknown"
        db.commit()
        raise HTTPException(409, "The provider outcome is unknown. Check the provider before submitting again.") from None
    reference = result.get("id") or result.get("ts") or (result.get("Customer") or {}).get("Id")
    action.status, action.reference = "Completed", str(reference)[:250] if reference is not None else None
    db.commit()
    return {"accepted": True, "reference": action.reference, "already_submitted": False}


def field_and_module(db, actor, field_id):
    org = access(db, actor, "manage_encryption", "field_level_encryption")
    result = db.execute(select(MetadataField, MetadataModule).join(MetadataModule).where(MetadataField.id == field_id, MetadataModule.organization_id == org)).first()
    if not result:
        raise HTTPException(404, "Custom field not found")
    return result


@router.get("/encrypted-fields")
def encrypted_fields(db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    org = access(db, actor, "manage_encryption", "field_level_encryption")
    rows = db.execute(select(MetadataField, MetadataModule).join(MetadataModule).where(MetadataModule.organization_id == org)).all()
    return {"encryption_ready": configured(), "items": [{"id": field.id, "name": field.label, "module": module.label, "encrypted": bool((field.permissions or {}).get("_encrypted"))} for field, module in rows]}


@router.put("/encrypted-fields/{field_id}")
def configure_field_encryption(field_id: int, payload: dict, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    field, module = field_and_module(db, actor, field_id)
    enabled = payload.get("encrypted")
    if type(enabled) is not bool:
        raise HTTPException(422, "encrypted must be true or false")
    reserved = {"id", "name", "title", "subject", "status", "owner_id", "organization_id", "account_id", "contact_id", "deal_id", "related_id", "related_type", "amount", "due_date", "tags", (module.config or {}).get("record_name_field")}
    if field.api_name in reserved or field.unique_value or field.field_type not in {"text", "multiline", "email", "phone", "url", "number", "decimal", "currency", "date", "datetime"}:
        raise HTTPException(422, "Choose a non-unique custom value field; names, lookup, computed and system fields cannot be encrypted")
    if enabled and field.default_value not in (None, ""):
        raise HTTPException(422, "Remove the field's plaintext default before enabling encryption")
    resource = (module.config or {}).get("layout_for") or module.api_name
    if not enabled and not _profile_action_allowed(db, actor, resource, "decrypt"):
        raise HTTPException(403, "Decrypt permission is required to remove encryption")
    cipher()
    query = select(PlatformRecord).where(PlatformRecord.organization_id == module.organization_id)
    if (module.config or {}).get("layout_for"):
        query = query.where(PlatformRecord.resource == "standard_layout_values", PlatformRecord.related_type == resource, PlatformRecord.owner_id == module.owner_id)
    else:
        query = query.where(PlatformRecord.resource == module.api_name)
    changed = 0
    # Keep the transaction atomic: protection and backfill are committed together.
    for record in db.scalars(query).all():
        values = dict(record.data or {})
        if field.api_name in values and values[field.api_name] is not None:
            raw = unseal(values[field.api_name], context(record, field))
            values[field.api_name] = seal(raw, context(record, field)) if enabled else raw
            record.data = values
            changed += 1
    field.permissions = {**(field.permissions or {}), "_encrypted": enabled}
    if enabled:
        for audit in db.scalars(select(AuditEvent).where(AuditEvent.organization_id == module.organization_id)).all():
            audit.before, audit.after = scrub(audit.before, {field.api_name}), scrub(audit.after, {field.api_name})
    add_audit(db, "field_encryption_changed", "metadata_fields", field.id, f"{'Enabled' if enabled else 'Disabled'} field encryption; {changed} stored values migrated", actor_id=actor.id)
    db.commit()
    return {"encrypted": enabled, "migrated_values": changed}


def snapshot(db, actor):
    org = _organization_id_required(db, actor)
    result = []
    for row in db.scalars(select(PlatformRecord).where(PlatformRecord.organization_id == org, PlatformRecord.resource.in_(SANDBOX_RESOURCES), PlatformRecord.archived == False).order_by(PlatformRecord.id)).all():
        if can_access_record(db, row.resource, row, actor):
            result.append({"source_id": row.id, "resource": row.resource, "values": dict(row.data or {})})
    return result


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def sandbox(db, actor, sandbox_id):
    org = access(db, actor, "manage_sandbox", "developer_sandbox")
    row = db.scalar(select(RuntimeSandbox).where(RuntimeSandbox.id == sandbox_id, RuntimeSandbox.organization_id == org).with_for_update())
    if not row:
        raise HTTPException(404, "Sandbox not found")
    return row


def validate_snapshot(entries):
    if not isinstance(entries, list) or len(entries) > 500 or len(json.dumps(entries)) > 1_000_000:
        raise HTTPException(422, "Sandbox configuration exceeds the supported size")
    seen = set()
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) - {"source_id", "resource", "values"}:
            raise HTTPException(422, "Invalid sandbox component")
        resource, values = entry.get("resource"), entry.get("values")
        if resource not in SANDBOX_RESOURCES or not isinstance(values, dict):
            raise HTTPException(422, "Unsupported sandbox component")
        source = entry.get("source_id")
        if source is not None and (type(source) is not int or source in seen):
            raise HTTPException(422, "Invalid or duplicate sandbox source")
        if source is not None:
            seen.add(source)
        keys = {field["key"] for field in PLATFORM_RESOURCES[resource]["fields"]}
        if set(values) - keys - {"owner_id"}:
            raise HTTPException(422, "Sandbox configuration contains unsupported fields")
        validate_platform_values(resource, values)


@router.get("/sandboxes")
def list_sandboxes(db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    org = access(db, actor, "manage_sandbox", "developer_sandbox")
    return {"encryption_ready": configured(), "items": [{"id": row.id, "name": row.name, "status": row.status, "revision": row.revision} for row in db.scalars(select(RuntimeSandbox).where(RuntimeSandbox.organization_id == org)).all()], "resources": sorted(SANDBOX_RESOURCES)}


@router.post("/sandboxes", status_code=201)
def create_sandbox(payload: dict, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    org = access(db, actor, "manage_sandbox", "developer_sandbox")
    name = str(payload.get("name") or "").strip()
    if not 1 <= len(name) <= 160:
        raise HTTPException(422, "Sandbox name must be 1–160 characters")
    entries = snapshot(db, actor)
    row = RuntimeSandbox(organization_id=org, owner_id=actor.id, name=name, base_digest=digest(entries), configuration={}, revision=1, status="Draft")
    db.add(row); db.flush()
    row.configuration = seal(entries, [org, "sandbox", row.id])
    add_audit(db, "sandbox_created", "runtime_sandboxes", row.id, "Created isolated configuration snapshot; no credentials or customer records copied", actor_id=actor.id)
    db.commit()
    return {"id": row.id}


@router.get("/sandboxes/{sandbox_id}")
def get_sandbox(sandbox_id: int, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    row = sandbox(db, actor, sandbox_id)
    return {"id": row.id, "name": row.name, "revision": row.revision, "status": row.status, "components": unseal(row.configuration, [row.organization_id, "sandbox", row.id])}


@router.put("/sandboxes/{sandbox_id}")
def save_sandbox(sandbox_id: int, payload: dict, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    row = sandbox(db, actor, sandbox_id)
    if payload.get("revision") != row.revision:
        raise HTTPException(409, "Sandbox changed; reload before saving")
    entries = payload.get("components")
    validate_snapshot(entries)
    row.configuration = seal(entries, [row.organization_id, "sandbox", row.id])
    row.revision += 1
    row.status = "Draft"
    db.commit()
    return {"revision": row.revision}


@router.post("/sandboxes/{sandbox_id}/test")
def test_sandbox(sandbox_id: int, payload: dict, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    row = sandbox(db, actor, sandbox_id)
    entries = unseal(row.configuration, [row.organization_id, "sandbox", row.id])
    validate_snapshot(entries)
    values = payload.get("values") or {}
    if not isinstance(values, dict) or len(json.dumps(values)) > 50000:
        raise HTTPException(422, "Provide a small sample record")
    rules = [{"name": entry["values"].get("name"), "matches": workflow_criteria_match(values, entry["values"].get("criteria") or []), "actions": entry["values"].get("actions", [])}
        for entry in entries if entry["resource"] == "workflow_rules" and str(entry["values"].get("module") or "").casefold() == str(payload.get("module") or "leads").casefold()]
    return {"valid": True, "rules": rules, "side_effects": False}


@router.post("/sandboxes/{sandbox_id}/promote")
def promote_sandbox(sandbox_id: int, payload: dict, db: Session = Depends(get_db), actor: User = Depends(current_actor)):
    row = sandbox(db, actor, sandbox_id)
    if payload.get("revision") != row.revision:
        raise HTTPException(409, "Sandbox changed; reload before promotion")
    db.execute(select(Organization.id).where(Organization.id == row.organization_id).with_for_update()).scalar_one()
    current = snapshot(db, actor)
    if digest(current) != row.base_digest:
        raise HTTPException(409, "Production configuration changed. Create a fresh sandbox to reconcile changes.")
    entries = unseal(row.configuration, [row.organization_id, "sandbox", row.id])
    validate_snapshot(entries)
    sources = {entry["source_id"]: entry for entry in current}
    prepared = []
    for entry in entries:
        resource, source = entry["resource"], entry.get("source_id")
        if source is not None and (source not in sources or sources[source]["resource"] != resource):
            raise HTTPException(422, "Sandbox component does not belong to its source organization")
        _enforce_request_access(db, actor, "/api/platform/" + resource, "PATCH" if source else "POST")
        prepared.append(entry)
    for entry in prepared:
        record = db.get(PlatformRecord, entry.get("source_id")) if entry.get("source_id") else None
        if not record:
            _enforce_record_limit(db, actor)
            record = PlatformRecord(organization_id=row.organization_id, owner_id=actor.id, resource=entry["resource"], data={})
            db.add(record)
        values = {**entry["values"], "owner_id": record.owner_id}
        sync_platform_columns(record, values)
        record.version = int(record.version or 0) + 1
        db.flush()
    updated = snapshot(db, actor)
    row.base_digest = digest(updated)
    row.configuration = seal(updated, [row.organization_id, "sandbox", row.id])
    row.status, row.revision = "Published", row.revision + 1
    add_audit(db, "sandbox_promoted", "runtime_sandboxes", row.id, f"Promoted {len(prepared)} validated configuration components", actor_id=actor.id)
    db.commit()
    return {"promoted": len(prepared), "revision": row.revision}
