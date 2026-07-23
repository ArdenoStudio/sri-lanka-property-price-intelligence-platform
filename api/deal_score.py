"""Deal score helpers — listing-type-aware relative pricing signal.

Score meaning (unchanged sign convention):
  positive → asking price below comparable median (cheaper)
  negative → asking price above comparable median (dearer)

Comparables MUST share listing_type (sale vs rent). Mixing those markets
is invalid and previously produced fake +100 scores on cheap rents.
"""
from __future__ import annotations

from typing import Optional

# Minimum peer listings before we stamp a score at all.
MIN_SAMPLE = 5
# At this sample size confidence reaches 1.0.
FULL_CONFIDENCE_SAMPLE = 15
# Reject comps when price/median is absurd (wrong market / bad parse).
MIN_PRICE_RATIO = 0.05
MAX_PRICE_RATIO = 20.0

VALID_LISTING_TYPES = frozenset({"sale", "rent"})


def bedroom_bucket(bedrooms) -> Optional[str]:
    if bedrooms is None:
        return None
    try:
        beds = int(bedrooms)
    except (TypeError, ValueError):
        return None
    if beds <= 1:
        return "1"
    if beds == 2:
        return "2"
    if beds == 3:
        return "3"
    if beds == 4:
        return "4"
    return "5+"


def normalize_listing_type(listing_type: Optional[str]) -> Optional[str]:
    if not listing_type:
        return None
    lt = str(listing_type).strip().lower()
    return lt if lt in VALID_LISTING_TYPES else None


def sample_confidence(sample_n: int, *, min_n: int = MIN_SAMPLE, full_n: int = FULL_CONFIDENCE_SAMPLE) -> float:
    """0 when under-sampled; ramps to 1.0 by full_n."""
    if sample_n is None or sample_n < min_n:
        return 0.0
    if sample_n >= full_n:
        return 1.0
    return (sample_n - min_n + 1) / (full_n - min_n + 1)


def raw_deal_score(price_lkr: float, market_median_lkr: float) -> Optional[float]:
    """Unsigned-clamp raw percentage vs median, or None if incomparable."""
    if price_lkr is None or market_median_lkr is None:
        return None
    try:
        price = float(price_lkr)
        median = float(market_median_lkr)
    except (TypeError, ValueError):
        return None
    if price <= 0 or median <= 0:
        return None
    ratio = price / median
    if ratio < MIN_PRICE_RATIO or ratio > MAX_PRICE_RATIO:
        return None
    return (1.0 - ratio) * 100.0


def clamp_score(score: float) -> float:
    return max(-100.0, min(100.0, score))


def compute_deal_score(
    price_lkr: float,
    market_median_lkr: float,
    sample_n: int,
    *,
    listing_type: Optional[str] = None,
    is_outlier: bool = False,
    is_short_term: bool = False,
) -> Optional[float]:
    """Return stamped deal_score or None when the signal is not trustworthy."""
    if is_outlier or is_short_term:
        return None
    if normalize_listing_type(listing_type) is None and listing_type is not None:
        # Explicit unknown type → no score. None listing_type also no score.
        return None
    if normalize_listing_type(listing_type) is None:
        return None

    conf = sample_confidence(sample_n)
    if conf <= 0:
        return None

    raw = raw_deal_score(price_lkr, market_median_lkr)
    if raw is None:
        return None

    return round(clamp_score(raw * conf), 1)


def peer_noun(listing_type: Optional[str]) -> str:
    lt = normalize_listing_type(listing_type)
    if lt == "rent":
        return "rentals"
    if lt == "sale":
        return "sales"
    return "listings"
