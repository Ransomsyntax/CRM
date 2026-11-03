"""Owner Console routes, registered after the application services initialize."""
from app.main import *  # noqa: F403 - shared application facade
from app.main import _admin_user_payload, _ensure_user_subscription, _notify_account, _session_token_hash, _subscription_payload, _user_in_actor_organization


@app.get("/owner", response_class=HTMLResponse)
def owner_console(_: User = Depends(require_owner_actor)) -> FileResponse:
    return FileResponse(ROOT / "templates" / "owner.html", media_type="text/html")


def _login_method(row: LoginHistory | None) -> str:
    if row is None:
        return "—"
    metadata = row.metadata_json or {}
    return str(metadata.get("method") or row.event or "password").replace("_", " ").title()


def _device_summary(user_agent: str | None) -> str:
    ua = str(user_agent or "").lower()
    if not ua:
        return "Unknown device"
    browser = "Edge" if "edg/" in ua else "Chrome" if "chrome/" in ua else "Firefox" if "firefox/" in ua else "Safari" if "safari/" in ua else "Browser"
    os_name = "Windows" if "windows" in ua else "Android" if "android" in ua else "iOS" if "iphone" in ua or "ipad" in ua else "macOS" if "mac os" in ua else "Linux" if "linux" in ua else "Unknown OS"
    return f"{browser} / {os_name}"


@app.get("/api/owner/overview")
def owner_overview(db: Session = Depends(get_db), _: User = Depends(require_owner_actor)) -> dict[str, Any]:
    now = datetime.utcnow()
    today = datetime(now.year, now.month, now.day)
    total_users = int(db.scalar(select(func.count()).select_from(User)) or 0)
    active_users = int(db.scalar(select(func.count()).select_from(User).where(User.status == "Active")) or 0)
    signed_up_today = int(db.scalar(select(func.count()).select_from(User).where(User.created_at >= today)) or 0)
    logins_today = int(db.scalar(select(func.count()).select_from(LoginHistory).where(LoginHistory.event == "login", LoginHistory.success == True, LoginHistory.occurred_at >= today)) or 0)
    active_sessions = int(db.scalar(select(func.count()).select_from(AuthSession).where(AuthSession.revoked_at.is_(None), AuthSession.expires_at > now)) or 0)

    plan_rows = db.execute(
        select(Plan.name, func.count(OrganizationSubscription.id))
        .outerjoin(OrganizationSubscription, OrganizationSubscription.plan_id == Plan.id)
        .group_by(Plan.id, Plan.name)
        .order_by(Plan.id)
    ).all()
    plans = [{"name": name, "count": int(count or 0)} for name, count in plan_rows]
    recent = db.execute(
        select(LoginHistory, User)
        .outerjoin(User, User.id == LoginHistory.user_id)
        .order_by(LoginHistory.occurred_at.desc())
        .limit(8)
    ).all()
    integrations = {
        "smtp": bool(os.getenv("SMTP_HOST", "").strip() and os.getenv("SMTP_FROM", "").strip()),
        "sms": bool(os.getenv("TWILIO_ACCOUNT_SID", "").strip() and os.getenv("TWILIO_AUTH_TOKEN", "").strip() and os.getenv("TWILIO_FROM_NUMBER", "").strip()),
        "ai": ai_config_error() is None,
        "public_url": bool(os.getenv("APP_PUBLIC_URL", "").strip()),
    }
    return {
        "total_users": total_users,
        "active_users": active_users,
        "signed_up_today": signed_up_today,
        "logins_today": logins_today,
        "active_sessions": active_sessions,
        "integrations": integrations,
        "plans": plans,
        "recent_logins": [{
            "id": event.id,
            "user_id": user.id if user else None,
            "name": user.name if user else "Unknown account",
            "email": user.email if user else None,
            "success": bool(event.success),
            "method": _login_method(event),
            "device": _device_summary(event.user_agent),
            "ip_address": event.ip_address,
            "occurred_at": event.occurred_at.isoformat(),
        } for event, user in recent],
    }


@app.get("/api/owner/users")
def owner_users(
    search: str | None = None,
    status: str | None = None,
    plan: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_owner_actor),
) -> dict[str, Any]:
    query = select(User).order_by(User.created_at.desc())
    if status:
        query = query.where(User.status == status)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.where(or_(User.name.ilike(pattern), User.email.ilike(pattern), User.username.ilike(pattern), User.phone.ilike(pattern)))
    users = db.scalars(query.offset(offset).limit(limit)).all()
    items = []
    for user in users:
        subscription = _subscription_payload(db, user.id)
        if plan and str(subscription.get("plan_code") or "").lower() != plan.lower():
            continue
        last_login = db.scalar(select(LoginHistory).where(LoginHistory.user_id == user.id, LoginHistory.event == "login", LoginHistory.success == True).order_by(LoginHistory.occurred_at.desc()).limit(1))
        items.append({
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "status": user.status,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "last_active": user.last_active.isoformat() if user.last_active else None,
            "login_method": _login_method(last_login),
            "last_device": _device_summary(last_login.user_agent if last_login else None),
            "subscription": subscription,
        })
    return {"items": items, "total": len(items), "limit": limit, "offset": offset}


@app.get("/api/owner/users/{user_id}")
def owner_user_detail(user_id: int, db: Session = Depends(get_db), actor: User = Depends(require_owner_actor)) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    logins = db.scalars(select(LoginHistory).where(LoginHistory.user_id == user.id).order_by(LoginHistory.occurred_at.desc()).limit(50)).all()
    sessions = db.scalars(select(AuthSession).where(AuthSession.user_id == user.id).order_by(AuthSession.created_at.desc()).limit(50)).all()
    custom_modules = int(db.scalar(select(func.count()).select_from(MetadataModule).where(MetadataModule.owner_id == user.id)) or 0)
    return {
        "user": _admin_user_payload(user, db),
        "can_export_crm_records": _user_in_actor_organization(db, actor, user.id),
        "custom_modules": custom_modules,
        "login_history": [{
            "id": row.id,
            "event": row.event,
            "success": bool(row.success),
            "method": _login_method(row),
            "ip_address": row.ip_address,
            "device": _device_summary(row.user_agent),
            "occurred_at": row.occurred_at.isoformat(),
        } for row in logins],
        "sessions": [{
            "id": row.id,
            "created_at": row.created_at.isoformat(),
            "last_seen_at": row.last_seen_at.isoformat(),
            "expires_at": row.expires_at.isoformat(),
            "revoked_at": row.revoked_at.isoformat() if row.revoked_at else None,
            "ip_address": row.ip_address,
            "device": _device_summary(row.user_agent),
            "active": row.revoked_at is None and row.expires_at > datetime.utcnow(),
        } for row in sessions],
    }


@app.get("/api/owner/login-history")
def owner_login_history(
    success: bool | None = None,
    user_id: int | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_owner_actor),
) -> dict[str, Any]:
    query = select(LoginHistory, User).outerjoin(User, User.id == LoginHistory.user_id)
    if success is not None:
        query = query.where(LoginHistory.success == success)
    if user_id:
        query = query.where(LoginHistory.user_id == user_id)
    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    rows = db.execute(query.order_by(LoginHistory.occurred_at.desc()).offset(offset).limit(limit)).all()
    return {"items": [{
        "id": event.id,
        "user_id": user.id if user else None,
        "name": user.name if user else "Unknown account",
        "email": user.email if user else None,
        "event": event.event,
        "success": bool(event.success),
        "method": _login_method(event),
        "ip_address": event.ip_address,
        "device": _device_summary(event.user_agent),
        "occurred_at": event.occurred_at.isoformat(),
    } for event, user in rows], "total": total, "limit": limit, "offset": offset}


@app.get("/api/owner/plan-requests")
def owner_plan_requests(status: str = "", db: Session = Depends(get_db),
                        actor: User = Depends(require_owner_actor)) -> dict[str, Any]:
    query = select(SubscriptionChangeRequest).order_by(SubscriptionChangeRequest.created_at.desc())
    if status in {"Pending Approval", "Approved", "Rejected", "Completed"}:
        query = query.where(SubscriptionChangeRequest.status == status)
    requests = db.scalars(query.limit(500)).all()
    items = []
    for request in requests:
        user = db.get(User, request.requested_by)
        from_plan = db.get(Plan, request.from_plan_id) if request.from_plan_id else None
        to_plan = db.get(Plan, request.to_plan_id)
        items.append({"id": request.id, "organization_id": request.organization_id,
                      "user_name": user.name if user else "Unknown",
                      "user_email": user.email if user else "",
                      "from_plan": from_plan.name if from_plan else "Unknown",
                      "to_plan": to_plan.name if to_plan else "Unknown",
                      "price_monthly": float(to_plan.price_monthly or 0) if to_plan else 0,
                      "status": request.status,
                      "created_at": request.created_at.isoformat() if request.created_at else None,
                      "completed_at": request.completed_at.isoformat() if request.completed_at else None})
    return {"items": items, "pending_count": sum(1 for item in items if item["status"] == "Pending Approval")}


@app.post("/api/owner/plan-requests/{request_id}/decision")
def owner_plan_request_decision(request_id: int, payload: dict[str, Any],
                                db: Session = Depends(get_db),
                                actor: User = Depends(require_owner_actor)) -> dict[str, Any]:
    decision = str(payload.get("decision") or "").strip().lower()
    if decision not in {"approve", "reject"}:
        raise HTTPException(422, "Decision must be approve or reject")
    request = db.scalar(select(SubscriptionChangeRequest).where(
        SubscriptionChangeRequest.id == request_id,
        SubscriptionChangeRequest.status == "Pending Approval",
    ).with_for_update())
    if request is None:
        raise HTTPException(409, "Request is not pending or has already been processed")
    subscription = db.scalar(select(OrganizationSubscription).where(
        OrganizationSubscription.organization_id == request.organization_id).with_for_update())
    plan = db.get(Plan, request.to_plan_id)
    if subscription is None or plan is None or not plan.active:
        raise HTTPException(409, "Subscription or requested plan is unavailable")
    if subscription.plan_id != request.from_plan_id:
        raise HTTPException(409, "The organization's plan changed since this request was submitted")
    now = datetime.utcnow()
    request.status = "Approved" if decision == "approve" else "Rejected"
    request.completed_at = now
    if decision == "approve":
        subscription.plan_id = plan.id
        subscription.status = "Active"
        subscription.current_period_start = now
        subscription.current_period_end = None
        subscription.cancel_at_period_end = False
        subscription.updated_at = now
    add_audit(db, "subscription_request_" + request.status.lower(), "organization_subscriptions",
              subscription.id, f"Owner {decision}d plan request #{request.id}",
              before={"plan_id": request.from_plan_id},
              after={"plan_id": subscription.plan_id, "request_id": request.id, "decision": decision},
              actor_id=actor.id)
    db.commit()
    return {"ok": True, "request_id": request.id, "status": request.status,
            "plan_name": plan.name, "activated": decision == "approve"}


@app.get("/api/owner/plans")
def owner_plans(db: Session = Depends(get_db), _: User = Depends(require_owner_actor)) -> dict[str, Any]:
    plans = db.scalars(select(Plan).where(Plan.active == True).order_by(Plan.price_monthly, Plan.id)).all()
    return {"items": [{
        "id": plan.id,
        "code": plan.code,
        "name": plan.name,
        "price_monthly": float(plan.price_monthly or 0),
        "currency": plan.currency,
        "max_records": plan.max_records,
        "max_storage_mb": plan.max_storage_mb,
        "max_custom_modules": plan.max_custom_modules,
        "ai_limit_monthly": plan.ai_limit_monthly,
        "active": bool(plan.active),
        "features": plan.features or {},
    } for plan in plans]}


@app.patch("/api/owner/users/{user_id}/subscription")
def owner_update_subscription(user_id: int, payload: dict[str, Any], db: Session = Depends(get_db), actor: User = Depends(require_owner_actor)) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    plan_code = str(payload.get("plan_code") or "").strip().lower()
    plan = db.scalar(select(Plan).where(func.lower(Plan.code) == plan_code, Plan.active == True))
    if plan is None:
        raise HTTPException(422, "Unknown or inactive plan")
    subscription = _ensure_user_subscription(db, user)
    before = _subscription_payload(db, user.id)
    if "purchased_seats" in payload:
        seats = payload["purchased_seats"]
        if isinstance(seats, bool) or not isinstance(seats, int) or seats < 1:
            raise HTTPException(422, "Purchased seats must be a positive integer")
        subscription.purchased_seats = seats
    subscription.plan_id = plan.id
    subscription.status = str(payload.get("status") or subscription.status or "Active")
    subscription.current_period_start = subscription.current_period_start or datetime.utcnow()
    subscription.current_period_end = payload.get("current_period_end") or subscription.current_period_end
    after = {
        "plan_code": plan.code,
        "purchased_seats": subscription.purchased_seats,
        "plan_name": plan.name,
        "status": subscription.status,
    }
    add_audit(db, "subscription_updated", "subscriptions", subscription.id, f"Updated subscription for '{user.email}'", before=before, after=after, actor_id=actor.id)
    db.commit()
    return _subscription_payload(db, user.id)


@app.patch("/api/owner/users/{user_id}/status")
def owner_update_user_status(user_id: int, payload: dict[str, Any], db: Session = Depends(get_db), actor: User = Depends(require_owner_actor)) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    status = str(payload.get("status") or "").strip().title()
    if status not in {"Active", "Inactive"}:
        raise HTTPException(422, "Status must be Active or Inactive")
    if user.id == actor.id and status == "Inactive":
        raise HTTPException(409, "You cannot deactivate the signed-in owner account")
    before = user.status
    user.status = status
    if status == "Inactive":
        db.execute(
            AuthSession.__table__.update().where(
                AuthSession.user_id == user.id,
                AuthSession.revoked_at.is_(None),
            ).values(revoked_at=datetime.utcnow())
        )
    add_audit(db, "owner_status_update", "users", user.id, f"Changed account status for '{user.email}'", before={"status": before}, after={"status": status}, actor_id=actor.id)
    db.commit()
    return _admin_user_payload(user, db)


@app.post("/api/owner/users/{user_id}/sessions/revoke")
def owner_revoke_user_sessions(user_id: int, db: Session = Depends(get_db), actor: User = Depends(require_owner_actor)) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    now = datetime.utcnow()
    active = db.scalars(select(AuthSession).where(
        AuthSession.user_id == user.id,
        AuthSession.revoked_at.is_(None),
        AuthSession.expires_at > now,
    )).all()
    for session in active:
        session.revoked_at = now
    add_audit(db, "sessions_revoked", "users", user.id, f"Revoked {len(active)} active session(s) for '{user.email}'", actor_id=actor.id)
    db.commit()
    return {"ok": True, "revoked": len(active)}


@app.post("/api/owner/users/{user_id}/password-reset")
def owner_send_password_reset(user_id: int, db: Session = Depends(get_db), actor: User = Depends(require_owner_actor)) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    if user.status != "Active":
        raise HTTPException(409, "Password reset can only be sent to an active account")
    raw = secrets.token_urlsafe(40)
    now = datetime.utcnow()
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=_session_token_hash(raw),
        created_at=now,
        expires_at=now + timedelta(minutes=30),
    ))
    db.commit()
    base = os.getenv("APP_PUBLIC_URL", "").strip().rstrip("/")
    reset_url = f"{base}/reset-password?token={raw}" if base else f"/reset-password?token={raw}"
    _notify_account(
        db, user, "password_reset_requested", "CONVOSIS CRM password reset",
        f"An Administrator requested a password reset for your CONVOSIS CRM account. Use this link within 30 minutes: {reset_url}"
    )
    external_delivery_configured = bool(
        (os.getenv("SMTP_HOST", "").strip() and os.getenv("SMTP_FROM", "").strip())
        or (user.phone and os.getenv("TWILIO_ACCOUNT_SID", "").strip() and os.getenv("TWILIO_AUTH_TOKEN", "").strip() and os.getenv("TWILIO_FROM_NUMBER", "").strip())
    )
    add_audit(db, "password_reset_requested", "users", user.id, f"Requested password reset for '{user.email}'", after={"notification_created": True, "external_delivery_configured": external_delivery_configured}, actor_id=actor.id)
    db.commit()
    return {"ok": True, "message": "Password reset instructions were created for the account."}


@app.get("/api/owner/users/{user_id}/export")
def owner_export_user(user_id: int, db: Session = Depends(get_db), actor: User = Depends(require_owner_actor)) -> StreamingResponse:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    if not _user_in_actor_organization(db, actor, user.id):
        raise HTTPException(403, "Tenant CRM records are private; export from the owning organization.")
    records: dict[str, Any] = {}
    for resource, model in RESOURCE_MAP.items():
        if resource == "users" or not hasattr(model, "owner_id"):
            continue
        rows = db.scalars(select(model).where(model.owner_id == user.id)).all()
        records[resource] = [serialize(row, db, actor) for row in rows if can_access_record(db, resource, row, actor)]
    platform_rows = db.scalars(select(PlatformRecord).where(PlatformRecord.owner_id == user.id)).all()
    records["platform_records"] = [serialize_platform(row, db, actor) for row in platform_rows if can_access_record(db, row.resource, row, actor)]
    export = {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "user": _admin_user_payload(user, db),
        "records": records,
    }
    payload = json.dumps(export, ensure_ascii=False, default=str, indent=2).encode("utf-8")
    filename = f"yash-crm-user-{user.id}-export.json"
    return StreamingResponse(iter([payload]), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


