#!/usr/bin/env python3
"""Polite live probe of public listing-site APIs.

Mirrors the spirit of cse-api-docs probe harness: hit known endpoints,
print a short report, optionally refresh truncated samples.

Usage:
  python3 scripts/probe_source_apis.py
  python3 scripts/probe_source_apis.py --write-samples
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
SAMPLES = ROOT / "docs" / "source-apis"
UA = (
    "Mozilla/5.0 (compatible; PropertyLkSourceApiProbe/0.1; "
    "+https://github.com/ArdenoStudio/sri-lanka-property-price-intelligence-platform)"
)
DELAY_S = 1.0

from scraper.privacy import sanitize_ikman_raw_json


def fetch(url: str, headers: dict | None = None, timeout: float = 30.0):
    req_headers = {"User-Agent": UA, "Accept": "application/json", **(headers or {})}
    req = urllib.request.Request(url, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            return resp.status, dict(resp.headers), body
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read()
    except Exception as e:  # noqa: BLE001 — probe harness
        return None, {}, str(e).encode()


def sleep():
    time.sleep(DELAY_S)


def probe_ikman(write_samples: bool) -> list[str]:
    lines = ["## ikman.lk"]
    h = {"Application": "web"}
    checks = [
        ("categories", "https://api.ikman.lk/v1/categories"),
        ("locations", "https://api.ikman.lk/v1/locations"),
        ("serp_property", "https://api.ikman.lk/v1/serp?category=409&page=1"),
        ("serp_rent", "https://api.ikman.lk/v1/serp?category=409&type=for_rent&page=1"),
    ]
    ad_id = None
    for name, url in checks:
        sleep()
        status, _hdrs, body = fetch(url, h)
        ok = status == 200
        extra = ""
        if ok:
            try:
                data = json.loads(body)
                if name.startswith("serp"):
                    pag = data.get("pagination") or {}
                    n = len((data.get("serp") or {}).get("results") or [])
                    extra = f" total={pag.get('total')} results={n}"
                    if not ad_id and n:
                        ad_id = data["serp"]["results"][0]["id"]
                    if write_samples and name == "serp_property":
                        sample = {
                            "pagination": pag,
                            "serp": {
                                "types": data["serp"].get("types"),
                                "categories": (data["serp"].get("categories") or [])[:5],
                                "locations": (data["serp"].get("locations") or [])[:5],
                                "results": sanitize_ikman_raw_json((data["serp"].get("results") or [])[:2]),
                            },
                        }
                        path = SAMPLES / "ikman" / "samples" / "serp_property.json"
                        path.write_text(json.dumps(sample, indent=2))
                elif name == "categories":
                    cats = data.get("categories") or []
                    prop = next((c for c in cats if c.get("id") == 409), None)
                    extra = f" n={len(cats)} property_children={prop.get('children') if prop else None}"
                elif name == "locations":
                    extra = f" n={len(data.get('locations') or [])}"
            except json.JSONDecodeError:
                extra = " (non-json)"
        lines.append(f"- {name}: HTTP {status}{extra}")

    if ad_id:
        sleep()
        status, _, body = fetch(f"https://api.ikman.lk/v1/ads/{ad_id}", h)
        lines.append(f"- ad_detail({ad_id[:8]}…): HTTP {status}")
        if write_samples and status == 200:
            try:
                data = sanitize_ikman_raw_json(json.loads(body))
                (SAMPLES / "ikman" / "samples" / "ad_detail.json").write_text(
                    json.dumps(data, indent=2)
                )
            except json.JSONDecodeError:
                pass
    return lines


def extract_lpw_token(html: str) -> tuple[str | None, str | None]:
    tok = re.search(r"token=([A-Za-z0-9_\-\.]+)", html)
    key = re.search(r"secure_key=([A-Za-z0-9_\-]+)", html)
    return (tok.group(1) if tok else None, key.group(1) if key else None)


def probe_lpw(write_samples: bool) -> list[str]:
    lines = ["## LankaPropertyWeb"]
    sleep()
    status, _, body = fetch(
        "https://www.lankapropertyweb.com/sale/index.php",
        {"Accept": "text/html"},
        timeout=40,
    )
    if status != 200:
        lines.append(f"- sale HTML: HTTP {status} (cannot extract token)")
        return lines
    token, secure = extract_lpw_token(body.decode("utf-8", "ignore"))
    lines.append(f"- sale HTML: HTTP 200 token={'yes' if token else 'no'} secure_key={secure or 'no'}")
    if not token or not secure:
        return lines

    for typ in ("sales", "rentals", "land"):
        sleep()
        qs = urllib.parse.urlencode(
            {
                "token": token,
                "site": "LPW",
                "secure_key": secure,
                "lang": "en",
                "type": typ,
                "start_point": 0,
                "limit": 5,
                "is_results_page": "Y",
                "pic_limit": "Y",
            }
        )
        url = f"https://www.lankapropertyweb.com/api/v3/search2?{qs}"
        st, _, b = fetch(url)
        extra = ""
        if st == 200:
            try:
                data = json.loads(b)
                extra = f" result_count={data.get('result_count')} ads={len(data.get('ads') or [])}"
                if write_samples and typ == "sales":
                    sample = {
                        "result_count": data.get("result_count"),
                        "count_per_property_type": data.get("count_per_property_type"),
                        "ads": (data.get("ads") or [])[:2],
                    }
                    path = SAMPLES / "lpw" / "samples" / "search2_sales.json"
                    path.write_text(json.dumps(sample, indent=2))
            except json.JSONDecodeError:
                extra = " (non-json)"
        lines.append(f"- search2 type={typ}: HTTP {st}{extra}")
    return lines


def probe_onlineproperty(write_samples: bool) -> list[str]:
    lines = ["## onlineproperty.lk"]
    sleep()
    status, hdrs, body = fetch(
        "https://onlineproperty.lk/wp-json/wp/v2/rtcl_listing?per_page=2&page=1",
        timeout=60,
    )
    total = hdrs.get("X-WP-Total") or hdrs.get("x-wp-total")
    extra = f" X-WP-Total={total}" if total else ""
    lines.append(f"- wp/v2/rtcl_listing: HTTP {status}{extra}")
    if write_samples and status == 200:
        try:
            data = json.loads(body)
            if data:
                item = data[0]
                slim = {
                    k: item[k]
                    for k in item
                    if k not in ("content", "yoast_head", "yoast_head_json", "_links")
                }
                slim["content_excerpt"] = ((item.get("content") or {}).get("rendered") or "")[:300]
                path = SAMPLES / "onlineproperty" / "samples" / "wp_v2_rtcl_listing.json"
                path.write_text(json.dumps(slim, indent=2))
        except json.JSONDecodeError:
            pass

    sleep()
    st, _, b = fetch("https://onlineproperty.lk/wp-json/rtcl/v1/listings?per_page=1")
    msg = ""
    try:
        msg = json.loads(b).get("code", "")
    except Exception:  # noqa: BLE001
        pass
    lines.append(f"- rtcl/v1/listings: HTTP {st} code={msg or '?'}")
    return lines


def probe_house() -> list[str]:
    lines = ["## house.lk"]
    sleep()
    status, _, body = fetch("https://house.lk/wp-json/", {"Accept": "text/html"}, timeout=20)
    snippet = body[:80].decode("utf-8", "ignore").replace("\n", " ")
    blocked = status in (403, 503) or "Just a moment" in snippet
    lines.append(f"- wp-json: HTTP {status}{' Cloudflare-blocked' if blocked else ''}")
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--write-samples",
        action="store_true",
        help="Refresh truncated samples under docs/source-apis/*/samples/",
    )
    args = parser.parse_args()

    report = [
        "# Source API probe report",
        "",
        f"delay_s={DELAY_S}",
        "",
    ]
    for section in (
        probe_ikman(args.write_samples),
        probe_lpw(args.write_samples),
        probe_onlineproperty(args.write_samples),
        probe_house(),
    ):
        report.extend(section)
        report.append("")

    text = "\n".join(report)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
