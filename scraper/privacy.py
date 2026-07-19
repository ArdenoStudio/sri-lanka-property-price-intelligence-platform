import re
from typing import Any


SAFE_IKMAN_CONTACT_CARD_KEYS = (
    "account_type",
    "chat_enabled",
    "delivery_methods",
    "opt_out",
)

EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
WHATSAPP_RE = re.compile(
    r"(?:https?://)?(?:wa\.me|api\.whatsapp\.com)/[^\s]+",
    re.IGNORECASE,
)
PHONE_PATTERNS = (
    re.compile(r"(?<!\d)\+94[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}(?!\d)"),
    re.compile(r"(?<!\d)0\d{2}[\s-]?\d{3}[\s-]?\d{4}(?!\d)"),
    re.compile(r"(?<!\d)\d{3}[\s-]\d{7}(?!\d)"),
)


def _sanitize_ikman_contact_card(contact_card: dict[str, Any]) -> dict[str, Any]:
    sanitized: dict[str, Any] = {}
    for key in SAFE_IKMAN_CONTACT_CARD_KEYS:
        value = contact_card.get(key)
        if value in (None, "", [], {}):
            continue
        sanitized[key] = value
    return sanitized


def sanitize_ikman_raw_json(payload: Any) -> Any:
    """Remove PII-bearing ikman contact blocks before persistence."""
    if isinstance(payload, dict):
        sanitized: dict[str, Any] = {}
        for key, value in payload.items():
            if key == "contact_card":
                if isinstance(value, dict):
                    safe_contact_card = _sanitize_ikman_contact_card(value)
                    if safe_contact_card:
                        sanitized[key] = safe_contact_card
                continue
            sanitized[key] = sanitize_ikman_raw_json(value)
        return sanitized
    if isinstance(payload, list):
        return [sanitize_ikman_raw_json(item) for item in payload]
    return payload


def redact_contact_channels(text: str | None) -> str | None:
    """Redact common seller contact channels from public-facing text."""
    if text is None:
        return None

    redacted = WHATSAPP_RE.sub("[redacted whatsapp]", text)
    redacted = EMAIL_RE.sub("[redacted email]", redacted)
    for pattern in PHONE_PATTERNS:
        redacted = pattern.sub("[redacted phone]", redacted)
    return redacted
