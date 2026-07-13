import os
from pathlib import Path

import pytest

from scraper.onlineproperty import (
    _category_url,
    _clean_price,
    _client_timeout,
    _format_error,
    _parse_cards,
)


FIXTURE = Path(__file__).parent / "fixtures" / "onlineproperty_sample.html"


def test_category_url_first_and_paged():
    assert _category_url("houses-for-sale", 1) == (
        "https://onlineproperty.lk/listing-category/property/houses-for-sale/"
    )
    assert _category_url("houses-for-sale", 2) == (
        "https://onlineproperty.lk/listing-category/property/houses-for-sale/page/2/"
    )


def test_clean_price_normalises_sinhala_and_suffixes():
    assert _clean_price("රු 48,500,000total price") == "Rs. 48,500,000"
    assert _clean_price("රු 25,000per month") == "Rs. 25,000 Per Month"


def test_parse_cards_from_fixture():
    html = FIXTURE.read_text(encoding="utf-8")
    items = _parse_cards(html, "house", "sale")
    assert len(items) == 2
    assert items[0]["title"] == "2 Story House for Sale in Avissawella"
    assert items[0]["raw_price"] == "Rs. 4,500,000"
    assert items[0]["raw_location"] == "Avissawella,Colombo District"
    assert items[0]["source_id"] == "sample-house-colombo"
    assert items[1]["property_type"] == "house"


def test_client_timeout_defaults_are_generous_enough_for_slow_responses():
    timeout = _client_timeout()
    assert timeout.read >= 60
    assert timeout.connect >= 10


def test_format_error_includes_type_for_empty_exceptions():
    class EmptyError(Exception):
        pass

    assert _format_error(EmptyError()) == "EmptyError"


def test_client_timeout_env_override(monkeypatch):
    monkeypatch.setenv("ONLINEPROPERTY_READ_TIMEOUT", "120")
    monkeypatch.setenv("ONLINEPROPERTY_CONNECT_TIMEOUT", "20")
    timeout = _client_timeout()
    assert timeout.read == 120
    assert timeout.connect == 20
