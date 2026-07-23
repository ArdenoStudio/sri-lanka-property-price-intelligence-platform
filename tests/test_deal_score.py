"""Deal score — 50+ cases covering sale/rent isolation and scoring guards."""
from __future__ import annotations

import pytest

from api.deal_score import (
    FULL_CONFIDENCE_SAMPLE,
    MAX_PRICE_RATIO,
    MIN_PRICE_RATIO,
    MIN_SAMPLE,
    bedroom_bucket,
    clamp_score,
    compute_deal_score,
    normalize_listing_type,
    peer_noun,
    raw_deal_score,
    sample_confidence,
)


# ── Bedroom buckets ──────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "beds,expected",
    [
        (None, None),
        (0, "1"),
        (1, "1"),
        (2, "2"),
        (3, "3"),
        (4, "4"),
        (5, "5+"),
        (8, "5+"),
        ("3", "3"),
        ("x", None),
    ],
)
def test_bedroom_bucket(beds, expected):
    assert bedroom_bucket(beds) == expected


# ── Listing type normalization ───────────────────────────────────────────────

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("sale", "sale"),
        ("RENT", "rent"),
        (" Sale ", "sale"),
        ("lease", None),
        ("", None),
        (None, None),
        ("short_term", None),
    ],
)
def test_normalize_listing_type(raw, expected):
    assert normalize_listing_type(raw) == expected


# ── Sample confidence ramp ───────────────────────────────────────────────────

def test_confidence_below_min_is_zero():
    assert sample_confidence(0) == 0.0
    assert sample_confidence(MIN_SAMPLE - 1) == 0.0


def test_confidence_at_min_positive():
    assert 0 < sample_confidence(MIN_SAMPLE) < 1


def test_confidence_at_full_is_one():
    assert sample_confidence(FULL_CONFIDENCE_SAMPLE) == 1.0
    assert sample_confidence(FULL_CONFIDENCE_SAMPLE + 50) == 1.0


def test_confidence_monotone():
    prev = sample_confidence(MIN_SAMPLE)
    for n in range(MIN_SAMPLE + 1, FULL_CONFIDENCE_SAMPLE + 1):
        cur = sample_confidence(n)
        assert cur >= prev
        prev = cur


# ── Raw score + ratio gate ───────────────────────────────────────────────────

def test_raw_equal_median_is_zero():
    assert raw_deal_score(10_000_000, 10_000_000) == pytest.approx(0.0)


def test_raw_half_median_is_plus_fifty():
    assert raw_deal_score(5_000_000, 10_000_000) == pytest.approx(50.0)


def test_raw_double_median_is_minus_hundred_pre_clamp():
    assert raw_deal_score(20_000_000, 10_000_000) == pytest.approx(-100.0)


def test_raw_rejects_rent_vs_sale_style_ratio():
    # Rs 275K rent vs ~Rs 50Mn sale median → ratio ~0.0055
    assert raw_deal_score(275_000, 50_000_000) is None


def test_raw_rejects_above_max_ratio():
    assert raw_deal_score(50_000_000, 1_000_000) is None  # 50x


def test_raw_boundary_min_ratio_accepted():
    median = 10_000_000
    price = median * MIN_PRICE_RATIO
    assert raw_deal_score(price, median) is not None


def test_raw_boundary_just_below_min_rejected():
    median = 10_000_000
    price = median * MIN_PRICE_RATIO * 0.99
    assert raw_deal_score(price, median) is None


def test_raw_boundary_max_ratio_accepted():
    median = 1_000_000
    price = median * MAX_PRICE_RATIO
    assert raw_deal_score(price, median) is not None


def test_raw_null_inputs():
    assert raw_deal_score(None, 1) is None
    assert raw_deal_score(1, None) is None
    assert raw_deal_score(0, 1) is None
    assert raw_deal_score(1, 0) is None


# ── Full compute_deal_score ──────────────────────────────────────────────────

def test_sale_below_peers_positive():
    score = compute_deal_score(
        40_000_000, 50_000_000, sample_n=20, listing_type="sale",
    )
    assert score == pytest.approx(20.0)


def test_rent_below_rent_peers_positive():
    score = compute_deal_score(
        200_000, 275_000, sample_n=20, listing_type="rent",
    )
    assert score is not None and score > 0


def test_rent_near_rent_median_typical():
    score = compute_deal_score(
        275_000, 280_000, sample_n=20, listing_type="rent",
    )
    assert score is not None
    assert abs(score) < 10


def test_rent_vs_sale_median_null_not_plus_100():
    """The bug in the screenshot: cheap rent vs sale median → must NOT score."""
    score = compute_deal_score(
        275_000, 50_000_000, sample_n=100, listing_type="rent",
    )
    assert score is None


def test_sale_vs_tiny_rent_median_null():
    score = compute_deal_score(
        50_000_000, 275_000, sample_n=100, listing_type="sale",
    )
    assert score is None


def test_unknown_listing_type_null():
    assert compute_deal_score(1_000_000, 1_000_000, 20, listing_type=None) is None
    assert compute_deal_score(1_000_000, 1_000_000, 20, listing_type="lease") is None


def test_outlier_null():
    assert compute_deal_score(
        1_000_000, 1_000_000, 20, listing_type="sale", is_outlier=True,
    ) is None


def test_short_term_null():
    assert compute_deal_score(
        50_000, 60_000, 20, listing_type="rent", is_short_term=True,
    ) is None


def test_thin_sample_null():
    assert compute_deal_score(
        40_000_000, 50_000_000, sample_n=4, listing_type="sale",
    ) is None


def test_sparse_sample_dampens_magnitude():
    full = compute_deal_score(40_000_000, 50_000_000, 20, listing_type="sale")
    sparse = compute_deal_score(40_000_000, 50_000_000, 5, listing_type="sale")
    assert full is not None and sparse is not None
    assert abs(sparse) < abs(full)


def test_clamp_upper():
    assert clamp_score(150) == 100.0


def test_clamp_lower():
    assert clamp_score(-150) == -100.0


def test_above_median_negative():
    score = compute_deal_score(60_000_000, 50_000_000, 20, listing_type="sale")
    assert score == pytest.approx(-20.0)


def test_commercial_rent_peers_ok():
    # High commercial rent vs commercial rent median — valid
    score = compute_deal_score(275_000, 300_000, 18, listing_type="rent")
    assert score is not None
    assert 0 < score < 20


def test_commercial_rent_not_scored_against_sale_house_median():
    score = compute_deal_score(275_000, 85_000_000, 40, listing_type="rent")
    assert score is None


# ── Peer copy nouns ──────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "lt,noun",
    [("rent", "rentals"), ("sale", "sales"), (None, "listings"), ("x", "listings")],
)
def test_peer_noun(lt, noun):
    assert peer_noun(lt) == noun


# ── Parametric market matrix (sale/rent × under/over/equal) ─────────────────

@pytest.mark.parametrize("listing_type", ["sale", "rent"])
@pytest.mark.parametrize(
    "price_factor,sign",
    [(0.8, 1), (1.0, 0), (1.25, -1)],
)
def test_sign_consistent_within_market(listing_type, price_factor, sign):
    median = 500_000 if listing_type == "rent" else 40_000_000
    score = compute_deal_score(
        median * price_factor, median, sample_n=20, listing_type=listing_type,
    )
    assert score is not None
    if sign == 0:
        assert abs(score) < 0.1
    elif sign > 0:
        assert score > 0
    else:
        assert score < 0


# ── SQL wiring: aggregator must isolate listing_type ─────────────────────────

def test_aggregator_sql_requires_listing_type_match():
    from pathlib import Path
    source = Path("api/main.py").read_text()
    assert "b.listing_type   = l.listing_type" in source or "b.listing_type = l.listing_type" in source
    assert "br.listing_type  = l.listing_type" in source or "br.listing_type = l.listing_type" in source
    assert "l.listing_type IN ('sale', 'rent')" in source
    assert "is_short_term" in source
    assert "min_ratio" in source


def test_migration_008_splits_listing_type():
    from pathlib import Path
    sql = Path("db/migrations/008_listing_type_aggregates.sql").read_text()
    assert "ADD COLUMN IF NOT EXISTS listing_type" in sql
    assert "DELETE FROM price_aggregates" in sql
    assert "deal_score = NULL" in sql
    assert "listing_type, period_year, period_month" in sql


def test_deal_score_module_exported():
    import api.deal_score as mod
    assert hasattr(mod, "compute_deal_score")
    assert hasattr(mod, "MIN_SAMPLE")


# Extra edge cases to push past 50 assertions / scenarios

@pytest.mark.parametrize("n", list(range(1, 6)))
def test_samples_1_to_5_boundary(n):
    score = compute_deal_score(9_000_000, 10_000_000, n, listing_type="sale")
    if n < MIN_SAMPLE:
        assert score is None
    else:
        assert score is not None


@pytest.mark.parametrize(
    "price,median",
    [
        (100_000, 120_000),
        (250_000, 275_000),
        (400_000, 500_000),
        (1_500_000, 2_000_000),  # high-end commercial rent band
    ],
)
def test_rent_band_examples(price, median):
    score = compute_deal_score(price, median, 20, listing_type="rent")
    assert score is not None
    assert -100 <= score <= 100


@pytest.mark.parametrize(
    "price,median",
    [
        (25_000_000, 40_000_000),
        (50_000_000, 50_000_000),
        (90_000_000, 60_000_000),
        (12_000_000, 15_000_000),
    ],
)
def test_sale_band_examples(price, median):
    score = compute_deal_score(price, median, 20, listing_type="sale")
    assert score is not None
