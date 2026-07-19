from scraper.privacy import redact_contact_channels, sanitize_ikman_raw_json


def test_sanitize_ikman_raw_json_strips_nested_contact_cards():
    payload = {
        "id": "abc123",
        "contact_card": {
            "name": "Jane Seller",
            "email": {"address": "jane@example.com", "verified": True},
            "phone_numbers": [{"number": "+94 77 123 4567", "verified": True}],
            "account_type": "private",
            "chat_enabled": True,
            "delivery_methods": ["chat"],
            "opt_out": False,
        },
        "shop": {
            "name": "Broker Shop",
            "contact_card": {
                "email": "sales@example.com",
                "phone_numbers": ["0771234567"],
                "account_type": "shop",
            },
        },
    }

    sanitized = sanitize_ikman_raw_json(payload)

    assert sanitized["contact_card"] == {
        "account_type": "private",
        "chat_enabled": True,
        "delivery_methods": ["chat"],
        "opt_out": False,
    }
    assert sanitized["shop"]["contact_card"] == {"account_type": "shop"}
    assert "name" not in sanitized["contact_card"]
    assert "email" not in sanitized["contact_card"]
    assert "phone_numbers" not in sanitized["contact_card"]


def test_redact_contact_channels_masks_phone_email_and_whatsapp():
    text = (
        "Call 077 123 4567 or +94 77 123 4567, "
        "email jane@example.com, or use https://wa.me/94771234567."
    )

    redacted = redact_contact_channels(text)

    assert "[redacted phone]" in redacted
    assert "[redacted email]" in redacted
    assert "[redacted whatsapp]" in redacted
    assert "077 123 4567" not in redacted
    assert "+94 77 123 4567" not in redacted
    assert "jane@example.com" not in redacted
