#!/usr/bin/env python3
"""Polite live probe for api.ikman.lk public endpoints.

Writes:
  samples/<id>.json          truncated + PII-sanitized response bodies
  catalog/last_probe.json    machine-readable results
  catalog/PROBE_REPORT.md    human summary

Exit 0 if all endpoints match expect_status; 1 otherwise.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx
import yaml

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "catalog" / "endpoints.yaml"
SAMPLES = ROOT / "samples"
REPORT_JSON = ROOT / "catalog" / "last_probe.json"
REPORT_MD = ROOT / "catalog" / "PROBE_REPORT.md"

SAFE_CONTACT_KEYS = {"account_type", "chat_enabled", "delivery_methods", "opt_out"}


def sanitize(data: Any) -> Any:
    """Strip seller PII from contact_card and similar blobs before writing samples."""
    if isinstance(data, list):
        return [sanitize(x) for x in data]
    if not isinstance(data, dict):
        return data
    out: dict[str, Any] = {}
    for k, v in data.items():
        if k == "contact_card" and isinstance(v, dict):
            out[k] = {sk: v[sk] for sk in SAFE_CONTACT_KEYS if sk in v}
            out[k]["_redacted"] = True
        elif k in {"phone", "email", "mobile", "account"} and isinstance(v, (str, dict)):
            out[k] = "[redacted]"
        else:
            out[k] = sanitize(v)
    return out


def prepare_serp_for_truncate(data: Any) -> Any:
    """Hoist serp.results to a top-level key the truncator understands."""
    if not isinstance(data, dict):
        return data
    serp = data.get("serp")
    if isinstance(serp, dict) and isinstance(serp.get("results"), list):
        out = dict(data)
        out["_serp_results"] = serp["results"]
        # keep a slim serp without full results for sample readability
        slim = {k: v for k, v in serp.items() if k != "results"}
        slim["results"] = []  # filled from truncated _serp_results in post
        out["serp"] = slim
        return out
    return data


def finalize_serp_sample(data: Any) -> Any:
    if isinstance(data, dict) and "_serp_results" in data and isinstance(data.get("serp"), dict):
        out = dict(data)
        out["serp"] = dict(out["serp"])
        out["serp"]["results"] = out.pop("_serp_results")
        return out
    return data


def truncate(data: Any, max_bytes: int, list_key: str | None) -> Any:
    data = prepare_serp_for_truncate(data) if list_key == "_serp_results" else data
    raw = json.dumps(data, ensure_ascii=False, default=str)
    if list_key and isinstance(data, dict) and isinstance(data.get(list_key), list):
        rows = data[list_key]
        keep = min(2, len(rows))
        out = dict(data)
        out[list_key] = rows[:keep]
        out["_truncated"] = {
            "list_key": list_key,
            "kept": keep,
            "original_len": len(rows),
        }
        data = out
        raw = json.dumps(data, ensure_ascii=False, default=str)
    data = finalize_serp_sample(data)
    if len(raw.encode()) <= max_bytes:
        return data
    return {
        "_truncated": True,
        "_note": f"payload exceeded {max_bytes} bytes; keys only",
        "keys": list(data.keys()) if isinstance(data, dict) else type(data).__name__,
        "preview": json.dumps(data, ensure_ascii=False, default=str)[:2000],
    }


def fingerprint(data: Any) -> dict[str, Any]:
    if isinstance(data, dict):
        return {"type": "object", "keys": sorted(data.keys())[:40]}
    if isinstance(data, list):
        sample_keys = (
            sorted(data[0].keys())[:20]
            if data and isinstance(data[0], dict)
            else None
        )
        return {"type": "array", "len": len(data), "item_keys": sample_keys}
    return {"type": type(data).__name__}


def render_path(path: str, ad_id: str | None) -> str:
    if "{{ad_id}}" in path:
        if not ad_id:
            raise RuntimeError("ad_id required but missing — run serp_property first")
        return path.replace("{{ad_id}}", ad_id)
    return path


def render_query(ep: dict[str, Any], meta: dict[str, Any], next_token: str | None) -> dict[str, str]:
    q = ep.get("query") or {}
    out: dict[str, str] = {}
    for k, v in q.items():
        s = str(v)
        s = s.replace("{{category}}", str(meta["test_category"]))
        s = s.replace("{{subcategory}}", str(meta["test_subcategory"]))
        s = s.replace("{{location}}", str(meta["test_location"]))
        if "{{next_page_token}}" in s:
            if not next_token:
                raise RuntimeError("next_page_token required but missing")
            s = s.replace("{{next_page_token}}", next_token)
        out[k] = s
    return out


def main() -> int:
    cfg = yaml.safe_load(CATALOG.read_text(encoding="utf-8"))
    meta = cfg["meta"]
    base = meta["base_url"].rstrip("/")
    delay = float(meta.get("delay_seconds", 0.4))
    max_bytes = int(meta.get("max_sample_bytes", 14000))
    headers = dict(meta.get("headers") or {})

    SAMPLES.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    ad_id: str | None = None
    next_page_token: str | None = None
    failed = 0

    with httpx.Client(timeout=45.0, follow_redirects=True, headers=headers) as client:
        for ep in cfg["endpoints"]:
            eid = ep["id"]
            method = ep["method"].upper()
            expect = set(ep.get("expect_status") or [200])
            row: dict[str, Any] = {
                "id": eid,
                "path": ep["path"],
                "method": method,
                "category": ep.get("category"),
                "summary": ep.get("summary"),
            }
            try:
                if ep.get("requires") == "ad_id" and not ad_id:
                    raise RuntimeError("ad_id not resolved yet — order catalog correctly")
                if ep.get("requires") == "next_page_token" and not next_page_token:
                    raise RuntimeError("next_page_token not resolved yet")

                path = render_path(ep["path"], ad_id)
                url = f"{base}{path}"
                params = render_query(ep, meta, next_page_token) if method == "GET" else {}

                resp = client.request(method, url, params=params or None)
                row["status"] = resp.status_code
                row["ok"] = resp.status_code in expect
                if not row["ok"]:
                    failed += 1
                    row["error"] = f"unexpected status {resp.status_code}; expected {sorted(expect)}"

                if resp.status_code == 204 or not resp.content:
                    data: Any = {"_empty": True, "_http_status": resp.status_code}
                else:
                    try:
                        data = resp.json()
                    except Exception:
                        data = {
                            "_non_json": True,
                            "text_preview": resp.text[:500],
                            "_http_status": resp.status_code,
                        }

                data = sanitize(data)

                if eid == "serp_property" and isinstance(data, dict):
                    pag = data.get("pagination") or {}
                    if pag.get("next_page_token"):
                        next_page_token = str(pag["next_page_token"])
                        row["resolved_next_page_token"] = next_page_token[:24] + "…"
                    serp = data.get("serp") or {}
                    rows = serp.get("results") or []
                    if rows and isinstance(rows[0], dict) and rows[0].get("id"):
                        ad_id = str(rows[0]["id"])
                        row["resolved_ad_id"] = ad_id

                full_url = url if not params else f"{url}?{urlencode(params)}"
                sample = {
                    "_probe": {
                        "id": eid,
                        "url": full_url,
                        "method": method,
                        "status": resp.status_code,
                        "verified_at": datetime.now(UTC).isoformat(),
                        "fingerprint": fingerprint(data),
                    },
                    "response": truncate(data, max_bytes, ep.get("truncate_list_key")),
                }
                (SAMPLES / f"{eid}.json").write_text(
                    json.dumps(sample, indent=2, ensure_ascii=False, default=str) + "\n",
                    encoding="utf-8",
                )
                row["fingerprint"] = sample["_probe"]["fingerprint"]
                row["sample"] = f"samples/{eid}.json"
            except Exception as exc:  # noqa: BLE001
                failed += 1
                row["ok"] = False
                row["status"] = None
                row["error"] = str(exc)
            results.append(row)
            time.sleep(delay)

    payload = {
        "probed_at": datetime.now(UTC).isoformat(),
        "base_url": base,
        "ad_id": ad_id,
        "next_page_token_present": bool(next_page_token),
        "failed": failed,
        "passed": len(results) - failed,
        "total": len(results),
        "results": results,
        "property_categories": cfg.get("property_categories"),
        "listing_types": cfg.get("listing_types"),
    }
    REPORT_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Probe report",
        "",
        f"**When:** `{payload['probed_at']}`  ",
        f"**Base:** `{base}`  ",
        f"**ad_id:** `{ad_id}`  ",
        f"**Result:** {payload['passed']}/{payload['total']} passed ({failed} failed)",
        "",
        "| ID | Method | Path | Status | OK |",
        "|---|---|---|---|---|",
    ]
    for r in results:
        st = r.get("status")
        ok = "✅" if r.get("ok") else "❌"
        lines.append(f"| `{r['id']}` | {r['method']} | `{r['path']}` | {st} | {ok} |")
        if r.get("error"):
            lines.append(f"| | | | | `{r['error']}` |")
    lines.append("")
    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(REPORT_MD.read_text(encoding="utf-8"))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
