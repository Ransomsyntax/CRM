"""Encrypt selected custom fields before persistence; never expose ciphertext as values."""
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.models import AuditEvent, MetadataField, MetadataModule, PlatformRecord
from app.services.vault import seal, sealed, unseal

MASK = "[Encrypted]"


def mapping(value):
    return value if isinstance(value, dict) else {}


def policies(db, record, rows=None):
    if not record.organization_id:
        return []
    if rows is None:
        rows = db.execute(select(MetadataField, MetadataModule).join(MetadataModule, MetadataModule.id == MetadataField.module_id)
            .where(MetadataModule.organization_id == record.organization_id)).all()
    return [(field, module) for field, module in rows if module.organization_id == record.organization_id and mapping(field.permissions).get("_encrypted") and
        (module.api_name == record.resource or (record.resource == "standard_layout_values" and
         mapping(module.config).get("layout_for") == record.related_type and module.owner_id == record.owner_id))]


def context(record, field):
    return [record.organization_id, field.module_id, field.id, field.api_name]


def read_values(db, record, actor=None, internal=False):
    from app.services.security import _enforce_plan_feature, _profile_action_allowed, field_allowed
    from fastapi import HTTPException
    values = dict(mapping(record.data))
    fields = policies(db, record)
    if not fields:
        return {key: MASK if sealed(value) and not internal else value for key, value in values.items()}
    resource = record.related_type if record.resource == "standard_layout_values" else record.resource
    entitled = internal
    if actor and not internal:
        try:
            _enforce_plan_feature(db, actor, "field_level_encryption")
            entitled = True
        except HTTPException:
            entitled = False
    for field, module in fields:
        if field.api_name not in values:
            continue
        allowed = internal or bool(entitled and actor and _profile_action_allowed(db, actor, resource, "decrypt") and
                                  field_allowed(db, module.api_name, field.api_name, actor, "read"))
        values[field.api_name] = unseal(values[field.api_name], context(record, field)) if allowed else MASK
    # Also mask encrypted values when a policy was removed or damaged.
    if not internal:
        values = {key: MASK if sealed(value) else value for key, value in values.items()}
    return values


def scrub(value, keys):
    if isinstance(value, dict):
        return {key: MASK if key in keys else scrub(item, keys) for key, item in value.items()}
    if isinstance(value, list):
        return [scrub(item, keys) for item in value]
    return value


@event.listens_for(Session, "before_flush")
def encrypt_pending_fields(db, flush_context, instances):
    pending = list(db.new) + list(db.dirty)
    organizations = {record.organization_id for record in pending if isinstance(record, (PlatformRecord, AuditEvent)) and record.organization_id}
    if not organizations:
        return
    rows = db.execute(select(MetadataField, MetadataModule).join(MetadataModule)
        .where(MetadataModule.organization_id.in_(organizations))).all()
    protected = [(field, module) for field, module in rows if mapping(field.permissions).get("_encrypted")]
    if not protected:
        return
    for record in pending:
        if isinstance(record, PlatformRecord) and isinstance(record.data, dict):
            fields = policies(db, record, protected)
            if fields:
                values = dict(record.data)
                for field, module in fields:
                    key = field.api_name
                    if key in values and values[key] is not None and not sealed(values[key]):
                        values[key] = seal(values[key], context(record, field))
                record.data = values
        elif isinstance(record, AuditEvent):
            # Audit JSON must not become an alternate plaintext copy of protected fields.
            encrypted = {field.api_name for field, module in protected if module.organization_id == record.organization_id}
            if encrypted:
                record.before = scrub(record.before, encrypted)
                record.after = scrub(record.after, encrypted)
