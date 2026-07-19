"""Feature flags for API cutover and UI experiments.

Defaults keep Playwright/HTML scrapers as the primary path until explicitly enabled.
"""
from __future__ import annotations

import os


def _truthy(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def use_lpw_api() -> bool:
    return _truthy("USE_LPW_API")


def use_ikman_serp_api() -> bool:
    return _truthy("USE_IKMAN_SERP_API")


def use_ikman_detail_api() -> bool:
    return _truthy("USE_IKMAN_DETAIL_API")


def use_district_profiles() -> bool:
    return _truthy("USE_DISTRICT_PROFILES")


def flag_snapshot() -> dict[str, bool]:
    return {
        "USE_LPW_API": use_lpw_api(),
        "USE_IKMAN_SERP_API": use_ikman_serp_api(),
        "USE_IKMAN_DETAIL_API": use_ikman_detail_api(),
        "USE_DISTRICT_PROFILES": use_district_profiles(),
    }
