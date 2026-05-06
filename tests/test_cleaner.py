import pytest
from scraper.cleaner import DataCleaner
from unittest.mock import MagicMock

@pytest.fixture
def cleaner():
    return DataCleaner(db=MagicMock())

# ---------------------------------------------------------------------------
# parse_price
# ---------------------------------------------------------------------------

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
    assert total is None

def test_parse_price_lkr_prefix(cleaner):
    total, per_unit = cleaner.parse_price("LKR 12,000,000")
    assert total == 12000000.0

def test_parse_price_empty(cleaner):
    total, per_unit = cleaner.parse_price("")
    assert total is None
    assert per_unit is None

def test_parse_price_m_suffix(cleaner):
    total, per_unit = cleaner.parse_price("Rs. 8M")
    assert total == 8_000_000.0

# ---------------------------------------------------------------------------
# parse_size
# ---------------------------------------------------------------------------

def test_parse_size_perches(cleaner):
    perches, sqft = cleaner.parse_size("12 perches")
    assert perches == 12.0
    assert sqft is None

def test_parse_size_acre(cleaner):
    perches, sqft = cleaner.parse_size("1 acre")
    assert perches == 160.0

def test_parse_size_sqft(cleaner):
    _, sqft = cleaner.parse_size("1200 sq ft")
    assert sqft == 1200.0

    _, sqft = cleaner.parse_size("2000 sqft")
    assert sqft == 2000.0

def test_parse_size_comma_formatted(cleaner):
    perches, _ = cleaner.parse_size("1,170.0 perches")
    assert perches == 1170.0

# ---------------------------------------------------------------------------
# parse_bedrooms
# ---------------------------------------------------------------------------

def test_parse_bedrooms_from_title(cleaner):
    assert cleaner.parse_bedrooms("3 Bedroom House for Sale") == 3

def test_parse_bedrooms_br(cleaner):
    assert cleaner.parse_bedrooms("4BR apartment") == 4

def test_parse_bedrooms_studio(cleaner):
    assert cleaner.parse_bedrooms("Studio apartment") == 1

def test_parse_bedrooms_none(cleaner):
    assert cleaner.parse_bedrooms("Bare land plot for sale") is None

def test_parse_bedrooms_bhk(cleaner):
    assert cleaner.parse_bedrooms("2BHK flat") == 2

# ---------------------------------------------------------------------------
# parse_location
# ---------------------------------------------------------------------------

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
    assert district == "Kalutara"
    assert city == "Random Place"

def test_location_empty(cleaner):
    district, city, confidence = cleaner.parse_location("")
    assert district is None
    assert city is None
    assert confidence == "low"

# ---------------------------------------------------------------------------
# detect_short_term
# ---------------------------------------------------------------------------

def test_detect_short_term_per_night(cleaner):
    assert cleaner.detect_short_term("Rs. 5000 per night", "Beach villa") is True

def test_detect_short_term_airbnb(cleaner):
    assert cleaner.detect_short_term("Rs. 3000", "Airbnb holiday home Unawatuna") is True

def test_detect_short_term_monthly_rental(cleaner):
    assert cleaner.detect_short_term("Rs. 75,000 Per Month", "3 Bedroom apartment Colombo 7") is False

# ---------------------------------------------------------------------------
# detect_outliers
# ---------------------------------------------------------------------------

def test_outlier_sale_too_cheap(cleaner):
    from db.models import Listing
    listing = Listing(price_lkr=50000, listing_type="sale")
    cleaner.detect_outliers(listing)
    assert listing.is_outlier is True
    assert "Sale price too low" in listing.outlier_reason

def test_outlier_sale_valid(cleaner):
    from db.models import Listing
    listing = Listing(price_lkr=5_000_000, listing_type="sale")
    cleaner.detect_outliers(listing)
    assert not listing.is_outlier

def test_outlier_rent_too_cheap(cleaner):
    from db.models import Listing
    listing = Listing(price_lkr=1000, listing_type="rent")
    cleaner.detect_outliers(listing)
    assert listing.is_outlier is True
    assert "Rent too low" in listing.outlier_reason

def test_outlier_rent_valid(cleaner):
    from db.models import Listing
    listing = Listing(price_lkr=75_000, listing_type="rent")
    cleaner.detect_outliers(listing)
    assert not listing.is_outlier

def test_outlier_price_per_perch_too_high(cleaner):
    from db.models import Listing
    listing = Listing(price_per_perch=100_000_000)
    cleaner.detect_outliers(listing)
    assert listing.is_outlier is True
    assert "Price per perch too high" in listing.outlier_reason
