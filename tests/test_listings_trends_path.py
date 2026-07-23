"""Guard: listings + price history paths remain available for analytics consumers."""
from pathlib import Path

API_MAIN = Path(__file__).resolve().parents[1] / "api" / "main.py"


def test_listings_and_prices_routes_exist():
    source = API_MAIN.read_text(encoding="utf-8")
    assert '@app.get("/listings")' in source
    assert '@app.get("/prices")' in source
    assert "PriceAggregator" in source
    assert "price_aggregates" in source.lower() or "PriceAggregate" in source
