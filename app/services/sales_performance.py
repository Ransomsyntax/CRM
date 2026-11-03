"""Sales performance calculations, separate from the HTTP application entrypoint."""
from __future__ import annotations
from datetime import date, datetime, timedelta
from typing import Any
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.models import Lead, PlatformRecord, User, OrganizationMember
from app.database import TENANT_ORGANIZATION_ID

def sales_performance(db: Session, actor: User | None = None, _date_value=None, access=None, redact=None) -> dict[str, Any]:
    today = date.today()
    # Managers see team members of the active tenant; ordinary users see only themselves.
    # Never aggregate all User rows: User is global and must be constrained by membership.
    org_id = TENANT_ORGANIZATION_ID.get()
    is_manager = bool(
        isinstance(actor, User)
        and org_id
        and (
            str(actor.role or "").lower() in {"administrator", "admin", "owner"}
            or db.scalar(select(OrganizationMember.id).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == actor.id,
                OrganizationMember.status == "Active",
                OrganizationMember.membership_role.in_(["Owner", "Admin", "Administrator"]),
            )) is not None
        )
    )
    if is_manager:
        users = db.scalars(
            select(User).join(OrganizationMember, OrganizationMember.user_id == User.id)
            .where(OrganizationMember.organization_id == org_id,
                   OrganizationMember.status == "Active",
                   User.status == "Active")
            .order_by(User.name)
        ).all()
    else:
        users = [actor] if isinstance(actor, User) else []
    targets = db.scalars(select(PlatformRecord).where(PlatformRecord.resource == "sales_targets", PlatformRecord.archived == False)).all()
    payments = db.scalars(select(PlatformRecord).where(PlatformRecord.resource == "payments", PlatformRecord.archived == False, PlatformRecord.status.in_(["Received", "Cleared"]))).all()
    if access:
        targets = [row for row in targets if access(db, "sales_targets", row, actor)]
        payments = [row for row in payments if access(db, "payments", row, actor)]
    people: list[dict[str, Any]] = []
    for user in users:
        candidates = []
        for target in targets:
            data = dict(target.data) if isinstance(target.data, dict) else {}
            start, end = _date_value(data.get("period_start")), _date_value(data.get("period_end"))
            if target.owner_id == user.id and start and end and start <= today <= end and target.status == "Active":
                candidates.append((start, end, target))
        candidates.sort(key=lambda item: (item[0], item[2].id), reverse=True)
        target_record = candidates[0][2] if candidates else None
        target_data = dict(target_record.data) if target_record and isinstance(target_record.data, dict) else {}
        if redact:
            target_data = redact(db, "sales_targets", target_data, actor)
        start = _date_value(target_data.get("period_start")) or date(today.year, today.month, 1)
        end = _date_value(target_data.get("period_end")) or today
        achieved = sum(
            float((redact(db, "payments", {"amount": item.amount}, actor).get("amount") if redact else item.amount) or 0)
            for item in payments
            if item.owner_id == user.id
            and start <= (
                _date_value((item.data if isinstance(item.data, dict) else {}).get("payment_date"))
                or item.created_at.date()
            ) <= end
        )
        target_amount = float(target_data.get("target_amount") or 0)
        achievement = round((achieved / target_amount * 100), 1) if target_amount else 0.0
        rate = float(target_data.get("incentive_rate") or 0)
        threshold = float(target_data.get("threshold_percent") or 80)
        incentive = round(achieved * rate / 100, 2) if achievement >= threshold else 0.0
        converted = db.scalars(select(Lead).where(Lead.owner_id == user.id, Lead.status == "Converted", Lead.archived == False, Lead.updated_at >= datetime.combine(start, datetime.min.time()), Lead.updated_at <= datetime.combine(end, datetime.max.time()))).all()
        conversions = sum(1 for row in converted if not access or access(db, "leads", row, actor))
        people.append({"owner_id": user.id, "name": user.name, "role": user.role, "target": target_amount, "achieved": achieved, "achievement_percent": achievement, "conversions": int(conversions), "incentive": incentive, "period_start": start.isoformat(), "period_end": end.isoformat(), "target_configured": target_record is not None})

    stuck_query = select(Lead).where(
        Lead.archived == False,
        Lead.status.not_in(["Converted", "Unqualified"]),
        or_(Lead.next_follow_up < today, Lead.updated_at < datetime.utcnow() - timedelta(days=7)),
    )
    quote_query = select(PlatformRecord).where(
        PlatformRecord.resource == "quotes",
        PlatformRecord.archived == False,
        PlatformRecord.status.in_(["Draft", "Pending Approval", "Approved", "Sent"]),
    )
    if isinstance(actor, User) and not is_manager:
        stuck_query = stuck_query.where(Lead.owner_id == actor.id)
        quote_query = quote_query.where(PlatformRecord.owner_id == actor.id)
    stuck_leads = db.scalars(stuck_query.order_by(Lead.next_follow_up.asc()).limit(8)).all()
    open_quotes = db.scalars(quote_query).all()
    if access:
        stuck_leads = [row for row in stuck_leads if access(db, "leads", row, actor)]
        open_quotes = [row for row in open_quotes if access(db, "quotes", row, actor)]
    quote_attention = []
    for quote in open_quotes:
        valid_until = _date_value((quote.data if isinstance(quote.data, dict) else {}).get("valid_until"))
        if valid_until is None or valid_until <= today + timedelta(days=7):
            quote_attention.append({"id": quote.id, "name": quote.title, "status": quote.status, "valid_until": valid_until.isoformat() if valid_until else None, "owner_id": quote.owner_id})
    attention = {
        "stuck_leads": [{"id": lead.id, "name": lead.name, "status": lead.status, "next_follow_up": lead.next_follow_up.isoformat() if lead.next_follow_up else None, "owner_id": lead.owner_id} for lead in stuck_leads],
        "quotes_needing_follow_up": quote_attention[:8],
    }
    if redact:
        attention["stuck_leads"] = [redact(db, "leads", item, actor) for item in attention["stuck_leads"]]
        attention["quotes_needing_follow_up"] = [redact(db, "quotes", item, actor) for item in attention["quotes_needing_follow_up"]]
    return {"people": people, "attention": attention, "totals": {"target": sum(item["target"] for item in people), "achieved": sum(item["achieved"] for item in people), "incentive": sum(item["incentive"] for item in people)}}

