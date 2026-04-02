import time
import os
import structlog
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
from sqlalchemy.orm import Session
from db.models import Listing
from dotenv import load_dotenv

load_dotenv()

log = structlog.get_logger()

class Geocoder:
    def __init__(self, db: Session):
        self.db = db
        self.user_agent = os.getenv("NOMINATIM_USER_AGENT", "nilam-geocoder/1.0")
        self.geolocator = Nominatim(user_agent=self.user_agent)
        # Rate limit to 1 request per second
        self.geocode_service = RateLimiter(self.geolocator.geocode, min_delay_seconds=1.1)
        self.cache = {} # Local dict cache keyed by "city, district"

    def geocode_listings(self):
        """Geocodes listings where lat IS NULL and geocode_confidence != 'low'"""
        listings = self.db.query(Listing).filter(
            Listing.lat == None,
            Listing.geocode_confidence != 'low',
            Listing.city != None
        ).all()

        stats = {"total": len(listings), "cache_hits": 0, "api_calls": 0, "failures": 0}

        for listing in listings:
            query_parts = []
            if listing.city: query_parts.append(listing.city)
            if listing.district: query_parts.append(listing.district)
            query_parts.append("Sri Lanka")
            
            cache_key = ", ".join([listing.city or "", listing.district or ""]).lower()
            
            location = None
            if cache_key in self.cache:
                location = self.cache[cache_key]
                stats["cache_hits"] += 1
            else:
                try:
                    query = ", ".join(query_parts)
                    log.info("geocoding_query", query=query)
                    location = self.geocode_service(query)
                    self.cache[cache_key] = location
                    stats["api_calls"] += 1
                except Exception as e:
                    log.error("geocoding_error", query=query, error=str(e))
                    stats["failures"] += 1
                    continue
            
            if location:
                listing.lat = location.latitude
                listing.lng = location.longitude
                # Keep confidence as 'high' or 'medium' as set by cleaner
            else:
                listing.geocode_confidence = 'low'
                stats["failures"] += 1
            
            # Commit every 10 for safety
            if stats["api_calls"] % 10 == 0:
                self.db.commit()

        self.db.commit()
        log.info("geocoding_complete", **stats)
        return stats
