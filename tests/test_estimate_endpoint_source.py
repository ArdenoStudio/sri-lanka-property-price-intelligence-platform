import ast
from pathlib import Path


API_MAIN = Path(__file__).resolve().parents[1] / "api" / "main.py"


def _estimate_source() -> str:
    source = API_MAIN.read_text(encoding="utf-8")
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "estimate_price":
            return ast.get_source_segment(source, node) or ""
    raise AssertionError("estimate_price not found")


def test_estimate_requires_sale_or_rent_listing_type():
    source = _estimate_source()

    assert 'listing_type not in {"sale", "rent"}' in source
    assert "Listing.listing_type == listing_type" in source


def test_estimate_excludes_short_term_and_outliers():
    source = _estimate_source()

    assert "Listing.is_outlier == False" in source
    assert "Listing.is_short_term == False" in source


def test_estimate_uses_ranked_comparables_not_recency_slice():
    source = _estimate_source()

    assert "choose_match_tier" in source
    assert "ranked_comparables" in source
    assert "comparables = query.order_by(desc(Listing.first_seen_at)).limit(50).all()" not in source
