"""Standard Layout routes, registered after the application services initialize."""
from app.main import *  # noqa: F403 - shared application facade
from app.main import _layout_field_json, _standard_layout_module, _standard_layout_values
from app.services.security import _enforce_plan_feature


@app.get("/api/admin/standard-layout/{resource}")
def read_standard_layout(resource: str, db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    module = _standard_layout_module(db, actor, resource)
    if module is None:
        return {"fields": [], "order": [], "sections": [], "named_layouts": {}, "active_layout": "Standard"}
    fields = db.scalars(select(MetadataField).where(MetadataField.module_id == module.id).order_by(MetadataField.position, MetadataField.id)).all()
    return {"fields": [_layout_field_json(f) for f in fields], "order": list((module.config or {}).get("field_order") or []), "sections": list((module.config or {}).get("sections") or []), "named_layouts": dict((module.config or {}).get("named_layouts") or {}), "active_layout": (module.config or {}).get("active_layout") or "Standard"}


@app.put("/api/admin/standard-layout/{resource}/named")
def save_named_standard_layout(resource: str, payload: dict[str, Any], db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    module = _standard_layout_module(db, actor, resource, True)
    name = str(payload.get("name") or "").strip()
    if not 1 <= len(name) <= 100:
        raise HTTPException(422, "Layout name is required (maximum 100 characters)")
    saved = dict(module.config or {})
    names = dict(saved.get("named_layouts") or {})
    if name.casefold() == "standard" and payload.get("mode") != "edit":
        raise HTTPException(403, "The Standard layout cannot be renamed or duplicated")
    matched = next((key for key in names if key.casefold() == name.casefold()), None)
    if matched is None and name != "Standard":
        raise HTTPException(404, "Layout does not exist; use Create New Layout in Settings")
    if len(names) >= 30 and name not in names:
        raise HTTPException(422, "Maximum 30 named layouts")
    sections = payload.get("sections")
    if not isinstance(sections, list) or not sections:
        raise HTTPException(422, "Layout must contain a section")
    if name == "Standard":
        saved["sections"] = sections
        saved["field_order"] = [key for section in sections for key in section.get("fields", [])]
    else:
        names[matched] = {"sections": sections}
    saved["named_layouts"] = names
    saved["active_layout"] = matched or "Standard"
    module.config = saved
    db.commit()
    return {"name": name, "names": list(names)}


@app.post("/api/admin/standard-layout/{resource}/named", status_code=201)
def create_named_standard_layout(resource: str, payload: dict[str, Any], db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    module = _standard_layout_module(db, actor, resource, True)
    name = str(payload.get("name") or "").strip()
    if not 1 <= len(name) <= 100 or name.casefold() == "standard":
        raise HTTPException(422, "Provide a unique custom layout name (1–100 characters)")
    config = dict(module.config or {})
    names = dict(config.get("named_layouts") or {})
    if any(existing.casefold() == name.casefold() for existing in names):
        raise HTTPException(409, "A layout with this name already exists")
    if len(names) >= 30:
        raise HTTPException(422, "Maximum 30 named layouts")
    sections = payload.get("sections")
    if not isinstance(sections, list) or not sections:
        raise HTTPException(422, "Layout must contain at least one section")
    names[name] = {"sections": sections}
    config["named_layouts"] = names
    module.config = config
    db.commit()
    return {"name": name, "names": list(names)}


@app.delete("/api/admin/standard-layout/{resource}/named/{name}")
def delete_named_standard_layout(resource: str, name: str, db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    if name.casefold() == "standard":
        raise HTTPException(403, "The original Standard layout cannot be deleted")
    module = _standard_layout_module(db, actor, resource)
    if module is None:
        raise HTTPException(404, "Layout not found")
    config = dict(module.config or {})
    names = dict(config.get("named_layouts") or {})
    matched = next((key for key in names if key.casefold() == name.casefold()), None)
    if matched is None:
        raise HTTPException(404, "Layout not found")
    del names[matched]
    config["named_layouts"] = names
    if str(config.get("active_layout") or "").casefold() == matched.casefold():
        config["active_layout"] = "Standard"
    module.config = config
    db.commit()
    return {"deleted": matched, "active_layout": config.get("active_layout", "Standard")}


@app.post("/api/admin/standard-layout/{resource}/fields", status_code=201)
def create_standard_layout_field(resource: str, payload: dict[str, Any], db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    module = _standard_layout_module(db, actor, resource, True)
    label = str(payload.get("label") or "").strip()
    kind = str(payload.get("type") or "text").strip().lower()
    _enforce_plan_feature(db, actor, "custom_fields")
    if kind in {"formula", "subform", "richtext", "file", "image"}:
        _enforce_plan_feature(db, actor, "extended_field_types")
    api_name = re.sub(r"[^a-z0-9_]+", "_", str(payload.get("key") or label).lower()).strip("_")[:90]
    if not 1 <= len(label) <= 160 or not api_name or kind not in LAYOUT_FIELD_TYPES:
        raise HTTPException(422, "Valid field name and supported type required")
    if len(db.scalars(select(MetadataField.id).where(MetadataField.module_id == module.id)).all()) >= 100:
        raise HTTPException(422, "Maximum 100 custom fields per module")
    if (resource in RESOURCE_MAP and api_name in RESOURCE_MAP[resource].__table__.columns) or api_name in {"id", "owner_id", "organization_id"}:
        raise HTTPException(409, "Field API name conflicts with an existing field")
    if db.scalar(select(MetadataField.id).where(MetadataField.module_id == module.id, MetadataField.api_name == api_name)):
        raise HTTPException(409, "Field API name already exists")
    options = payload.get("options") or []
    if not isinstance(options, list) or len(options) > 100 or any(not isinstance(option, str) or len(option) > 160 for option in options):
        raise HTTPException(422, "Invalid field options")
    field = MetadataField(module_id=module.id, label=label, api_name=api_name, field_type=kind,
                          required=bool(payload.get("required", False)), position=1000, validation={"options": options})
    db.add(field)
    db.flush()
    config = dict(module.config or {})
    config["field_order"] = list(config.get("field_order") or []) + [api_name]
    module.config = config
    db.commit()
    db.refresh(field)
    return _layout_field_json(field)


@app.patch("/api/admin/standard-layout/{resource}/fields/{field_id}")
def edit_standard_layout_field(resource: str, field_id: int, payload: dict[str, Any], db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    module = _standard_layout_module(db, actor, resource)
    field = db.get(MetadataField, field_id)
    if not module or not field or field.module_id != module.id:
        raise HTTPException(404, "Custom field not found")
    if "label" in payload:
        label = str(payload["label"]).strip()
        if not 1 <= len(label) <= 160:
            raise HTTPException(422, "Field label must be 1–160 characters")
        field.label = label
    if "required" in payload:
        field.required = bool(payload["required"])
    if "options" in payload:
        options = payload["options"]
        if not isinstance(options, list) or len(options) > 100 or any(not isinstance(x, str) or len(x) > 160 for x in options):
            raise HTTPException(422, "Invalid field options")
        field.validation = {**(field.validation or {}), "options": options}
    db.commit()
    db.refresh(field)
    return _layout_field_json(field)


@app.put("/api/admin/standard-layout/{resource}/sections")
def save_standard_layout_sections(resource: str, payload: dict[str, Any], db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    module = _standard_layout_module(db, actor, resource, True)
    sections = payload.get("sections")
    if not isinstance(sections, list) or not 1 <= len(sections) <= 30:
        raise HTTPException(422, "Supply between 1 and 30 sections")
    identifiers = set()
    cleaned = []
    for section in sections:
        if not isinstance(section, dict):
            raise HTTPException(422, "Invalid section")
        section_id = str(section.get("id") or "")
        title = str(section.get("title") or "").strip()
        keys = section.get("fields", [])
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,90}", section_id) or section_id in identifiers or not 1 <= len(title) <= 160 or not isinstance(keys, list):
            raise HTTPException(422, "Invalid section definition")
        if len(keys) > 250 or any(not isinstance(key, str) for key in keys):
            raise HTTPException(422, "Invalid section fields")
        identifiers.add(section_id)
        cleaned.append({"id": section_id, "title": title, "fields": keys})
    all_keys = [key for section in cleaned for key in section["fields"]]
    if len(all_keys) != len(set(all_keys)):
        raise HTTPException(422, "A field cannot appear in multiple sections")
    known = (set(RESOURCE_MAP[resource].__table__.columns.keys()) if resource in RESOURCE_MAP else set()) | {
        field.api_name for field in db.scalars(select(MetadataField).where(MetadataField.module_id == module.id)).all()
    }
    if any((key not in known if resource in RESOURCE_MAP else not re.fullmatch(r"[a-zA-Z0-9_]{1,100}", key)) for key in all_keys):
        raise HTTPException(422, "Unrecognized field in section")
    config = dict(module.config or {})
    config["sections"] = cleaned
    config["field_order"] = all_keys
    module.config = config
    db.commit()
    return {"sections": cleaned, "order": all_keys}


@app.put("/api/admin/standard-layout/{resource}/order")
def update_standard_layout_order(resource: str, payload: dict[str, Any], db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    module = _standard_layout_module(db, actor, resource, True)
    supplied = payload.get("order")
    if not isinstance(supplied, list) or len(supplied) > 250 or any(not isinstance(k, str) for k in supplied) or len(set(supplied)) != len(supplied):
        raise HTTPException(422, "Invalid field order")
    known = {field.api_name for field in db.scalars(select(MetadataField).where(MetadataField.module_id == module.id)).all()}
    standard = set(RESOURCE_MAP[resource].__table__.columns.keys()) if resource in RESOURCE_MAP else set()
    if any(key not in known and key not in standard for key in supplied):
        raise HTTPException(422, "Unrecognized field in layout")
    config = dict(module.config or {})
    config["field_order"] = supplied
    module.config = config
    db.commit()
    return {"order": supplied}


@app.get("/api/admin/standard-layout/{resource}/records/{item_id}")
def get_standard_layout_values(resource: str, item_id: int, db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    row = _standard_layout_values(db, actor, resource, item_id)
    from app.services.field_encryption import read_values
    return {"values": read_values(db, row, actor) if row else {}}


@app.put("/api/admin/standard-layout/{resource}/records/{item_id}")
def put_standard_layout_values(resource: str, item_id: int, payload: dict[str, Any], db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    row = _standard_layout_values(db, actor, resource, item_id, True)
    module = _standard_layout_module(db, actor, resource)
    fields = db.scalars(select(MetadataField).where(MetadataField.module_id == module.id)).all() if module else []
    defined = {field.api_name: field for field in fields}
    values = payload.get("values")
    if not isinstance(values, dict) or any(key not in defined for key in values):
        raise HTTPException(422, "Unrecognized custom field")
    cleaned = dict(row.data or {}) if row else {}
    for key, value in values.items():
        field = defined[key]
        if (field.permissions or {}).get("_encrypted") and value == "[Encrypted]":
            continue
        if value is not None and not isinstance(value, (str, int, float, bool, list)):
            raise HTTPException(422, "Unsupported field value")
        if isinstance(value, str) and len(value) > 12000:
            raise HTTPException(422, "Field value exceeds length limit")
        if field.field_type == "checkbox" and value is not None and not isinstance(value, bool):
            raise HTTPException(422, "Checkbox expects boolean")
        if field.field_type == "multi_select" and value is not None and (not isinstance(value, list) or len(value) > 100 or any(not isinstance(v, str) for v in value)):
            raise HTTPException(422, "Multi-select expects string list")
        cleaned[key] = value
    if row is None:
        row = PlatformRecord(resource="standard_layout_values", title=f"{resource}:{item_id}", owner_id=actor.id,
                             organization_id=getattr(db.get(RESOURCE_MAP[resource], item_id), "organization_id", None),
                             related_type=resource, related_id=item_id, data=cleaned)
        db.add(row)
    else:
        row.data = cleaned
    db.commit()
    from app.services.field_encryption import read_values
    return {"values": read_values(db, row, actor)}


