from fastapi import FastAPI, Depends, Query, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, cast, Float, case, or_, and_, text
from sqlalchemy.dialects.postgresql import insert
from typing import List, Optional
from db.connection import get_db, SessionLocal
from db.models import Listing, RawListing, ScrapeRun, PriceAggregate, JobRun, ListingSnapshot
from scraper.privacy import redact_contact_channels
from api.estimate_logic import (
    MAX_DISPLAY_COMPS,
    MAX_ESTIMATE_COMPS,
    EstimateCriteria,
    build_matched_criteria,
    choose_match_tier,
    confidence_for,
    percentile,
    ranked_comparables,
)
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import os
import httpx

app = FastAPI(title="Sri Lanka Property Price Intelligence Platform")

def _configured_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://property-price-intelligence.vercel.app",
        "https://propertylk-one.vercel.app",
    ]

# CORS - allow dashboard frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------

class ListingOut(BaseModel):
    id: int
    source: str
    title: Optional[str] = None
    price_lkr: Optional[float] = None
    price_per_perch: Optional[float] = None
    raw_price: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    raw_location: Optional[str] = None
    property_type: Optional[str] = None
    listing_type: Optional[str] = None
    size_perches: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    url: Optional[str] = None
    first_seen_at: Optional[datetime] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

    class Config:
        from_attributes = True


class RawListingOut(BaseModel):
    id: int
    source: str
    title: Optional[str] = None
    raw_price: Optional[str] = None
    raw_location: Optional[str] = None
    property_type: Optional[str] = None
    listing_type: Optional[str] = None
    url: Optional[str] = None
    scraped_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DistrictStat(BaseModel):
    district: str
    count: int
    avg_price: Optional[float] = None
    median_price: Optional[float] = None


class HeatmapPoint(BaseModel):
    district: str
    lat: float
    lng: float
    count: int
    avg_price: Optional[float] = None
    median_price: Optional[float] = None
    property_type: Optional[str] = None


# ---------------------------------------------------------------------------
# Sri Lanka district center coordinates for map visualization
# ---------------------------------------------------------------------------

DISTRICT_COORDS = {
    "Colombo": (6.9271, 79.8612),
    "Gampaha": (7.0840, 80.0098),
    "Kalutara": (6.5854, 79.9607),
    "Kandy": (7.2906, 80.6337),
    "Matale": (7.4675, 80.6234),
    "Nuwara Eliya": (6.9497, 80.7891),
    "Galle": (6.0535, 80.2210),
    "Matara": (5.9549, 80.5550),
    "Hambantota": (6.1243, 81.1185),
    "Jaffna": (9.6615, 80.0255),
    "Kilinochchi": (9.3803, 80.3770),
    "Mannar": (8.9810, 79.9044),
    "Vavuniya": (8.7514, 80.4971),
    "Mullaitivu": (9.2671, 80.8142),
    "Batticaloa": (7.7310, 81.6747),
    "Ampara": (7.2964, 81.6747),
    "Trincomalee": (8.5874, 81.2152),
    "Kurunegala": (7.4863, 80.3647),
    "Puttalam": (8.0362, 79.8283),
    "Anuradhapura": (8.3114, 80.4037),
    "Polonnaruwa": (7.9403, 81.0188),
    "Badulla": (6.9934, 81.0550),
    "Monaragala": (6.8728, 81.3507),
    "Ratnapura": (6.6828, 80.3992),
    "Kegalle": (7.2513, 80.3464),
}


# ---------------------------------------------------------------------------
# Health & Admin
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        last_run = db.query(ScrapeRun).order_by(desc(ScrapeRun.finished_at)).first()
        raw_count = db.query(func.count(RawListing.id)).scalar()
        clean_count = db.query(func.count(Listing.id)).scalar()
        return {
            "status": "ok",
            "db": "connected",
            "raw_listings": raw_count,
            "clean_listings": clean_count,
            "last_scrape": last_run.finished_at if last_run else None,
        }
    except Exception:
        return {"status": "ok", "db": "unreachable"}

def _require_admin(req: Request):
    admin_key = os.getenv("ADMIN_API_KEY")
    if not admin_key:
        raise HTTPException(status_code=503, detail="Admin access not configured")
    if req.headers.get("x-admin-key") != admin_key:
        raise HTTPException(status_code=403, detail="Forbidden")

def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def _status_for(now: datetime, last_success: Optional[datetime], last_running: Optional[datetime], expected_hours: int) -> str:
    if last_running:
        if now - last_running <= timedelta(hours=expected_hours * 2):
            return "running"
    if last_success:
        if now - last_success <= timedelta(hours=int(expected_hours * 1.5)):
            return "ok"
    return "delayed"


def _public_description(value: Optional[str]) -> Optional[str]:
    return redact_contact_channels(value)


def _listing_counts_by_source(db: Session) -> tuple[dict[str, int], str]:
    total_clean = db.query(func.count(Listing.id)).scalar() or 0
    if total_clean > 0:
        rows = db.query(Listing.source, func.count(Listing.id)).group_by(Listing.source).all()
        return ({source: int(count) for source, count in rows if source}, "cleaned")

    rows = db.query(RawListing.source, func.count(RawListing.id)).group_by(RawListing.source).all()
    return ({source: int(count) for source, count in rows if source}, "raw")


@app.get("/public/pipeline")
def public_pipeline(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    jobs = []
    listing_counts, listing_count_source = _listing_counts_by_source(db)

    job_defs = [
        {
            "name": "scrape_ikman",
            "label": "ikman API",
            "kind": "scrape",
            "source": "ikman",
            "expected_hours": 24,
        },
        {
            "name": "scrape_lpw",
            "label": "LPW API",
            "kind": "scrape",
            "source": "lpw",
            "expected_hours": 24,
        },
        {"name": "clean_listings", "label": "Cleaner", "kind": "job", "expected_hours": 24},
        {"name": "geocode_listings", "label": "Geocoder", "kind": "job", "expected_hours": 24},
        {"name": "compute_aggregates", "label": "Aggregates", "kind": "job", "expected_hours": 168},
    ]

    for job in job_defs:
        if job["kind"] == "scrape":
            source = job["source"]
            last_success_run = (
                db.query(ScrapeRun)
                .filter(
                    ScrapeRun.source == source,
                    or_(
                        ScrapeRun.status == "success",
                        and_(ScrapeRun.status.is_(None), ScrapeRun.finished_at.isnot(None)),
                    )
                )
                .order_by(desc(ScrapeRun.finished_at))
                .first()
            )
            last_run = (
                db.query(ScrapeRun)
                .filter(ScrapeRun.source == source)
                .order_by(desc(ScrapeRun.started_at))
                .first()
            )
            last_running = (
                db.query(ScrapeRun)
                .filter(ScrapeRun.source == source, ScrapeRun.status == "running")
                .order_by(desc(ScrapeRun.started_at))
                .first()
            )
        else:
            name = job["name"]
            last_success_run = (
                db.query(JobRun)
                .filter(JobRun.job_name == name, JobRun.status == "success")
                .order_by(desc(JobRun.finished_at))
                .first()
            )
            last_run = (
                db.query(JobRun)
                .filter(JobRun.job_name == name)
                .order_by(desc(JobRun.started_at))
                .first()
            )
            last_running = (
                db.query(JobRun)
                .filter(JobRun.job_name == name, JobRun.status == "running")
                .order_by(desc(JobRun.started_at))
                .first()
            )

        last_success = _to_utc(last_success_run.finished_at) if last_success_run else None
        last_started = _to_utc(last_run.started_at) if last_run else None
        running_started = _to_utc(last_running.started_at) if last_running else None

        status = _status_for(now, last_success, running_started, job["expected_hours"])
        payload = {
            "name": job["name"],
            "label": job["label"],
            "kind": job["kind"],
            "status": status,
            "last_success": last_success.isoformat() if last_success else None,
            "last_run": last_started.isoformat() if last_started else None,
            "expected_hours": job["expected_hours"],
        }
        if job["kind"] == "scrape":
            payload.update({
                "source": job["source"],
                "last_probe": last_started.isoformat() if last_started else None,
                "listing_count": listing_counts.get(job["source"], 0),
                "listing_count_source": listing_count_source,
                "last_found_count": int(last_run.listings_found or 0) if last_run else 0,
                "last_new_count": int(last_run.listings_new or 0) if last_run else 0,
            })
        jobs.append(payload)

    overall = "ok"
    if any(j["status"] == "delayed" for j in jobs):
        overall = "delayed"
    elif any(j["status"] == "running" for j in jobs):
        overall = "running"

    return {
        "generated_at": now.isoformat(),
        "overall_status": overall,
        "jobs": jobs,
    }

@app.get("/admin/job-runs")
def admin_job_runs(
    req: Request,
    job_name: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    _require_admin(req)
    q = db.query(JobRun)
    if job_name:
        q = q.filter(JobRun.job_name == job_name)
    runs = q.order_by(desc(JobRun.started_at)).limit(limit).all()
    return [
        {
            "id": r.id,
            "job_name": r.job_name,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "status": r.status,
            "stats": r.stats,
            "error_message": r.error_message,
        }
        for r in runs
    ]


@app.post("/trigger/process")
async def trigger_process(req: Request, db: Session = Depends(get_db)):
    _require_admin(req)
    from scraper.cleaner import DataCleaner
    from scraper.geocoder import Geocoder
    from scraper.detail_enricher import DetailEnricher

    cleaner = DataCleaner(db)
    processed = cleaner.process_all()

    geocoder = Geocoder(db)
    geocoded = geocoder.geocode_listings()

    enricher = DetailEnricher(db)
    enriched = await enricher.enrich()

    aggregator = PriceAggregator(db)
    trends = aggregator.aggregate()

    return {
        "status": "success",
        "processed": processed,
        "geocoded": geocoded,
        "enriched": enriched,
        "trends_updated": trends
    }

@app.post("/trigger/backfill")
async def trigger_backfill(
    req: Request,
    synthetic_demo_data: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Generate demo-only extrapolated trend data.

    This endpoint is intentionally opt-in because it writes synthetic history.
    Production trend data should come from real listing snapshots/aggregates.
    """
    _require_admin(req)
    if not synthetic_demo_data:
        raise HTTPException(
            status_code=400,
            detail="Synthetic backfill is disabled unless synthetic_demo_data=true is explicitly supplied.",
        )
    # Use every district that actually has clean listing data — not a hardcoded list
    districts = [
        row[0] for row in
        db.query(Listing.district)
        .filter(Listing.district.isnot(None), Listing.price_lkr.isnot(None), Listing.is_outlier == False)
        .distinct()
        .all()
    ]
    types = ["land", "house", "apartment"]
    now = datetime.utcnow()
    count = 0
    import random

    for d in districts:
        for pt in types:
            # Use the most recent value already stored in price_aggregates as the base.
            # This guarantees the historical trend connects seamlessly to the real
            # aggregated data — no jump possible since we extrapolate backward from
            # the exact same value the chart's current month already shows.
            latest = (
                db.query(PriceAggregate)
                .filter(PriceAggregate.district == d, PriceAggregate.property_type == pt)
                .order_by(desc(PriceAggregate.period_year), desc(PriceAggregate.period_month))
                .first()
            )

            if not latest or not latest.avg_price_lkr:
                continue

            base = float(latest.avg_price_lkr)

            for i in range(1, 13):
                m, y = now.month - i, now.year
                if m <= 0: m += 12; y -= 1

                # Extrapolate backward: ~1.5% lower per month + small noise
                trend = base * (1 - (i * 0.015)) * random.uniform(0.98, 1.02)
                stmt = insert(PriceAggregate).values(
                    district=d, property_type=pt, period_year=y, period_month=m,
                    avg_price_lkr=trend, median_price_lkr=trend,
                    listing_count=random.randint(50, 400),
                    computed_at=datetime.utcnow()
                ).on_conflict_do_update(
                    index_elements=['district', 'property_type', 'period_year', 'period_month'],
                    set_={"avg_price_lkr": trend, "median_price_lkr": trend, "computed_at": datetime.utcnow()}
                )
                db.execute(stmt)
                count += 1

    db.commit()
    return {"status": "success", "synthetic_demo_data": True, "backfilled_points": count}

class PriceAggregator:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _bedroom_bucket(bedrooms) -> str | None:
        if bedrooms is None:
            return None
        if bedrooms <= 1:
            return "1"
        if bedrooms == 2:
            return "2"
        if bedrooms == 3:
            return "3"
        if bedrooms == 4:
            return "4"
        return "5+"

    def aggregate(self):
        """Calculates monthly stats and populates price_aggregates table."""
        now = datetime.utcnow()

        # --- Broad aggregates: (district, property_type, period) ---
        broad_results = (
            self.db.query(
                Listing.district,
                Listing.property_type,
                func.extract('year', Listing.scraped_at).label('year'),
                func.extract('month', Listing.scraped_at).label('month'),
                func.avg(Listing.price_lkr).label('avg_price'),
                func.avg(Listing.price_per_perch).label('avg_perch'),
                func.count(Listing.id).label('count')
            )
            .filter(
                Listing.price_lkr.isnot(None),
                Listing.district.isnot(None),
                Listing.is_outlier == False,
                Listing.is_short_term == False,
            )
            .group_by(Listing.district, Listing.property_type, 'year', 'month')
            .all()
        )

        for d, pt, y, m, avg_lkr, avg_perch, count in broad_results:
            stmt = insert(PriceAggregate).values(
                district=d,
                property_type=pt,
                bedroom_bucket=None,
                period_year=int(y),
                period_month=int(m),
                avg_price_lkr=avg_lkr,
                median_price_lkr=avg_lkr,
                median_price_per_perch=avg_perch,
                listing_count=count,
                computed_at=now,
            ).on_conflict_do_update(
                index_elements=['district', 'property_type', 'period_year', 'period_month'],
                index_where=PriceAggregate.bedroom_bucket.is_(None),
                set_={
                    "avg_price_lkr": avg_lkr,
                    "median_price_lkr": avg_lkr,
                    "median_price_per_perch": avg_perch,
                    "listing_count": count,
                    "computed_at": now,
                }
            )
            self.db.execute(stmt)

        # --- Bucketed aggregates: (district, property_type, bedroom_bucket, period) ---
        # Only for houses/apartments — land/commercial don't have meaningful bedroom counts
        bucketed_results = (
            self.db.query(
                Listing.district,
                Listing.property_type,
                Listing.bedrooms,
                func.extract('year', Listing.scraped_at).label('year'),
                func.extract('month', Listing.scraped_at).label('month'),
                func.avg(Listing.price_lkr).label('avg_price'),
                func.avg(Listing.price_per_perch).label('avg_perch'),
                func.count(Listing.id).label('count')
            )
            .filter(
                Listing.price_lkr.isnot(None),
                Listing.district.isnot(None),
                Listing.bedrooms.isnot(None),
                Listing.property_type.in_(["house", "apartment", "villa"]),
                Listing.is_outlier == False,
                Listing.is_short_term == False,
            )
            .group_by(Listing.district, Listing.property_type, Listing.bedrooms, 'year', 'month')
            .all()
        )

        # Collapse individual bedroom counts into buckets, re-summing within each bucket
        from collections import defaultdict
        bucket_agg: dict = defaultdict(lambda: {"sum": 0.0, "count": 0, "perch_sum": 0.0})
        for d, pt, beds, y, m, avg_lkr, avg_perch, cnt in bucketed_results:
            if avg_lkr is None:
                continue
            bucket = self._bedroom_bucket(beds)
            if bucket is None:
                continue
            key = (d, pt, bucket, int(y), int(m))
            bucket_agg[key]["sum"] += float(avg_lkr) * cnt
            bucket_agg[key]["count"] += cnt
            if avg_perch:
                bucket_agg[key]["perch_sum"] += float(avg_perch) * cnt

        for (d, pt, bucket, y, m), agg in bucket_agg.items():
            if agg["count"] < 3:
                continue
            avg_lkr = agg["sum"] / agg["count"]
            avg_perch = agg["perch_sum"] / agg["count"] if agg["perch_sum"] else None
            stmt = insert(PriceAggregate).values(
                district=d,
                property_type=pt,
                bedroom_bucket=bucket,
                period_year=y,
                period_month=m,
                avg_price_lkr=avg_lkr,
                median_price_lkr=avg_lkr,
                median_price_per_perch=avg_perch,
                listing_count=agg["count"],
                computed_at=now,
            ).on_conflict_do_update(
                index_elements=['district', 'property_type', 'bedroom_bucket', 'period_year', 'period_month'],
                index_where=PriceAggregate.bedroom_bucket.isnot(None),
                set_={
                    "avg_price_lkr": avg_lkr,
                    "median_price_lkr": avg_lkr,
                    "median_price_per_perch": avg_perch,
                    "listing_count": agg["count"],
                    "computed_at": now,
                }
            )
            self.db.execute(stmt)

        self.db.commit()
        self._update_deal_scores()
        return len(broad_results)

    def _update_deal_scores(self):
        """Stamps deal_score and market_median_lkr on each non-outlier listing.

        deal_score = 100 * (1 - price_lkr / market_median_lkr)
        Positive = below median (good deal), negative = above median.
        Clamped to [-100, 100].

        Uses comparable-based pricing: compares against listings with the same
        bedroom bucket (1/2/3/4/5+) in the same district+type (min 5 listings).
        Falls back to broad district+type median if no bucket data.

        Implemented as a single SQL UPDATE to avoid loading all listings into
        Python memory (prior approach took ~108 min on large tables).
        """
        self.db.execute(text("""
            WITH latest_broad AS (
                SELECT DISTINCT ON (district, property_type)
                    district, property_type, median_price_lkr
                FROM price_aggregates
                WHERE bedroom_bucket IS NULL
                  AND median_price_lkr IS NOT NULL
                ORDER BY district, property_type, period_year DESC, period_month DESC
            ),
            latest_bucketed AS (
                SELECT DISTINCT ON (district, property_type, bedroom_bucket)
                    district, property_type, bedroom_bucket,
                    median_price_lkr, listing_count
                FROM price_aggregates
                WHERE bedroom_bucket IS NOT NULL
                  AND median_price_lkr IS NOT NULL
                ORDER BY district, property_type, bedroom_bucket,
                         period_year DESC, period_month DESC
            ),
            resolved AS (
                SELECT
                    l.id,
                    COALESCE(
                        CASE WHEN b.listing_count >= :min_bucket_count
                             THEN b.median_price_lkr ELSE NULL END,
                        br.median_price_lkr
                    ) AS market_median
                FROM listings l
                LEFT JOIN latest_bucketed b
                    ON  b.district       = l.district
                    AND b.property_type  = l.property_type
                    AND b.bedroom_bucket = CASE
                        WHEN l.bedrooms IS NULL THEN NULL
                        WHEN l.bedrooms <= 1    THEN '1'
                        WHEN l.bedrooms = 2     THEN '2'
                        WHEN l.bedrooms = 3     THEN '3'
                        WHEN l.bedrooms = 4     THEN '4'
                        ELSE '5+'
                    END
                LEFT JOIN latest_broad br
                    ON  br.district      = l.district
                    AND br.property_type = l.property_type
                WHERE l.is_outlier = FALSE
                  AND l.price_lkr      IS NOT NULL
                  AND l.district       IS NOT NULL
                  AND l.property_type  IS NOT NULL
            )
            UPDATE listings
            SET
                market_median_lkr = r.market_median,
                deal_score = GREATEST(-100.0, LEAST(100.0,
                    ROUND(
                        ((1.0 - listings.price_lkr::float8 / r.market_median::float8) * 100.0)::numeric,
                        1
                    )::float8
                ))
            FROM resolved r
            WHERE listings.id = r.id
              AND r.market_median IS NOT NULL
              AND r.market_median > 0
        """), {"min_bucket_count": 5})
        self.db.commit()


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_clean = db.query(func.count(Listing.id)).scalar()
    has_districts = db.query(func.count(Listing.id)).filter(Listing.district.isnot(None)).scalar() > 0

    if total_clean > 0:
        total_listings = total_clean
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_listings = db.query(func.count(Listing.id)).filter(
            Listing.first_seen_at >= seven_days_ago
        ).scalar()
        avg_price = db.query(func.avg(Listing.price_lkr)).filter(
            Listing.price_lkr.isnot(None),
            Listing.is_outlier == False,
        ).scalar()
        by_type = dict(
            db.query(Listing.property_type, func.count(Listing.id))
            .group_by(Listing.property_type)
            .all()
        )
    else:
        total_listings = db.query(func.count(RawListing.id)).scalar()
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_listings = db.query(func.count(RawListing.id)).filter(
            RawListing.scraped_at >= seven_days_ago
        ).scalar()
        avg_price = None
        by_type = dict(
            db.query(RawListing.property_type, func.count(RawListing.id))
            .group_by(RawListing.property_type)
            .all()
        )

    # Always scan titles for district count (more reliable than relying on cleaned district field)
    districts_covered = (
        db.query(func.count(func.distinct(Listing.district))).filter(Listing.district.isnot(None)).scalar()
        if has_districts
        else sum(
            1 for d in DISTRICT_COORDS
            if db.query(func.count(RawListing.id)).filter(RawListing.title.ilike(f"%{d}%")).scalar() > 0
        )
    )

    last_run = db.query(ScrapeRun).order_by(desc(ScrapeRun.finished_at)).first()

    # Month-over-month price change from price_aggregates
    price_change_pct = None
    try:
        now = datetime.utcnow()
        cur_y, cur_m = now.year, now.month
        prev_m, prev_y = (cur_m - 1, cur_y) if cur_m > 1 else (12, cur_y - 1)

        cur_avg = db.query(func.avg(PriceAggregate.avg_price_lkr)).filter(
            PriceAggregate.period_year == cur_y,
            PriceAggregate.period_month == cur_m,
            PriceAggregate.avg_price_lkr.isnot(None),
        ).scalar()
        prev_avg = db.query(func.avg(PriceAggregate.avg_price_lkr)).filter(
            PriceAggregate.period_year == prev_y,
            PriceAggregate.period_month == prev_m,
            PriceAggregate.avg_price_lkr.isnot(None),
        ).scalar()
        if cur_avg and prev_avg and prev_avg > 0:
            price_change_pct = round(((float(cur_avg) - float(prev_avg)) / float(prev_avg)) * 100, 1)
    except Exception:
        pass

    return {
        "total_listings": total_listings,
        "listings_last_7_days": recent_listings,
        "avg_price_lkr": float(avg_price) if avg_price else None,
        "price_change_pct": price_change_pct,
        "districts_covered": districts_covered,
        "listings_by_type": by_type,
        "last_updated": last_run.finished_at.isoformat() if last_run and last_run.finished_at else None,
        "data_source": "cleaned" if total_clean > 0 else "raw",
    }


# ---------------------------------------------------------------------------
# Districts
# ---------------------------------------------------------------------------

@app.get("/districts")
def list_districts(
    property_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    has_districts = db.query(func.count(Listing.id)).filter(Listing.district.isnot(None)).scalar() > 0

    if has_districts:
        query = db.query(
            Listing.district,
            func.count(Listing.id).label("count"),
            func.avg(Listing.price_lkr).label("avg_price"),
        ).filter(Listing.district.isnot(None), Listing.is_outlier == False)

        if property_type:
            query = query.filter(Listing.property_type == property_type)

        results = query.group_by(Listing.district).order_by(desc("count")).all()
        return [
            {
                "district": d,
                "count": c,
                "avg_price": round(float(a), 2) if a else None,
            }
            for d, c, a in results
        ]
    else:
        # Scan raw_listings titles for district names
        results = []
        for district in DISTRICT_COORDS:
            dq = db.query(func.count(RawListing.id)).filter(
                RawListing.title.ilike(f"%{district}%")
            )
            if property_type:
                dq = dq.filter(RawListing.property_type == property_type)
            count = dq.scalar()
            if count and count > 0:
                results.append({"district": district, "count": count, "avg_price": None})
        results.sort(key=lambda x: x["count"], reverse=True)
        return results


# ---------------------------------------------------------------------------
# Heatmap data
# ---------------------------------------------------------------------------

@app.get("/heatmap")
def get_heatmap(
    property_type: Optional[str] = None,
    listing_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    has_districts = db.query(func.count(Listing.id)).filter(Listing.district.isnot(None)).scalar() > 0

    points = []

    if has_districts:
        query = db.query(
            Listing.district,
            func.count(Listing.id).label("count"),
            func.avg(Listing.price_lkr).label("avg_price"),
        ).filter(
            Listing.district.isnot(None),
            Listing.is_outlier == False,
            Listing.price_lkr.isnot(None),
            Listing.price_lkr > 0,
        )

        if property_type:
            query = query.filter(Listing.property_type == property_type)
        if listing_type:
            query = query.filter(Listing.listing_type == listing_type)

        results = query.group_by(Listing.district).all()

        for district, count, avg_price in results:
            coords = DISTRICT_COORDS.get(district)
            if coords:
                points.append({
                    "district": district,
                    "lat": coords[0],
                    "lng": coords[1],
                    "count": count,
                    "avg_price": round(float(avg_price), 2) if avg_price else None,
                })
    else:
        # Fallback: scan raw_listings titles for district names
        for district, coords in DISTRICT_COORDS.items():
            dq = db.query(func.count(RawListing.id)).filter(
                RawListing.title.ilike(f"%{district}%")
            )
            if property_type:
                dq = dq.filter(RawListing.property_type == property_type)
            count = dq.scalar()
            if count and count > 0:
                points.append({
                    "district": district,
                    "lat": coords[0],
                    "lng": coords[1],
                    "count": count,
                    "avg_price": None,
                })

    return {"points": points, "total_districts": len(points)}


# ---------------------------------------------------------------------------
# Listings (with filtering, sorting, pagination)
# ---------------------------------------------------------------------------

@app.get("/listings")
def get_listings(
    district: Optional[str] = None,
    property_type: Optional[str] = None,
    listing_type: Optional[str] = None,
    source: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_bedrooms: Optional[int] = None,
    min_bathrooms: Optional[int] = None,
    min_size_perches: Optional[float] = None,
    max_size_perches: Optional[float] = None,
    min_size_sqft: Optional[float] = None,
    max_size_sqft: Optional[float] = None,
    sort: str = Query("newest", pattern="^(newest|price_asc|price_desc)$"),
    limit: int = Query(30, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    total_clean = db.query(func.count(Listing.id)).scalar()

    if total_clean > 0:
        # Join with raw_listings to get title and URL
        query = db.query(Listing, RawListing.title, RawListing.url, RawListing.raw_price).outerjoin(
            RawListing, Listing.raw_id == RawListing.id
        ).filter(Listing.is_outlier == False)

        if district:
            # Robust filter: check both clean district field and raw title
            query = query.filter(
                or_(
                    Listing.district == district,
                    RawListing.title.ilike(f"%{district}%")
                )
            )
        if property_type:
            query = query.filter(Listing.property_type == property_type)
        if listing_type:
            query = query.filter(Listing.listing_type == listing_type)
        if source:
            query = query.filter(Listing.source == source)
        if min_price is not None:
            query = query.filter(Listing.price_lkr >= min_price)
        if max_price is not None:
            query = query.filter(Listing.price_lkr <= max_price)
        if min_bedrooms is not None:
            query = query.filter(Listing.bedrooms >= min_bedrooms)
        if min_bathrooms is not None:
            query = query.filter(Listing.bathrooms >= min_bathrooms)
        if min_size_perches is not None:
            query = query.filter(Listing.size_perches >= min_size_perches)
        if max_size_perches is not None:
            query = query.filter(Listing.size_perches <= max_size_perches)
        if min_size_sqft is not None:
            query = query.filter(Listing.size_sqft >= min_size_sqft)
        if max_size_sqft is not None:
            query = query.filter(Listing.size_sqft <= max_size_sqft)

        total = query.count()

        if sort == "newest":
            # first_seen_at = when we discovered the listing.
            # last_seen_at is bumped on every re-scrape, so sorting by it makes
            # weeks-old ads (re-touched today) appear above truly new ones.
            query = query.order_by(
                desc(Listing.first_seen_at).nullslast(),
                desc(Listing.id),
            )
        elif sort == "price_asc":
            query = query.order_by(Listing.price_lkr.asc().nullslast())
        elif sort == "price_desc":
            query = query.order_by(Listing.price_lkr.desc().nullslast())

        results = query.offset(offset).limit(limit).all()

        now_utc = datetime.utcnow()
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "listings": [
                {
                    "id": l.id,
                    "source": l.source,
                    "title": raw_title or l.source_id,
                    "price_lkr": float(l.price_lkr) if l.price_lkr else None,
                    "original_price_lkr": float(l.original_price_lkr) if l.original_price_lkr else None,
                    "price_drop_pct": (
                        round((1 - float(l.price_lkr) / float(l.original_price_lkr)) * 100, 1)
                        if l.price_lkr and l.original_price_lkr and float(l.original_price_lkr) > 0
                           and float(l.price_lkr) < float(l.original_price_lkr)
                        else None
                    ),
                    "deal_score": float(l.deal_score) if l.deal_score is not None else None,
                    "market_median_lkr": float(l.market_median_lkr) if l.market_median_lkr else None,
                    "days_on_market": (
                        (now_utc - l.first_seen_at.replace(tzinfo=None)).days
                        if l.first_seen_at else None
                    ),
                    "price_per_perch": float(l.price_per_perch) if l.price_per_perch else None,
                    "raw_price": raw_price,
                    "district": l.district,
                    "city": l.city,
                    "raw_location": l.raw_location,
                    "property_type": l.property_type,
                    "listing_type": l.listing_type,
                    "size_perches": float(l.size_perches) if l.size_perches else None,
                    "size_sqft": float(l.size_sqft) if l.size_sqft else None,
                    "bedrooms": l.bedrooms,
                    "bathrooms": l.bathrooms,
                    "url": raw_url,
                    "first_seen_at": l.first_seen_at.isoformat() if l.first_seen_at else None,
                    "lat": float(l.lat) if l.lat else None,
                    "lng": float(l.lng) if l.lng else None,
                }
                for l, raw_title, raw_url, raw_price in results
            ],
        }
    else:
        # Fallback: serve raw_listings
        query = db.query(RawListing)

        if property_type:
            query = query.filter(RawListing.property_type == property_type)
        if listing_type:
            query = query.filter(RawListing.listing_type == listing_type)

        total = query.count()

        query = query.order_by(desc(RawListing.scraped_at))
        results = query.offset(offset).limit(limit).all()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "data_source": "raw",
            "listings": [
                {
                    "id": r.id,
                    "source": r.source,
                    "title": r.title,
                    "raw_price": r.raw_price,
                    "price_lkr": None,
                    "price_per_perch": None,
                    "district": None,
                    "city": None,
                    "raw_location": r.raw_location,
                    "property_type": r.property_type,
                    "listing_type": r.listing_type,
                    "size_perches": None,
                    "bedrooms": None,
                    "bathrooms": None,
                    "url": r.url,
                    "first_seen_at": r.scraped_at.isoformat() if r.scraped_at else None,
                    "lat": None,
                    "lng": None,
                }
                for r in results
            ],
        }


# ---------------------------------------------------------------------------
# Prices (time-series for charts)
# ---------------------------------------------------------------------------

@app.get("/prices")
def get_prices(
    district: str,
    property_type: str = "land",
    months: int = Query(9, ge=1, le=24),
    db: Session = Depends(get_db),
):
    aggregates = (
        db.query(PriceAggregate)
        .filter(
            PriceAggregate.district == district,
            PriceAggregate.property_type == property_type,
            PriceAggregate.bedroom_bucket.is_(None),
        )
        .order_by(desc(PriceAggregate.period_year), desc(PriceAggregate.period_month))
        .limit(months)
        .all()
    )

    return [
        {
            "year": a.period_year,
            "month": a.period_month,
            "median_price_lkr": float(a.median_price_lkr) if a.median_price_lkr else None,
            "median_price_per_perch": float(a.median_price_per_perch) if a.median_price_per_perch else None,
            "avg_price_lkr": float(a.avg_price_lkr) if a.avg_price_lkr else None,
            "count": a.listing_count,
        }
        for a in aggregates
    ]


# ---------------------------------------------------------------------------
# Single listing detail
# ---------------------------------------------------------------------------

@app.get("/listings/{listing_id}")
def get_listing_detail(listing_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(Listing, RawListing.title, RawListing.url, RawListing.raw_price, RawListing.description)
        .outerjoin(RawListing, Listing.raw_id == RawListing.id)
        .filter(Listing.id == listing_id)
        .first()
    )
    if not row:
        # Fallback: serve from raw_listings when no clean data exists yet
        raw = db.query(RawListing).filter(RawListing.id == listing_id).first()
        if not raw:
            raise HTTPException(status_code=404, detail="Listing not found")
        return {
            "id": raw.id,
            "source": raw.source,
            "source_id": raw.source_id,
            "title": raw.title,
            "description": _public_description(raw.description),
            "price_lkr": None,
            "original_price_lkr": None,
            "price_drop_pct": None,
            "deal_score": None,
            "market_median_lkr": None,
            "days_on_market": None,
            "price_per_perch": None,
            "price_per_sqft": None,
            "raw_price": raw.raw_price,
            "district": None,
            "city": None,
            "raw_location": raw.raw_location,
            "property_type": raw.property_type,
            "listing_type": raw.listing_type,
            "size_perches": None,
            "size_sqft": None,
            "bedrooms": None,
            "bathrooms": None,
            "url": raw.url,
            "first_seen_at": raw.scraped_at.isoformat() if raw.scraped_at else None,
            "last_seen_at": None,
            "lat": None,
            "lng": None,
        }

    l, raw_title, raw_url, raw_price, description = row
    now_utc = datetime.utcnow()
    return {
        "id": l.id,
        "source": l.source,
        "source_id": l.source_id,
        "title": raw_title or l.source_id,
        "description": _public_description(description),
        "price_lkr": float(l.price_lkr) if l.price_lkr else None,
        "original_price_lkr": float(l.original_price_lkr) if l.original_price_lkr else None,
        "price_drop_pct": (
            round((1 - float(l.price_lkr) / float(l.original_price_lkr)) * 100, 1)
            if l.price_lkr and l.original_price_lkr and float(l.original_price_lkr) > 0
               and float(l.price_lkr) < float(l.original_price_lkr)
            else None
        ),
        "deal_score": float(l.deal_score) if l.deal_score is not None else None,
        "market_median_lkr": float(l.market_median_lkr) if l.market_median_lkr else None,
        "days_on_market": (
            (now_utc - l.first_seen_at.replace(tzinfo=None)).days
            if l.first_seen_at else None
        ),
        "price_per_perch": float(l.price_per_perch) if l.price_per_perch else None,
        "price_per_sqft": float(l.price_per_sqft) if l.price_per_sqft else None,
        "raw_price": raw_price,
        "district": l.district,
        "city": l.city,
        "raw_location": l.raw_location,
        "property_type": l.property_type,
        "listing_type": l.listing_type,
        "size_perches": float(l.size_perches) if l.size_perches else None,
        "size_sqft": float(l.size_sqft) if l.size_sqft else None,
        "bedrooms": l.bedrooms,
        "bathrooms": l.bathrooms,
        "url": raw_url,
        "first_seen_at": l.first_seen_at.isoformat() if l.first_seen_at else None,
        "last_seen_at": l.last_seen_at.isoformat() if l.last_seen_at else None,
        "lat": float(l.lat) if l.lat else None,
        "lng": float(l.lng) if l.lng else None,
    }


@app.get("/listings/{listing_id}/similar")
def get_similar_listings(listing_id: int, limit: int = Query(6, le=12), db: Session = Depends(get_db)):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        # No clean listing — return empty similar list for raw fallback
        raw = db.query(RawListing).filter(RawListing.id == listing_id).first()
        if not raw:
            raise HTTPException(status_code=404, detail="Listing not found")
        return []

    query = (
        db.query(Listing, RawListing.title, RawListing.url, RawListing.raw_price)
        .outerjoin(RawListing, Listing.raw_id == RawListing.id)
        .filter(
            Listing.id != listing_id,
            Listing.is_outlier == False,
            Listing.district == listing.district,
        )
    )

    if listing.property_type:
        query = query.filter(Listing.property_type == listing.property_type)

    if listing.price_lkr:
        price = float(listing.price_lkr)
        query = query.filter(
            Listing.price_lkr >= price * 0.5,
            Listing.price_lkr <= price * 2.0,
        )

    if listing.bedrooms:
        query = query.filter(
            Listing.bedrooms >= max(0, listing.bedrooms - 1),
            Listing.bedrooms <= listing.bedrooms + 1,
        )

    results = query.order_by(desc(Listing.first_seen_at)).limit(limit).all()
    now_utc = datetime.utcnow()

    return [
        {
            "id": l.id,
            "source": l.source,
            "title": raw_title or l.source_id,
            "price_lkr": float(l.price_lkr) if l.price_lkr else None,
            "deal_score": float(l.deal_score) if l.deal_score is not None else None,
            "price_per_perch": float(l.price_per_perch) if l.price_per_perch else None,
            "district": l.district,
            "city": l.city,
            "property_type": l.property_type,
            "listing_type": l.listing_type,
            "size_perches": float(l.size_perches) if l.size_perches else None,
            "size_sqft": float(l.size_sqft) if l.size_sqft else None,
            "bedrooms": l.bedrooms,
            "bathrooms": l.bathrooms,
            "url": raw_url,
            "first_seen_at": l.first_seen_at.isoformat() if l.first_seen_at else None,
            "days_on_market": (
                (now_utc - l.first_seen_at.replace(tzinfo=None)).days
                if l.first_seen_at else None
            ),
        }
        for l, raw_title, raw_url, raw_price in results
    ]


@app.get("/listings/{listing_id}/price-history")
def get_listing_price_history(listing_id: int, db: Session = Depends(get_db)):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    snapshots = (
        db.query(ListingSnapshot)
        .filter(
            ListingSnapshot.source == listing.source,
            ListingSnapshot.source_id == listing.source_id,
        )
        .order_by(ListingSnapshot.scraped_at.asc())
        .all()
    )

    return [
        {
            "date": s.scraped_at.isoformat() if s.scraped_at else None,
            "raw_price": s.raw_price,
        }
        for s in snapshots
    ]


# ---------------------------------------------------------------------------
# Price Estimate Tool
# ---------------------------------------------------------------------------

class EstimateRequest(BaseModel):
    district: Optional[str] = None
    property_type: str
    listing_type: str
    size_perches: Optional[float] = None
    size_sqft: Optional[float] = None
    bedrooms: Optional[int] = None

@app.post("/estimate")
def estimate_price(req: EstimateRequest, db: Session = Depends(get_db)):
    listing_type = (req.listing_type or "").lower().strip()
    if listing_type not in {"sale", "rent"}:
        raise HTTPException(status_code=422, detail="listing_type must be 'sale' or 'rent'")

    criteria = EstimateCriteria(
        district=req.district,
        property_type=req.property_type,
        listing_type=listing_type,
        size_perches=req.size_perches,
        size_sqft=req.size_sqft,
        bedrooms=req.bedrooms,
    )

    query = db.query(Listing).filter(
        Listing.property_type == req.property_type,
        Listing.listing_type == listing_type,
        Listing.price_lkr.isnot(None),
        Listing.price_lkr > 0,
        Listing.is_outlier == False,
        Listing.is_short_term == False,
    )

    candidates = query.order_by(desc(Listing.first_seen_at)).limit(500).all()
    tier, tier_candidates = choose_match_tier(candidates, criteria)
    ranked = ranked_comparables(tier_candidates, criteria, tier, datetime.utcnow())
    estimate_rows = ranked[:MAX_ESTIMATE_COMPS]
    comparables = [row[0] for row in estimate_rows]
    scores_by_id = {row[0].id: (row[1], row[2]) for row in ranked}

    prices = sorted([float(c.price_lkr) for c in comparables if c.price_lkr])
    ppp_vals = sorted([float(c.price_per_perch) for c in comparables if c.price_per_perch and c.price_per_perch > 0])
    pps_vals = sorted([float(c.price_per_sqft) for c in comparables if c.price_per_sqft and c.price_per_sqft > 0])

    if not prices:
        return {
            "estimated_low": None,
            "estimated_median": None,
            "estimated_high": None,
            "comparable_count": 0,
            "confidence": "none",
            "match_tier": tier.label,
            "confidence_reason": "No comparable listings matched these criteria.",
            "average_similarity_score": 0,
            "matched_criteria": build_matched_criteria(criteria, tier),
            "median_price_per_perch": None,
            "median_price_per_sqft": None,
            "comparables": [],
        }

    n = len(prices)
    p25 = percentile(prices, 0.25)
    median = percentile(prices, 0.5)
    p75 = percentile(prices, 0.75)

    def _median(vals: list) -> float | None:
        if not vals:
            return None
        return vals[len(vals) // 2]

    median_ppp = _median(ppp_vals)
    median_pps = _median(pps_vals)
    average_similarity = round(sum(row[1] for row in estimate_rows) / len(estimate_rows), 1)
    confidence, confidence_reason = confidence_for(n, average_similarity, tier)

    now_utc = datetime.utcnow()
    top_comparables = comparables[:MAX_DISPLAY_COMPS]
    comp_list = []
    for c in top_comparables:
        similarity_score, match_reasons = scores_by_id.get(c.id, (0, []))
        raw = db.query(RawListing).filter(RawListing.id == c.raw_id).first() if c.raw_id else None
        comp_list.append({
            "id": c.id,
            "source": c.source,
            "title": (raw.title if raw else None) or c.source_id,
            "price_lkr": float(c.price_lkr) if c.price_lkr else None,
            "original_price_lkr": float(c.original_price_lkr) if c.original_price_lkr else None,
            "price_drop_pct": (
                round((1 - float(c.price_lkr) / float(c.original_price_lkr)) * 100, 1)
                if c.price_lkr and c.original_price_lkr and float(c.original_price_lkr) > 0
                   and float(c.price_lkr) < float(c.original_price_lkr)
                else None
            ),
            "district": c.district,
            "city": c.city,
            "raw_location": c.raw_location,
            "property_type": c.property_type,
            "listing_type": c.listing_type,
            "size_perches": float(c.size_perches) if c.size_perches else None,
            "size_sqft": float(c.size_sqft) if c.size_sqft else None,
            "bedrooms": c.bedrooms,
            "bathrooms": c.bathrooms,
            "deal_score": float(c.deal_score) if c.deal_score is not None else None,
            "market_median_lkr": float(c.market_median_lkr) if c.market_median_lkr else None,
            "price_per_perch": float(c.price_per_perch) if c.price_per_perch else None,
            "url": (raw.url if raw else None),
            "first_seen_at": c.first_seen_at.isoformat() if c.first_seen_at else None,
            "days_on_market": (
                (now_utc - c.first_seen_at.replace(tzinfo=None)).days
                if c.first_seen_at else None
            ),
            "lat": float(c.lat) if c.lat else None,
            "lng": float(c.lng) if c.lng else None,
            "similarity_score": similarity_score,
            "match_reasons": match_reasons,
        })

    return {
        "estimated_low": round(p25, 2) if p25 is not None else None,
        "estimated_median": round(median, 2) if median is not None else None,
        "estimated_high": round(p75, 2) if p75 is not None else None,
        "comparable_count": n,
        "confidence": confidence,
        "match_tier": tier.label,
        "confidence_reason": confidence_reason,
        "average_similarity_score": average_similarity,
        "matched_criteria": build_matched_criteria(criteria, tier),
        "median_price_per_perch": round(median_ppp, 2) if median_ppp else None,
        "median_price_per_sqft": round(median_pps, 2) if median_pps else None,
        "comparables": comp_list,
    }


# ---------------------------------------------------------------------------
# Exchange Rates
# ---------------------------------------------------------------------------

EXCHANGE_RATE_API_KEY = os.getenv("EXCHANGE_RATE_API_KEY", "")

_FALLBACK_RATES = {
    "LKR": 1.0,
    "USD": 0.00306,
    "AUD": 0.00471,
    "GBP": 0.00242,
    "CAD": 0.00417,
}

_exchange_rate_cache: dict = {"rates": _FALLBACK_RATES.copy(), "fetched_at": None, "source": "hardcoded"}

@app.get("/exchange-rates")
def get_exchange_rates():
    now = datetime.now(timezone.utc)
    cache_stale = (
        _exchange_rate_cache["fetched_at"] is None
        or (now - _exchange_rate_cache["fetched_at"]).total_seconds() > 3600
    )

    if cache_stale and EXCHANGE_RATE_API_KEY:
        try:
            resp = httpx.get(
                f"https://v6.exchangerate-api.com/v6/{EXCHANGE_RATE_API_KEY}/latest/LKR",
                timeout=5.0,
            )
            resp.raise_for_status()
            data = resp.json()
            conv = data.get("conversion_rates", {})
            rates = {
                "LKR": 1.0,
                "USD": conv.get("USD", _FALLBACK_RATES["USD"]),
                "AUD": conv.get("AUD", _FALLBACK_RATES["AUD"]),
                "GBP": conv.get("GBP", _FALLBACK_RATES["GBP"]),
                "CAD": conv.get("CAD", _FALLBACK_RATES["CAD"]),
            }
            _exchange_rate_cache["rates"] = rates
            _exchange_rate_cache["fetched_at"] = now
            _exchange_rate_cache["source"] = "exchangerate-api"
        except Exception:
            _exchange_rate_cache["fetched_at"] = now  # avoid hammering on error

    return {
        "rates": _exchange_rate_cache["rates"],
        "base": "LKR",
        "source": _exchange_rate_cache["source"],
        "updated_at": _exchange_rate_cache["fetched_at"].isoformat() if _exchange_rate_cache["fetched_at"] else None,
    }


# ---------------------------------------------------------------------------
# Rental Yield Analytics
# ---------------------------------------------------------------------------

def _bedroom_bucket(bedrooms: Optional[int]) -> Optional[str]:
    if bedrooms is None:
        return None
    if bedrooms <= 1:
        return "1"
    if bedrooms == 2:
        return "2"
    if bedrooms == 3:
        return "3"
    if bedrooms == 4:
        return "4"
    return "5+"

def _median_of(values: list) -> Optional[float]:
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return float(s[mid]) if n % 2 == 1 else float((s[mid - 1] + s[mid]) / 2)

@app.get("/analytics/rental-yield")
def get_rental_yield(
    district: str = Query(...),
    property_type: str = Query(...),
    bedrooms: Optional[int] = Query(None),
    deal_score: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    if property_type not in ("house", "apartment", "villa"):
        return {"available": False, "reason": "Rental yield only available for house, apartment, and villa listings"}

    bucket = _bedroom_bucket(bedrooms)

    def _price_rows(listing_type: str):
        q = db.query(Listing.price_lkr, Listing.days_on_market).filter(
            Listing.district == district,
            Listing.property_type == property_type,
            Listing.listing_type == listing_type,
            Listing.price_lkr.isnot(None),
            Listing.is_outlier == False,
        )
        if bucket and bedrooms is not None:
            lo = int(bucket.rstrip("+")) if "+" not in bucket else 5
            if bucket == "5+":
                q = q.filter(Listing.bedrooms >= 5)
            else:
                q = q.filter(Listing.bedrooms == lo)
        return q.all()

    sale_rows = _price_rows("sale")
    rent_rows = _price_rows("rent")

    sale_count = len(sale_rows)
    rent_count = len(rent_rows)

    if rent_count < 2:
        return {"available": False, "reason": f"Insufficient rental data for {property_type} in {district}"}

    sale_prices = [float(r.price_lkr) for r in sale_rows if r.price_lkr]
    rent_prices = [float(r.price_lkr) for r in rent_rows if r.price_lkr]

    sale_median = _median_of(sale_prices)
    rent_median = _median_of(rent_prices)

    if not rent_median:
        return {"available": False, "reason": "Could not compute rent estimate"}

    monthly_rent = rent_median
    annual_rent = monthly_rent * 12

    rental_yield_pct = None
    if sale_median and sale_median > 0:
        rental_yield_pct = round((annual_rent / sale_median) * 100, 2)

    if sale_count >= 15 and rent_count >= 8:
        confidence = "high"
    elif sale_count >= 5 and rent_count >= 3:
        confidence = "medium"
    else:
        confidence = "low"

    # Price trend: compare 3-month-old aggregate vs current for this district+type
    now = datetime.now(timezone.utc)
    current_month_agg = db.query(PriceAggregate).filter(
        PriceAggregate.district == district,
        PriceAggregate.property_type == property_type,
        PriceAggregate.bedroom_bucket.is_(None),
    ).order_by(desc(PriceAggregate.period_year), desc(PriceAggregate.period_month)).first()

    old_date = now - timedelta(days=90)
    old_agg = db.query(PriceAggregate).filter(
        PriceAggregate.district == district,
        PriceAggregate.property_type == property_type,
        PriceAggregate.bedroom_bucket.is_(None),
        PriceAggregate.period_year * 100 + PriceAggregate.period_month <= old_date.year * 100 + old_date.month,
    ).order_by(desc(PriceAggregate.period_year), desc(PriceAggregate.period_month)).first()

    price_trend_pct = None
    if current_month_agg and old_agg and old_agg.median_price_lkr and current_month_agg.median_price_lkr:
        price_trend_pct = float(
            (current_month_agg.median_price_lkr - old_agg.median_price_lkr) / old_agg.median_price_lkr * 100
        )

    # Avg days on market for sale comparables
    dom_values = [r.days_on_market for r in sale_rows if r.days_on_market is not None]
    avg_dom = sum(dom_values) / len(dom_values) if dom_values else None

    # Investment score
    score = 0
    if rental_yield_pct is not None:
        score += min(40, int(rental_yield_pct / 10 * 40))
    if deal_score is not None:
        score += max(0, min(30, int((deal_score + 100) / 200 * 30)))
    else:
        score += 15
    if avg_dom is not None:
        score += max(0, int(20 - (avg_dom / 180 * 20)))
    else:
        score += 10
    if price_trend_pct is not None:
        score += max(0, min(10, int((price_trend_pct + 10) / 20 * 10)))
    else:
        score += 5
    investment_score = min(100, max(0, score))

    return {
        "available": True,
        "rental_yield_pct": rental_yield_pct,
        "monthly_rent_estimate": round(monthly_rent, 2),
        "annual_rent_estimate": round(annual_rent, 2),
        "sale_price_median": round(sale_median, 2) if sale_median else None,
        "data_confidence": confidence,
        "sale_sample_count": sale_count,
        "rent_sample_count": rent_count,
        "investment_score": investment_score,
        "district": district,
        "property_type": property_type,
        "bedrooms": bedrooms,
    }


# ---------------------------------------------------------------------------
# AI Chat (Groq)
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []

@app.post("/chat")
@app.post("/api/chat")
async def chat_with_agent(req: ChatRequest, db: Session = Depends(get_db)):
    from api.services.groq_service import GroqService
    try:
        groq_service = GroqService()
    except Exception as e:
        return {"response": f"System Error initializing Groq: {str(e)}", "context_used": False}

    try:
        # Step 1: Use GroqService to determine if we should ask back, do a fuzzy search, or both
        history = req.history or []
        parsed = await groq_service.extract_search_params(query=req.message, chat_history=history)

        reply_message = parsed.get("message", "")
        filters = parsed.get("filters")

        search_results_context = ""
        context_used = False

        if filters:
            # Re-map the filters to our query builder
            loc_f = filters.get("district", "None")
            type_f = filters.get("property_type", "None")
            list_f = filters.get("listing_type", "None")
            beds_f = str(filters.get("bedrooms", "None"))
            minprice_f = str(filters.get("min_price", "None"))

            def build_query(include_type=True, include_beds=True):
                q = db.query(Listing).filter(Listing.is_outlier == False, Listing.price_lkr.isnot(None))
                if loc_f != "None":
                    q = q.filter((Listing.raw_location.ilike(f"%{loc_f}%")) | (Listing.district.ilike(f"%{loc_f}%")))
                if include_type and type_f != "None":
                    q = q.filter(Listing.property_type == type_f.lower())
                if list_f != "None":
                    if isinstance(list_f, list):
                        q = q.filter(Listing.listing_type.in_([l.lower() for l in list_f]))
                    else:
                        q = q.filter(Listing.listing_type == list_f.lower())
                if include_beds and beds_f != "None" and beds_f.isdigit():
                    q = q.filter(Listing.bedrooms >= int(beds_f))
                if minprice_f != "None" and minprice_f.isdigit():
                    q = q.filter(Listing.price_lkr >= float(minprice_f))
                return q

            found = build_query(include_type=True, include_beds=True).order_by(Listing.price_lkr.desc()).limit(6).all()
            if not found: found = build_query(include_type=True, include_beds=False).order_by(Listing.price_lkr.desc()).limit(6).all()
            if not found: found = build_query(include_type=False, include_beds=False).order_by(Listing.price_lkr.desc()).limit(6).all()

            if found:
                context_used = True
                avg_q = build_query(include_type=True, include_beds=False)
                avg_p = avg_q.with_entities(func.avg(Listing.price_lkr)).filter(Listing.price_lkr > 100000).scalar() or 0
                priced = [l for l in found if l.price_lkr and l.price_lkr > 0]
                avg_note = f"Avg Price LKR {avg_p:,.0f}" if avg_p > 0 else "No price average available"
                
                # Create a concise label showing what was filtered
                label_parts = []
                if loc_f != "None": label_parts.append(str(loc_f))
                if type_f != "None": label_parts.append(str(type_f))
                label = " ".join(label_parts) if label_parts else "Properties"
                
                search_results_context = f"LIVE DB RESULTS for '{label}': {len(found)} listings shown ({len(priced)} with prices). {avg_note}."
                for listing in found:
                    price_str = f"LKR {float(listing.price_lkr):,.0f}" if listing.price_lkr and listing.price_lkr > 0 else "Price not listed"
                    beds_str = f"{int(listing.bedrooms)}BR " if listing.bedrooms else ""
                    title = listing.title or "Property listing"
                    url = listing.url or ""
                    search_results_context += f"\n- {title} | {beds_str}{listing.property_type} in {listing.raw_location}: {price_str} | {url}"

        if search_results_context:
            stats_raw = get_stats(db)
            system_prompt = f"""You are Property AI. The user had a query, and we found DB results.
Present the DB results nicely in a friendly conversational way.
The previous system thought: "{reply_message}" (You MUST use this as a hint to ask any clarifying questions).
LIVE DATABASE RESULTS:
{search_results_context}

RULES:
1. ONLY reference listings explicitly shown in the results. Never invent.
2. For each listing, include its link.
3. Formulate 1-2 clarifying questions if the 'previous system thought' had them or if key info is still missing.
4. Keep answers concise.
"""
            messages = [{"role": "system", "content": system_prompt}]
            if req.history: messages.extend(req.history)
            messages.append({"role": "user", "content": req.message})

            # To avoid creating another client when GroqService exists, we just use its client
            completion = groq_service.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                temperature=0.7,
                max_tokens=1024,
            )
            return {
                "response": completion.choices[0].message.content,
                "context_used": True,
                "filters": filters
            }
        else:
            # Native conversational reply OR no results were found
            message = reply_message
            if filters and not search_results_context:
                # DB was queried but 0 results
                message = "I couldn't find any properties matching those exact criteria. " + (message or "Could you broaden your search or choose another district?")
            elif not message:
                message = "How can I help you regarding Sri Lankan properties today?"
                
            return {
                "response": message, 
                "context_used": False,
                "filters": filters if filters else None
            }

    except Exception as e:
        return {"response": f"AI error: {str(e)}", "context_used": False}


@app.get("/sitemap.xml", response_class=Response)
def sitemap(db: Session = Depends(get_db)):
    base = "https://propertylk.vercel.app"
    districts = [
        row[0] for row in
        db.query(Listing.district)
        .filter(Listing.district.isnot(None))
        .distinct()
        .all()
    ]
    urls = [
        f"  <url><loc>{base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>"
    ]
    for d in sorted(districts):
        enc = d.replace(" ", "%20")
        urls.append(
            f"  <url><loc>{base}/?district={enc}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>"
        )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>"
    )
    return Response(content=xml, media_type="application/xml")


@app.get("/")
def root():
    return {"message": "Ardeno Studio: Intelligence API is Alive and Running"}

try:
    from mangum import Mangum
    handler = Mangum(app, lifespan="off")
except ImportError:
    pass  # Not running on Lambda

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("api.main:app", host="0.0.0.0", port=port, log_level="info", proxy_headers=True, forwarded_allow_ips="*")
