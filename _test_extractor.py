"""Quick test: run _extract_ikman against a live URL and print what we get."""
import asyncio
import json
import sys
import os

root = r"C:\Users\Ovindu\Documents\Ardeno Studio\Property Price Intelligence An Ardeno Production"
sys.path.insert(0, root)

from playwright.async_api import async_playwright
from scraper.detail_enricher import _extract_ikman

TEST_URL = "https://ikman.lk/en/ad/land-for-sale-in-kurunegala-for-sale-kurunegala-5621"

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        await context.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
        )
        page = await context.new_page()

        print(f"Fetching: {TEST_URL}")
        resp = await page.goto(TEST_URL, wait_until="domcontentloaded", timeout=30000)
        print(f"Status: {resp.status if resp else 'none'}")

        # Check for __NEXT_DATA__
        next_el = await page.query_selector("#__NEXT_DATA__")
        if next_el:
            raw = await next_el.inner_text()
            data = json.loads(raw)
            ad = (data.get("props", {}).get("pageProps", {}).get("ad") or
                  data.get("props", {}).get("pageProps", {}).get("adData") or {})
            print(f"\n__NEXT_DATA__ found. Top-level pageProps keys: {list(data.get('props',{}).get('pageProps',{}).keys())}")
            if ad:
                print(f"ad keys: {list(ad.keys())}")
                print(f"attributes sample: {ad.get('attributes', [])[:3]}")
            else:
                print("No 'ad' or 'adData' key found in pageProps")
                # Print full pageProps structure
                pp = data.get("props", {}).get("pageProps", {})
                print(f"pageProps keys: {list(pp.keys())}")
        else:
            print("\nNo #__NEXT_DATA__ found on page")
            # Check page content snippet
            content = await page.content()
            print(f"Page content snippet (first 500 chars):\n{content[:500]}")

        # Dump full page HTML to file for inspection
        content = await page.content()
        with open(os.path.join(root, "_ikman_page_dump.html"), "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Full HTML saved to _ikman_page_dump.html ({len(content)} chars)")

        # Try to find attribute-like elements
        print("\n--- Probing selectors ---")
        probes = [
            "[data-qa='ad-attributes'] li",
            "[class*='attributes'] li",
            "[class*='KeyInformation'] li",
            "[class*='attribute'] li",
            "[class*='detail'] li",
            "ul li",
            "table tr",
            "[class*='info'] li",
            "dl dt",
            ".item--detail",
            "[class*='spec']",
        ]
        for sel in probes:
            els = await page.query_selector_all(sel)
            if els:
                texts = []
                for el in els[:5]:
                    t = (await el.inner_text()).strip().replace("\n", " ")[:80]
                    if t:
                        texts.append(t)
                if texts:
                    print(f"  {sel}: {texts}")

        print("\n--- _extract_ikman result ---")
        attrs = await _extract_ikman(page)
        print(json.dumps(attrs, indent=2, default=str))

        await browser.close()

asyncio.run(main())
