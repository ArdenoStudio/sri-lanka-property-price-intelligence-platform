"""Dedupe / entity-resolution heuristic tests for DataCleaner."""
from datetime import datetime
from unittest.mock import MagicMock

from db.models import Listing
from scraper.cleaner import DataCleaner


def _listing(**kwargs) -> Listing:
    defaults = dict(
        source="ikman",
        source_id="abc",
        scraped_at=datetime.utcnow(),
        price_lkr=5_000_000,
        raw_location="Nugegoda, Colombo",
        district="Colombo",
        property_type="house",
    )
    defaults.update(kwargs)
    return Listing(**defaults)


def test_detect_duplicates_pass1_exact_location():
    db = MagicMock()
    cleaner = DataCleaner(db)
    existing = _listing(source="lpw", source_id="other", id=99)

    # First filter().first() → match
    query = MagicMock()
    db.query.return_value = query
    query.filter.return_value = query
    query.first.return_value = existing

    candidate = _listing(source="ikman", source_id="mine")
    assert cleaner.detect_duplicates(candidate) is True
    assert candidate.is_duplicate is True
    assert candidate.duplicate_of == 99


def test_detect_duplicates_pass2_cross_source_district():
    db = MagicMock()
    cleaner = DataCleaner(db)
    existing = _listing(source="lpw", source_id="lpw-1", id=42)

    query = MagicMock()
    db.query.return_value = query
    query.filter.return_value = query
    # Pass 1 miss, pass 2 hit
    query.first.side_effect = [None, existing]

    candidate = _listing(
        source="ikman",
        source_id="ik-1",
        raw_location="Different string, Colombo District",
        district="Colombo",
        property_type="house",
        price_lkr=5_000_000,
    )
    assert cleaner.detect_duplicates(candidate) is True
    assert candidate.duplicate_of == 42


def test_detect_duplicates_no_price_skips():
    cleaner = DataCleaner(MagicMock())
    candidate = _listing(price_lkr=None)
    assert cleaner.detect_duplicates(candidate) is False


def test_detect_duplicates_no_match():
    db = MagicMock()
    cleaner = DataCleaner(db)
    query = MagicMock()
    db.query.return_value = query
    query.filter.return_value = query
    query.first.return_value = None

    candidate = _listing()
    assert cleaner.detect_duplicates(candidate) is False
    assert not candidate.is_duplicate
