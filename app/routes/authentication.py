"""Account registration, sessions, and recovery routes.

Registered after the shared application services are initialized.
"""
from app.main import *  # noqa: F403 - shared application facade
from app.services.security import _enforce_invitation_capacity
from app.main import _account_by_identifier, _auth_rate_limit, _claim_legacy_custom_modules, _clean_username, _clear_session_cookie, _create_session, _ensure_user_subscription, _environment_admin_credentials_valid, _is_platform_owner, _normalize_phone, _notify_account, _notify_account_once, _password_hash, _password_valid, _revoke_session, _session_token_hash, _session_user, _set_session_cookie, _subscription_payload


def _seed_signup_demo_records(db: Session, organization_id: int, owner_id: int) -> None:
    """Seed an isolated onboarding dataset; never seed again for this organization."""
    if db.scalar(select(Lead.id).where(Lead.organization_id == organization_id).limit(1)) is not None:
        return
    sectors = ["Technology", "Retail", "Logistics", "Healthcare", "Education",
               "Manufacturing", "Hospitality", "Finance", "Construction", "Services"]
    first_names = ["Arun", "Meera", "Rohan", "Neha", "Vivek",
                   "Anika", "Kiran", "Priya", "Aditya", "Sara"]
    last_names = ["Nair", "Shah", "Menon", "Kapoor", "Rao",
                  "Thomas", "Iyer", "Das", "Pillai", "Khan"]
    accounts = []
    for index, sector in enumerate(sectors, 1):
        account = Account(
            name=f"Demo {sector} Company {index:02d}",
            industry=sector, type="Prospect", owner_id=owner_id,
            organization_id=organization_id, tags=["demo"],
            notes="Sample data for onboarding. Safe to edit or delete.",
        )
        db.add(account)
        accounts.append(account)
    db.flush()
    contacts = []
    for index, account in enumerate(accounts):
        first, last = first_names[index], last_names[index]
        contact = Contact(
            first_name=first, last_name=last,
            email=f"demo.contact{index + 1}@example.com",
            job_title="Demo Contact", account_id=account.id,
            owner_id=owner_id, organization_id=organization_id, tags=["demo"],
        )
        db.add(contact)
        contacts.append(contact)
        db.add(Lead(
            name=f"{first} {last}", company=account.name,
            email=f"demo.lead{index + 1}@example.com",
            source="Demo Data", status="New", owner_id=owner_id,
            organization_id=organization_id, tags=["demo"],
        ))
    db.flush()
    for index, account in enumerate(accounts):
        db.add(Deal(
            name=f"Demo Opportunity {index + 1:02d}",
            account_id=account.id, contact_id=contacts[index].id,
            amount=10000.0 * (index + 1), stage="Qualification",
            owner_id=owner_id, organization_id=organization_id,
            source="Demo Data",
        ))


@app.post("/api/auth/signup")
def auth_signup(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> Response:
    email_hint = str(payload.get("email") or "").strip().lower()
    _auth_rate_limit(request, "signup", email_hint, limit=6, window_seconds=600)
    name = str(payload.get("name") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    username = _clean_username(payload.get("username") or email.split("@", 1)[0])
    if username.lower() == os.getenv("APP_USERNAME", "").strip().lower():
        raise HTTPException(409, "This username is reserved")
    phone = _normalize_phone(payload.get("phone")) or None
    password = str(payload.get("password") or "")
    # Independent registration must explicitly name its organization.
    organization_name = str(payload.get("organization_name") or "").strip()
    invitation_requested = bool(str(payload.get("invitation_token") or payload.get("invite") or "").strip())
    if not invitation_requested and not 2 <= len(organization_name) <= 160:
        raise HTTPException(422, "Organization name must contain 2 to 160 characters")
    if len(name) < 2 or len(name) > 120:
        raise HTTPException(422, "Enter your full name")
    if parseaddr(email)[1] != email or "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(422, "Enter a valid email address")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(422, f"Password must contain at least {MIN_PASSWORD_LENGTH} characters")
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(409, "An account already exists for this email address")
    if db.scalar(select(User).where(func.lower(User.username) == username)):
        raise HTTPException(409, "That username is already in use")
    if phone:
        normalized_phone = re.sub(r"\D", "", phone)
        existing_phone = db.scalar(select(User).where(
            func.replace(func.replace(func.replace(func.replace(User.phone, "+", ""), " ", ""), "-", ""), "(", "") == normalized_phone
        ))
        if existing_phone:
            raise HTTPException(409, "An account already exists for this phone number")
    invitation_token = str(payload.get("invitation_token") or payload.get("invite") or "").strip()
    invitation = None
    if invitation_token:
        invitation = db.scalar(select(OrganizationInvitation).where(
            OrganizationInvitation.token_hash == _session_token_hash(invitation_token),
            OrganizationInvitation.status == "Pending",
            OrganizationInvitation.expires_at > datetime.utcnow(),
        ))
        if invitation is None:
            raise HTTPException(422, "Invitation is invalid or has expired")
        if invitation.email.lower() != email:
            raise HTTPException(422, "Sign up using the email address that received the invitation")
        _enforce_invitation_capacity(db, invitation)

    user = User(
        name=name,
        email=email,
        username=username,
        phone=phone,
        role=(invitation.user_role or ("Administrator" if invitation.membership_role.lower() == "admin" else "User")) if invitation else "Administrator",
        profile_name=(invitation.profile_name or ("Administrator" if invitation.membership_role.lower() == "admin" else "Standard")) if invitation else "Administrator",
        status="Active",
        last_active=datetime.utcnow(),
        password_hash=_password_hash(password),
        password_changed_at=datetime.utcnow(),
    )
    db.add(user)
    db.flush()
    if invitation is not None:
        db.add(OrganizationMember(
            organization_id=invitation.organization_id,
            user_id=user.id,
            membership_role=invitation.membership_role,
            status="Active",
        ))
        invitation.status = "Accepted"
        invitation.accepted_at = datetime.utcnow()
        user.invited_at = invitation.created_at
    else:
        subscription = _ensure_user_subscription(db, user)
        organization = db.get(Organization, subscription.organization_id)
        if organization is None:
            raise HTTPException(500, "Could not initialize organization")
        organization.name = organization_name
        setting = db.scalar(select(OrganizationSetting).where(OrganizationSetting.organization_id == organization.id))
        if setting is not None:
            setting.org_name = organization_name
        for company_record in db.scalars(select(PlatformRecord).where(
            PlatformRecord.organization_id == organization.id,
            PlatformRecord.resource == "company_details",
        )).all():
            if company_record.data.get("name") == "CONVOSIS CRM":
                company_record.data = {**company_record.data, "name": organization_name,
                                       "legal_name": organization_name}
                company_record.title = organization_name
        # Seed exactly one isolated sample dataset per newly registered organization.
        # Invitations never create a second dataset.
        _seed_signup_demo_records(db, organization.id, user.id)
    db.commit()
    db.refresh(user)
    token = _create_session(request, db, user)
    login_url = (os.getenv("APP_PUBLIC_URL", "").strip().rstrip("/") + "/login") if os.getenv("APP_PUBLIC_URL", "").strip() else "/login"
    _notify_account(
        db, user, "account_created", "CONVOSIS CRM account created",
        f"Hello {user.name}. Your CONVOSIS CRM account was created successfully. Username: {user.username}. Login: {login_url}. If this was not you, contact your administrator immediately."
    )
    response = JSONResponse({"ok": True, "user": serialize(user, db), "redirect": "/dashboard"}, status_code=201)
    _set_session_cookie(response, token)
    return response


@app.post("/api/auth/login")
def auth_login(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> Response:
    identifier = str(payload.get("identifier") or payload.get("email") or "").strip()
    _auth_rate_limit(request, "login", identifier, limit=10, window_seconds=300)
    password = str(payload.get("password") or "")
    user = _account_by_identifier(db, identifier)

    credentials_valid = bool(
        user is not None
        and user.status == "Active"
        and _password_valid(password, user.password_hash)
    )

    if not credentials_valid and _environment_admin_credentials_valid(identifier, password):
        ensure_cloud_admin(db)
        admin_username = os.getenv("APP_USERNAME", "").strip().lower()
        admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
        user = db.scalar(select(User).where(
            func.lower(User.role) == "administrator",
            User.status == "Active",
        ).order_by(User.id))
        credentials_valid = bool(
            user
            and (
                identifier.strip().lower() == admin_username
                or identifier.strip().lower() == admin_email
            )
        )

    if not credentials_valid or user is None:
        db.add(LoginHistory(
            user_id=user.id if user else None,
            event="login",
            success=False,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent", "")[:500],
            metadata_json={"path": request.url.path, "method": "password"},
        ))
        db.commit()
        raise HTTPException(401, "Incorrect username, email, phone number, or password")

    _claim_legacy_custom_modules(db, user)
    token = _create_session(request, db, user, auth_method="password")
    _notify_account_once(
        db, user, "login", "New CONVOSIS CRM sign-in",
        f"Your CONVOSIS CRM account was signed in on {datetime.utcnow().strftime('%d %b %Y %H:%M UTC')}. If this was not you, reset your password immediately.",
        within_minutes=10,
    )
    response = JSONResponse({"ok": True, "user": serialize(user, db), "redirect": "/dashboard"})
    _set_session_cookie(response, token)
    return response


@app.post("/api/auth/logout")
def auth_logout(request: Request, db: Session = Depends(get_db)) -> Response:
    actor = _session_user(request, db)
    if actor is not None:
        db.add(LoginHistory(user_id=actor.id, event="logout", success=True, ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent", "")[:500], metadata_json={"path": request.url.path}))
        add_audit(db, "logout", "users", actor.id, f"User '{actor.email}' logged out", actor_id=actor.id)
        db.commit()
    _revoke_session(request, db)
    response = JSONResponse({"ok": True, "redirect": "/login"})
    _clear_session_cookie(response)
    return response


@app.get("/api/auth/session")
def auth_session(request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    user = _session_user(request, db)
    if user is None:
        raise HTTPException(401, "No active session")
    payload = serialize(user, db)
    payload["owner_console_access"] = _is_platform_owner(user)
    payload["subscription"] = _subscription_payload(db, user.id)
    return {"authenticated": True, "user": payload}


@app.post("/api/auth/forgot-password")
def auth_forgot_password(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    identifier = str(payload.get("identifier") or payload.get("email") or "").strip()
    _auth_rate_limit(request, "forgot", identifier, limit=5, window_seconds=900)
    user = _account_by_identifier(db, identifier)
    if user is not None and user.status == "Active":
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
            f"A password reset was requested for your CONVOSIS CRM account. Use this link within 30 minutes: {reset_url}"
        )
    return {"ok": True, "message": "If the account exists, password reset instructions have been sent."}


@app.post("/api/auth/reset-password")
def auth_reset_password(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    token = str(payload.get("token") or "")
    _auth_rate_limit(request, "reset", token, limit=6, window_seconds=900)
    password = str(payload.get("password") or "")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(422, f"Password must contain at least {MIN_PASSWORD_LENGTH} characters")
    row = db.scalar(select(PasswordResetToken).where(
        PasswordResetToken.token_hash == _session_token_hash(token),
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > datetime.utcnow(),
    ))
    if row is None:
        raise HTTPException(400, "This password reset link is invalid or expired")
    user = db.get(User, row.user_id)
    if user is None or user.status != "Active":
        raise HTTPException(400, "This account is unavailable")
    user.password_hash = _password_hash(password)
    user.password_changed_at = datetime.utcnow()
    row.used_at = datetime.utcnow()
    db.execute(
        AuthSession.__table__.update().where(
            AuthSession.user_id == user.id,
            AuthSession.revoked_at.is_(None),
        ).values(revoked_at=datetime.utcnow())
    )
    db.commit()
    _notify_account(
        db, user, "password_reset", "CONVOSIS CRM password changed",
        "Your CONVOSIS CRM password was reset successfully. If you did not make this change, contact your administrator immediately."
    )
    return {"ok": True, "redirect": "/login"}


