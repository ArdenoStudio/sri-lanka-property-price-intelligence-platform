"""
Opens a visible browser to ikman.lk so you can solve the Cloudflare challenge.
Once you're past it, press Enter in this terminal and the cookies will be saved
to ikman_auth_state.json — the catchup runner will reuse them automatically.
"""
import asyncio
import os
import sys

root = r"C:\Users\Ovindu\Documents\Ardeno Studio\Property Price Intelligence An Ardeno Production"
sys.path.insert(0, root)

from playwright.async_api import async_playwright

STATE_FILE = os.path.join(root, "ikman_auth_state.json")

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized",
            ],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport=None,  # use maximized window size
            locale="en-US",
        )
        await context.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
        )

        page = await context.new_page()
        await page.goto(
            "https://ikman.lk/en/ads/sri-lanka/property?sort=date&order=desc&buy_now=0&urgent=0&page=1",
            wait_until="domcontentloaded",
            timeout=60000,
        )

        print("\nBrowser is open — solve the Cloudflare challenge in the window.")
        print("This script will detect when you're past it and save cookies automatically.\n")

        # Poll until we see actual listing cards (challenge solved)
        for _ in range(120):  # wait up to 2 minutes
            await asyncio.sleep(1)
            try:
                # ikman listing cards have data-testid="listing-card" or similar
                cards = await page.query_selector_all(
                    "[data-testid='listing-card'], .listing--list-item, ul.items--list > li"
                )
                if cards:
                    print(f"Challenge passed — {len(cards)} listings detected. Saving cookies...")
                    break
                # Also check if the URL moved away from the challenge
                url = page.url
                if "challenges.cloudflare.com" not in url and "ikman.lk" in url:
                    content = await page.content()
                    if "listing" in content.lower() and "cloudflare" not in content.lower():
                        print("Challenge passed (content check). Saving cookies...")
                        break
            except Exception:
                pass
        else:
            print("Timed out waiting. Saving whatever state we have...")

        await context.storage_state(path=STATE_FILE)
        print(f"Cookies saved to: {STATE_FILE}")
        print("Run _ikman_catchup_runner.py to start the scrape.")
        await asyncio.sleep(3)
        await browser.close()

asyncio.run(main())
