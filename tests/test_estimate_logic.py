from datetime import datetime, timedelta
from types import SimpleNamespace

from api.estimate_logic import (
    EstimateCriteria,
    choose_match_tier,
    confidence_for,
    ranked_comparables,
)


NOW = datetime(2026, 5, 31)


def listing(
    id,
    *,
    district="Colombo",
    city="Nugegoda",
    price=10_000_000,
    listing_type="sale",
    size_perches=10,
    size_sqft=None,
    bedrooms=3,
    days_old=5,
    is_short_term=False,
):
    return SimpleNamespace(
        id=id,
        district=district,
        city=city,
        price_lkr=price,
        listing_type=listing_type,
        size_perches=size_perches,
        size_sqft=size_sqft,
        bedrooms=bedrooms,
        first_seen_at=NOW - timedelta(days=days_old),
        price_per_perch=(price / size_perches) if size_perches else None,
        price_per_sqft=(price / size_sqft) if size_sqft else None,
        is_short_term=is_short_term,
    )


def test_strict_district_matches_are_preferred():
    criteria = EstimateCriteria(
        property_type="house",
        listing_type="sale",
        district="Colombo",
        size_perches=10,
        bedrooms=3,
    )
    candidates = [
        *[listing(i, district="Colombo", size_perches=10 + (i % 2), bedrooms=3) for i in range(6)],
        *[listing(i + 10, district="Gampaha", size_perches=10, bedrooms=3) for i in range(6)],
    ]

    tier, matched = choose_match_tier(candidates, criteria)

    assert tier.key == "tier_1_strict_district"
    assert {item.district for item in matched} == {"Colombo"}


def test_fallback_tier_when_local_matches_are_too_few():
    criteria = EstimateCriteria(
        property_type="house",
        listing_type="sale",
        district="Colombo",
        size_perches=10,
        bedrooms=3,
    )
    candidates = [
        listing(1, district="Colombo", size_perches=10, bedrooms=3),
        *[listing(i + 10, district="Gampaha", size_perches=10, bedrooms=3) for i in range(6)],
    ]

    tier, matched = choose_match_tier(candidates, criteria)

    assert tier.key == "tier_4_national_fallback"
    assert len(matched) == 7


def test_nationwide_estimates_use_national_scope_label():
    criteria = EstimateCriteria(
        property_type="house",
        listing_type="sale",
        size_perches=10,
        bedrooms=3,
    )
    candidates = [listing(i, district="Colombo", size_perches=10, bedrooms=3) for i in range(6)]

    tier, matched = choose_match_tier(candidates, criteria)

    assert tier.key == "tier_4_national_fallback"
    assert tier.location_scope == "national"
    assert len(matched) == 6


def test_ranked_comparables_sort_by_similarity_not_recency():
    criteria = EstimateCriteria(
        property_type="house",
        listing_type="sale",
        district="Colombo",
        size_perches=10,
        bedrooms=3,
    )
    old_better_match = listing(1, district="Colombo", size_perches=10, bedrooms=3, days_old=60)
    recent_weaker_match = listing(2, district="Colombo", size_perches=25, bedrooms=5, days_old=1)
    tier, _ = choose_match_tier([old_better_match, recent_weaker_match], criteria)

    ranked = ranked_comparables([old_better_match, recent_weaker_match], criteria, tier, NOW)

    assert ranked[0][0].id == 1
    assert ranked[0][1] > ranked[1][1]


def test_missing_size_and_bedrooms_are_penalized_not_excluded_in_relaxed_tier():
    criteria = EstimateCriteria(
        property_type="house",
        listing_type="sale",
        district="Colombo",
        size_perches=10,
        bedrooms=3,
    )
    candidates = [
        listing(1, district="Colombo", size_perches=None, bedrooms=None),
        listing(2, district="Colombo", size_perches=None, bedrooms=None),
        listing(3, district="Colombo", size_perches=None, bedrooms=None),
        listing(4, district="Colombo", size_perches=None, bedrooms=None),
        listing(5, district="Colombo", size_perches=None, bedrooms=None),
    ]

    tier, matched = choose_match_tier(candidates, criteria)
    ranked = ranked_comparables(matched, criteria, tier, NOW)

    assert tier.key == "tier_3_relaxed_district"
    assert len(matched) == 5
    assert ranked[0][1] < 80


def test_confidence_uses_sample_similarity_and_tier():
    high, high_reason = confidence_for(25, 75, SimpleNamespace(key="tier_2_similar_district"))
    low, low_reason = confidence_for(3, 80, SimpleNamespace(key="tier_1_strict_district"))

    assert high == "high"
    assert "Strong sample" in high_reason
    assert low == "low"
    assert "Limited" in low_reason
