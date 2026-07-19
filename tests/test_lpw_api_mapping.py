import json
from pathlib import Path

from scraper.lpw_api import (
    extract_bootstrap_credentials,
    map_listing_type,
    map_lpw_ad,
    map_property_type,
)

SAMPLE = Path(__file__).resolve().parents[1] / "docs/source-apis/lpw/samples/search2_sales.json"


def test_map_property_type():
    assert map_property_type("Apartment") == "apartment"
    assert map_property_type("House") == "house"
    assert map_property_type("Land") == "land"
    assert map_property_type("Commercial Buildings") == "commercial"


def test_map_listing_type():
    assert map_listing_type("sales") == "sale"
    assert map_listing_type("rentals") == "rent"
    assert map_listing_type("land") == "sale"


def test_map_lpw_ad_from_sample():
    data = json.loads(SAMPLE.read_text())
    ad = data["ads"][0]
    mapped = map_lpw_ad(ad, default_property_type="house", default_listing_type="sale")
    assert mapped is not None
    assert mapped["source"] == "lpw"
    assert mapped["source_id"] == "5688969"
    assert mapped["property_type"] == "apartment"
    assert mapped["listing_type"] == "sale"
    assert mapped["raw_json"]["bedrooms"] == 2
    assert mapped["raw_json"]["bathrooms"] == 2
    assert mapped["raw_json"]["lat"] is not None
    assert mapped["raw_json"]["lon"] is not None
    assert "sqft" in (mapped["raw_size"] or "").lower()
    assert "Koswatta" in (mapped["raw_location"] or "")


def test_extract_bootstrap_credentials():
    html = '''
    <script>
      const token = "eyJhbGciOiJIUzI1NiJ9.eyJMUFciOiJscHdfYXBpX2tleSJ9.sig";
      const secure_key = "2JIOMXS";
    </script>
    '''
    token, key = extract_bootstrap_credentials(html)
    assert token.startswith("eyJ")
    assert key == "2JIOMXS"
