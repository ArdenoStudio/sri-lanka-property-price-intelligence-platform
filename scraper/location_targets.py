from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import re
from typing import Mapping

from scraper.cleaner import LOCATION_DISTRICT_MAP


CANONICAL_DISTRICTS = (
    "Ampara",
    "Anuradhapura",
    "Badulla",
    "Batticaloa",
    "Colombo",
    "Galle",
    "Gampaha",
    "Hambantota",
    "Jaffna",
    "Kalutara",
    "Kandy",
    "Kegalle",
    "Kilinochchi",
    "Kurunegala",
    "Mannar",
    "Matale",
    "Matara",
    "Monaragala",
    "Mullaitivu",
    "Nuwara Eliya",
    "Polonnaruwa",
    "Puttalam",
    "Ratnapura",
    "Trincomalee",
    "Vavuniya",
)

IKMAN_DISTRICT_SLUGS = {
    district: re.sub(r"\s+", "-", district.strip().lower())
    for district in CANONICAL_DISTRICTS
}
IKMAN_DISTRICT_SLUGS["Mullaitivu"] = "mullativu"

EXTRA_LOCATION_ALIASES = {
    "Colombo": (
        "Pannipitiya",
        "Rathmalana",
        "Kalubowila",
        "Kohuwala",
        "Koswatta",
        "Bolgoda",
        "Kesbewa",
        "Polgasowita",
        "Madiwela",
        "Angoda",
        "Kotikawatta",
    ),
    "Gampaha": ("Uswetakeiyawa",),
    "Puttalam": ("Kalpitiya",),
    "Ampara": ("Arugam Bay",),
    "Hambantota": ("Yala",),
    "Matara": ("Midigama",),
    "Galle": ("Kathaluwa", "Kosgoda", "Godagama"),
}


@dataclass(frozen=True)
class CoverageTarget:
    kind: str
    district: str
    query: str
    slug: str
    pages: int
    min_pages: int = 1


def slugify_location(value: str) -> str:
    return re.sub(r"\s+", "-", value.strip().lower())


def district_page_budget(count: int, district_target: int = 750) -> int:
    if count < 100:
        return 20
    if count < 250:
        return 12
    if count < district_target:
        return 8
    return 3


def should_stop_after_page(
    *,
    page_num: int,
    page_new: int,
    page_listings_count: int,
    min_pages: int,
    consecutive_duplicate_pages: int,
    duplicate_stop_pages: int,
) -> bool:
    if page_listings_count == 0:
        return True
    if page_num < min_pages:
        return False
    return page_new == 0 and consecutive_duplicate_pages >= duplicate_stop_pages


def aliases_by_district() -> dict[str, tuple[str, ...]]:
    grouped: dict[str, set[str]] = {district: set() for district in CANONICAL_DISTRICTS}
    for alias, district in LOCATION_DISTRICT_MAP.items():
        if district in grouped and alias.lower() != district.lower():
            grouped[district].add(alias)
    for district, aliases in EXTRA_LOCATION_ALIASES.items():
        grouped.setdefault(district, set()).update(aliases)
    return {
        district: tuple(sorted(aliases, key=lambda value: value.lower()))
        for district, aliases in grouped.items()
    }


def rotate_aliases(
    aliases: tuple[str, ...],
    *,
    run_date: date,
    limit: int,
) -> tuple[str, ...]:
    if not aliases or limit <= 0:
        return ()
    start = run_date.toordinal() % len(aliases)
    rotated = aliases[start:] + aliases[:start]
    return rotated[: min(limit, len(rotated))]


def build_ikman_coverage_targets(
    district_counts: Mapping[str, int] | None = None,
    *,
    run_date: date | None = None,
    district_target: int = 750,
    subdistricts_per_district: int = 2,
    subdistrict_pages: int = 2,
) -> list[CoverageTarget]:
    run_date = run_date or date.today()
    district_counts = district_counts or {}
    alias_map = aliases_by_district()

    targets: list[CoverageTarget] = []
    for district in CANONICAL_DISTRICTS:
        count = int(district_counts.get(district, 0) or 0)
        pages = district_page_budget(count, district_target=district_target)
        targets.append(
            CoverageTarget(
                kind="district",
                district=district,
                query=district,
                slug=IKMAN_DISTRICT_SLUGS[district],
                pages=pages,
                min_pages=min(2, pages),
            )
        )

        if count >= district_target:
            continue
        for alias in rotate_aliases(
            alias_map.get(district, ()),
            run_date=run_date,
            limit=subdistricts_per_district,
        ):
            targets.append(
                CoverageTarget(
                    kind="subdistrict",
                    district=district,
                    query=alias,
                    slug=slugify_location(alias),
                    pages=subdistrict_pages,
                    min_pages=min(2, subdistrict_pages),
                )
            )

    return targets
