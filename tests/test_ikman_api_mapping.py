import json
from pathlib import Path

from scraper.ikman_api import (
    legacy_source_id_from_slug,
    map_ikman_ad_detail,
    map_ikman_serp_result,
    map_listing_type,
    slug_from_url,
)
from scraper.privacy import sanitize_ikman_raw_json

SERP = Path(__file__).resolve().parents[1] / "docs/source-apis/ikman/samples/serp_property.json"
DETAIL = Path(__file__).resolve().parents[1] / "docs/source-apis/ikman/samples/ad_detail.json"


def test_slug_helpers():
    assert slug_from_url("https://ikman.lk/en/ad/foo-bar-123") == "foo-bar-123"
    assert legacy_source_id_from_slug("foo-bar-123") == "123"
    assert map_listing_type("for_rent") == "rent"
    assert map_listing_type("for_sale") == "sale"


def test_map_serp_land_sample():
    data = json.loads(SERP.read_text())
    result = data["serp"]["results"][0]
    mapped = map_ikman_serp_result(result)
    assert mapped is not None
    assert mapped["source"] == "ikman"
    assert mapped["source_id"] == result["id"]
    assert len(mapped["source_id"]) == 24
    assert mapped["property_type"] == "land"
    assert mapped["listing_type"] == "sale"
    assert mapped["raw_json"]["hex_id"] == result["id"]
    assert mapped["raw_json"]["legacy_source_id"] == "1"
    assert "perch" in (mapped["raw_size"] or "").lower() or "perch" in (mapped["raw_price"] or "").lower()
    # PDPA: no phone/name fields from contact_card
    assert "name" not in (mapped["raw_json"].get("contact_card") or {})
    assert "phone" not in (mapped["raw_json"].get("contact_card") or {})


def test_map_detail_sample():
    data = json.loads(DETAIL.read_text())
    attrs = map_ikman_ad_detail(data)
    assert attrs["source_id"] == "6a2cb4d30277c4957529efda"
    assert attrs["size_perches"] == 8.5
    assert attrs["raw_json"]["ingest"] == "ikman_detail_api"
    sanitized = sanitize_ikman_raw_json(data)
    assert "phone_number" not in json.dumps(sanitized)


def test_map_ikman_ad_detail_parses_comma_thousands_in_size():
    """Live ikman sizes often look like '1,816.0 sqft' — must not become 816."""
    payload = {
        "ad": {
            "id": "999",
            "properties": [
                {"label": "Size (square feet)", "key": "size", "value": "1,816.0 sqft"},
                {"label": "Bedrooms", "key": "bedrooms", "value": "3"},
                {"label": "Bathrooms", "key": "bathrooms", "value": "2"},
            ],
        }
    }
    mapped = map_ikman_ad_detail(payload)
    assert mapped["size_sqft"] == 1816.0
    assert mapped["bedrooms"] == 3
    assert mapped["bathrooms"] == 2


def test_map_serp_puts_bedrooms_in_raw_json():
    result = {
        "id": "6a460b164c8bc14f02780157",
        "slug": "house-for-sale-in-hokandara-123",
        "title": "House",
        "type": "for_sale",
        "url": "/en/ad/house-for-sale-in-hokandara-123",
        "details": ["Bedrooms: 4", "Bathrooms: 3"],
        "money": {"amount": "Rs 10,000,000"},
        "location": {"name": "Colombo"},
        "area": {"name": "Hokandara"},
        "category": {"id": 415, "name": "Houses For Sale"},
        "date": "2026-07-20T09:00:00+05:30",
        "images": {
            "base_uri": "https://i.ikman-st.com",
            "ids": ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
        },
    }
    mapped = map_ikman_serp_result(result)
    assert mapped is not None
    assert mapped["raw_json"]["bedrooms"] == 4
    assert mapped["raw_json"]["bathrooms"] == 3
    assert mapped["property_type"] == "house"
    assert mapped["listing_type"] == "sale"
    assert mapped["raw_json"]["image_urls"] == [
        "https://i.ikman-st.com/house-for-sale-in-hokandara-123/"
        "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/640/480/fitted.jpg"
    ]
