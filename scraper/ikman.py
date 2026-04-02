import asyncio
import random
import re
from datetime import datetime
from playwright.async_api import async_playwright
import structlog
from db.models import RawListing
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

log = structlog.get_logger()

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15"
]

class IkmanScraper:
    SOURCE = "ikman"
    BASE_URL = "https://ikman.lk/en/ads/sri-lanka/property?sort=date&order=desc&buy_now=0&urgent=0&page="

    def __init__(self, db: Session):
        self.db = db

    async def scrape(self, max_pages: int = 50):
        import os
        from urllib.parse import urlparse

        proxy_url = os.getenv("PROXY_URL")
        proxy_settings = None
        if proxy_url:
            parsed = urlparse(proxy_url)
            proxy_settings = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
            if parsed.username:
                proxy_settings["username"] = parsed.username
            if parsed.password:
                proxy_settings["password"] = parsed.password

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, proxy=proxy_settings)
            context = await browser.new_context(user_agent=random.choice(USER_AGENTS))
            page = await context.new_page()

            # Extreme performance boost: Block all images, videos, fonts, and CSS from loading
            await page.route("**/*", lambda route: route.abort() if route.request.resource_type in ["image", "media", "stylesheet", "font"] else route.continue_())

            total_found = 0
            total_new = 0

            for page_num in range(1, max_pages + 1):
                url = f"{self.BASE_URL}{page_num}"
                log.info("scraping_page", source=self.SOURCE, page=page_num, url=url)

                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)

                    # Close any overlay/ad popup if present
                    try:
                        close_btn = page.locator("button[aria-label='Close'], .close-button, [data-testid='close-button']")
                        if await close_btn.count() > 0:
                            await close_btn.first.click(timeout=3000)
                    except Exception:
                        pass

                    # Wait for listing links (current Ikman selector)
                    await page.wait_for_selector("a.gtm-ad-item", timeout=15000)

                    # Get all listing anchors
                    listings = await page.query_selector_all("a.gtm-ad-item")
                    if not listings:
                        log.warning("no_listings_found", source=self.SOURCE, page=page_num)
                        break

                    page_listings_count = 0
                    page_new_count = 0

                    for listing in listings:
                        try:
                            listing_url = await listing.get_attribute("href") or ""
                            if not listing_url.startswith("http"):
                                listing_url = f"https://ikman.lk{listing_url}"

                            # Extract ID from URL path e.g. "/en/ad/land-nugegoda-4523123"
                            id_match = re.search(r"-(\d+)$", listing_url.rstrip("/"))
                            source_id = id_match.group(1) if id_match else listing_url.split("/")[-1]

                            # Title from h2 inside the link
                            title_elem = await listing.query_selector("h2")
                            title = (await title_elem.inner_text()).strip() if title_elem else ""

                            # Price: find span/div containing "Rs" text
                            price_elem = await listing.query_selector("[class*='price'], [class*='Price']")
                            raw_price = (await price_elem.inner_text()).strip() if price_elem else ""

                            # Location + Category combined in one div typically
                            loc_elems = await listing.query_selector_all("[class*='location'], [class*='Location']")
                            raw_location = ""
                            if loc_elems:
                                raw_location = (await loc_elems[0].inner_text()).strip()

                            # Category / meta info
                            cat_elems = await listing.query_selector_all("[class*='category'], [class*='Category'], [class*='tag'], [class*='Tag']")
                            raw_meta = ""
                            if cat_elems:
                                raw_meta = (await cat_elems[0].inner_text()).strip()

                            # Property type inference
                            combined = (title + " " + raw_meta).lower()
                            property_type = 'land'
                            if 'house' in combined:
                                property_type = 'house'
                            elif 'apartment' in combined or 'flat' in combined:
                                property_type = 'apartment'
                            elif 'commercial' in combined:
                                property_type = 'commercial'

                            listing_type = 'sale'
                            if 'rent' in combined or 'lease' in combined:
                                listing_type = 'rent'

                            if not title and not raw_price:
                                continue  # Skip empty cards

                            stmt = insert(RawListing).values(
                                source=self.SOURCE,
                                source_id=source_id,
                                url=listing_url,
                                title=title,
                                raw_price=raw_price,
                                raw_location=raw_location,
                                raw_size=raw_meta,
                                property_type=property_type,
                                listing_type=listing_type,
                                raw_json={"full_meta": raw_meta},
                                scraped_at=datetime.utcnow()
                            ).on_conflict_do_nothing()

                            res = self.db.execute(stmt)
                            if res.rowcount > 0:
                                page_new_count += 1
                                total_new += 1

                            page_listings_count += 1
                            total_found += 1

                        except Exception as e:
                            log.error("listing_parse_error", source=self.SOURCE, error=str(e))

                    # Batch commit all 25 rows together to completely remove DB lag!
                    self.db.commit()

                    log.info("page_complete", source=self.SOURCE, page=page_num, found=page_listings_count, new=page_new_count)

                    if page_listings_count == 0:
                        log.info("no_new_listings_stopping", source=self.SOURCE)
                        break

                    # Random delay to be polite
                    await asyncio.sleep(random.uniform(1, 2.5))

                except Exception as e:
                    log.error("page_load_error", source=self.SOURCE, page=page_num, error=str(e))
                    await asyncio.sleep(1)  # brief pause before next page

            await browser.close()
            return total_found, total_new

async def scrape_ikman(db: Session, max_pages: int = 20):
    scraper = IkmanScraper(db)
    return await scraper.scrape(max_pages=max_pages)
