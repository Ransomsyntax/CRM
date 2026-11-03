"""Regression checks for editing existing records without false duplicates."""
from app.services.record_deduplication import identity_fields_changed


def test_lead_edit_with_unchanged_email_phone_is_not_duplicate():
    before = {"email": "1simon@convosis.com", "phone": None, "name": "Simon Mathew"}
    after = {**before, "status": "Qualified", "notes": "Updated details"}
    assert identity_fields_changed("leads", before, after) is False


def test_lead_edit_changed_email_still_validates_duplicates():
    before = {"email": "original@example.com", "phone": None}
    after = {"email": "other@example.com", "phone": None}
    assert identity_fields_changed("leads", before, after) is True


def test_formatting_only_differences_do_not_trigger_identity_change():
    before = {"email": "USER@example.com", "phone": " 12345 "}
    after = {"email": " user@example.com ", "phone": "12345"}
    assert identity_fields_changed("contacts", before, after) is False


def test_account_and_deal_identity_changes_are_detected():
    assert identity_fields_changed("accounts", {"name": " Acme "}, {"name": "acme"}) is False
    assert identity_fields_changed("deals", {"name": "Renewal", "account_id": 1, "contact_id": 2}, {"name": "Renewal", "account_id": 3, "contact_id": 2}) is True
