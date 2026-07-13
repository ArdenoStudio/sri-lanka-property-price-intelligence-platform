#!/usr/bin/env python3
"""Generate a print-ready PDF from the /report page.

Usage:
  python scripts/generate_report_pdf.py --output docs/phase0/samples/report.pdf \
    --district Colombo --type house --size-perches 8 --bedrooms 3

Requires a running dashboard (built with VITE_API_URL pointing at production API),
or pass --base-url to a deployed frontend.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from urllib.parse import urlencode


def build_report_url(
    base_url: str,
    *,
    district: str | None,
    property_type: str,
    listing_type: str,
    size_perches: float | None,
    size_sqft: float | None,
    bedrooms: int | None,
) -> str:
    params: dict[str, str] = {
        "type": property_type,
        "listing_type": listing_type,
    }
    if district:
        params["district"] = district
    if size_perches is not None:
        params["size_perches"] = str(size_perches)
    if size_sqft is not None:
        params["size_sqft"] = str(int(size_sqft))
    if bedrooms is not None:
        params["bedrooms"] = str(bedrooms)
    return f"{base_url.rstrip('/')}/report?{urlencode(params)}"


def generate_pdf(url: str, output: Path, timeout_ms: int = 30_000) -> None:
    from playwright.sync_api import sync_playwright

    output.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 794, "height": 1123})
        page.goto(url, wait_until="networkidle", timeout=timeout_ms)
        page.wait_for_selector("text=Property Market Intelligence Report", timeout=timeout_ms)
        page.wait_for_selector("text=Estimated Asking Value", timeout=timeout_ms)
        page.wait_for_timeout(500)
        page.emulate_media(media="print")
        page.pdf(
            path=str(output),
            format="A4",
            print_background=False,
            margin={"top": "18mm", "right": "15mm", "bottom": "18mm", "left": "15mm"},
        )
        browser.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a property intelligence PDF report")
    parser.add_argument("--base-url", default="http://localhost:3456", help="Dashboard base URL")
    parser.add_argument("--output", required=True, type=Path, help="Output PDF path")
    parser.add_argument("--district", default="Colombo")
    parser.add_argument("--type", dest="property_type", default="house")
    parser.add_argument("--listing-type", default="sale")
    parser.add_argument("--size-perches", type=float, default=8.0)
    parser.add_argument("--size-sqft", type=float, default=1800.0)
    parser.add_argument("--bedrooms", type=int, default=3)
    parser.add_argument("--timeout-ms", type=int, default=30_000)
    args = parser.parse_args()

    url = build_report_url(
        args.base_url,
        district=args.district,
        property_type=args.property_type,
        listing_type=args.listing_type,
        size_perches=args.size_perches,
        size_sqft=args.size_sqft,
        bedrooms=args.bedrooms,
    )
    print(f"Generating report from {url}")
    try:
        generate_pdf(url, args.output, timeout_ms=args.timeout_ms)
    except Exception as exc:
        print(f"Failed to generate PDF: {exc}", file=sys.stderr)
        return 1
    print(f"Wrote {args.output} ({args.output.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
