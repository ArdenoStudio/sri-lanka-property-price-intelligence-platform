"""Fail if required scraper modules are missing from a Lambda package dir."""
from __future__ import annotations

import sys
from pathlib import Path

REQUIRED = (
    "scraper.privacy",
    "scraper.pipeline_metrics",
    "scraper.quality",
    "scraper.flags",
)


def main() -> int:
    package = Path(sys.argv[1] if len(sys.argv) > 1 else "package").resolve()
    sys.path.insert(0, str(package))
    for mod in REQUIRED:
        __import__(mod)
    from scraper.flags import flag_snapshot

    print("lambda_scraper_modules_ok", sorted(flag_snapshot()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
