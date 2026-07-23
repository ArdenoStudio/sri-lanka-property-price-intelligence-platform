"""Smoke tests for quality check module shape and thresholds."""
from scraper.quality import FRESHNESS_SLA_HOURS, SALE_PRICE_MAX, SALE_PRICE_MIN, CheckResult


def test_freshness_sla_covers_known_sources():
    assert set(FRESHNESS_SLA_HOURS) >= {"ikman", "lpw", "onlineproperty", "lamudi"}
    assert FRESHNESS_SLA_HOURS["ikman"] <= 48
    assert FRESHNESS_SLA_HOURS["lamudi"] >= FRESHNESS_SLA_HOURS["ikman"]


def test_outlier_bands_align_with_cleaner():
    assert SALE_PRICE_MIN == 500_000
    assert SALE_PRICE_MAX == 2_000_000_000


def test_check_result_dataclass():
    c = CheckResult(name="duplicate_rate_pct", status="pass", value=1.2, threshold=15)
    assert c.name == "duplicate_rate_pct"
    assert c.status == "pass"
