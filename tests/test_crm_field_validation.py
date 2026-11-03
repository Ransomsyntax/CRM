"""Regression coverage for CRM field validation reported in October 2026 QA."""
import pytest
from pydantic import ValidationError
from app.schemas import RecordPayload


@pytest.mark.parametrize("payload", [
    {"name": "   "},
    {"first_name": "  "},
    {"last_name": "\t"},
    {"email": "angel@123"},
    {"phone": "mmtth"},
    {"phone": "khjghmm"},
    {"phone": "1234567899999999"},
    {"website": "zsdxghj"},
    {"website": "javascript:alert(1)"},
    {"website": "https://.com"},
    {"website": "https://example..com"},
    {"website": "https://-example.com"},
    {"website": "https://example.com:bad"},
    {"website": "https://example.com:99999"},
])
def test_invalid_crm_fields_are_rejected(payload):
    with pytest.raises(ValidationError):
        RecordPayload(**payload)


@pytest.mark.parametrize("payload", [
    {"name": "Jane Doe"},
    {"first_name": "Anne-Marie", "last_name": "O'Neil"},
    {"email": "person@example.com"},
    {"phone": "+91 98765 43210"},
    {"website": "https://example.com"},
    {"website": "example.com"},
    {"website": "https://example.com:8443/path?q=test"},
    {"website": "https://例え.テスト"},
])
def test_valid_crm_fields_remain_accepted(payload):
    RecordPayload(**payload)

