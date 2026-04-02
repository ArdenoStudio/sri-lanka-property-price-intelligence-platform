import httpx
from bs4 import BeautifulSoup
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
    # ... shortcut ...
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

            # Speed optimization: block images, media, etc.
            await page.route("**/*", lambda route: route.abort() if route.request.resource_type in ["image", "media", "font"] else route.continue_())

            total_found = 0
            total_new = 0

            # LPW has different base URLs for types
            base_urls = [
                "https://www.lankapropertyweb.com/property-for-sale/",
                "https://www.lankapropertyweb.com/land-for-sale/"
            ]

            for base in base_urls:
                # Adjust for location if any (LPW uses slug in path)
                loc_slug = location.lower().replace(" ", "-")
                if loc_slug != "sri-lanka":
                    target_url = f"{base}{loc_slug}/?sort=latest&page="
                else:
                    target_url = f"{base}?sort=latest&page="

                for page_num in range(1, max_pages + 1):
                    full_url = f"{target_url}{page_num}"
                    log.info("scraping_lpw_page", page=page_num, url=full_url)

                    try:
                        await page.goto(full_url, wait_until="domcontentloaded", timeout=30000)
                        
                        # Wait for cards
                        await page.wait_for_selector(".cl-listing-ads, .property-listing-row", timeout=10000)
                        cards = await page.query_selector_all(".cl-listing-ads, .property-listing-row")
                        
                        if not cards:
                            log.warning("no_lpw_cards_found", url=full_url)
                            break

                        for card in cards:
                            try:
                                title_elem = await card.query_selector("h3, .cl-listing-desc-title")
                                title = (await title_elem.inner_text()).strip() if title_elem else ""
                                
                                url_elem = await card.query_selector("a")
                                href = await url_elem.get_attribute("href") if url_elem else ""
                                listing_url = href if href.startswith("http") else f"https://www.lankapropertyweb.com{href}"
                                
                                # Extract ID
                                sid_match = re.search(r"(\d+)\.html$", listing_url)
                                source_id = sid_match.group(1) if sid_match else listing_url.split("/")[-1]

                                price_elem = await card.query_selector(".cl-listing-price, .price")
                                raw_price = (await price_elem.inner_text()).strip() if price_elem else ""

                                loc_elem = await card.query_selector(".cl-listing-location, .location")
                                raw_loc = (await loc_elem.inner_text()).strip() if loc_elem else ""

                                meta_elem = await card.query_selector(".cl-listing-land-size, .land-size, .cl-listing-category")
                                raw_meta = (await meta_elem.inner_text()).strip() if meta_elem else ""

                                property_type = 'house'
                                if 'land' in base: property_type = 'land'
                                elif 'apartment' in title.lower(): property_type = 'apartment'

                                stmt = insert(RawListing).values(
                                    source=self.SOURCE,
                                    source_id=source_id,
                                    url=listing_url,
                                    title=title,
                                    raw_price=raw_price,
                                    raw_location=raw_loc,
                                    raw_size=raw_meta,
                                    property_type=property_type,
                                    listing_type='sale', # Default for these URLs
                                    scraped_at=datetime.utcnow()
                                ).on_conflict_do_nothing()

                                res = self.db.execute(stmt)
                                if res.rowcount > 0:
                                    total_new += 1
                                total_found += 1

                            except Exception as e:
                                log.error("lpw_card_error", error=str(e))
                        
                        self.db.commit()
                        await asyncio.sleep(random.uniform(1, 2))

                    except Exception as e:
                        log.error("lpw_page_error", url=full_url, error=str(e))
                        break

            await browser.close()
            return total_found, total_new

async def scrape_lpw(db: Session, max_pages: int = 15, location: str = "sri-lanka"):
    scraper = LPWScraper(db)
    return await scraper.scrape(max_pages=max_pages, location=location)
