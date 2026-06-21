"""
Generate a PropertyLK market intelligence PDF report by calling the production
API directly and rendering an HTML page with Playwright.

Usage:
  python scripts/generate_report_pdf.py \
    --output docs/phase0/samples/seanika_colombo_house_sample.pdf \
    --district Colombo --type house --size-perches 8 --size-sqft 1800 --bedrooms 3

Requirements:
  pip install playwright requests
  python -m playwright install chromium
"""

import argparse
import json
import os
import sys
import time
import requests
from playwright.sync_api import sync_playwright

API_URL = os.environ.get(
    "API_URL",
    "https://property-price-intelligence-an-ardeno-production.fly.dev/estimate",
)


def fetch_estimate(district, property_type, listing_type, size_perches, size_sqft, bedrooms):
    payload = {k: v for k, v in {
        "district": district,
        "property_type": property_type,
        "listing_type": listing_type,
        "size_perches": size_perches,
        "size_sqft": size_sqft,
        "bedrooms": bedrooms,
    }.items() if v is not None}
    r = requests.post(API_URL, json=payload, timeout=30)
    r.raise_for_status()
    return r.json()


def fmt_lkr(n):
    if n is None:
        return "—"
    if n >= 1_000_000:
        return f"LKR {n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"LKR {n/1_000:.0f}K"
    return f"LKR {n:,.0f}"


def build_html(data, district, property_type, listing_type, size_perches, size_sqft, bedrooms):
    from datetime import date
    import random, string
    ref_id = "PI-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    today = date.today().strftime("%-d %B %Y") if sys.platform != "win32" else date.today().strftime("%#d %B %Y")

    subject_parts = [
        property_type.capitalize(),
        "for Sale" if listing_type == "sale" else "for Rent",
        f"— {district} District" if district else "— All Districts",
        f"· {size_perches} perches" if size_perches else "",
        f"· {int(size_sqft):,} sqft" if size_sqft else "",
        f"· {bedrooms} bedroom{'s' if bedrooms != 1 else ''}" if bedrooms else "",
    ]
    subject_line = " ".join(p for p in subject_parts if p)

    confidence = data.get("confidence", "")
    conf_colour = {"high": "#16a34a", "medium": "#d97706"}.get(confidence, "#dc2626")
    conf_bg = {"high": "#dcfce7", "medium": "#fef3c7"}.get(confidence, "#fee2e2")

    comparables_rows = ""
    for i, c in enumerate(data.get("comparables", [])):
        bg = "#f9fafb" if i % 2 == 1 else "white"
        location = c.get("city") or c.get("raw_location") or c.get("district") or "—"
        size = f"{c['size_perches']}p" if c.get("size_perches") is not None else (
            f"{int(c['size_sqft']):,} sqft" if c.get("size_sqft") is not None else "—")
        beds = str(c.get("bedrooms", "—")) if c.get("bedrooms") is not None else "—"
        dom = f"{c['days_on_market']}d" if c.get("days_on_market") is not None else "—"
        sim = f"{c['similarity_score']:.0f}%" if c.get("similarity_score") is not None else "—"
        comparables_rows += f"""
        <tr style="background:{bg}">
          <td style="padding:7px 12px 7px 0;color:#374151">{location}</td>
          <td style="padding:7px 6px;text-align:right;font-weight:600;color:#111827">{fmt_lkr(c.get('price_lkr'))}</td>
          <td style="padding:7px 6px;text-align:right;color:#4b5563">{size}</td>
          <td style="padding:7px 6px;text-align:right;color:#4b5563">{beds}</td>
          <td style="padding:7px 6px;text-align:right;color:#4b5563">{dom}</td>
          <td style="padding:7px 6px;text-align:right;color:#4b5563">{sim}</td>
        </tr>"""

    per_perch = data.get("median_price_per_perch")
    per_sqft = data.get("median_price_per_sqft")
    unit_prices = ""
    if per_perch or per_sqft:
        unit_prices = '<div style="border-top:1px solid #e5e7eb;padding-top:10px;display:flex;gap:32px;font-size:12px;color:#4b5563;margin-top:10px">'
        if per_perch:
            unit_prices += f'<p>Per perch: <strong style="color:#111827">{fmt_lkr(per_perch)}</strong></p>'
        if per_sqft:
            unit_prices += f'<p>Per sqft: <strong style="color:#111827">{fmt_lkr(per_sqft)}</strong></p>'
        unit_prices += "</div>"

    conf_reason = data.get("confidence_reason", "")
    conf_reason_html = f'<p style="font-size:11px;color:#6b7280;margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;line-height:1.6">{conf_reason}</p>' if conf_reason else ""

    count = data.get("comparable_count", 0)
    dist_label = f"in {district} District" if district else "across Sri Lanka"
    value_label = "Estimated Monthly Rent" if listing_type == "rent" else "Estimated Asking Value"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>PropertyLK Market Intelligence Report</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; color: #111827; }}
  @page {{ size: A4; margin: 18mm 15mm; }}
</style>
</head>
<body>
<div style="max-width:720px;margin:0 auto;padding:40px 40px 60px">

  <!-- Header -->
  <header style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:36px;padding-bottom:20px;border-bottom:2px solid #111827">
    <div>
      <p style="font-size:9px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px">Ardeno Studio</p>
      <h1 style="font-size:22px;font-weight:700;color:#111827;line-height:1.2">Property Market Intelligence Report</h1>
    </div>
    <div style="text-align:right;flex-shrink:0;margin-left:24px">
      <p style="font-size:9px;text-transform:uppercase;letter-spacing:0.15em;color:#9ca3af">Ref</p>
      <p style="font-size:13px;font-family:monospace;font-weight:700;color:#374151">{ref_id}</p>
      <p style="font-size:11px;color:#9ca3af;margin-top:4px">{today}</p>
    </div>
  </header>

  <!-- Subject property -->
  <section style="margin-bottom:28px">
    <p style="font-size:9px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Subject Property</p>
    <p style="font-size:15px;color:#1f2937;font-weight:500">{subject_line}</p>
  </section>

  <!-- Market value estimate -->
  <section style="margin-bottom:28px;border-radius:12px;border:1px solid #e5e7eb;background:#f9fafb;padding:24px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px">
      <div>
        <p style="font-size:9px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px">{value_label}</p>
        <p style="font-size:11px;color:#6b7280">Based on {count} comparable listing{"s" if count != 1 else ""} {dist_label}</p>
      </div>
      <span style="font-size:11px;font-weight:600;padding:4px 12px;border-radius:9999px;background:{conf_bg};color:{conf_colour};text-transform:capitalize">{confidence} confidence</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="text-align:center;padding:16px;border-radius:8px;background:white;border:1px solid #e5e7eb">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:4px">Low (P25)</p>
        <p style="font-size:16px;font-weight:700;color:#111827">{fmt_lkr(data.get("estimated_low"))}</p>
      </div>
      <div style="text-align:center;padding:16px;border-radius:8px;background:white;border:2px solid #111827">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:4px">Median (P50)</p>
        <p style="font-size:20px;font-weight:700;color:#111827">{fmt_lkr(data.get("estimated_median"))}</p>
      </div>
      <div style="text-align:center;padding:16px;border-radius:8px;background:white;border:1px solid #e5e7eb">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:4px">High (P75)</p>
        <p style="font-size:16px;font-weight:700;color:#111827">{fmt_lkr(data.get("estimated_high"))}</p>
      </div>
    </div>
    {unit_prices}
    {conf_reason_html}
  </section>

  <!-- Comparables table -->
  <section style="margin-bottom:28px">
    <p style="font-size:9px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#9ca3af;margin-bottom:10px">Comparable Listings</p>
    <table style="width:100%;font-size:12px;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:2px solid #111827">
          <th style="padding:8px 12px 8px 0;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;font-weight:600">Location</th>
          <th style="padding:8px 6px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;font-weight:600">Price</th>
          <th style="padding:8px 6px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;font-weight:600">Size</th>
          <th style="padding:8px 6px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;font-weight:600">Beds</th>
          <th style="padding:8px 6px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;font-weight:600">Days Listed</th>
          <th style="padding:8px 6px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;font-weight:600">Match</th>
        </tr>
      </thead>
      <tbody>
        {comparables_rows}
      </tbody>
    </table>
  </section>

  <!-- Methodology -->
  <section style="margin-bottom:16px;padding:14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
    <p style="font-size:9px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Methodology</p>
    <p style="font-size:11px;color:#4b5563;line-height:1.6">
      Price ranges are derived from ranked comparable listings sourced from OnlineProperty.lk, Ikman.lk, and Lamudi.lk.
      Comparables are filtered by property type, district, and size, then scored by similarity. P25, P50, and P75
      represent the 25th percentile, median, and 75th percentile of asking prices in the matched set.
      All prices reflect current or recently active market listings, not transacted sale prices.
    </p>
  </section>

  <!-- Disclaimer -->
  <section style="margin-bottom:36px;padding:14px;border:1px solid #e5e7eb;border-radius:8px">
    <p style="font-size:9px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px">Disclaimer</p>
    <p style="font-size:11px;color:#6b7280;line-height:1.6">
      This report is produced from publicly available listing data and is intended as a market reference tool only.
      It does not constitute a formal valuation under Sri Lankan law and should not be used as a substitute for a
      valuation by a registered member of the Institute of Valuers of Sri Lanka. Ardeno Studio accepts no liability
      for decisions made on the basis of this report. Asking prices may differ materially from transacted values.
    </p>
  </section>

  <!-- Footer -->
  <footer style="border-top:1px solid #e5e7eb;padding-top:18px;display:flex;align-items:flex-start;justify-content:space-between">
    <div>
      <p style="font-size:12px;font-weight:700;color:#1f2937">Ardeno Studio</p>
      <p style="font-size:11px;color:#9ca3af">ardeno-studio-website.vercel.app</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:11px;color:#6b7280">karunaratneovindu@gmail.com</p>
      <p style="font-size:11px;color:#6b7280">076 248 5456</p>
    </div>
  </footer>

</div>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser(description="Generate a PropertyLK PDF report")
    parser.add_argument("--output", default="docs/phase0/samples/seanika_colombo_house_sample.pdf")
    parser.add_argument("--district", default="Colombo")
    parser.add_argument("--type", dest="property_type", default="house")
    parser.add_argument("--listing-type", default="sale")
    parser.add_argument("--size-perches", type=float, default=None)
    parser.add_argument("--size-sqft", type=float, default=None)
    parser.add_argument("--bedrooms", type=int, default=None)
    args = parser.parse_args()

    print(f"Calling API: {API_URL}")
    data = fetch_estimate(
        district=args.district,
        property_type=args.property_type,
        listing_type=args.listing_type,
        size_perches=args.size_perches,
        size_sqft=args.size_sqft,
        bedrooms=args.bedrooms,
    )
    print(f"  Confidence: {data.get('confidence')}  Comparables: {data.get('comparable_count')}")
    print(f"  Low: {fmt_lkr(data.get('estimated_low'))}  Median: {fmt_lkr(data.get('estimated_median'))}  High: {fmt_lkr(data.get('estimated_high'))}")

    html = build_html(
        data=data,
        district=args.district,
        property_type=args.property_type,
        listing_type=args.listing_type,
        size_perches=args.size_perches,
        size_sqft=args.size_sqft,
        bedrooms=args.bedrooms,
    )

    out_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle")
        page.pdf(
            path=out_path,
            format="A4",
            margin={"top": "18mm", "bottom": "18mm", "left": "15mm", "right": "15mm"},
            print_background=True,
        )
        browser.close()

    print(f"\nPDF saved: {out_path}")
    return out_path


if __name__ == "__main__":
    main()
