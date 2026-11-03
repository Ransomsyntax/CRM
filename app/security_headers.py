from __future__ import annotations

import base64
import hashlib
import os
import re
import secrets
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
READINESS_EVIDENCE_TOKEN = os.getenv("READINESS_EVIDENCE_TOKEN", "").strip()


def readiness_evidence_authorized(request_token: str) -> bool:
    """Return whether a readiness probe may receive release identifiers."""
    return bool(
        READINESS_EVIDENCE_TOKEN
        and request_token
        and secrets.compare_digest(
            request_token.encode("utf-8"), READINESS_EVIDENCE_TOKEN.encode("utf-8")
        )
    )


def _inline_script_csp_sources() -> str:
    """Allow only the repository's exact inline script blocks."""
    script_pattern = re.compile(
        r"<script\b(?![^>]*\bsrc=)[^>]*>(.*?)</script>",
        re.IGNORECASE | re.DOTALL,
    )
    sources: set[str] = set()
    html_files = [
        *sorted((ROOT / "templates").glob("*.html")),
        *sorted((ROOT / "static" / "threeui").glob("*.html")),
    ]
    for html_file in html_files:
        try:
            content = html_file.read_text(encoding="utf-8")
        except OSError:
            continue
        inline_values = script_pattern.findall(content)
        for value in inline_values:
            digest = base64.b64encode(
                hashlib.sha256(value.encode("utf-8")).digest()
            ).decode("ascii")
            sources.add(f"'sha256-{digest}'")
    return " ".join(sorted(sources))


INLINE_SCRIPT_CSP_SOURCES = _inline_script_csp_sources()
