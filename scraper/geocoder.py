import time
import os
import structlog
from datetime import datetime
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
from sqlalchemy.orm import Session
from sqlalchemy import or_
from db.models import Listing, Location
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

    def _normalize_location_key(self, city, district):
        def norm(value):
            if not value:
                return ""
            return " ".join(str(value).strip().lower().split())
        city_n = norm(city)
        district_n = norm(district)
        if not city_n and not district_n:
            return None
        return f"{city_n}|{district_n}"

    def _ensure_location_for_listing(self, listing: Listing) -> Location:
        key = self._normalize_location_key(listing.city, listing.district)
        if not key:
            return None
        location = self.db.query(Location).filter(Location.normalized_key == key).first()
        if not location:
            location = Location(
                normalized_key=key,
                district=listing.district,
                city=listing.city,
                confidence=listing.geocode_confidence,
                source="geocoder",
            )
            self.db.add(location)
            self.db.flush()
        listing.location_id = location.id
        if location.lat and location.lng:
            listing.lat = location.lat
            listing.lng = location.lng
        return location

    def geocode_listings(self):
        """Geocodes listings where lat IS NULL and geocode_confidence != 'low'"""
        listings = self.db.query(Listing).filter(
            Listing.lat == None,
            or_(Listing.geocode_confidence == None, Listing.geocode_confidence != 'low'),
            Listing.city != None
        ).all()

        stats = {"total": len(listings), "cache_hits": 0, "api_calls": 0, "failures": 0}

        # Ensure listings are linked to normalized locations first
        for listing in listings:
            self._ensure_location_for_listing(listing)
        self.db.commit()

        locations = self.db.query(Location).filter(
            Location.lat == None,
            or_(Location.confidence == None, Location.confidence != 'low')
        ).all()

        if locations:
            stats["total"] = len(locations)

        for loc in locations:
            query_parts = []
            if loc.city: query_parts.append(loc.city)
            if loc.district: query_parts.append(loc.district)
            query_parts.append("Sri Lanka")
            
            cache_key = ", ".join([loc.city or "", loc.district or ""]).lower()
            
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
                loc.lat = location.latitude
                loc.lng = location.longitude
                loc.updated_at = datetime.utcnow()
                # Update all listings linked to this location
                for l in self.db.query(Listing).filter(Listing.location_id == loc.id).all():
                    l.lat = loc.lat
                    l.lng = loc.lng
            else:
                loc.confidence = 'low'
                stats["failures"] += 1
            
            # Commit every 10 for safety
            if stats["api_calls"] % 10 == 0:
                self.db.commit()

        self.db.commit()
        log.info("geocoding_complete", **stats)
        return stats
