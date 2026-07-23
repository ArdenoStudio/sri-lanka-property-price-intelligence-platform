"""Helpers for persisting scrape_runs with a consistent schema."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from db.models import ScrapeRun


def record_scrape_run(
    db: Session,
    *,
    source: str,
    started_at: datetime,
    listings_found: int = 0,
    listings_new: int = 0,
    listings_failed: int = 0,
    status: str = "success",
    error_message: Optional[str] = None,
    stats: Optional[dict[str, Any]] = None,
    finished_at: Optional[datetime] = None,
    commit: bool = True,
) -> ScrapeRun:
    run = ScrapeRun(
        source=source,
        started_at=started_at,
        finished_at=finished_at or datetime.utcnow(),
        status=status,
        listings_found=listings_found,
        listings_new=listings_new,
        listings_failed=listings_failed,
        error_message=error_message,
        stats=stats,
    )
    db.add(run)
    if commit:
        db.commit()
    return run
