"""Thin unofficial client for api.ikman.lk public reads."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any

BASE = "https://api.ikman.lk"
DEFAULT_HEADERS = {
    "Accept": "application/json",
    "Application": "web",
    "User-Agent": "ikman_lk/0.1 (+educational; polite)",
}


def _get(path: str, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> Any:
    url = BASE + path
    if params:
        cleaned = {k: v for k, v in params.items() if v is not None}
        url += "?" + urllib.parse.urlencode(cleaned)
    req = urllib.request.Request(url, headers={**DEFAULT_HEADERS, **(headers or {})})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode())


def categories() -> dict:
    return _get("/v1/categories")


def locations() -> dict:
    return _get("/v1/locations")


def serp(
    category: int = 409,
    page: int = 1,
    location: int | None = None,
    listing_type: str | None = None,
    next_page_token: str | None = None,
) -> dict:
    return _get(
        "/v1/serp",
        {
            "category": category,
            "page": page,
            "location": location,
            "type": listing_type,
            "next_page_token": next_page_token,
        },
    )


def ad(ad_id: str) -> dict:
    return _get(f"/v1/ads/{ad_id}")


__all__ = ["BASE", "categories", "locations", "serp", "ad"]
