from __future__ import annotations

import base64
import binascii
import hashlib
import os
import re
import secrets
import smtplib
import threading
import time
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import Any
from urllib.request import Request as URLRequest, urlopen

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.access_policy import ENTITLEMENT_RESOURCE_FEATURES, request_entitlement_feature, request_resource_action
from app.entitlements import plan_capabilities, SETUP_FEATURES
from app.database import SessionLocal, TENANT_ACTOR_ID, TENANT_ORGANIZATION_ID, get_db
from app.models import *
from app.platform_catalog import PLATFORM_RESOURCES
from app.services.core import *

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"
MIN_PASSWORD_LENGTH = 8

def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)).strip())
    except ValueError:
        return default

def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, "1" if default else "0").strip().lower() in {"1", "true", "yes", "on"}

def _is_platform_owner(actor: User | None) -> bool:
    if not isinstance(actor, User) or str(actor.role or "").lower() != "administrator":
        return False
    configured_username = os.getenv("APP_USERNAME", "").strip().lower()
    actor_username = str(actor.username or "").strip().lower()
    return bool(configured_username and secrets.compare_digest(actor_username, configured_username))

def _app_credentials() -> tuple[str, str]:
    # Hosting secret stores often add a trailing newline when a value is pasted; that
    # silently made a correct password fail with 401.
    return os.getenv("APP_USERNAME", "").strip(), os.getenv("APP_PASSWORD", "").strip("\r\n")


def _basic_auth_valid(header: str) -> bool:
    scheme, _, token = header.strip().partition(" ")
    token = token.strip()
    if scheme.lower() != "basic" or not token:  # the scheme name is case-insensitive (RFC 7235)
        return False
    token += "=" * (-len(token) % 4)  # tolerate clients that omit base64 padding
    try:
        decoded = base64.b64decode(token).decode("utf-8")
        supplied_user, supplied_password = decoded.split(":", 1)
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return False
    expected_user, expected_password = _app_credentials()
    user_ok = secrets.compare_digest(supplied_user.encode(), expected_user.encode())
    password_ok = secrets.compare_digest(supplied_password.encode(), expected_password.encode())
    return user_ok and password_ok


def _basic_username(header: str) -> str:
    scheme, _, token = header.strip().partition(" ")
    if scheme.lower() != "basic" or not token:
        return ""
    try:
        token += "=" * (-len(token) % 4)
        decoded = base64.b64decode(token).decode("utf-8")
        return decoded.split(":", 1)[0].strip()
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return ""


AUTH_COOKIE = "yash_session"
AUTH_SESSION_DAYS = max(1, min(_env_int("YASHCRM_SESSION_DAYS", 14), 90))
PASSWORD_ITERATIONS = 260_000


def _password_hash(password: str) -> str:
    password = str(password or "")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must contain at least {MIN_PASSWORD_LENGTH} characters")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def _password_valid(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        algorithm, iterations, salt_b64, digest_b64 = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_b64.encode())
        expected = base64.urlsafe_b64decode(digest_b64.encode())
        actual = hashlib.pbkdf2_hmac("sha256", str(password or "").encode("utf-8"), salt, int(iterations))
        return secrets.compare_digest(actual, expected)
    except (ValueError, TypeError, binascii.Error):
        return False


def _session_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _session_user(request: Request, db: Session) -> User | None:
    token = request.cookies.get(AUTH_COOKIE, "")
    if not token:
        return None
    now = datetime.utcnow()
    session = db.scalar(select(AuthSession).where(
        AuthSession.token_hash == _session_token_hash(token),
        AuthSession.revoked_at.is_(None),
        AuthSession.expires_at > now,
    ))
    if session is None:
        return None
    user = db.get(User, session.user_id)
    if user is None or user.status != "Active":
        return None
    if session.last_seen_at < now - timedelta(minutes=5):
        session.last_seen_at = now
        user.last_active = now
        db.commit()
    return user


def _create_session(request: Request, db: Session, user: User, auth_method: str = "password") -> str:
    raw = secrets.token_urlsafe(48)
    now = datetime.utcnow()
    db.add(AuthSession(
        user_id=user.id,
        token_hash=_session_token_hash(raw),
        created_at=now,
        expires_at=now + timedelta(days=AUTH_SESSION_DAYS),
        last_seen_at=now,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
    ))
    user.last_login_at = now
    user.last_active = now
    db.add(LoginHistory(
        user_id=user.id,
        event="login",
        success=True,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500],
        metadata_json={"path": request.url.path, "method": str(auth_method or "password")[:40]},
    ))
    db.commit()
    return raw


def _revoke_session(request: Request, db: Session) -> None:
    token = request.cookies.get(AUTH_COOKIE, "")
    if not token:
        return
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == _session_token_hash(token), AuthSession.revoked_at.is_(None)))
    if session is not None:
        session.revoked_at = datetime.utcnow()
        db.commit()


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        AUTH_COOKIE,
        token,
        max_age=AUTH_SESSION_DAYS * 86400,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(AUTH_COOKIE, path="/", secure=IS_PRODUCTION, httponly=True, samesite="lax")


def _normalize_phone(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    prefix = "+" if raw.startswith("+") else ""
    digits = re.sub(r"\D", "", raw)
    if not 8 <= len(digits) <= 15:
        raise HTTPException(422, "Enter a valid phone number with 8 to 15 digits")
    return prefix + digits


def _clean_username(value: Any) -> str:
    username = re.sub(r"[^a-z0-9._-]+", "", str(value or "").strip().lower())
    if not 3 <= len(username) <= 40:
        raise HTTPException(422, "Username must contain 3 to 40 letters, numbers, dots, dashes, or underscores")
    return username


def _account_by_identifier(db: Session, identifier: str) -> User | None:
    value = str(identifier or "").strip()
    if not value:
        return None
    lowered = value.lower()
    normalized_phone = re.sub(r"\D", "", value)
    clauses = [func.lower(User.email) == lowered, func.lower(User.username) == lowered]
    if normalized_phone:
        clauses.append(func.replace(func.replace(func.replace(User.phone, "+", ""), " ", ""), "-", "") == normalized_phone)
    return db.scalar(select(User).where(or_(*clauses)))


def _environment_admin_credentials_valid(identifier: str, password: str) -> bool:
    configured_username = os.getenv("APP_USERNAME", "").strip()
    configured_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    configured_password = os.getenv("APP_PASSWORD", "").strip("\r\n")
    if not configured_password or len(configured_password) < MIN_PASSWORD_LENGTH:
        return False
    supplied_identifier = str(identifier or "").strip().lower()
    username_ok = bool(configured_username) and secrets.compare_digest(
        supplied_identifier.encode(), configured_username.lower().encode()
    )
    email_ok = bool(configured_email) and secrets.compare_digest(
        supplied_identifier.encode(), configured_email.encode()
    )
    password_ok = secrets.compare_digest(
        str(password or "").encode(), configured_password.encode()
    )
    return (username_ok or email_ok) and password_ok


def _send_email_message(to_email: str, subject: str, body: str) -> bool:
    host = os.getenv("SMTP_HOST", "").strip()
    sender = os.getenv("SMTP_FROM", "").strip()
    if not host or not sender or not to_email:
        return False
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    use_tls = env_bool("SMTP_STARTTLS", True)
    message = EmailMessage()
    message["From"] = sender
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)
    try:
        with smtplib.SMTP(host, port, timeout=12) as client:
            if use_tls:
                client.starttls()
            if username:
                client.login(username, password)
            client.send_message(message)
        return True
    except Exception:
        return False


def _send_sms_message(phone: str, body: str) -> bool:
    sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    sender = os.getenv("TWILIO_FROM_NUMBER", "").strip()
    if not sid or not token or not sender or not phone:
        return False
    payload = urlencode({"From": sender, "To": phone, "Body": body}).encode()
    req = URLRequest(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", data=payload, method="POST")
    req.add_header("Authorization", "Basic " + base64.b64encode(f"{sid}:{token}".encode()).decode())
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urlopen(req, timeout=12) as response:
            return 200 <= int(response.status) < 300
    except Exception:
        return False


def _dispatch_account_message(user: User, subject: str, body: str) -> None:
    email = str(user.email or "")
    phone = str(user.phone or "")
    threading.Thread(target=lambda: _send_email_message(email, subject, body), daemon=True).start()
    if phone:
        threading.Thread(target=lambda: _send_sms_message(phone, body[:1400]), daemon=True).start()


def _notify_account(db: Session, user: User, kind: str, title: str, body: str) -> None:
    db.add(Notification(user_id=user.id, kind=kind, title=title[:220], body=body, resource="account", record_id=user.id))
    db.commit()
    _dispatch_account_message(user, title, body)


def _notify_account_once(db: Session, user: User, kind: str, title: str, body: str, *, within_minutes: int = 10) -> None:
    """Avoid flooding email/SMS providers when a user signs in repeatedly in a short window."""
    cutoff = datetime.utcnow() - timedelta(minutes=max(1, within_minutes))
    recent = db.scalar(select(Notification.id).where(
        Notification.user_id == user.id,
        Notification.kind == kind,
        Notification.created_at >= cutoff,
    ).order_by(Notification.created_at.desc()).limit(1))
    if recent is None:
        _notify_account(db, user, kind, title, body)


def _ensure_plan_catalog(db: Session) -> None:
    """Keep the subscription catalog aligned with the CRM pricing presented in-product."""
    catalog = [
        {
            "code": "free", "name": "Free", "price_monthly": 0, "currency": "INR",
            "max_records": 1000, "max_storage_mb": 250, "max_custom_modules": 2, "ai_limit_monthly": 0,
            "features": {
                "reports": True, "custom_modules": True, "apex": False, "max_users": 3, "inventory_management": False, "cpq": False, "customer_portals": False, "approval_process": False, "developer_sandbox": False,
                "tagline": "Forever free, for 3 users",
                "included_features": [
                    "Contact management", "Follow-up reminders", "Workflow automation",
                    "Custom email templates", "Tasks, meetings & calls", "Data import and export",
                    "Standard reports", "APIs", "Mobile apps"
                ]
            }
        },
        {
            "code": "bigin_express", "name": "Bigin Express", "price_monthly": 400, "currency": "INR",
            "max_records": 5000, "max_storage_mb": 1024, "max_custom_modules": 0, "ai_limit_monthly": 0,
            "features": {
                "reports": True, "custom_modules": False, "apex": False, "max_users": 5, "inventory_management": False, "cpq": False, "customer_portals": False, "approval_process": False, "developer_sandbox": False,
                "tagline": "First-timer, moving from spreadsheets",
                "included_features": [
                    "Sales pipeline", "Built-in calling", "Appointment scheduling", "Payment collection",
                    "Tags", "Email integration", "Calendar integration", "Social Ads integration",
                    "Custom fields", "QuickBooks integration"
                ]
            }
        },
        {
            "code": "standard", "name": "Standard", "price_monthly": 800, "currency": "INR",
            "max_records": 10000, "max_storage_mb": 2048, "max_custom_modules": 10, "ai_limit_monthly": 1500,
            "features": {
                "reports": True, "custom_modules": True, "apex": True, "max_users": 25, "inventory_management": False, "cpq": False, "customer_portals": False, "approval_process": False, "developer_sandbox": False,
                "tagline": "Small team, getting started",
                "included_features": [
                    "Email integration & mass emails", "Built-in calling", "Multiple sales pipelines",
                    "Calendar integration", "Data capture via forms", "Sales forecasting", "Data enrichment",
                    "Custom modules", "HIPAA compliance", "Gmail and Outlook integration",
                    "Slack, Zoom, Teams integration"
                ]
            }
        },
        {
            "code": "professional", "name": "Professional", "price_monthly": 1400, "currency": "INR",
            "max_records": 100000, "max_storage_mb": 10240, "max_custom_modules": 50, "ai_limit_monthly": 10000,
            "features": {
                "reports": True, "custom_modules": True, "apex": True, "advanced_analytics": True, "max_users": 100,
                "inventory_management": True, "cpq": True, "customer_portals": True, "approval_process": False, "developer_sandbox": False,
                "tagline": "Growing team, needs automation", "popular": True,
                "included_features": [
                    "AI agents", "Process management", "Inventory management", "Predictive intelligence",
                    "Unlimited reports", "Configure, Price, Quote (CPQ)", "Custom portals",
                    "Customer journeys", "Web-to-case forms", "Google Ads integration"
                ]
            }
        },
        {
            "code": "enterprise", "name": "Enterprise", "price_monthly": 2400, "currency": "INR",
            "max_records": None, "max_storage_mb": None, "max_custom_modules": None, "ai_limit_monthly": None,
            "features": {
                "reports": True, "custom_modules": True, "apex": True, "advanced_analytics": True, "max_users": None,
                "priority_support": True, "inventory_management": True, "cpq": True, "customer_portals": True, "approval_process": True, "developer_sandbox": True,
                "tagline": "Running a mature sales org",
                "included_features": [
                    "Multi-team management", "Reporting hierarchy", "Custom buttons and functions",
                    "Extended field types", "Sequential data collection", "Approval process",
                    "Account Based Marketing", "Developer sandbox", "Field-level encryption",
                    "Extended AI capabilities", "QuickBooks integration"
                ]
            }
        },
    ]

    for spec in catalog:
        plan = db.scalar(select(Plan).where(Plan.code == spec["code"]))
        if plan is None:
            plan = Plan(code=spec["code"])
            db.add(plan)
        plan.name = spec["name"]
        plan.price_monthly = spec["price_monthly"]
        plan.currency = spec["currency"]
        plan.max_records = spec["max_records"]
        plan.max_storage_mb = spec["max_storage_mb"]
        plan.max_custom_modules = spec["max_custom_modules"]
        plan.ai_limit_monthly = spec["ai_limit_monthly"]
        plan.active = True
        plan.features = {**spec["features"], **plan_capabilities(spec["code"]),
            "max_users": 3 if spec["code"] == "free" else None,
            "hipaa_compliance_verified": False,
            "sales_forecasting": spec["code"] in {"standard", "professional", "enterprise"},
            "process_management": spec["code"] in {"professional", "enterprise"},
            "custom_functions": spec["code"] == "enterprise",
            "multi_team_management": spec["code"] == "enterprise",
        }
    # Retire CRM Plus without deleting subscriptions or historical billing records.
    legacy_plus = db.scalar(select(Plan).where(Plan.code == "crm_plus"))
    if legacy_plus is not None:
        legacy_plus.active = False
        enterprise = db.scalar(select(Plan).where(Plan.code == "enterprise"))
        if enterprise is not None:
            # Preserve existing customers' paid access and all billing history.
            for model in (OrganizationSubscription, Subscription):
                for subscription in db.scalars(select(model).where(model.plan_id == legacy_plus.id)).all():
                    subscription.plan_id = enterprise.id
    db.flush()


def _default_plan(db: Session) -> Plan:
    plan = db.scalar(select(Plan).where(Plan.code == "free"))
    if plan is None:
        plan = Plan(
            code="free",
            name="Free",
            price_monthly=0,
            currency="INR",
            max_records=1000,
            max_storage_mb=250,
            max_custom_modules=2,
            ai_limit_monthly=0,
            active=True,
            features={"reports": True, "custom_modules": True, "apex": False},
        )
        db.add(plan)
        db.flush()
    return plan


def _organization_slug_for_user(user: User) -> str:
    base = re.sub(r"[^a-z0-9-]+", "-", str(user.username or user.name or f"user-{user.id}").lower()).strip("-")
    return (base or f"user-{user.id}")[:90] + f"-{user.id}"


def _organization_for_user(db: Session, user_id: int) -> Organization | None:
    membership = db.scalar(
        select(OrganizationMember)
        .where(OrganizationMember.user_id == user_id, OrganizationMember.status == "Active")
        .order_by(OrganizationMember.id)
    )
    return db.get(Organization, membership.organization_id) if membership else None

def _organization_id_for_user(db: Session, user_id: int) -> int | None:
    membership = db.scalar(
        select(OrganizationMember)
        .where(OrganizationMember.user_id == user_id, OrganizationMember.status == "Active")
        .order_by(OrganizationMember.id)
    )
    return membership.organization_id if membership else None


def _organization_user_ids(db: Session, actor: User) -> set[int]:
    """Return active CRM users in the actor's organization.

    User accounts are global authentication identities, so membership—not the users
    table itself—is the tenant boundary for user administration.
    """
    organization_id = _organization_id_for_user(db, actor.id)
    if organization_id is None:
        return {actor.id}
    return {
        int(user_id)
        for user_id in db.scalars(
            select(OrganizationMember.user_id).where(
                OrganizationMember.organization_id == organization_id,
                OrganizationMember.status == "Active",
            )
        ).all()
    }


def _user_in_actor_organization(db: Session, actor: User, user_id: int) -> bool:
    return int(user_id) in _organization_user_ids(db, actor)



def _ensure_user_organization(db: Session, user: User) -> Organization:
    organization = _organization_for_user(db, user.id)
    if organization is not None:
        return organization

    organization = Organization(
        name=(user.name or user.username or "CONVOSIS CRM")[:160],
        slug=_organization_slug_for_user(user),
        status="Active",
        owner_user_id=user.id,
    )
    db.add(organization)
    db.flush()
    db.add(OrganizationMember(
        organization_id=organization.id,
        user_id=user.id,
        membership_role="Owner" if _is_platform_owner(user) else "Admin",
        status="Active",
    ))
    db.flush()

    actor_token = TENANT_ACTOR_ID.set(user.id)
    organization_token = TENANT_ORGANIZATION_ID.set(organization.id)
    try:
        ensure_workspace_defaults(db)
        ensure_platform_defaults(db, include_demo=False)
    finally:
        TENANT_ORGANIZATION_ID.reset(organization_token)
        TENANT_ACTOR_ID.reset(actor_token)
    return organization


def _ensure_organization_subscription(db: Session, user: User) -> OrganizationSubscription:
    organization = _ensure_user_organization(db, user)
    subscription = db.scalar(
        select(OrganizationSubscription).where(OrganizationSubscription.organization_id == organization.id)
    )
    if subscription is not None:
        return subscription

    legacy = db.scalar(select(Subscription).where(Subscription.user_id == user.id))
    plan = db.get(Plan, legacy.plan_id) if legacy else None
    plan = plan if plan is not None and plan.active else _default_plan(db)
    now = datetime.utcnow()
    subscription = OrganizationSubscription(
        organization_id=organization.id,
        plan_id=plan.id,
        status=(legacy.status if legacy else "Active"),
        started_at=(legacy.started_at if legacy else now),
        trial_ends_at=(legacy.trial_ends_at if legacy else None),
        current_period_start=(legacy.current_period_start if legacy else now),
        current_period_end=(legacy.current_period_end if legacy else None),
        cancel_at_period_end=(legacy.cancel_at_period_end if legacy else False),
        provider=(legacy.provider if legacy else None),
        provider_customer_id=(legacy.provider_customer_id if legacy else None),
        provider_subscription_id=(legacy.provider_subscription_id if legacy else None),
    )
    db.add(subscription)
    db.flush()
    return subscription


def _ensure_user_subscription(db: Session, user: User) -> OrganizationSubscription:
    """Compatibility wrapper: subscriptions are organization-owned from Tier 0 onward."""
    return _ensure_organization_subscription(db, user)


def _subscription_payload(db: Session, user_id: int) -> dict[str, Any]:
    user = db.get(User, user_id)
    if user is None:
        return {"plan_code": "free", "plan_name": "Free", "status": "Unknown"}
    subscription = _ensure_organization_subscription(db, user)
    organization = db.get(Organization, subscription.organization_id)
    plan = db.get(Plan, subscription.plan_id)
    pending = db.scalar(
        select(SubscriptionChangeRequest).where(
            SubscriptionChangeRequest.organization_id == subscription.organization_id,
            SubscriptionChangeRequest.status.in_(["Pending Approval", "Pending Payment"]),
        ).order_by(SubscriptionChangeRequest.id.desc())
    )
    pending_plan = db.get(Plan, pending.to_plan_id) if pending else None
    owner_access = _is_platform_owner(user)
    active = bool(plan and plan.active and str(subscription.status or "").lower() in {"active", "trialing", "trial"})
    period_end = subscription.trial_ends_at if str(subscription.status or "").lower() in {"trial", "trialing"} else (subscription.current_period_end if subscription.cancel_at_period_end else None)
    if period_end and period_end <= datetime.utcnow():
        active = False
    return {
        "owner_unrestricted": owner_access,
        "access_active": owner_access or active,
        "features": dict(plan.features or {}) if active and plan else {},
        "resource_features": ENTITLEMENT_RESOURCE_FEATURES,
        "limits": {**{key: None if owner_access else getattr(plan, key, 0) for key in ("max_records", "max_storage_mb", "max_custom_modules", "ai_limit_monthly")}, "max_users": None if owner_access else (3 if plan and plan.code == "free" else subscription.purchased_seats)},
        "purchased_seats": subscription.purchased_seats,
        "id": subscription.id,
        "organization_id": subscription.organization_id,
        "organization_public_id": organization.public_id if organization else None,
        "organization_name": organization.name if organization else None,
        "status": subscription.status,
        "plan_id": subscription.plan_id,
        "plan_code": plan.code if plan else None,
        "plan_name": plan.name if plan else "Unknown",
        "price_monthly": float(plan.price_monthly or 0) if plan else 0,
        "currency": plan.currency if plan else "INR",
        "started_at": subscription.started_at.isoformat() if subscription.started_at else None,
        "trial_ends_at": subscription.trial_ends_at.isoformat() if subscription.trial_ends_at else None,
        "current_period_start": subscription.current_period_start.isoformat() if subscription.current_period_start else None,
        "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
        "cancel_at_period_end": bool(subscription.cancel_at_period_end),
        "provider": subscription.provider,
        "pending_upgrade": ({
            "request_id": pending.id,
            "plan_id": pending_plan.id if pending_plan else pending.to_plan_id,
            "plan_code": pending_plan.code if pending_plan else None,
            "plan_name": pending_plan.name if pending_plan else "Pending plan",
            "status": pending.status,
            "requested_at": pending.created_at.isoformat() if pending.created_at else None,
        } if pending else None),
    }


def _active_plan(db: Session, actor: User) -> Plan | None:
    # Only the deployment-provisioned platform owner bypasses customer plan limits.
    if _is_platform_owner(actor):
        return None
    subscription = _ensure_organization_subscription(db, actor)
    if str(subscription.status or "").lower() not in {"active", "trialing", "trial"}:
        raise HTTPException(403, detail={"code": "SUBSCRIPTION_INACTIVE", "message": "Your organization subscription is not active."})
    period_end = subscription.trial_ends_at if str(subscription.status or "").lower() in {"trial", "trialing"} else (subscription.current_period_end if subscription.cancel_at_period_end else None)
    if period_end and period_end <= datetime.utcnow():
        raise HTTPException(403, detail={"code": "SUBSCRIPTION_EXPIRED", "message": "Your subscription period has expired. Choose a plan to continue."})
    plan = db.get(Plan, subscription.plan_id)
    if plan is None or not plan.active:
        raise HTTPException(403, detail={"code": "PLAN_UNAVAILABLE", "message": "Your organization subscription plan is unavailable."})
    return plan


def _enforce_plan_feature(db: Session, actor: User, feature: str) -> None:
    plan = _active_plan(db, actor)
    if plan is None:
        return
    if not bool(_json_mapping(plan.features).get(feature, False)):
        raise HTTPException(403, detail={"code": "PLAN_UPGRADE_REQUIRED", "message": f"Your {plan.name} plan does not include this feature."})
    profile = str(actor.profile_name or actor.role or "").casefold()
    rows = db.scalars(select(PlatformRecord).where(
        PlatformRecord.resource == "module_permission_matrix",
        PlatformRecord.organization_id == _organization_id_for_user(db, actor.id),
        PlatformRecord.archived == False,
    )).all()
    entry = next((r.data or {} for r in rows if str((r.data or {}).get("profile") or r.title).casefold() == profile), {})
    if (entry.get("features") or {}).get(feature) is False:
        raise HTTPException(403, detail={"code": "PROFILE_PERMISSION_DENIED", "feature": feature,
                                        "message": "Your profile does not allow this capability."})


def _organization_id_required(db: Session, actor: User) -> int:
    organization_id = _organization_id_for_user(db, actor.id)
    if not organization_id:
        organization = _ensure_user_organization(db, actor)
        organization_id = organization.id
    return int(organization_id)


def _billable_platform_resources() -> set[str]:
    """Return platform resources that represent CRM business data, not setup metadata."""
    billable_groups = {"Sales & Inventory", "Customer & Marketing", "Collaboration", "Analytics"}
    return {
        resource
        for resource, config in PLATFORM_RESOURCES.items()
        if str(config.get("group") or "").strip() in billable_groups
    }


def _organization_record_count(db: Session, actor: User) -> int:
    organization_id = _organization_id_required(db, actor)
    total = 0
    for model in (Lead, Contact, Account, Deal, Activity, Product, Note, Email):
        total += int(
            db.scalar(
                select(func.count()).select_from(model).where(model.organization_id == organization_id)
            ) or 0
        )
    billable_resources = _billable_platform_resources() | set(db.scalars(
        select(MetadataModule.api_name).where(MetadataModule.organization_id == organization_id)
    ).all())
    if billable_resources:
        total += int(
            db.scalar(
                select(func.count()).select_from(PlatformRecord).where(
                    PlatformRecord.organization_id == organization_id,
                    PlatformRecord.resource.in_(billable_resources),
                    PlatformRecord.archived == False,
                )
            ) or 0
        )
    return total


def _enforce_record_limit(db: Session, actor: User) -> None:
    plan = _active_plan(db, actor)
    if plan is None or plan.max_records is None:
        return
    organization_id = _organization_id_required(db, actor)
    db.execute(select(Organization.id).where(Organization.id == organization_id).with_for_update()).scalar_one()
    if _organization_record_count(db, actor) >= int(plan.max_records):
        raise HTTPException(403, detail={
            "code": "PLAN_RECORD_LIMIT",
            "message": f"Your organization has reached the {plan.name} plan record limit.",
        })


def _enforce_custom_module_limit(db: Session, actor: User) -> None:
    _enforce_plan_feature(db, actor, "custom_modules")
    plan = _active_plan(db, actor)
    if plan is None or plan.max_custom_modules is None:
        return
    organization_id = _organization_id_required(db, actor)
    db.execute(select(Organization.id).where(Organization.id == organization_id).with_for_update()).scalar_one()
    current = int(
        db.scalar(
            select(func.count()).select_from(MetadataModule).where(
                MetadataModule.organization_id == organization_id
            )
        ) or 0
    )
    if current >= int(plan.max_custom_modules):
        raise HTTPException(403, detail={
            "code": "PLAN_CUSTOM_MODULE_LIMIT",
            "message": f"Your organization has reached the {plan.name} custom-module limit.",
        })


def _enforce_storage_limit(db: Session, actor: User, incoming_bytes: int) -> None:
    plan = _active_plan(db, actor)
    if plan is None or plan.max_storage_mb is None:
        return
    organization_id = _organization_id_required(db, actor)
    db.execute(select(Organization.id).where(Organization.id == organization_id).with_for_update()).scalar_one()
    rows = db.scalars(
        select(PlatformRecord).where(
            PlatformRecord.resource == "documents",
            PlatformRecord.organization_id == organization_id,
            PlatformRecord.archived == False,
        )
    ).all()
    used = sum(int(_json_mapping(row.data).get("file_size") or 0) for row in rows)
    maximum = int(plan.max_storage_mb) * 1024 * 1024
    if used + max(0, int(incoming_bytes)) > maximum:
        raise HTTPException(403, detail={
            "code": "PLAN_STORAGE_LIMIT",
            "message": f"Your organization has reached the {plan.name} storage limit.",
        })


def _enforce_ai_limit(db: Session, actor: User) -> None:
    _enforce_plan_feature(db, actor, "apex")
    plan = _active_plan(db, actor)
    if plan is None or plan.ai_limit_monthly is None:
        return
    organization_id = _organization_id_required(db, actor)
    db.execute(select(Organization.id).where(Organization.id == organization_id).with_for_update()).scalar_one()
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    used = int(
        db.scalar(
            select(func.count()).select_from(ApexAssistantRun).where(
                ApexAssistantRun.organization_id == organization_id,
                ApexAssistantRun.created_at >= month_start,
            )
        ) or 0
    )
    if used >= int(plan.ai_limit_monthly):
        raise HTTPException(403, detail={
            "code": "PLAN_AI_LIMIT",
            "message": f"Your organization has reached the {plan.name} monthly AI limit.",
        })


def _claim_legacy_custom_modules(db: Session, actor: User) -> None:
    unowned = db.scalars(select(MetadataModule).where(MetadataModule.owner_id.is_(None))).all()
    changed = False
    for module in unowned:
        owned_record = db.scalar(select(PlatformRecord.id).where(
            PlatformRecord.resource == module.api_name,
            PlatformRecord.owner_id == actor.id,
        ).limit(1))
        if owned_record:
            module.owner_id = actor.id
            changed = True
    if changed:
        db.commit()


def record_login_event(request: Request, username: str, event: str, success: bool) -> None:
    """Persist authentication events without exposing credential material."""
    try:
        with SessionLocal() as db:
            user = db.scalar(select(User).where(func.lower(User.email) == username.lower())) if username else None
            if user is None and username:
                user = db.scalar(select(User).where(func.lower(User.name) == username.lower()))
            if user is not None and success and event == "login":
                user.last_login_at = datetime.utcnow()
                user.last_active = datetime.utcnow()
            db.add(LoginHistory(user_id=user.id if user else None, event=event, success=success, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent", "")[:500], metadata_json={"path": request.url.path}))
            db.commit()
    except Exception:
        # Authentication must not fail because audit persistence is temporarily unavailable.
        return


def current_actor(request: Request, db: Session = Depends(get_db)) -> User | None:
    """Resolve the named CRM user authenticated by a database session.

    HTTP Basic remains an emergency compatibility path for existing automated tests and
    deployment recovery, but normal browser access uses the HttpOnly session cookie.
    """
    if not env_bool("ENABLE_AUTH", IS_PRODUCTION):
        raw_id = request.headers.get("X-Yash-Actor-Id")
        if raw_id and raw_id.isdigit():
            actor = db.get(User, int(raw_id))
            if actor and actor.status == "Active":
                return actor
        return db.scalar(select(User).where(User.status == "Active", func.lower(User.role) == "administrator").order_by(User.id)) or db.scalar(select(User).where(User.status == "Active").order_by(User.id))
    actor_id = getattr(request.state, "actor_id", None)
    if actor_id:
        actor = db.get(User, int(actor_id))
        if actor and actor.status == "Active":
            return actor
    actor = _session_user(request, db)
    if actor is not None:
        return actor
    username = _basic_username(request.headers.get("Authorization", "")) if not IS_PRODUCTION else ""
    if username:
        actor = db.scalar(select(User).where(func.lower(User.email) == username.lower(), User.status == "Active"))
        if actor is None:
            actor = db.scalar(select(User).where(func.lower(User.name) == username.lower(), User.status == "Active"))
        if actor is None and username.lower() in {"admin", "administrator"}:
            actor = db.scalar(select(User).where(func.lower(User.role) == "administrator", User.status == "Active").order_by(User.id))
        if actor is not None:
            return actor
    raise HTTPException(401, "Sign in to continue")


def _role_record(db: Session, role: str | None, organization_id: int | None = None) -> PlatformRecord | None:
    if not role:
        return None
    normalized = str(role).strip().casefold()
    rows = db.scalars(select(PlatformRecord).where(
        PlatformRecord.resource == "roles", PlatformRecord.archived == False,
        PlatformRecord.organization_id == organization_id
    )).all()
    return next((row for row in rows if str(_json_mapping(row.data).get("name") or row.title).strip().casefold() == normalized), None)


def _role_names_visible_to_actor(db: Session, actor: User) -> set[str]:
    org = _organization_id_for_user(db, actor.id)
    own = str(actor.role or "").strip().casefold()
    plan = _active_plan(db, actor)
    if plan is not None and not (plan.features or {}).get("reporting_hierarchy"):
        return {own}
    role = _role_record(db, actor.role, org)
    if role is None:
        return {own}
    rows = db.scalars(select(PlatformRecord).where(
        PlatformRecord.resource == "roles", PlatformRecord.archived == False,
        PlatformRecord.organization_id == org
    )).all()
    hierarchy = {str(_json_mapping(r.data).get("name") or r.title).strip().casefold(): _json_mapping(r.data) for r in rows}
    settings = db.scalar(select(PlatformRecord).where(
        PlatformRecord.resource == "role_hierarchy_settings",
        PlatformRecord.organization_id == org, PlatformRecord.archived == False
    ))
    mode = str(_json_mapping(settings.data).get("mode") if settings else "role")
    if mode == "reporting_manager":
        return {own}
    visible = {own}
    changed = True
    while changed:
        changed = False
        for name, data in hierarchy.items():
            parent = str(data.get("parent_role") or "").strip().casefold()
            if parent and parent in visible and name not in visible:
                visible.add(name)
                changed = True
    return visible


def _sharing_allows(db: Session, resource: str, actor: User, record_owner_id: int | None, access: str = "read") -> bool:
    if record_owner_id == actor.id:
        return True
    if not record_owner_id:
        return False
    owner = db.get(User, record_owner_id)
    org = _organization_id_for_user(db, actor.id)
    if not owner or _organization_id_for_user(db, owner.id) != org:
        return False
    requested = "delete" if str(access).lower() == "delete" else "write" if str(access).lower() in {"write", "update"} else "read"
    plan = _active_plan(db, actor)
    hierarchy_enabled = plan is None or bool((plan.features or {}).get("reporting_hierarchy"))
    settings = db.scalar(select(PlatformRecord).where(
        PlatformRecord.resource == "role_hierarchy_settings", PlatformRecord.organization_id == org,
        PlatformRecord.archived == False
    ))
    mode = str(_json_mapping(settings.data).get("mode") if settings else "role")
    if mode == "reporting_manager" and hierarchy_enabled:
        visited = {owner.id}
        manager_id = owner.manager_id
        while manager_id and manager_id not in visited:
            if manager_id == actor.id:
                return requested == "read"
            visited.add(manager_id)
            superior = db.get(User, manager_id)
            if not superior or _organization_id_for_user(db, superior.id) != org:
                break
            manager_id = superior.manager_id
    else:
        actor_role = str(actor.role or "").strip().casefold()
        owner_role = str(owner.role or "").strip().casefold()
        visible = _role_names_visible_to_actor(db, actor)
        if owner_role != actor_role and owner_role in visible:
            return requested == "read"
        role = _role_record(db, actor.role, org)
        if role and owner_role == actor_role and _json_mapping(role.data).get("share_data_with_peers"):
            return requested == "read"

    defaults = db.scalars(select(PlatformRecord).where(
        PlatformRecord.resource == "module_sharing_defaults",
        PlatformRecord.organization_id == org, PlatformRecord.archived == False
    )).all()
    level = next((str((r.data or {}).get("access")) for r in defaults
                  if (r.data or {}).get("module") == resource), "Private")
    if level == "Public Read/Write/Delete":
        return True
    if level == "Public Read/Write" and requested in {"read", "write"}:
        return True
    if level == "Public Read Only" and requested == "read":
        return True
    group_ids = db.scalars(select(SecurityGroupMember.group_id).where(SecurityGroupMember.user_id == actor.id)).all()
    groups = {str(row.name).casefold() for row in db.scalars(select(SecurityGroup).where(
        SecurityGroup.id.in_(group_ids), SecurityGroup.organization_id == org, SecurityGroup.active == True)).all()} if group_ids else set()
    rules = db.scalars(select(PlatformRecord).where(
        PlatformRecord.resource == "role_sharing_rules", PlatformRecord.organization_id == org,
        PlatformRecord.archived == False
    )).all()
    for rule in rules:
        data = rule.data or {}
        if data.get("module") != resource or str(data.get("source_role") or "").casefold() != str(owner.role or "").casefold():
            continue
        target = str(data.get("target") or "").casefold()
        if data.get("target_type") == "group":
            destination_matches = target in groups
        else:
            destination_matches = target == str(actor.role or "").casefold()
            if data.get("superiors_allowed"):
                destination_matches = destination_matches or target in _role_names_visible_to_actor(db, actor)
        if not destination_matches: continue
        if requested == "delete" or (requested == "write" and data.get("grant") != "Read/Write"):
            continue
        # Criteria-based rules require record field inspection in can_access_record.
        if data.get("kind") == "owner":
            return True
    policies = db.scalars(select(SharingPolicy).where(
        SharingPolicy.enabled == True, SharingPolicy.organization_id == org,
        or_(SharingPolicy.module == resource, SharingPolicy.module == "*"),
    )).all()
    for policy in policies:
        policy_access = str(policy.access or "Read Only").lower().replace("_", " ")
        allows_write = policy_access in {"read/write", "read write", "write", "read and write"}
        allows_read = allows_write or policy_access in {"read", "read only"}
        if requested == "delete" or (requested == "write" and not allows_write) or (requested == "read" and not allows_read):
            continue
        scope = str(policy.scope or "").lower().replace("_", " ")
        if scope in {"public", "public read only", "public read/write", "public read write"}:
            return True
    return False

# Customer CRM data is private to the record owner, including from administrators.
PRIVATE_USER_RESOURCES = frozenset({
    "leads", "contacts", "accounts", "deals", "activities",
    "notes", "attachments", "emails",
    "quotes", "sales_orders", "purchase_orders",
    "invoices", "payments",
})


def _record_share_allows(db: Session, resource: str, record: Any, actor: User, access: str) -> bool:
    """Per-record grants are tenant scoped and never imply profile capabilities."""
    org = _organization_id_for_user(db, actor.id)
    record_id = getattr(record, "id", None)
    if record_id is None:
        return False
    grants = db.scalars(select(PlatformRecord).where(
        PlatformRecord.resource == "record_shares", PlatformRecord.organization_id == org,
        PlatformRecord.archived == False
    )).all()
    group_ids = db.scalars(select(SecurityGroupMember.group_id).where(SecurityGroupMember.user_id == actor.id)).all()
    group_names = {str(row.name).casefold() for row in db.scalars(select(SecurityGroup).where(SecurityGroup.id.in_(group_ids), SecurityGroup.organization_id == org, SecurityGroup.active == True)).all()} if group_ids else set()
    for row in grants:
        grant = row.data or {}
        if grant.get("module") != resource or grant.get("record_id") != record_id:
            continue
        kind, target = grant.get("target_type"), str(grant.get("target") or "").casefold()
        applies = (
            (kind == "user" and target == str(actor.id)) or
            (kind == "role" and target == str(actor.role or "").casefold()) or
            (kind == "group" and target in group_names)
        )
        if applies and access != "delete" and (access in {"read", "view"} or grant.get("grant") == "Read/Write"):
            return True
    return False


def _criteria_share_allows(db: Session, resource: str, record: Any, actor: User, access: str) -> bool:
    if access == "delete":
        return False
    org = _organization_id_for_user(db, actor.id)
    owner_id = getattr(record, "owner_id", None)
    if owner_id is None:
        return False
    owner = db.get(User, owner_id)
    if owner is None or _organization_id_for_user(db, owner.id) != org:
        return False
    group_ids = db.scalars(select(SecurityGroupMember.group_id).where(SecurityGroupMember.user_id == actor.id)).all()
    groups = {g.name.casefold() for g in db.scalars(select(SecurityGroup).where(
        SecurityGroup.id.in_(group_ids), SecurityGroup.organization_id == org, SecurityGroup.active == True
    )).all()} if group_ids else set()
    rules = db.scalars(select(PlatformRecord).where(
        PlatformRecord.resource == "role_sharing_rules", PlatformRecord.organization_id == org,
        PlatformRecord.archived == False,
    )).all()
    for row in rules:
        rule = _json_mapping(row.data)
        if rule.get("kind") != "criteria" or rule.get("module") != resource:
            continue
        if str(rule.get("source_role") or "").casefold() != str(owner.role or "").casefold():
            continue
        target = str(rule.get("target") or "").casefold()
        applies = (target in groups) if rule.get("target_type") == "group" else (
            target == str(actor.role or "").casefold() or
            bool(rule.get("superiors_allowed") and target in _role_names_visible_to_actor(db, actor))
        )
        if not applies or (access in {"write", "update"} and rule.get("grant") != "Read/Write"):
            continue
        criteria = _json_mapping(rule.get("criteria"))
        field = criteria.get("field")
        if field not in {"status", "stage"} or criteria.get("operator") != "equals":
            continue
        value = _json_mapping(record.data).get(field) if isinstance(record, PlatformRecord) else getattr(record, field, None)
        if value == criteria.get("value"):
            return True
    return False


def can_access_record(db: Session, resource: str, record: Any, actor: User | None, access: str = "read") -> bool:
    # Platform administration and plan bypass never grant access to tenant records.
    if isinstance(actor, User):
        try:
            _active_plan(db, actor)
            feature = request_entitlement_feature("/api/platform/" + resource)
            if feature:
                _enforce_plan_feature(db, actor, feature)
        except HTTPException:
            return False
    if resource in PRIVATE_USER_RESOURCES:
        if not isinstance(actor, User):
            return False
        record_org = getattr(record, "organization_id", None)
        actor_org = _organization_id_for_user(db, actor.id)
        if record_org is not None and record_org != actor_org:
            return False
        if record_org is None and getattr(record, "owner_id", None) != actor.id:
            return False
        action = "delete" if access == "delete" else "update" if access in {"write", "update"} else "read"
        if not _profile_action_allowed(db, actor, resource, action):
            return False
        return _sharing_allows(db, resource, actor, getattr(record, "owner_id", None), access) or _record_share_allows(db, resource, record, actor, access) or _criteria_share_allows(db, resource, record, actor, access)
    if not isinstance(actor, User):
        return True
    actor_org = _organization_id_for_user(db, actor.id)
    if isinstance(record, User):
        return _user_in_actor_organization(db, actor, record.id)
    if hasattr(record, "organization_id"):
        record_org = getattr(record, "organization_id", None)
        if record_org is None:
            # Unmigrated legacy records remain accessible only to their original owner.
            return getattr(record, "owner_id", None) == actor.id
        if actor_org != record_org:
            return False
    if _is_platform_owner(actor):
        return True
    if not hasattr(record, "owner_id"):
        return True
    if not _profile_action_allowed(db, actor, resource, "delete" if access == "delete" else "update" if access in {"update", "write"} else "read"):
        return False
    return _sharing_allows(db, resource, actor, getattr(record, "owner_id", None), access) or _record_share_allows(db, resource, record, actor, access) or _criteria_share_allows(db, resource, record, actor, access)


def _metadata_fields(db: Session, resource: str) -> list[MetadataField]:
    names = {resource.lower(), resource.rstrip("s").lower(), resource.replace("_", "").lower()}
    modules = db.scalars(select(MetadataModule)).all()
    module_ids = [
        item.id for item in modules
        if str(item.api_name or "").lower() in names
        or str(item.label or "").lower().replace(" ", "_") in names
    ]
    if not module_ids:
        return []
    return db.scalars(select(MetadataField).where(MetadataField.module_id.in_(module_ids))).all()


def _json_mapping(value: Any) -> dict[str, Any]:
    """Normalize persisted JSON configuration to a mapping.

    Historical imports/customizations may contain null, lists, strings, or other
    scalar JSON. Security evaluation must fail closed/open by explicit policy,
    never with an unhandled AttributeError that returns HTTP 500 for every API.
    """
    return dict(value) if isinstance(value, dict) else {}


def field_allowed(db: Session, resource: str, field_name: str, actor: User | None, action: str = "read") -> bool:
    if not isinstance(actor, User):
        return True
    if _is_platform_owner(actor):
        return True

    # Field security is primarily Profile-based (Zoho-style). Role remains a
    # compatibility fallback for existing field-security definitions.
    principals = []
    if actor.profile_name:
        principals.append(str(actor.profile_name).lower().replace("representative", "rep"))
    if actor.role:
        principals.append(str(actor.role).lower().replace("representative", "rep"))

    def matching_value(mapping: Any) -> Any:
        normalized = {
            str(key).lower().replace("representative", "rep"): value
            for key, value in _json_mapping(mapping).items()
        }
        for principal in principals:
            if principal in normalized:
                return normalized[principal]
        return normalized.get("*")

    for field in _metadata_fields(db, resource):
        api_name = str(field.api_name or "").strip().lower()
        if not api_name or api_name != str(field_name or "").lower():
            continue
        visibility = _json_mapping(field.visibility)
        permissions = _json_mapping(field.permissions)
        selected_visibility = matching_value(visibility)
        if action == "read" and str(selected_visibility or "").lower() == "hidden":
            return False
        grants = matching_value(permissions)
        if isinstance(grants, dict):
            requested = "write" if action in {"write", "create", "update"} else action
            if grants.get(requested) is False:
                return False
        if action in {"write", "create", "update"} and field.read_only:
            return False
    return True


def authorize_field_values(db: Session, resource: str, values: dict[str, Any], actor: User | None, action: str = "write") -> None:
    if not isinstance(actor, User):
        return
    for key in values:
        if not field_allowed(db, resource, key, actor, action):
            raise HTTPException(403, detail={"code": "FIELD_PERMISSION_DENIED", "message": f"You do not have {action} access to field '{key}'."})


def redact_record_fields(db: Session, resource: str, data: dict[str, Any], actor: User | None) -> dict[str, Any]:
    if not isinstance(actor, User):
        return data
    return {key: value for key, value in data.items() if field_allowed(db, resource, key, actor, "read")}


def _profile_permission_record(db: Session, actor: User) -> dict[str, Any] | None:
    profile_name = str(actor.profile_name or "").strip()
    if not profile_name:
        return None
    rows = db.scalars(select(PlatformRecord).where(
        PlatformRecord.resource == "profiles",
        PlatformRecord.organization_id == _organization_id_for_user(db, actor.id),
        PlatformRecord.archived == False,
    )).all()
    for row in rows:
        data = _json_mapping(row.data)
        name = str(data.get("name") or row.title or "").strip()
        if name.lower() == profile_name.lower():
            return _json_mapping(data.get("permissions"))
    direct = db.scalar(select(PermissionProfile).where(
        func.lower(PermissionProfile.name) == profile_name.lower(),
        PermissionProfile.organization_id == _organization_id_for_user(db, actor.id)))
    return _json_mapping(direct.grants) if direct else None


MODULE_PERMISSION_ACTIONS = (
    "decrypt",
    "read", "create", "update", "delete", "import", "export",
    "mass_update", "mass_delete", "mass_transfer", "change_owner",
    "share", "convert", "mass_convert", "send_email", "mass_email",
    "manage_views", "record_lock",
)
PERMISSION_DEPENDENCIES = {
    "mass_update": ("update",), "mass_delete": ("delete",),
    "mass_transfer": ("update", "change_owner"), "change_owner": ("update",),
    "mass_convert": ("convert",), "convert": ("read", "update"),
    "mass_email": ("send_email",), "send_email": ("read",),
    "share": ("read",), "record_lock": ("update",),
    "manage_views": ("read",), "import": ("create",), "export": ("read",),
}


def _matrix_permission(db: Session, actor: User, resource: str, action: str) -> bool | None:
    org = _organization_id_for_user(db, actor.id)
    role = str(actor.profile_name or actor.role or "").casefold()
    rows = db.scalars(select(PlatformRecord).where(
        PlatformRecord.resource == "module_permission_matrix",
        PlatformRecord.organization_id == org, PlatformRecord.archived == False
    )).all()
    entry = next((r.data or {} for r in rows if str((r.data or {}).get("profile") or "").casefold() == role), None)
    if entry is None:
        return None
    configured = (entry.get("modules") or {}).get(resource)
    if configured is None:
        configured = (entry.get("modules") or {}).get("*")
    if not isinstance(configured, dict):
        return False
    key = "read" if action == "view" else "update" if action == "edit" else action
    if not bool(configured.get(key, False)):
        return False
    for dependency in PERMISSION_DEPENDENCIES.get(key, ()):
        if not bool(configured.get(dependency, False)):
            return False
    return True


def _is_organization_owner(db: Session, actor: User) -> bool:
    """Customer ownership uses owner_user_id; Owner membership is platform-only."""
    organization = db.get(Organization, _organization_id_for_user(db, actor.id))
    if not organization or organization.owner_user_id != actor.id:
        return False
    return db.scalar(select(OrganizationMember.id).where(
        OrganizationMember.organization_id == organization.id,
        OrganizationMember.user_id == actor.id, OrganizationMember.status == "Active",
        OrganizationMember.membership_role.in_(["Owner", "Admin", "Administrator"]))) is not None


def _profile_action_allowed(db: Session, actor: User, resource: str, action: str) -> bool:
    if _is_platform_owner(actor):
        return True
    if resource not in RESOURCE_MAP and resource not in PLATFORM_RESOURCES:
        for module in db.scalars(select(MetadataModule).where(
                MetadataModule.organization_id == _organization_id_for_user(db, actor.id)).order_by(MetadataModule.id)).all():
            if resource in {module.api_name, (module.config or {}).get("public_api_name")}:
                resource = module.api_name
                break
    configured = _matrix_permission(db, actor, resource, action)
    if configured is not None:
        return configured
    # A new custom module requires explicit permission assignment.
    custom = db.scalar(select(MetadataModule.id).where(
        MetadataModule.api_name == resource,
        MetadataModule.organization_id == _organization_id_for_user(db, actor.id)
    )) if resource not in PLATFORM_RESOURCES and resource not in {"leads", "contacts", "accounts", "deals", "activities", "products"} else None
    if custom is not None and str(actor.role or "").casefold() != "administrator":
        return False
    matrix = _profile_permission_record(db, actor)
    if matrix is None:
        if str(actor.profile_name or "").casefold() == "read only":
            return action in {"read", "view"}
        if str(actor.profile_name or "").casefold() in {"standard", "team manager"} or (str(actor.role or "").casefold() != "administrator" and not _is_organization_owner(db, actor)):
            if action in {"decrypt", "delete", "import", "export", "mass_update", "mass_delete", "mass_transfer", "change_owner", "mass_email", "record_lock"}:
                return False
        return True
    candidates = [
        matrix.get(resource),
        (matrix.get("modules") or {}).get(resource) if isinstance(matrix.get("modules"), dict) else None,
        matrix.get("*"), matrix.get("default"),
    ]
    rule = next((item for item in candidates if item is not None), None)
    if rule is None:
        return True
    key = "read" if action == "view" else "update" if action == "edit" else action
    if isinstance(rule, bool):
        return rule
    if isinstance(rule, list):
        return key in {str(v).lower() for v in rule}
    if isinstance(rule, dict):
        aliases = {"read": ["read", "view"], "update": ["update", "edit"],
                   "admin": ["admin", "manage"]}
        return any(bool(rule[k]) for k in aliases.get(key, [key]) if k in rule) if any(k in rule for k in aliases.get(key, [key])) else True
    return True



SETUP_CAPABILITIES = (
    "manage_billing",
    "manage_ai", "manage_cpq", "manage_webforms", "manage_integrations",
    "manage_functions", "manage_sandbox", "manage_encryption",
    "manage_users", "manage_roles", "manage_profiles", "manage_groups",
    "manage_modules_fields", "manage_layouts", "manage_automation",
    "manage_workflow_rules", "manage_blueprints", "manage_assignment_rules",
    "manage_approval_rules", "manage_templates", "manage_import_settings",
    "manage_backup", "manage_data_administration", "manage_audit_logs",
    "manage_security_configuration",
)


def _setup_capability_allowed(db: Session, actor: User, capability: str) -> bool:
    if capability not in SETUP_CAPABILITIES:
        return False
    if not _is_platform_owner(actor):
        feature = SETUP_FEATURES.get(capability)
        if feature:
            try:
                _enforce_plan_feature(db, actor, feature)
            except HTTPException:
                return False
    if _is_platform_owner(actor) or _is_organization_owner(db, actor):
        return True
    org = _organization_id_for_user(db, actor.id)
    profile = str(actor.profile_name or actor.role or "").casefold()
    rows = db.scalars(select(PlatformRecord).where(
        PlatformRecord.resource == "module_permission_matrix",
        PlatformRecord.organization_id == org, PlatformRecord.archived == False,
    )).all()
    entry = next((r.data or {} for r in rows
                  if str((r.data or {}).get("profile") or "").casefold() == profile), None)
    if entry is not None:
        return bool((entry.get("setup") or {}).get(capability, False))
    # Preserve existing organization administrator behavior until a matrix is configured.
    return (capability != "manage_billing" and str(actor.role or "").casefold() == "administrator"
            and str(actor.profile_name or "Administrator").casefold() == "administrator")


def _setup_capability_for_request(path: str, method: str) -> str | None:
    p = path.lower().strip("/")
    if p.startswith("api/v1/"):
        p = "api/" + p[len("api/v1/"):]
    if (p.startswith("api/organization/invitations") and not p.endswith("/accept")) or p.startswith("api/organization/members/") or p == "api/users" or p.startswith("api/users/"):
        return "manage_users"
    if p.startswith("api/owner/") or p.startswith("api/organization/"):
        return None
    if p in {"api/subscription", "api/billing/checkout"} and method.upper() != "GET":
        return "manage_billing"
    # Running a published transition or acting on an assigned approval is a
    # record-level operation. Managing approval *definitions* remains setup-gated.
    if p.startswith("api/blueprint-records/") and p.endswith("/transition"):
        return None
    if p == "api/approvals/requests" or p.startswith("api/approvals/requests/"):
        return None
    if p.startswith("api/admin/security/profiles"):
        return "manage_profiles"
    if p.startswith("api/platform/apex_"):
        return "manage_ai"
    if p.startswith("api/platform/marketplace_integrations"):
        return "manage_integrations"
    if p.startswith("api/platform/webforms"):
        return "manage_webforms"
    if p.startswith("api/platform/sandboxes"):
        return "manage_sandbox"
    if p.startswith("api/platform/functions") or p.startswith("api/platform/client_scripts"):
        return "manage_functions"
    if p.startswith("api/admin/security/sharing"):
        return "manage_security_configuration"
    if p.startswith("api/admin/security/territories"):
        return "manage_assignment_rules"
    if p.startswith("api/admin/standard-layout/"):
        parts = p.split("/")
        # Forms consume metadata and their own record values without administering layouts.
        if len(parts) == 4 and method.upper() == "GET":
            return None
        if len(parts) == 6 and parts[4] == "records" and parts[5].isdigit() and method.upper() in {"GET", "PUT"}:
            return None
        return "manage_layouts"
    if p.startswith("api/admin/users"):
        return "manage_users"
    if p.startswith("api/admin/security/role-hierarchy") or p.startswith("api/admin/security/roles"):
        return "manage_roles"
    if p.startswith("api/admin/security/module-permissions") or p.startswith("api/platform/profiles"):
        return "manage_profiles"
    if p.startswith("api/admin/security/groups"):
        return "manage_groups"
    if p.startswith("api/admin/security/data-sharing") or p.startswith("api/admin/security/sharing"):
        return "manage_security_configuration"
    if p.startswith("api/admin/metadata/") and "/layouts" in p:
        return "manage_layouts"
    if p.startswith("api/admin/metadata/") or p.startswith("api/custom-modules"):
        return "manage_modules_fields"
    if "layout" in p and p.startswith("api/"):
        return "manage_layouts"
    if p.startswith("api/platform/approval_processes"):
        return "manage_approval_rules"
    if p.startswith("api/platform/assignment_rules"):
        return "manage_assignment_rules"
    if p.startswith("api/platform/email_templates") or p.startswith("api/platform/inventory_templates"):
        return "manage_templates"
    if p.startswith("api/automation/"):
        return "manage_automation"
    if p.startswith("api/platform/workflow_rules"):
        return "manage_workflow_rules"
    if "blueprint" in p and p.startswith("api/"):
        return "manage_blueprints"
    if "assignment" in p and p.startswith("api/"):
        return "manage_assignment_rules"
    if "approval" in p and p.startswith("api/"):
        return "manage_approval_rules"
    if "template" in p and p.startswith("api/"):
        return "manage_templates"
    if p.startswith("api/import") and method.upper() != "GET":
        return "manage_import_settings"
    if "backup" in p and p.startswith("api/"):
        return "manage_backup"
    if p.startswith("api/admin/privacy") or p.startswith("api/admin/data"):
        return "manage_data_administration"
    if "audit" in p and p.startswith("api/"):
        return "manage_audit_logs"
    if p.startswith("api/admin/security/"):
        return "manage_security_configuration"
    if p.startswith("api/security/overview"):
        return "manage_security_configuration"
    return None


def _enforce_request_access(db: Session, actor: User, path: str, method: str) -> None:
    if _is_platform_owner(actor):
        return
    resource, action = request_resource_action(path, method)
    if resource in RESOURCE_MAP or resource in PLATFORM_RESOURCES or resource in {"dashboard", "search"} or path.startswith("/api/custom/"):
        _active_plan(db, actor)
    feature = request_entitlement_feature(path)
    if feature:
        _enforce_plan_feature(db, actor, feature)
    if action in {"import", "export"}:
        _enforce_plan_feature(db, actor, "import_export")
    if action in {"send_email", "mass_email"}:
        _enforce_plan_feature(db, actor, "mass_email" if action == "mass_email" else "email_integration")
    capability = _setup_capability_for_request(path, method)
    if capability and not _setup_capability_allowed(db, actor, capability):
        raise HTTPException(403, detail={"code": "SETUP_PERMISSION_DENIED", "capability": capability})
    resource, action = request_resource_action(path, method)
    record_resource = resource in RESOURCE_MAP or resource in PLATFORM_RESOURCES or resource == "ai" or path.startswith(("/api/custom/", "/api/v1/custom/"))
    if record_resource and not _profile_action_allowed(db, actor, resource, action):
        raise HTTPException(403, detail={
            "code": "PROFILE_PERMISSION_DENIED",
            "message": f"Your profile does not allow {action} access to {resource.replace('_', ' ')}.",
        })


def _enforce_organization_user_limit(db: Session, actor: User, reserved_invitation_id: int | None = None) -> None:
    plan = _active_plan(db, actor)
    if plan is None:
        return
    subscription = _ensure_organization_subscription(db, actor)
    raw_limit = 3 if plan.code == "free" else subscription.purchased_seats
    organization_id = _organization_id_required(db, actor)
    db.execute(select(Organization.id).where(Organization.id == organization_id).with_for_update()).scalar_one()
    active_members = int(db.scalar(select(func.count()).select_from(OrganizationMember).where(
        OrganizationMember.organization_id == organization_id,
        OrganizationMember.status == "Active",
    )) or 0)
    pending = int(db.scalar(select(func.count()).select_from(OrganizationInvitation).where(
        OrganizationInvitation.organization_id == organization_id,
        OrganizationInvitation.status == "Pending",
        OrganizationInvitation.expires_at > datetime.utcnow(),
    )) or 0)
    reserved = int(bool(reserved_invitation_id and db.scalar(select(OrganizationInvitation.id).where(
        OrganizationInvitation.id == reserved_invitation_id,
        OrganizationInvitation.organization_id == organization_id,
        OrganizationInvitation.status == "Pending",
        OrganizationInvitation.expires_at > datetime.utcnow(),
    ))))
    if active_members + pending - reserved >= int(raw_limit):
        raise HTTPException(403, detail={
            "code": "PLAN_USER_LIMIT",
            "message": f"Your {plan.name} subscription has {int(raw_limit)} seats. Increase seats before adding users.",
        })


def _validate_profile_assignment(db: Session, actor: User, name: str) -> str:
    name = str(name or "Standard").strip()
    organization_id = _organization_id_required(db, actor)
    profile = db.scalar(select(PermissionProfile.id).where(
        PermissionProfile.organization_id == organization_id,
        func.lower(PermissionProfile.name) == name.casefold(),
    ))
    matrix = db.scalar(select(PlatformRecord).where(
        PlatformRecord.organization_id == organization_id,
        PlatformRecord.resource == "module_permission_matrix",
        func.lower(PlatformRecord.title) == name.casefold(),
        PlatformRecord.archived == False,
    ))
    if name not in {"Standard", "Administrator", "Team Manager", "Read Only"} and not profile and not matrix:
        raise HTTPException(422, "Choose an existing organization permission profile")
    if not (_is_platform_owner(actor) or _is_organization_owner(db, actor)):
        target = matrix.data or {} if matrix else {}
        actor_matrix = db.scalar(select(PlatformRecord).where(PlatformRecord.organization_id == organization_id,
            PlatformRecord.resource == "module_permission_matrix", PlatformRecord.archived == False,
            func.lower(PlatformRecord.title) == str(actor.profile_name or actor.role).casefold()))
        actor_features = (actor_matrix.data or {}).get("features", {}) if actor_matrix else {}
        if any(granted is False and target.get("features", {}).get(key, True) for key, granted in actor_features.items()):
            raise HTTPException(403, "You cannot assign a profile with feature privileges you do not hold")
        setup = target.get("setup", {}) if matrix else {key: name == "Administrator" for key in SETUP_CAPABILITIES}
        if any(value and not _setup_capability_allowed(db, actor, key) for key, value in setup.items()):
            raise HTTPException(403, "You cannot assign a profile with setup privileges you do not hold")
        modules = target.get("modules", {}) if matrix else {
            module: {action: action in ({"read"} if name == "Read Only" else {"read", "create", "update", "share", "convert", "send_email", "manage_views"}) for action in MODULE_PERMISSION_ACTIONS}
            for module in set(PRIVATE_USER_RESOURCES) | set(PLATFORM_RESOURCES) | {"products"}}
        if any(value and not _profile_action_allowed(db, actor, module, action)
               for module, actions in modules.items() for action, value in actions.items()):
            raise HTTPException(403, "You cannot assign a profile with module privileges you do not hold")
    return name


def _enforce_invitation_capacity(db: Session, invitation: OrganizationInvitation) -> None:
    organization = db.get(Organization, invitation.organization_id)
    if not organization or organization.status != "Active":
        raise HTTPException(409, "The invited organization is unavailable")
    owner = db.get(User, organization.owner_user_id)
    if owner is None:
        raise HTTPException(409, "The invited organization owner is unavailable")
    _enforce_organization_user_limit(db, owner, reserved_invitation_id=invitation.id)


configure_security_hooks(redact_record_fields, can_access_record, _organization_id_for_user)

__all__ = [
    "APP_ENV",
    "AUTH_COOKIE",
    "AUTH_SESSION_DAYS",
    "IS_PRODUCTION",
    "MIN_PASSWORD_LENGTH",
    "PASSWORD_ITERATIONS",
    "PRIVATE_USER_RESOURCES",
    "SETUP_CAPABILITIES",
    "_setup_capability_allowed",
    "_account_by_identifier",
    "_active_plan",
    "_app_credentials",
    "_basic_auth_valid",
    "_basic_username",
    "_claim_legacy_custom_modules",
    "_clean_username",
    "_clear_session_cookie",
    "_create_session",
    "_default_plan",
    "_dispatch_account_message",
    "_enforce_ai_limit",
    "_enforce_custom_module_limit",
    "_enforce_organization_user_limit",
    "_enforce_invitation_capacity",
    "_validate_profile_assignment",
    "_enforce_plan_feature",
    "_enforce_record_limit",
    "_enforce_request_access",
    "_enforce_storage_limit",
    "_ensure_organization_subscription",
    "_ensure_plan_catalog",
    "_ensure_user_organization",
    "_ensure_user_subscription",
    "_env_int",
    "_environment_admin_credentials_valid",
    "_is_platform_owner",
    "_metadata_fields",
    "_normalize_phone",
    "_notify_account",
    "_notify_account_once",
    "_organization_for_user",
    "_organization_id_for_user",
    "_organization_user_ids",
    "_user_in_actor_organization",
    "_organization_id_required",
    "_organization_record_count",
    "_organization_slug_for_user",
    "_password_hash",
    "_password_valid",
    "_profile_action_allowed",
    "_profile_permission_record",
    "_revoke_session",
    "_role_names_visible_to_actor",
    "_role_record",
    "_send_email_message",
    "_send_sms_message",
    "_session_token_hash",
    "_session_user",
    "_set_session_cookie",
    "_sharing_allows",
    "_subscription_payload",
    "authorize_field_values",
    "can_access_record",
    "current_actor",
    "env_bool",
    "field_allowed",
    "record_login_event",
    "redact_record_fields"
]

