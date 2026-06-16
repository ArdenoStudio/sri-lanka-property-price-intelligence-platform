from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import exp
from typing import Any, Iterable, Optional


MIN_SAMPLE = 5
MAX_ESTIMATE_COMPS = 50
MAX_DISPLAY_COMPS = 6


@dataclass(frozen=True)
class EstimateCriteria:
    property_type: str
    listing_type: str
    district: Optional[str] = None
    size_perches: Optional[float] = None
    size_sqft: Optional[float] = None
    bedrooms: Optional[int] = None


@dataclass(frozen=True)
class MatchTier:
    key: str
    label: str
    location_scope: str
    size_multiplier: Optional[tuple[float, float]]
    bedroom_delta: Optional[int]
    require_size: bool
    require_bedrooms: bool


TIERS = (
    MatchTier(
        key="tier_1_strict_district",
        label="Same district, tight size and room match",
        location_scope="district",
        size_multiplier=(0.75, 1.35),
        bedroom_delta=0,
        require_size=True,
        require_bedrooms=True,
    ),
    MatchTier(
        key="tier_2_similar_district",
        label="Same district, similar size and rooms",
        location_scope="district",
        size_multiplier=(0.5, 2.0),
        bedroom_delta=1,
        require_size=True,
        require_bedrooms=True,
    ),
    MatchTier(
        key="tier_3_relaxed_district",
        label="Same district, relaxed comparable match",
        location_scope="district",
        size_multiplier=(0.35, 3.0),
        bedroom_delta=2,
        require_size=False,
        require_bedrooms=False,
    ),
    MatchTier(
        key="tier_4_national_fallback",
        label="Broader market fallback",
        location_scope="national",
        size_multiplier=(0.5, 2.0),
        bedroom_delta=1,
        require_size=False,
        require_bedrooms=False,
    ),
)


def as_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def as_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def requested_size(criteria: EstimateCriteria) -> tuple[Optional[str], Optional[float]]:
    if criteria.size_perches and criteria.size_perches > 0:
        return "perches", criteria.size_perches
    if criteria.size_sqft and criteria.size_sqft > 0:
        return "sqft", criteria.size_sqft
    return None, None


def listing_size(listing: Any, unit: Optional[str]) -> Optional[float]:
    if unit == "perches":
        return as_float(getattr(listing, "size_perches", None))
    if unit == "sqft":
        return as_float(getattr(listing, "size_sqft", None))
    return None


def size_matches(listing: Any, criteria: EstimateCriteria, tier: MatchTier) -> bool:
    unit, target = requested_size(criteria)
    if target is None:
        return True
    actual = listing_size(listing, unit)
    if actual is None:
        return not tier.require_size
    if not tier.size_multiplier:
        return True
    low, high = tier.size_multiplier
    return target * low <= actual <= target * high


def bedrooms_match(listing: Any, criteria: EstimateCriteria, tier: MatchTier) -> bool:
    if criteria.bedrooms is None or criteria.bedrooms <= 0:
        return True
    actual = as_int(getattr(listing, "bedrooms", None))
    if actual is None:
        return not tier.require_bedrooms
    delta = tier.bedroom_delta if tier.bedroom_delta is not None else 99
    return abs(actual - criteria.bedrooms) <= delta


def location_matches(listing: Any, criteria: EstimateCriteria, tier: MatchTier) -> bool:
    if tier.location_scope == "national" or not criteria.district:
        return True
    return getattr(listing, "district", None) == criteria.district


def candidate_matches_tier(listing: Any, criteria: EstimateCriteria, tier: MatchTier) -> bool:
    return (
        location_matches(listing, criteria, tier)
        and size_matches(listing, criteria, tier)
        and bedrooms_match(listing, criteria, tier)
    )


def choose_match_tier(candidates: Iterable[Any], criteria: EstimateCriteria) -> tuple[MatchTier, list[Any]]:
    candidate_list = list(candidates)
    tiers = TIERS if criteria.district else (TIERS[-1],)
    for tier in tiers:
        matched = [candidate for candidate in candidate_list if candidate_matches_tier(candidate, criteria, tier)]
        if matched and (len(matched) >= MIN_SAMPLE or tier == TIERS[-1]):
            return tier, matched

    return TIERS[-1], []


def freshness_score(first_seen_at: Any, now: datetime) -> float:
    if not first_seen_at:
        return 0.3
    seen = first_seen_at.replace(tzinfo=None) if hasattr(first_seen_at, "replace") else None
    if not seen:
        return 0.3
    age_days = max((now.replace(tzinfo=None) - seen).days, 0)
    return max(0.0, min(1.0, exp(-age_days / 90)))


def ratio_closeness(actual: Optional[float], target: Optional[float]) -> float:
    if not actual or not target or actual <= 0 or target <= 0:
        return 0.35
    ratio = max(actual, target) / min(actual, target)
    return max(0.0, min(1.0, 1 - ((ratio - 1) / 2)))


def bedroom_closeness(actual: Optional[int], target: Optional[int]) -> float:
    if not target or target <= 0:
        return 1.0
    if actual is None:
        return 0.45
    return max(0.0, 1 - (abs(actual - target) / 3))


def score_candidate(listing: Any, criteria: EstimateCriteria, tier: MatchTier, now: datetime) -> tuple[float, list[str]]:
    reasons: list[str] = []

    if criteria.district and getattr(listing, "district", None) == criteria.district:
        location_score = 1.0
        reasons.append("same district")
        if getattr(listing, "city", None):
            reasons.append(f"{getattr(listing, 'city')} area")
    elif tier.location_scope == "national":
        location_score = 0.45
        reasons.append("broader market fallback")
    else:
        location_score = 0.25

    unit, target_size = requested_size(criteria)
    actual_size = listing_size(listing, unit)
    size_score = ratio_closeness(actual_size, target_size)
    if target_size and actual_size:
        reasons.append("similar size" if size_score >= 0.65 else "relaxed size match")
    elif target_size:
        reasons.append("size missing")

    actual_bedrooms = as_int(getattr(listing, "bedrooms", None))
    beds_score = bedroom_closeness(actual_bedrooms, criteria.bedrooms)
    if criteria.bedrooms and actual_bedrooms is not None:
        reasons.append("same bedrooms" if actual_bedrooms == criteria.bedrooms else "similar bedrooms")
    elif criteria.bedrooms:
        reasons.append("bedrooms missing")

    fresh_score = freshness_score(getattr(listing, "first_seen_at", None), now)
    if fresh_score >= 0.65:
        reasons.append("recent listing")

    has_unit_price = bool(getattr(listing, "price_per_perch", None) or getattr(listing, "price_per_sqft", None))
    data_score = 1.0 if has_unit_price or actual_size or actual_bedrooms is not None else 0.72

    weighted = (
        location_score * 0.36
        + size_score * 0.26
        + beds_score * 0.18
        + fresh_score * 0.12
        + data_score * 0.08
    )
    return round(max(0.0, min(1.0, weighted)) * 100, 1), reasons[:4]


def ranked_comparables(candidates: Iterable[Any], criteria: EstimateCriteria, tier: MatchTier, now: datetime) -> list[tuple[Any, float, list[str]]]:
    scored = [
        (candidate, *score_candidate(candidate, criteria, tier, now))
        for candidate in candidates
    ]
    return sorted(
        scored,
        key=lambda item: (item[1], getattr(item[0], "first_seen_at", None) or datetime.min),
        reverse=True,
    )


def percentile(sorted_values: list[float], pct: float) -> Optional[float]:
    if not sorted_values:
        return None
    index = int((len(sorted_values) - 1) * pct)
    return sorted_values[index]


def confidence_for(sample_count: int, average_similarity: float, tier: MatchTier) -> tuple[str, str]:
    if sample_count <= 0:
        return "none", "No comparable listings matched these criteria."
    if sample_count >= 20 and average_similarity >= 68 and tier.key in {"tier_1_strict_district", "tier_2_similar_district"}:
        return "high", "Strong sample of local listings with close size and room matches."
    if sample_count >= 8 and average_similarity >= 55 and tier.key != "tier_4_national_fallback":
        return "medium", "Enough local comparables, with some relaxed matching."
    return "low", "Limited or broader comparable set; treat this as a directional benchmark."


def build_matched_criteria(criteria: EstimateCriteria, tier: MatchTier) -> dict[str, Any]:
    size_unit, size_value = requested_size(criteria)
    matched = {
        "listing_type": criteria.listing_type,
        "property_type": criteria.property_type,
        "city_scope": tier.location_scope,
    }
    if criteria.district:
        matched["district"] = criteria.district
    if size_unit and size_value:
        matched["size"] = {"unit": size_unit, "value": size_value}
    if criteria.bedrooms:
        matched["bedrooms"] = criteria.bedrooms
    return matched
