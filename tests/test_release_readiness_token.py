"""Release checks must send the protected readiness token and reject stale builds."""
import io
import json

import pytest

from scripts import verify_production, wait_for_production


def test_wait_check_forwards_token_and_rejects_old_revision(monkeypatch):
    monkeypatch.setattr(wait_for_production, "READINESS_EVIDENCE_TOKEN", "release-token")
    monkeypatch.setattr(wait_for_production, "EXPECTED_APP_REVISION", "abcdef123456")
    monkeypatch.setattr(wait_for_production, "EXPECTED_MIGRATION_REVISION", "migration_head")
    payload = {"status": "ok", "database": "ready", "app_revision": "abcdef123456", "migration_revision": "migration_head"}

    def respond(request, timeout):
        assert request.get_header("X-readiness-token") == "release-token"
        response = io.BytesIO(json.dumps(payload).encode())
        response.status = 200
        return response

    monkeypatch.setattr(wait_for_production, "urlopen", respond)
    assert wait_for_production.check()[0] is True
    payload["app_revision"] = "000000000000"
    assert wait_for_production.check()[0] is False


def test_release_verifier_forwards_token_and_requires_configuration(monkeypatch):
    monkeypatch.setattr(verify_production, "READINESS_EVIDENCE_TOKEN", "release-token")
    monkeypatch.setattr(verify_production, "EXPECTED_APP_REVISION", "abcdef123456")
    monkeypatch.setattr(verify_production, "EXPECTED_MIGRATION_REVISION", "migration_head")
    monkeypatch.setattr(verify_production, "client", lambda: object())

    def respond(opener, method, path, **kwargs):
        if path == "/health":
            return 200, {"status": "ok"}
        assert kwargs["headers"] == {"X-Readiness-Token": "release-token"}
        return 200, {"status": "ok", "database": "ready", "app_revision": "abcdef123456", "migration_revision": "migration_head"}

    monkeypatch.setattr(verify_production, "call", respond)
    assert verify_production.verify_public_readiness()["ready"]["database"] == "ready"
    monkeypatch.setattr(verify_production, "READINESS_EVIDENCE_TOKEN", "")
    with pytest.raises(AssertionError, match="READINESS_EVIDENCE_TOKEN"):
        verify_production.verify_public_readiness()
    monkeypatch.setattr(wait_for_production, "EXPECTED_APP_REVISION", "abcdef123456")
    monkeypatch.setattr(wait_for_production, "READINESS_EVIDENCE_TOKEN", "")
    with pytest.raises(RuntimeError, match="READINESS_EVIDENCE_TOKEN"):
        wait_for_production.main()
