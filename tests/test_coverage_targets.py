from datetime import date

from scraper.location_targets import (
    CANONICAL_DISTRICTS,
    IKMAN_DISTRICT_SLUGS,
    build_ikman_coverage_targets,
    rotate_aliases,
    should_stop_after_page,
)


def test_coverage_planner_includes_all_25_districts():
    targets = build_ikman_coverage_targets(
        {district: 1000 for district in CANONICAL_DISTRICTS},
        subdistricts_per_district=0,
        run_date=date(2026, 5, 30),
    )
    district_targets = [target for target in targets if target.kind == "district"]
    assert len(district_targets) == 25
    assert {target.district for target in district_targets} == set(CANONICAL_DISTRICTS)


def test_mullaitivu_uses_ikman_mullativu_slug():
    assert IKMAN_DISTRICT_SLUGS["Mullaitivu"] == "mullativu"


def test_thin_districts_receive_larger_page_budgets():
    targets = build_ikman_coverage_targets(
        {"Mullaitivu": 6, "Colombo": 34_000},
        subdistricts_per_district=0,
        run_date=date(2026, 5, 30),
    )
    by_district = {target.district: target for target in targets if target.kind == "district"}
    assert by_district["Mullaitivu"].pages == 15
    assert by_district["Colombo"].pages == 2


def test_alias_rotation_is_deterministic_by_date():
    aliases = ("a", "b", "c", "d")
    first = rotate_aliases(aliases, run_date=date(2026, 5, 30), limit=2)
    second = rotate_aliases(aliases, run_date=date(2026, 5, 30), limit=2)
    later = rotate_aliases(aliases, run_date=date(2026, 5, 31), limit=2)
    assert first == second
    assert first != later


def test_targeted_scrape_does_not_stop_after_first_duplicate_page():
    assert should_stop_after_page(
        page_num=1,
        page_new=0,
        page_listings_count=25,
        min_pages=2,
        consecutive_duplicate_pages=1,
        duplicate_stop_pages=3,
    ) is False
    assert should_stop_after_page(
        page_num=3,
        page_new=0,
        page_listings_count=25,
        min_pages=2,
        consecutive_duplicate_pages=3,
        duplicate_stop_pages=3,
    ) is True
