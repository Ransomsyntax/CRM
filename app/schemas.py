from __future__ import annotations

from datetime import date, datetime
from typing import Any
import re
import unicodedata
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

class RecordPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    source: str | None = None
    status: str | None = None
    owner_id: int | None = None
    lead_score: int | None = None
    next_follow_up: date | None = None
    notes: str | None = None
    tags: list[str] | None = None
    first_name: str | None = None
    last_name: str | None = None
    job_title: str | None = None
    department: str | None = None
    account_id: int | None = None
    contact_id: int | None = None
    website: str | None = None
    industry: str | None = None
    employees: int | None = None
    annual_revenue: float | None = None
    type: str | None = None
    billing_city: str | None = None
    billing_country: str | None = None
    amount: float | None = None
    stage: str | None = None
    probability: int | None = None
    expected_close_date: date | None = None
    create_deal: bool | None = None
    account_name: str | None = None
    deal_name: str | None = None
    deal_amount: float | None = None
    contact_role: str | None = None
    pipeline: str | None = None
    layout_name: str | None = None
    activity_type: str | None = None
    subject: str | None = None
    title: str | None = None
    start_at: datetime | None = None
    due_at: datetime | None = None
    priority: str | None = None
    related_type: str | None = None
    related_id: int | list[int] | None = None
    description: str | None = None
    content: str | None = None
    body: str | None = None
    completed_at: datetime | None = None
    role: str | None = None
    last_active: datetime | None = None
    module: str | None = None
    trigger: str | None = None
    approver: str | None = None
    conditions: list[dict[str, Any]] | None = None
    steps: list[dict[str, Any]] | None = None
    entry_criteria: str | None = None
    stages: list[dict[str, Any]] | None = None
    transitions: list[dict[str, Any]] | None = None
    transition_requirements: list[dict[str, Any]] | None = None
    active: bool | None = None
    create_deal: bool | None = None
    account_name: str | None = None
    deal_name: str | None = None
    deal_amount: float | None = None
    sku: str | None = None
    category: str | None = None
    unit_price: float | None = None
    stock_quantity: int | None = None
    file_type: str | None = None
    file_size: str | None = None
    url: str | None = None
    from_email: str | None = None
    to_email: str | None = None
    sent_at: datetime | None = None

    @field_validator("name", "first_name", "last_name")
    @classmethod
    def reject_whitespace_names(cls, value: str | None, info: ValidationInfo) -> str | None:
        if value is not None and value != "" and not value.strip():
            raise ValueError("Name must contain visible characters")
        if value is None:
            return None
        name = value.strip()
        limit = 100 if info.field_name in {"first_name", "last_name"} else 160
        if len(name) > limit:
            raise ValueError(f"Name must be {limit} characters or fewer")
        if name and not any(character.isalpha() for character in name):
            raise ValueError("Name must contain at least one letter")
        if info.field_name in {"first_name", "last_name"} and any(
            not (unicodedata.category(character)[0] in {"L", "M"} or character in " .'-’")
            for character in name
        ):
            raise ValueError("Use letters, spaces, apostrophes, periods or hyphens in a person's name")
        return name

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: str | None) -> str | None:
        if not value:
            return value
        email = value.strip()
        if not re.fullmatch(r"[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+", email):
            raise ValueError("Enter a valid email address")
        return email

    @field_validator("phone")
    @classmethod
    def validate_phone_format(cls, value: str | None) -> str | None:
        if not value:
            return value
        phone = value.strip()
        digits = re.sub(r"[^0-9]", "", phone)
        if not re.fullmatch(r"\+?[0-9 ()-]+", phone) or not 7 <= len(digits) <= 15:
            raise ValueError("Enter a valid phone number (7–15 digits)")
        return phone

    @field_validator("website")
    @classmethod
    def validate_website_format(cls, value: str | None) -> str | None:
        if not value:
            return value
        website = value.strip()
        try:
            parsed = urlsplit(website if "://" in website else "https://" + website)
            # Accessing port validates both its numeric format and allowed range.
            _ = parsed.port
            host = (parsed.hostname or "").removesuffix(".").encode("idna").decode("ascii")
            labels = host.split(".")
            valid_host = len(host) <= 253 and len(labels) >= 2 and all(
                re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?", label)
                for label in labels
            )
        except (ValueError, UnicodeError):
            raise ValueError("Enter a valid website URL") from None
        if parsed.scheme not in ("http", "https") or not valid_host or any(char.isspace() for char in website):
            raise ValueError("Enter a valid website URL")
        return website


class SettingsPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    org_name: str | None = None
    timezone: str | None = None
    currency: str | None = None
    date_format: str | None = None
    fiscal_year_start: str | None = None
    default_pipeline: str | None = None
    notifications: dict[str, bool] | None = None
    name: str | None = None
    email: str | None = None


class AIProposedActivity(BaseModel):
    model_config = ConfigDict(extra="forbid")
    activity_type: str = Field(pattern="^(Task|Call|Meeting)$")
    subject: str = Field(min_length=3, max_length=180)
    description: str = Field(min_length=1, max_length=1200)
    due_at: datetime
    priority: str = Field(default="Normal", pattern="^(Low|Normal|High)$")
    related_type: str = Field(pattern="^(leads|contacts|accounts|deals)$")
    related_id: int = Field(ge=1)
    owner_id: int | None = Field(default=None, ge=1)
    reason: str = Field(min_length=1, max_length=500)


class AIChatPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=3, max_length=1500)
    lead_id: int | None = Field(default=None, ge=1)


class AIInsight(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: str = Field(min_length=1, max_length=5000)
    actions: list[str] = Field(default_factory=list, max_length=6)
    risks: list[str] = Field(default_factory=list, max_length=6)
    confidence: str = Field(default="medium", pattern="^(low|medium|high)$")
    proposed_activities: list[AIProposedActivity] = Field(default_factory=list, max_length=10)


class AIActivityApprovalPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: str = Field(min_length=8, max_length=100)
    activities: list[AIProposedActivity] = Field(min_length=1, max_length=10)


class AIExceptionReviewPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: str = Field(pattern="^(open|dismissed|corrected|unclear|acted_on)$")
    reason: str = Field(min_length=2, max_length=500)


class AIRankPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    occurrence_ids: list[str] = Field(min_length=1, max_length=50)


class AIRankItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ref: str = Field(min_length=12, max_length=80)
    rationale: str = Field(min_length=1, max_length=500)
    description: str = Field(default="", max_length=1000)
    intent: str = Field(default="quote_follow_up", pattern="^(quote_follow_up|confirm_validity|resolve_missing_validity)$")


class AIRankResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ranked: list[AIRankItem] = Field(min_length=1, max_length=50)


class ApexAssistantPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=3, max_length=1500)
    resource: str | None = Field(default=None, max_length=50)
    record_id: int | None = Field(default=None, ge=1)


class ApexSummaryPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resource: str = Field(min_length=2, max_length=50)
    record_id: int = Field(ge=1)


class ApexScoringPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    lead_ids: list[int] | None = Field(default=None, max_length=100)
    persist: bool = False


class BulkArchivePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    related_id: list[int]


class PlatformPayload(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str | None = None
    title: str | None = None
    status: str | None = None
    owner_id: int | None = None
    account_id: int | None = None
    contact_id: int | None = None
    deal_id: int | None = None
    related_type: str | None = None
    related_id: int | None = None
    amount: float | None = None
    due_date: date | None = None


class RestorePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resource: str
    record_id: int

__all__ = [
    "RecordPayload",
    "SettingsPayload",
    "AIProposedActivity",
    "AIChatPayload",
    "AIInsight",
    "AIActivityApprovalPayload",
    "AIExceptionReviewPayload",
    "AIRankPayload",
    "AIRankItem",
    "AIRankResponse",
    "ApexAssistantPayload",
    "ApexSummaryPayload",
    "ApexScoringPayload",
    "BulkArchivePayload",
    "PlatformPayload",
    "RestorePayload"
]

