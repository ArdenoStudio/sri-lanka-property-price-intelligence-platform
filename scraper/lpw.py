import asyncio
import random
import re
from datetime import datetime
import structlog
from db.models import RawListing
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert

log = structlog.get_logger()

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

BASE = "https://www.lankapropertyweb.com"

# Updated URL structure after LPW site redesign (Apr 2026)
# Old: /property-for-sale/?page=N  →  New: /sale/index.php?page=N
BASE_URLS = [
    {"url": f"{BASE}/sale/index.php",                  "type": "house",     "listing_type": "sale"},
    {"url": f"{BASE}/land/index.php",                  "type": "land",      "listing_type": "sale"},
    {"url": f"{BASE}/rentals/index.php",               "type": "house",     "listing_type": "rent"},
    {"url": f"{BASE}/forsale-all-Apartment.html",      "type": "apartment", "listing_type": "sale"},
]


class LPWScraper:
    SOURCE = "lpw"

    def __init__(self, db: Session):
        self.db = db

    async def scrape(self, max_pages: int = 15, location: str = "sri-lanka"):
        import os
        from urllib.parse import urlparse
        from playwright.async_api import async_playwright

        proxy_url = os.getenv("PROXY_URL")
        proxy_settings = None
        if proxy_url:
            parsed = urlparse(proxy_url)
            proxy_settings = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
            if parsed.username: proxy_settings["username"] = parsed.username
            if parsed.password: proxy_settings["password"] = parsed.password

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, proxy=proxy_settings)
            context = await browser.new_context(user_agent=random.choice(USER_AGENTS))
            page = await context.new_page()

            # Block heavy resources to speed things up
            await page.route("**/*", lambda route: route.abort()
                if route.request.resource_type in ["image", "media", "font", "stylesheet"]
                else route.continue_())

            total_found = 0
            total_new = 0

            for entry in BASE_URLS:
                base_url = entry["url"]
                default_type = entry["type"]
                listing_type = entry["listing_type"]

                for page_num in range(1, max_pages + 1):
                    full_url = f"{base_url}?page={page_num}"
                    log.info("scraping_lpw_page", page=page_num, url=full_url)

                    try:
                        await page.goto(full_url, wait_until="domcontentloaded", timeout=30000)
                        await page.wait_for_selector("article.listing-item", timeout=12000)

                        cards = await page.query_selector_all("article.listing-item")
                        if not cards:
                            log.warning("no_lpw_cards_found", url=full_url)
                            break

                        for card in cards:
                            try:
                                # Source ID from data attribute
                                source_id = await card.get_attribute("data-ad-id") or ""

                                # Listing URL
                                header_link = await card.query_selector("a.listing-header")
                                href = await header_link.get_attribute("href") if header_link else ""
                                listing_url = href if href.startswith("http") else f"{BASE}{href}"

                                # Title
                                title_el = await card.query_selector("h4.listing-title a, h4.listing-title")
                                title = (await title_el.inner_text()).strip() if title_el else ""

                                # Price
                                price_el = await card.query_selector(".listing-price")
                                raw_price = (await price_el.inner_text()).strip() if price_el else ""

                                # Location (city/district level)
                                loc_el = await card.query_selector(".location")
                                raw_loc = (await loc_el.inner_text()).strip() if loc_el else ""

                                # Property type override from card badge
                                type_el = await card.query_selector(".type")
                                type_text = (await type_el.inner_text()).strip().lower() if type_el else ""
                                if "apartment" in type_text or "flat" in type_text:
                                    property_type = "apartment"
                                elif "land" in type_text or "lot" in type_text:
                                    property_type = "land"
                                elif "commercial" in type_text or "office" in type_text or "shop" in type_text:
                                    property_type = "commercial"
                                else:
                                    property_type = default_type

                                # Size (perches/sqft)
                                size_el = await card.query_selector(".listing-summery li:nth-child(2) .count, li .count")
                                raw_size = (await size_el.inner_text()).strip() if size_el else ""

                                if not source_id and listing_url:
                                    m = re.search(r"(\d+)\.html", listing_url)
                                    source_id = m.group(1) if m else listing_url.split("/")[-1]

                                stmt = insert(RawListing).values(
                                    source=self.SOURCE,
                                    source_id=source_id,
                                    url=listing_url,
                                    title=title,
                                    raw_price=raw_price,
                                    raw_location=raw_loc,
                                    raw_size=raw_size,
                                    property_type=property_type,
                                    listing_type=listing_type,
                                    scraped_at=datetime.utcnow()
                                ).on_conflict_do_nothing()

                                res = self.db.execute(stmt)
                                if res.rowcount > 0:
                                    total_new += 1
                                total_found += 1

                            except Exception as e:
                                log.error("lpw_card_error", error=str(e))

                        self.db.commit()
                        log.info("lpw_page_done", page=page_num, found=total_found, new=total_new)
                        await asyncio.sleep(random.uniform(1.5, 2.5))

                    except Exception as e:
                        log.error("lpw_page_error", url=full_url, error=str(e))
                        break

            from db.models import ScrapeRun
            new_run = ScrapeRun(
                source=self.SOURCE,
                started_at=datetime.utcnow(),
                finished_at=datetime.utcnow(),
                listings_found=total_found,
                listings_new=total_new
            )
            self.db.add(new_run)
            self.db.commit()
            await browser.close()
            return total_found, total_new


async def scrape_lpw(db: Session, max_pages: int = 15, location: str = "sri-lanka"):
    scraper = LPWScraper(db)
    return await scraper.scrape(max_pages=max_pages, location=location)
