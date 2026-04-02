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
    SALES_URL = "https://www.lankapropertyweb.com/property-for-sale/?sort=latest&page="
    LAND_URL = "https://www.lankapropertyweb.com/land-for-sale/?sort=latest&page="

    def __init__(self, db: Session):
        self.db = db

    async def scrape(self, max_pages: int = 20):
        import os
        headers = {"User-Agent": random.choice(USER_AGENTS)}
        total_found = 0
        total_new = 0

        proxy_url = os.getenv("PROXY_URL")
        proxies = {"http://": proxy_url, "https://": proxy_url} if proxy_url else None

        async with httpx.AsyncClient(headers=headers, timeout=30.0, proxies=proxies) as client:
            for base_url in [self.SALES_URL, self.LAND_URL]:
                for page_num in range(1, max_pages + 1):
                    url = f"{base_url}{page_num}"
                    log.info("scraping_page", source=self.SOURCE, url=url)

                    try:
                        resp = await client.get(url)
                        if resp.status_code != 200:
                            log.warning("http_blocked", status=resp.status_code, url=url)
                            # Fallback to playwright could be added here
                            break
                        
                        soup = BeautifulSoup(resp.text, "html.parser")
                        cards = soup.select(".cl-listing-ads, .property-listing-row")
                        
                        if not cards:
                            log.warning("no_cards_found", source=self.SOURCE, url=url)
                            break
                        
                        new_on_page = 0
                        for card in cards:
                            try:
                                # Extract data from card
                                title_elem = card.select_one(".cl-listing-desc-title, .listing-title")
                                title = title_elem.text.strip() if title_elem else ""
                                
                                anchor = card.select_one("a")
                                url_path = anchor['href'] if anchor else ""
                                listing_url = url_path if url_path.startswith("http") else f"https://www.lankapropertyweb.com{url_path}"
                                
                                source_id_match = re.search(r"/(\d+)\.html", url_path)
                                if not source_id_match:
                                    source_id_match = re.search(r"-(\d+)$", url_path.rstrip("/"))
                                
                                source_id = source_id_match.group(1) if source_id_match else url_path.split("/")[-1]

                                price_elem = card.select_one(".cl-listing-price, .price")
                                raw_price = price_elem.text.strip() if price_elem else ""

                                loc_elem = card.select_one(".cl-listing-location, .location")
                                raw_location = loc_elem.text.strip() if loc_elem else ""

                                size_elem = card.select_one(".cl-listing-land-size, .land-size")
                                raw_size = size_elem.text.strip() if size_elem else ""

                                # Type inference
                                property_type = 'house'
                                if 'land' in base_url: property_type = 'land'
                                elif 'apartment' in title.lower(): property_type = 'apartment'

                                stmt = insert(RawListing).values(
                                    source=self.SOURCE,
                                    source_id=source_id,
                                    url=listing_url,
                                    title=title,
                                    raw_price=raw_price,
                                    raw_location=raw_location,
                                    raw_size=raw_size,
                                    property_type=property_type,
                                    listing_type='sale',
                                    scraped_at=datetime.utcnow()
                                ).on_conflict_do_nothing()

                                res = self.db.execute(stmt)
                                if res.rowcount > 0:
                                    new_on_page += 1
                                    total_new += 1
                                total_found += 1

                            except Exception as e:
                                log.error("card_parse_error", source=self.SOURCE, error=str(e))
                        
                        log.info("page_complete", source=self.SOURCE, page=page_num, new=new_on_page)
                        
                        # Stop if old (approximate for LPW)
                        date_elem = soup.select_one(".cl-listing-date, .date")
                        if date_elem and ("3 days" in date_elem.text or "ago" in date_elem.text and "3d" in date_elem.text):
                             log.info("reached_date_limit", source=self.SOURCE)
                             break

                        await asyncio.sleep(random.uniform(3, 7))

                    except Exception as e:
                        log.error("page_request_error", source=self.SOURCE, url=url, error=str(e))
        
        return total_found, total_new

async def scrape_lpw(db: Session):
    scraper = LPWScraper(db)
    return await scraper.scrape(max_pages=20)
