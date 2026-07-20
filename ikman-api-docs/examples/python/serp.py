#!/usr/bin/env python3
"""Minimal SERP + detail example against api.ikman.lk."""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request

BASE = "https://api.ikman.lk"
HEADERS = {
    "Accept": "application/json",
    "Application": "web",
    "User-Agent": "Ikman-API-Docs-Example/1.0",
}


def get(path: str, params: dict | None = None) -> dict:
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    serp = get("/v1/serp", {"category": 415, "page": 1})
    pag = serp["pagination"]
    results = serp["serp"]["results"]
    print(f"page={pag['page']} total={pag['total']} results={len(results)}")
    if not results:
        print("no results", file=sys.stderr)
        return 1
    ad_id = results[0]["id"]
    detail = get(f"/v1/ads/{ad_id}")
    props = {p["key"]: p["value"] for p in detail["ad"].get("properties") or [] if "key" in p}
    print(f"ad={ad_id} title={detail['ad'].get('title')!r}")
    print("properties:", json.dumps(props, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
