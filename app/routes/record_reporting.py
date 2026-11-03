"""Smaller route module for dashboard reporting, billing, exports and record history.

Imported at the end of app.main, after shared services have been defined.
Route objects still belong to the application's original FastAPI instance.
"""
from app.main import *  # noqa: F403 - route compatibility with the existing app facade
from app.main import _pending_upgrade_request, _require_admin_resource, _enforce_plan_feature, _enforce_ai_limit, _ai_dashboard_platform_rows, _ai_count_status, _public_ai_error


@app.get("/api/dashboard/report/{report_key}")
def dashboard_report(
    report_key: str,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    actor: User = Depends(current_actor),
) -> dict[str, Any]:
    """Read-only KPI drill-downs with the dashboard's ownership and date predicates."""
    definitions = {
        "total-leads": ("Total leads", "Your non-archived, non-converted leads that you can access."),
        "open-deals": ("Open deals", "Your deals excluding Closed Won and Closed Lost."),
        "pipeline-value": ("Pipeline value", "Value and details of your open opportunities."),
        "activities-due": ("Activities due", "Incomplete and overdue activities due within seven days."),
        "ai-action-queue": ("AI action queue", "Stale leads and quotations requiring follow-up."),
    }
    if report_key not in definitions:
        raise HTTPException(404, "Dashboard report not found")
    title, description = definitions[report_key]
    if report_key == "ai-action-queue":
        attention = sales_performance(db, actor)["attention"]
        rows = [
            {"id": item["id"], "resource": "leads", "title": item["name"],
             "context": "Stale lead", "status": item["status"],
             "date": item.get("next_follow_up"), "amount": None,
             "url": f"/leads/{item['id']}"}
            for item in attention["stuck_leads"]
        ] + [
            {"id": item["id"], "resource": "quotes", "title": item["name"],
             "context": "Quotation follow-up", "status": item["status"],
             "date": item.get("valid_until"), "amount": None, "url": "/quotes"}
            for item in attention["quotes_needing_follow_up"]
        ]
        return {
            "key": report_key, "title": title, "description": description,
            "total": len(rows), "amount": None,
            "items": rows[offset:offset + limit], "limit": limit,
            "offset": offset, "has_more": offset + limit < len(rows),
        }

    if report_key == "total-leads":
        resource = "leads"
        query = select(Lead).where(
            Lead.archived == False, Lead.status != "Converted", Lead.owner_id == actor.id,
        ).order_by(Lead.created_at.desc(), Lead.id.desc())
    elif report_key in {"open-deals", "pipeline-value"}:
        resource = "deals"
        query = select(Deal).where(
            Deal.archived == False, Deal.owner_id == actor.id,
            Deal.stage.not_in(["Closed Won", "Closed Lost"]),
        ).order_by(Deal.created_at.desc(), Deal.id.desc())
    else:
        resource = "activities"
        query = select(Activity).where(
            Activity.archived == False, Activity.owner_id == actor.id,
            Activity.status != "Completed",
            Activity.due_at <= datetime.utcnow() + timedelta(days=7),
        ).order_by(Activity.due_at.asc(), Activity.id.desc())

    # Verify record access and apply field-level serialization for every result.
    visible = [
        record for record in db.scalars(query).all()
        if can_access_record(db, resource, record, actor)
    ]
    rows = []
    for record in visible[offset:offset + limit]:
        data = serialize(record, db, actor)
        if resource == "leads":
            label, context, status = data.get("name"), data.get("company"), data.get("status")
            date_value, amount = data.get("next_follow_up"), None
        elif resource == "deals":
            label, context, status = data.get("name"), data.get("type"), data.get("stage")
            date_value, amount = data.get("expected_close_date"), data.get("amount")
        else:
            label, context, status = data.get("subject"), data.get("activity_type"), data.get("status")
            date_value, amount = data.get("due_at"), None
        rows.append({
            "id": record.id, "resource": resource,
            "title": label or f"Record {record.id}", "context": context or "",
            "status": status or "", "date": date_value, "amount": amount,
            "url": f"/{resource}/{record.id}",
        })
    return {
        "key": report_key, "title": title, "description": description,
        "total": len(visible),
        "amount": float(sum(float(record.amount or 0) for record in visible))
                  if report_key == "pipeline-value" else None,
        "items": rows, "limit": limit, "offset": offset,
        "has_more": offset + limit < len(visible),
    }



@app.post("/api/billing/checkout")
def billing_checkout(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    actor: User = Depends(current_actor),
) -> dict[str, Any]:
    plan_code = str(payload.get("plan_code") or "").strip().lower()
    plan = db.scalar(select(Plan).where(func.lower(Plan.code) == plan_code, Plan.active == True))
    if plan is None:
        raise HTTPException(404, "Selected plan is unavailable")
    if float(plan.price_monthly or 0) <= 0:
        raise HTTPException(422, "The selected plan does not require checkout")
    subscription, upgrade = _pending_upgrade_request(db, actor, plan)
    members = int(db.scalar(select(func.count()).select_from(OrganizationMember).where(
        OrganizationMember.organization_id == subscription.organization_id,
        OrganizationMember.status == "Active",
    )) or 1)
    public_url = os.getenv("APP_PUBLIC_URL", "").strip()
    pending = int(db.scalar(select(func.count()).select_from(OrganizationInvitation).where(
        OrganizationInvitation.organization_id == subscription.organization_id,
        OrganizationInvitation.status == "Pending", OrganizationInvitation.expires_at > datetime.utcnow(),
    )) or 0)
    seats = payload.get("seats", max(subscription.purchased_seats, members + pending))
    if isinstance(seats, bool) or not isinstance(seats, int) or seats < max(1, members + pending):
        raise HTTPException(422, "Seats must be an integer covering active users and pending invitations")
    if upgrade.provider_reference and upgrade.requested_seats != seats:
        raise HTTPException(409, "A checkout is already pending with a different seat quantity")
    upgrade.requested_seats = seats
    if not public_url:
        raise HTTPException(503, detail={"code": "BILLING_NOT_READY", "message": "APP_PUBLIC_URL is required for hosted checkout."})
    try:
        checkout = create_hosted_checkout(
            request_id=upgrade.id,
            plan_name=plan.name,
            amount_major=float(plan.price_monthly or 0),
            currency=plan.currency,
            seats=seats,
            customer_email=actor.email,
            public_url=public_url,
        )
    except BillingError as exc:
        raise HTTPException(503, detail={"code": "BILLING_NOT_READY", "message": str(exc)}) from exc
    upgrade.provider = checkout.get("provider")
    upgrade.provider_reference = checkout.get("provider_reference")
    db.commit()
    return {
        "ok": True,
        "provider": checkout.get("provider"),
        "checkout_url": checkout.get("checkout_url"),
        "request_id": upgrade.id,
        "seats": seats,
        "plan": {"code": plan.code, "name": plan.name, "price_monthly": float(plan.price_monthly or 0), "currency": plan.currency},
    }



@app.get("/api/export/{resource}.csv")
def export_csv(resource: str, db: Session = Depends(get_db), actor: User | None = Depends(current_actor)) -> StreamingResponse:
    if resource in PLATFORM_RESOURCES:
        rows = [serialize_platform(row, db, actor) for row in db.scalars(select(PlatformRecord).where(PlatformRecord.resource == resource, PlatformRecord.archived == False)).all() if can_access_record(db, resource, row, actor)]
    elif resource in RESOURCE_MAP:
        model = RESOURCE_MAP[resource]
        query = select(model)
        if hasattr(model, "archived"):
            query = query.where(getattr(model, "archived") == False)
        rows = [serialize(row, db, actor) for row in db.scalars(query).all() if can_access_record(db, resource, row, actor)]
    else:
        raise HTTPException(404, "Unknown export resource")
    keys = sorted({key for row in rows for key in row.keys() if key not in {"data"}}) or ["id", "name"]
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=keys, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value for key, value in row.items()})
    content = stream.getvalue().encode("utf-8-sig")
    return StreamingResponse(iter([content]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="yash-crm-{resource}.csv"'})



@app.get("/api/{resource}/{item_id}/timeline")
def record_timeline(
    resource: str,
    item_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(current_actor),
) -> dict[str, Any]:
    """Accessible, tenant-scoped activity and change history for a single lead or deal."""
    if resource not in {"leads", "deals"}:
        raise HTTPException(404, "Timeline is unavailable for this resource")
    _require_admin_resource(resource, actor)
    record = db.get(RESOURCE_MAP[resource], item_id)
    if record is None or getattr(record, "archived", False) or not can_access_record(db, resource, record, actor):
        raise HTTPException(404, "Record not found")
    organization_id = record.organization_id
    if organization_id is None:
        # A legacy private record may be readable by its owner before the
        # organization backfill. Never query tenant-scoped history without a
        # verified organization ID; render the readable record with a safe,
        # empty timeline instead of reporting that the record does not exist.
        from app.services.blueprint_engine import FIELDS
        return {
            "items": [], "total": 0, "blueprint_enabled": False,
            "blueprint_id": None, "blueprint_name": None,
            "current_stage": str(getattr(record, FIELDS[resource], None) or ""),
            "field_name": FIELDS[resource], "transition_details": [],
            "blueprint_states": [], "transitions": [],
        }
    audit_rows = db.scalars(
        select(AuditEvent).where(
            AuditEvent.organization_id == organization_id,
            AuditEvent.resource == resource,
            AuditEvent.record_id == item_id,
        ).order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc()).limit(150)
    ).all()
    readable = serialize(record, db, actor)
    allowed_status = {"New", "Contacted", "Qualified", "Unqualified", "Converted"}
    allowed_stages = set(STAGE_PROBABILITY)
    entries: list[dict[str, Any]] = []
    for row in audit_rows:
        title = row.summary or "Record updated"
        before = row.before if isinstance(row.before, dict) else {}
        after = row.after if isinstance(row.after, dict) else {}
        for field, allowed in (("status", allowed_status), ("stage", allowed_stages)):
            if readable.get(field) not in allowed or (resource == "leads" and field != "status") or (resource == "deals" and field != "stage"):
                continue
            previous, updated = before.get(field), after.get(field)
            if previous != updated and previous in allowed and updated in allowed:
                title = f"{field.title()} changed from {previous} to {updated}"
                break
        audit_actor = db.get(User, row.actor_id) if row.actor_id else None
        entries.append({
            "id": f"audit-{row.id}", "kind": "audit",
            "action": row.action, "title": title, "detail": "",
            "occurred_at": row.occurred_at.isoformat(),
            "actor_name": audit_actor.name if audit_actor else "System",
        })

    activity_rows = db.scalars(
        select(Activity).where(
            Activity.organization_id == organization_id,
            Activity.related_type == resource,
            Activity.related_id == item_id,
            Activity.archived == False,
        ).order_by(Activity.created_at.desc()).limit(150)
    ).all()
    for activity in activity_rows:
        if not can_access_record(db, "activities", activity, actor):
            continue
        visible_activity = serialize(activity, db, actor)
        entries.append({
            "id": f"activity-{activity.id}", "kind": "activity",
            "action": "activity",
            "title": visible_activity.get("subject") or "Activity recorded",
            "detail": str(visible_activity.get("activity_type") or "Activity").title()
                      + " · " + str(visible_activity.get("status") or "Open"),
            "occurred_at": activity.created_at.isoformat(),
            "actor_name": visible_activity.get("owner_name") or "System",
        })

    note_rows = db.scalars(
        select(Note).where(
            Note.organization_id == organization_id,
            Note.related_type == resource,
            Note.related_id == item_id,
            Note.archived == False,
        ).order_by(Note.created_at.desc()).limit(100)
    ).all()
    for note in note_rows:
        if not can_access_record(db, "notes", note, actor):
            continue
        visible_note = serialize(note, db, actor)
        entries.append({
            "id": f"note-{note.id}", "kind": "note",
            "action": "note",
            "title": visible_note.get("title") or "Note added",
            "detail": "Note added to this record",
            "occurred_at": note.created_at.isoformat(),
            "actor_name": visible_note.get("owner_name") or "System",
        })
    entries.sort(key=lambda item: item["occurred_at"], reverse=True)
    from app.services.blueprint_engine import matching_blueprint, transition_choices, FIELDS
    bp = matching_blueprint(db, resource, record)
    field_name = bp.field_name if bp else FIELDS[resource]
    current_state = str(getattr(record, field_name) or "")
    choices = transition_choices(bp, current_state) if bp else []
    return {"items": entries[:300], "total": len(entries),
            "blueprint_enabled": bool(bp), "blueprint_id": bp.id if bp else None,
            "blueprint_name": bp.name if bp else None, "current_stage": current_state,
            "field_name": field_name, "transition_details": choices,
            "blueprint_states": [str(s.get("label") or s.get("name") or "") for s in (bp.stages or []) if isinstance(s, dict)] if bp else [],
            "transitions": list(dict.fromkeys(choice["to"] for choice in choices))}



@app.get("/api/{resource}/{item_id}/related")
def related_records(resource: str, item_id: int, db: Session = Depends(get_db), actor: User | None = Depends(current_actor)) -> dict[str, Any]:
    if resource not in RESOURCE_MAP:
        raise HTTPException(404, "Resource not found")
    parent = db.get(RESOURCE_MAP[resource], item_id)
    if parent is None or not can_access_record(db, resource, parent, actor):
        raise HTTPException(404, "Record not found")

    def visible(key: str, rows: list[Any]) -> list[dict[str, Any]]:
        return [
            serialize(row, db, actor)
            for row in rows
            if can_access_record(db, key, row, actor)
        ]

    related: dict[str, list[dict[str, Any]]] = {
        "activities": [], "contacts": [], "accounts": [], "deals": [],
        "leads": [], "products": [], "notes": [], "attachments": [], "emails": [],
    }
    if resource == "accounts":
        related["contacts"] = visible("contacts", db.scalars(select(Contact).where(Contact.account_id == item_id, Contact.archived == False)).all())
        related["deals"] = visible("deals", db.scalars(select(Deal).where(Deal.account_id == item_id, Deal.archived == False)).all())
        related["activities"] = visible("activities", db.scalars(select(Activity).where(Activity.related_type == "accounts", Activity.related_id == item_id, Activity.archived == False).order_by(Activity.created_at.desc())).all())
    elif resource == "contacts":
        contact = db.get(Contact, item_id)
        if contact and contact.account_id:
            account = db.get(Account, contact.account_id)
            if account and can_access_record(db, "accounts", account, actor):
                related["accounts"] = [serialize(account, db, actor)]
        related["deals"] = visible("deals", db.scalars(select(Deal).where(Deal.contact_id == item_id, Deal.archived == False)).all())
        related["activities"] = visible("activities", db.scalars(select(Activity).where(Activity.related_type == "contacts", Activity.related_id == item_id, Activity.archived == False).order_by(Activity.created_at.desc())).all())
    elif resource == "leads":
        lead = db.get(Lead, item_id)
        related["activities"] = visible("activities", db.scalars(select(Activity).where(Activity.related_type == "leads", Activity.related_id == item_id, Activity.archived == False).order_by(Activity.created_at.desc())).all())
        if lead and lead.converted_account_id:
            account = db.get(Account, lead.converted_account_id)
            if account and can_access_record(db, "accounts", account, actor):
                related["accounts"] = [serialize(account, db, actor)]
        if lead and lead.converted_contact_id:
            contact = db.get(Contact, lead.converted_contact_id)
            if contact and can_access_record(db, "contacts", contact, actor):
                related["contacts"] = [serialize(contact, db, actor)]
        if lead and lead.converted_deal_id:
            deal = db.get(Deal, lead.converted_deal_id)
            if deal and can_access_record(db, "deals", deal, actor):
                related["deals"] = [serialize(deal, db, actor)]
    elif resource == "deals":
        deal = db.get(Deal, item_id)
        if deal and deal.account_id:
            account = db.get(Account, deal.account_id)
            if account and can_access_record(db, "accounts", account, actor):
                related["accounts"] = [serialize(account, db, actor)]
        if deal and deal.contact_id:
            contact = db.get(Contact, deal.contact_id)
            if contact and can_access_record(db, "contacts", contact, actor):
                related["contacts"] = [serialize(contact, db, actor)]
        related["activities"] = visible("activities", db.scalars(select(Activity).where(Activity.related_type == "deals", Activity.related_id == item_id, Activity.archived == False).order_by(Activity.created_at.desc())).all())

    for key, model in {"products": Product, "notes": Note, "attachments": Attachment, "emails": Email}.items():
        rows = db.scalars(select(model).where(
            model.related_type == resource,
            model.related_id == item_id,
            model.archived == False,
        ).order_by(model.created_at.desc())).all()
        related[key] = visible(key, rows)
    if resource in {"leads", "accounts", "contacts", "deals"}:
        organization_id = parent.organization_id
        platform_rows = db.scalars(select(PlatformRecord).where(
            PlatformRecord.organization_id == organization_id,
            PlatformRecord.archived == False,
        ).order_by(PlatformRecord.created_at.desc())).all()
        related["custom_records"] = []
        if resource in {"contacts", "accounts", "deals"}:
            related["quotes"] = []
        for record in platform_rows:
            data = record.data or {}
            direct = record.related_type == resource and record.related_id == item_id
            keyed = (
                (resource == "leads" and str(data.get("lead_id") or "") == str(item_id))
                or (resource == "accounts" and record.account_id == item_id)
                or (resource == "contacts" and record.contact_id == item_id)
                or (resource == "deals" and record.deal_id == item_id)
            )
            if (direct or keyed) and can_access_record(db, record.resource, record, actor):
                if record.resource == "quotes" and resource in {"contacts", "accounts", "deals"}:
                    related["quotes"].append(serialize_platform(record, db, actor))
                related["custom_records"].append({
                    "id": record.id, "resource": record.resource,
                    "title": record.title, "status": record.status,
                })
    return related



@app.get("/api/ai/dashboard")
def ai_dashboard(db: Session = Depends(get_db), actor: User = Depends(current_actor)) -> dict[str, Any]:
    """Management cockpit scoped to the signed-in workspace."""
    _enforce_plan_feature(db, actor, "apex")
    for resource, fields in {"leads": ["status"], "activities": ["status"], "quotes": ["status", "amount"], "invoices": ["status", "amount"], "payments": ["status", "amount"]}.items():
        if not all(field_allowed(db, resource, field, actor, "read") for field in fields):
            raise HTTPException(403, "The management dashboard requires read access to its status and amount fields. Use the module assistant for your permitted fields.")
    leads = [r for r in db.scalars(select(Lead).where(Lead.archived == False, Lead.status != "Converted")).all() if can_access_record(db, "leads", r, actor)]
    all_leads = [r for r in db.scalars(select(Lead).where(Lead.archived == False)).all() if can_access_record(db, "leads", r, actor)]
    emails = [r for r in db.scalars(select(Email).where(Email.archived == False)).all() if can_access_record(db, "emails", r, actor)]
    activities = [r for r in db.scalars(select(Activity).where(Activity.archived == False)).all() if can_access_record(db, "activities", r, actor)]
    visits = _ai_dashboard_platform_rows(db, "site_visits", actor)
    quotes = _ai_dashboard_platform_rows(db, "quotes", actor)
    invoices = _ai_dashboard_platform_rows(db, "invoices", actor)
    payments = _ai_dashboard_platform_rows(db, "payments", actor)
    performance = sales_performance(db, actor)
    assigned = sum(1 for row in leads if row.owner_id)
    open_followups = sum(1 for row in activities if row.status != "Completed")
    collected = sum(float(row.amount or 0) for row in payments if str(row.status or "").lower() in {"received", "cleared"})
    invoiced = sum(float(row.amount or 0) for row in invoices if str(row.status or "").lower() != "void")
    journey = [
        {"key": "leads", "label": "Leads received", "count": len(leads), "detail": f"{assigned} assigned"},
        {"key": "conversations", "label": "Conversations & follow-ups", "count": len(emails), "detail": f"{open_followups} open follow-ups"},
        {"key": "site_visits", "label": "Site visits", "count": len(visits), "detail": f"{_ai_count_status(visits, 'Completed')} completed · {_ai_count_status(visits, 'Scheduled')} scheduled"},
        {"key": "quotes", "label": "Quotations", "count": len(quotes), "detail": f"{_ai_count_status(quotes, 'Converted', 'Accepted', 'Won')} converted"},
        {"key": "invoices", "label": "Invoices", "count": len(invoices), "detail": f"₹{invoiced:,.0f} issued"},
        {"key": "payments", "label": "Payments", "count": len(payments), "detail": f"₹{collected:,.0f} collected"},
    ]
    # Deterministic operational breakdowns for the management view.
    # Tenant filters are enforced by the application's scoped DB session.
    def _status_breakdown(rows):
        counts = {}
        for record in rows:
            status = str(record.status or "Unspecified").strip() or "Unspecified"
            counts[status] = counts.get(status, 0) + 1
        return dict(sorted(counts.items(), key=lambda pair: (-pair[1], pair[0])))

    breakdown = {
        "leads": _status_breakdown(all_leads),
        "site_visits": _status_breakdown(visits),
        "quotes": _status_breakdown(quotes),
        "invoices": _status_breakdown(invoices),
        "payments": _status_breakdown(payments),
        "activities": _status_breakdown(activities),
    }
    # Monthly source-record series for genuine historical charts (last six calendar months).
    from collections import defaultdict
    from datetime import timezone
    now = datetime.utcnow()
    months = []
    for back in range(5, -1, -1):
        index = now.year * 12 + now.month - 1 - back
        year, month = divmod(index, 12)
        months.append(f"{year:04d}-{month + 1:02d}")
    series = {}
    for resource, rows in {
        "leads": all_leads, "conversations": emails, "activities": activities,
        "site_visits": visits, "quotes": quotes, "invoices": invoices, "payments": payments,
    }.items():
        monthly = defaultdict(int)
        for record in rows:
            created = getattr(record, "created_at", None)
            if created:
                monthly[created.strftime("%Y-%m")] += 1
        series[resource] = [monthly.get(month, 0) for month in months]
    trend = {"months": months, "series": series}
    context = {
        "journey": journey,
        "performance": performance,
        "stuck_leads": performance["attention"]["stuck_leads"],
        "quotes_needing_follow_up": performance["attention"]["quotes_needing_follow_up"],
    }
    insight = None
    insight_error = None
    insight_error_code = None
    if not ai_config_error():
        try:
            _enforce_ai_limit(db, actor)
            db.add(ApexAssistantRun(organization_id=TENANT_ORGANIZATION_ID.get(), requested_by=actor.id,
                question="Management operational readout", intent="dashboard_insight", scope="management", confidence="medium", result={"state": "requested"}))
            db.commit()
            result, usage = ask_cloud_ai(
                "Give management a concise operational readout: who is performing, who is near target, where leads are stuck, which quotations need follow-up, and who earned incentives. Use only the supplied facts.",
                context,
            )
            insight = {"answer": result.answer, "actions": result.actions, "risks": result.risks, "confidence": result.confidence, "model": AI_MODEL, "usage": usage}
        except Exception as error:
            insight_error_code, insight_error = _public_ai_error(error)
            # Expose only an error category/status, never a provider response body or token.
            import re as _ai_re
            _http_match = _ai_re.search(r"Cloud AI returned HTTP ([0-9]{3})", str(error))
            if _http_match:
                insight_error_code += "_HTTP_" + _http_match.group(1)
    else:
        insight_error_code = "AI_NOT_CONFIGURED"
        insight_error = ai_config_error()
    return {
        "journey": journey,
        "breakdown": breakdown,
        "trend": trend,
        "performance": performance,
        "totals": {"invoiced": invoiced, "collected": collected, "leads": len(leads), "assigned_leads": assigned, "conversations": len(emails), "open_followups": open_followups},
        "insight": insight,
        "insight_error": insight_error,
        "insight_error_code": insight_error_code,
        "provider": AI_PROVIDER,
        "model": AI_MODEL,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


REPORT_SOURCE_BLOCKLIST = {"reports", "dashboards", "workflow_rules", "approval_processes", "users"}
REPORT_OPERATORS = {"equals", "not_equals", "contains", "starts_with", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"}



