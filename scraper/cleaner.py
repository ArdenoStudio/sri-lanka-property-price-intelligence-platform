import re
import structlog
from typing import Dict, Optional, Tuple
from db.models import RawListing, Listing
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

log = structlog.get_logger()

# Hardcoded mapping of common SL location strings -> district
# This is a representative sample, normally this would be a larger dictionary or a separate JSON
LOCATION_DISTRICT_MAP = {
    "Nugegoda": "Colombo",
    "Mafahpitiya": "Colombo",
    "Mount Lavinia": "Colombo",
    "Dehiwala": "Colombo",
    "Rajagiriya": "Colombo",
    "Battaramulla": "Colombo",
    "Kotte": "Colombo",
    "Malabe": "Colombo",
    "Ratmalana": "Colombo",
    "Moratuwa": "Colombo",
    "Piliyandala": "Colombo",
    "Maharagama": "Colombo",
    "Homagama": "Colombo",
    "Kaduwela": "Colombo",
    "Athurugiriya": "Colombo",
    "Wattegama": "Kandy",
    "Peradeniya": "Kandy",
    "Katugastota": "Kandy",
    "Gampola": "Kandy",
    "Digana": "Kandy",
    "Kundasale": "Kandy",
    "Katugastota": "Kandy",
    "Kandy": "Kandy",
    "Gampaha": "Gampaha",
    "Negombo": "Gampaha",
    "Kelaniya": "Gampaha",
    "Wattala": "Gampaha",
    "Ja-Ela": "Gampaha",
    "Kiribathgoda": "Gampaha",
    "Kadawatha": "Gampaha",
    "Ragama": "Gampaha",
    "Biyagama": "Gampaha",
    "Galle": "Galle",
    "Hikkaduwa": "Galle",
    "Ambalangoda": "Galle",
    "Matara": "Matara",
    "Weligama": "Matara",
    "Kurunegala": "Kurunegala",
    "Kuliyapitiya": "Kurunegala",
    "Jaffna": "Jaffna",
    "Trincomalee": "Trincomalee",
    "Batticaloa": "Batticaloa",
    "Anuradhapura": "Anuradhapura",
    "Polonnaruwa": "Polonnaruwa",
    "Ratnapura": "Ratnapura",
    "Badulla": "Badulla",
    "Bandarawela": "Badulla",
    "Kalutara": "Kalutara",
    "Panadura": "Kalutara",
    "Horana": "Kalutara",
    "Puttalam": "Puttalam",
    "Chilaw": "Puttalam",
    "Kegalle": "Kegalle",
    "Vavuniya": "Vavuniya",
    "Mannar": "Mannar",
    "Mullaitivu": "Mullaitivu",
    "Kilinochchi": "Kilinochchi",
    "Ampara": "Ampara",
    "Moneragala": "Moneragala",
    "Hambantota": "Hambantota",
    "Tangalle": "Hambantota",
    "Nuwara Eliya": "Nuwara Eliya",
    "Matale": "Matale",
    "Dambulla": "Matale",
}

class DataCleaner:
    def __init__(self, db: Session):
        self.db = db

    def parse_price(self, raw_price: str) -> Tuple[Optional[float], Optional[float]]:
        """Parses raw_price string to numeric LKR. Returns (total_price, price_per_unit)"""
        if not raw_price or "Negotiable" in raw_price:
            return None, None

        # Clean string
        clean_str = raw_price.replace("Rs.", "").replace("LKR", "").replace(",", "").strip()
        
        # Handle "Million" / "Mn"
        multiplier = 1.0
        if "Million" in clean_str:
            multiplier = 1_000_000.0
            clean_str = clean_str.replace("Million", "").strip()
        elif "Mn" in clean_str:
            multiplier = 1_000_000.0
            clean_str = clean_str.replace("Mn", "").strip()

        # Check for per unit rates
        price_per_unit = None
        if "per perch" in clean_str.lower():
            val_match = re.findall(r"(\d+\.?\d*)", clean_str)
            if val_match:
                price_per_unit = float(val_match[0]) * multiplier
                # If it's just a per perch rate, total price is unknown yet
                return None, price_per_unit
        
        # Extract numeric value
        match = re.search(r"(\d+\.?\d*)", clean_str)
        if match:
            return float(match.group(1)) * multiplier, price_per_unit
        
        return None, None

    def parse_size(self, raw_size: str, title: str = "") -> Tuple[Optional[float], Optional[float]]:
        """Parses size from raw_size or title. Returns (perches, sqft)"""
        text_to_search = (str(raw_size or "") + " " + str(title or "")).lower().strip()
        if not text_to_search:
            return None, None
        
        # Acres to Perches (1 acre = 160 perches)
        if "acre" in text_to_search:
            match = re.search(r"(\d+\.?\d*)\s*acre", text_to_search)
            if match:
                return float(match.group(1)) * 160.0, None
        
        # Perches (handle "perch", "perches", "p")
        # Regex to find numbers followed by "perch", "perches", or just "p" at the end of a word
        p_match = re.search(r"(\d+\.?\d*)\s*(?:perch|perches|p\b)", text_to_search)
        if p_match:
            return float(p_match.group(1)), None
        
        # Sqft
        if "sq ft" in text_to_search or "sqft" in text_to_search:
            match = re.search(r"(\d+\.?\d*)", text_to_search)
            if match:
                return None, float(match.group(1))
        
        return None, None

    def parse_location(self, raw_location: str, title: str = "") -> Tuple[Optional[str], Optional[str], str]:
        """Parses location to (district, city, confidence)"""
        text_to_search = (str(raw_location or "") + " " + str(title or "")).lower()
        if not text_to_search:
            return None, None, 'low'
        
        parts = [p.strip() for p in (raw_location or "").split(',')]
        city = parts[0] if parts else None
        district = None
        confidence = 'low'

        # Check in map
        for loc, dist in LOCATION_DISTRICT_MAP.items():
            if loc.lower() in text_to_search:
                district = dist
                confidence = 'high'
                break
        
        # If not in map, but has comma, the last part might be district
        if not district and len(parts) > 1:
            district = parts[-1]
            confidence = 'medium'
        
        return district, city, confidence

    def detect_outliers(self, listing: Listing):
        """Flags listing as outlier if price/size are suspicious"""
        reasons = []
        if listing.price_lkr:
            if listing.price_lkr < 100_000:
                reasons.append("Price too low (<100K LKR)")
            if listing.price_lkr > 2_000_000_000:
                reasons.append("Price too high (>2B LKR)")
        
        if listing.price_per_perch:
            if listing.price_per_perch > 50_000_000:
                reasons.append("Price per perch too high (>50M)")
            if listing.price_per_perch < 10_000:
                reasons.append("Price per perch too low (<10K)")
        
        if listing.size_perches and listing.size_perches > 10_000:
            reasons.append("Size too large (>10000 perches)")
            
        if reasons:
            listing.is_outlier = True
            listing.outlier_reason = "; ".join(reasons)

    def detect_duplicates(self, listing: Listing) -> bool:
        """Checks for duplicates based on price, location, size within 7 days"""
        if not listing.price_lkr or not listing.raw_location:
            return False
        
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        
        existing = self.db.query(Listing).filter(
            Listing.price_lkr == listing.price_lkr,
            Listing.raw_location == listing.raw_location,
            Listing.scraped_at >= seven_days_ago,
            Listing.source_id != listing.source_id
        ).first()

        if existing:
            listing.is_duplicate = True
            listing.duplicate_of = existing.id
            return True
        return False

    def process_all(self, limit: int = 500):
        """Processes a batch of unprocessed raw_listings to avoid memory issues."""
        raw_listings = self.db.query(RawListing).filter(RawListing.is_processed == False).limit(limit).all()
        
        stats = {"processed": 0, "passed": 0, "outliers": 0, "duplicates": 0}
        
        for raw in raw_listings:
            try:
                # 1. Basic Cleaning
                price_lkr, price_per_perch = self.parse_price(raw.raw_price)
                size_perches, size_sqft = self.parse_size(raw.raw_size, raw.title)
                district, city, confidence = self.parse_location(raw.raw_location, raw.title)
                
                # If we only got price_per_perch but have size, compute total
                if not price_lkr and price_per_perch and size_perches:
                    price_lkr = price_per_perch * size_perches
                # If we have total and size, compute per perch
                elif price_lkr and not price_per_perch and size_perches:
                    price_per_perch = price_lkr / size_perches

                # 2. Create Listing
                listing = Listing(
                    raw_id=raw.id,
                    source=raw.source,
                    source_id=raw.source_id,
                    scraped_at=raw.scraped_at,
                    price_lkr=price_lkr,
                    price_per_perch=price_per_perch,
                    price_per_sqft=None,
                    raw_location=raw.raw_location,
                    district=district,
                    city=city,
                    geocode_confidence=confidence,
                    property_type=raw.property_type,
                    listing_type=raw.listing_type,
                    size_perches=size_perches,
                    size_sqft=size_sqft
                )
                
                self.detect_outliers(listing)
                if listing.is_outlier: stats["outliers"] += 1
                
                if not self.detect_duplicates(listing):
                    self.db.add(listing)
                    stats["passed"] += 1
                else:
                    stats["duplicates"] += 1
                
                raw.is_processed = True
                
            except Exception as e:
                log.error("clean_error", raw_id=raw.id, error=str(e))
            
            stats["processed"] += 1
        
        self.db.commit()
        log.info("clean_complete", **stats)
        return stats
