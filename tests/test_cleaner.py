import pytest
from scraper.cleaner import DataCleaner
from unittest.mock import MagicMock

@pytest.fixture
def cleaner():
    return DataCleaner(db=MagicMock())

def test_parse_price_standard(cleaner):
    total, per_unit = cleaner.parse_price("Rs. 4,500,000")
    assert total == 4500000.0
    assert per_unit is None

def test_parse_price_million(cleaner):
    total, per_unit = cleaner.parse_price("4.5 Million")
    assert total == 4500000.0

def test_parse_price_mn(cleaner):
    total, per_unit = cleaner.parse_price("2.3 Mn")
    assert total == 2300000.0

def test_parse_price_negotiable(cleaner):
    total, per_unit = cleaner.parse_price("Negotiable")
    assert total is None

def test_parse_price_per_perch(cleaner):
    total, per_unit = cleaner.parse_price("Rs. 750,000 per perch")
    assert per_unit == 750000.0

def test_parse_size_perches(cleaner):
    perches, sqft = cleaner.parse_size("12 perches")
    assert perches == 12.0
    assert sqft is None

def test_parse_size_acre(cleaner):
    perches, sqft = cleaner.parse_size("1 acre")
    assert perches == 160.0

def test_parse_size_sqft(cleaner):
    perches, sqft = cleaner.parse_size("1200 sq ft")
    assert sqft == 1200.0
    
    perches, sqft = cleaner.parse_size("2000 sqft")
    assert sqft == 2000.0

def test_location_colombo(cleaner):
    district, city, confidence = cleaner.parse_location("Nugegoda, Colombo")
    assert district == "Colombo"
    assert city == "Nugegoda"
    assert confidence == "high"

def test_location_kandy(cleaner):
    district, city, confidence = cleaner.parse_location("Kandy")
    assert district == "Kandy"
    assert confidence == "high"

def test_location_fallback(cleaner):
    district, city, confidence = cleaner.parse_location("Random Place, Kalutara")
    # Even if "Random Place" is not in map, "Kalutara" is in map or last part
    assert district == "Kalutara"
    assert city == "Random Place"

def test_outlier_too_cheap(cleaner):
    from db.models import Listing
    listing = Listing(price_lkr=50000)
    cleaner.detect_outliers(listing)
    assert listing.is_outlier == True
    assert "Price too low" in listing.outlier_reason

def test_outlier_valid_price(cleaner):
    from db.models import Listing
    listing = Listing(price_lkr=5000000)
    cleaner.detect_outliers(listing)
    assert listing.is_outlier == False
