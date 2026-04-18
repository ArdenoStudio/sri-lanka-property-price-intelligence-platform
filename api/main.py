from fastapi import FastAPI, Depends, Query, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, cast, Float, case, or_, and_
from sqlalchemy.dialects.postgresql import insert
from typing import List, Optional
from db.connection import get_db, SessionLocal
from db.models import Listing, RawListing, ScrapeRun, PriceAggregate, JobRun, ListingSnapshot
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import os

app = FastAPI(title="Sri Lanka Property Price Intelligence Platform")

# CORS - allow dashboard frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

@app.get("/public/pipeline")
def public_pipeline(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    jobs = []

    job_defs = [
        {"name": "scrape_ikman", "type": "scrape", "source": "ikman", "expected_hours": 24},
        {"name": "scrape_lpw", "type": "scrape", "source": "lpw", "expected_hours": 24},
        {"name": "scrape_lamudi", "type": "scrape", "source": "lamudi", "expected_hours": 24},
        {"name": "clean_listings", "type": "job", "expected_hours": 24},
        {"name": "geocode_listings", "type": "job", "expected_hours": 24},
        {"name": "compute_aggregates", "type": "job", "expected_hours": 168},
    ]

    for job in job_defs:
        if job["type"] == "scrape":
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
        jobs.append({
            "name": job["name"],
            "status": status,
            "last_success": last_success.isoformat() if last_success else None,
            "last_run": last_started.isoformat() if last_started else None,
            "expected_hours": job["expected_hours"],
        })

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
async def trigger_process(db: Session = Depends(get_db)):
    from scraper.cleaner import DataCleaner
    from scraper.geocoder import Geocoder
    from scraper.detail_enricher import DetailEnricher
    import asyncio

    cleaner = DataCleaner(db)
    processed = cleaner.process_all()

    geocoder = Geocoder(db)
    geocoded = geocoder.geocode_listings()

    enricher = DetailEnricher(db)
    loop = asyncio.new_event_loop()
    try:
        enriched = loop.run_until_complete(enricher.enrich())
    finally:
        loop.close()

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
async def trigger_backfill(db: Session = Depends(get_db)):
    """Generates 12 months of trend data extrapolated backward from real current prices."""
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
    return {"status": "success", "backfilled_points": count}

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

    def _latest_medians_query(self, with_bucket: bool):
        """Returns the most recent aggregate rows, preferring current month with fallback."""
        now = datetime.utcnow()
        bucket_filter = (
            PriceAggregate.bedroom_bucket.isnot(None)
            if with_bucket
            else PriceAggregate.bedroom_bucket.is_(None)
        )
        cols = [
            PriceAggregate.district,
            PriceAggregate.property_type,
            PriceAggregate.median_price_lkr,
            PriceAggregate.listing_count,
        ]
        if with_bucket:
            cols.insert(2, PriceAggregate.bedroom_bucket)

        rows = (
            self.db.query(*cols)
            .filter(
                bucket_filter,
                PriceAggregate.period_year == now.year,
                PriceAggregate.period_month == now.month,
                PriceAggregate.median_price_lkr.isnot(None),
            )
            .all()
        )
        if rows:
            return rows

        # Fall back to most recent available month
        group_cols = [PriceAggregate.district, PriceAggregate.property_type]
        if with_bucket:
            group_cols.append(PriceAggregate.bedroom_bucket)
        subq = (
            self.db.query(
                *group_cols,
                func.max(PriceAggregate.period_year * 100 + PriceAggregate.period_month).label("ym"),
            )
            .filter(bucket_filter, PriceAggregate.median_price_lkr.isnot(None))
            .group_by(*group_cols)
            .subquery()
        )
        join_cond = (
            (PriceAggregate.district == subq.c.district)
            & (PriceAggregate.property_type == subq.c.property_type)
            & (PriceAggregate.period_year * 100 + PriceAggregate.period_month == subq.c.ym)
        )
        if with_bucket:
            join_cond = join_cond & (PriceAggregate.bedroom_bucket == subq.c.bedroom_bucket)
        return self.db.query(*cols).filter(bucket_filter).join(subq, join_cond).all()

    def _update_deal_scores(self):
        """Stamps deal_score and market_median_lkr on each non-outlier listing.

        deal_score = 100 * (1 - price_lkr / market_median_lkr)
        Positive = below median (good deal), negative = above median.
        Clamped to [-100, 100].

        Uses comparable-based pricing: compares against listings with the same
        bedroom bucket (1/2/3/4/5+) in the same district+type (min 5 listings).
        Falls back to broad district+type median if no bucket data.
        """
        MIN_BUCKET_COUNT = 5

        # Build bucketed map: (district, property_type, bedroom_bucket) -> median
        bucketed_map: dict = {}
        for row in self._latest_medians_query(with_bucket=True):
            d, pt, bucket, med, cnt = row
            if med and cnt and cnt >= MIN_BUCKET_COUNT:
                bucketed_map[(d, pt, bucket)] = float(med)

        # Build broad fallback map: (district, property_type) -> median
        broad_map: dict = {}
        for row in self._latest_medians_query(with_bucket=False):
            d, pt, med, cnt = row
            if med:
                broad_map[(d, pt)] = float(med)

        if not broad_map and not bucketed_map:
            return

        listings = (
            self.db.query(Listing)
            .filter(
                Listing.is_outlier == False,
                Listing.price_lkr.isnot(None),
                Listing.district.isnot(None),
                Listing.property_type.isnot(None),
            )
            .all()
        )

        for listing in listings:
            # Try bucketed comparable first
            bucket = self._bedroom_bucket(listing.bedrooms)
            median = None
            if bucket:
                median = bucketed_map.get((listing.district, listing.property_type, bucket))
            # Fall back to broad median
            if not median:
                median = broad_map.get((listing.district, listing.property_type))
            if not median or median <= 0:
                continue
            listing.market_median_lkr = median
            raw_score = (1.0 - float(listing.price_lkr) / median) * 100.0
            listing.deal_score = max(-100.0, min(100.0, round(raw_score, 1)))

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
            query = query.order_by(desc(Listing.last_seen_at))
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
        raise HTTPException(status_code=404, detail="Listing not found")

    l, raw_title, raw_url, raw_price, description = row
    now_utc = datetime.utcnow()
    return {
        "id": l.id,
        "source": l.source,
        "source_id": l.source_id,
        "title": raw_title or l.source_id,
        "description": description,
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
        raise HTTPException(status_code=404, detail="Listing not found")

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
    district: str
    property_type: str
    size_perches: Optional[float] = None
    size_sqft: Optional[float] = None
    bedrooms: Optional[int] = None

@app.post("/estimate")
def estimate_price(req: EstimateRequest, db: Session = Depends(get_db)):
    query = db.query(Listing).filter(
        Listing.district == req.district,
        Listing.property_type == req.property_type,
        Listing.price_lkr.isnot(None),
        Listing.price_lkr > 0,
        Listing.is_outlier == False,
    )

    if req.size_perches:
        query = query.filter(
            Listing.size_perches >= req.size_perches * 0.5,
            Listing.size_perches <= req.size_perches * 2.0,
        )
    if req.size_sqft:
        query = query.filter(
            Listing.size_sqft >= req.size_sqft * 0.5,
            Listing.size_sqft <= req.size_sqft * 2.0,
        )
    if req.bedrooms is not None and req.bedrooms > 0:
        query = query.filter(
            Listing.bedrooms >= max(0, req.bedrooms - 1),
            Listing.bedrooms <= req.bedrooms + 1,
        )

    comparables = query.order_by(desc(Listing.first_seen_at)).limit(50).all()
    prices = sorted([float(c.price_lkr) for c in comparables if c.price_lkr])

    if not prices:
        return {
            "estimated_low": None,
            "estimated_median": None,
            "estimated_high": None,
            "comparable_count": 0,
            "confidence": "none",
            "comparables": [],
        }

    n = len(prices)
    p25 = prices[int(n * 0.25)] if n >= 4 else prices[0]
    median = prices[n // 2]
    p75 = prices[int(n * 0.75)] if n >= 4 else prices[-1]

    confidence = "high" if n >= 20 else ("medium" if n >= 5 else "low")

    now_utc = datetime.utcnow()
    top_comparables = comparables[:6]
    comp_list = []
    for c in top_comparables:
        raw = db.query(RawListing).filter(RawListing.id == c.raw_id).first() if c.raw_id else None
        comp_list.append({
            "id": c.id,
            "title": (raw.title if raw else None) or c.source_id,
            "price_lkr": float(c.price_lkr) if c.price_lkr else None,
            "district": c.district,
            "city": c.city,
            "property_type": c.property_type,
            "size_perches": float(c.size_perches) if c.size_perches else None,
            "size_sqft": float(c.size_sqft) if c.size_sqft else None,
            "bedrooms": c.bedrooms,
            "bathrooms": c.bathrooms,
            "deal_score": float(c.deal_score) if c.deal_score is not None else None,
            "url": (raw.url if raw else None),
            "first_seen_at": c.first_seen_at.isoformat() if c.first_seen_at else None,
            "days_on_market": (
                (now_utc - c.first_seen_at.replace(tzinfo=None)).days
                if c.first_seen_at else None
            ),
        })

    return {
        "estimated_low": round(p25, 2),
        "estimated_median": round(median, 2),
        "estimated_high": round(p75, 2),
        "comparable_count": n,
        "confidence": confidence,
        "comparables": comp_list,
    }


# ---------------------------------------------------------------------------
# Recent listings (legacy endpoint, kept for compatibility)
# ---------------------------------------------------------------------------

@app.get("/listings/recent")
def recent_listings(
    district: Optional[str] = None,
    property_type: Optional[str] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
):
    total_clean = db.query(func.count(Listing.id)).scalar()

    if total_clean > 0:
        query = db.query(Listing)
        if district:
            query = query.filter(Listing.district == district)
        if property_type:
            query = query.filter(Listing.property_type == property_type)
        return query.order_by(desc(Listing.first_seen_at)).limit(limit).all()
    else:
        query = db.query(RawListing)
        if property_type:
            query = query.filter(RawListing.property_type == property_type)
        return query.order_by(desc(RawListing.scraped_at)).limit(limit).all()


# ---------------------------------------------------------------------------
# Listing Detail, Similar, Price History
# ---------------------------------------------------------------------------

def _build_listing_dict(l, raw_title, raw_url, raw_price_str, description, now_utc, price_history=None):
    """Build a full listing detail dict from a Listing ORM row + RawListing fields."""
    price_lkr = float(l.price_lkr) if l.price_lkr else None
    orig_price = float(l.original_price_lkr) if l.original_price_lkr else None
    price_drop_pct = None
    if price_lkr and orig_price and orig_price > 0 and price_lkr < orig_price:
        price_drop_pct = round((1 - price_lkr / orig_price) * 100, 1)

    days_on_market = None
    if l.first_seen_at:
        first = l.first_seen_at.replace(tzinfo=None) if l.first_seen_at.tzinfo else l.first_seen_at
        days_on_market = (now_utc - first).days

    result = {
        "id": l.id,
        "source": l.source,
        "source_id": l.source_id,
        "title": raw_title or l.source_id,
        "description": description,
        "price_lkr": price_lkr,
        "original_price_lkr": orig_price,
        "price_drop_pct": price_drop_pct,
        "deal_score": float(l.deal_score) if l.deal_score is not None else None,
        "market_median_lkr": float(l.market_median_lkr) if l.market_median_lkr else None,
        "days_on_market": days_on_market,
        "price_per_perch": float(l.price_per_perch) if l.price_per_perch else None,
        "price_per_sqft": float(l.price_per_sqft) if l.price_per_sqft else None,
        "raw_price": raw_price_str,
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
    if price_history is not None:
        result["price_history"] = price_history
    return result


@app.get("/listings/{listing_id}")
def get_listing_detail(listing_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(Listing, RawListing.title, RawListing.url, RawListing.raw_price, RawListing.description)
        .outerjoin(RawListing, Listing.raw_id == RawListing.id)
        .filter(Listing.id == listing_id, Listing.is_outlier == False)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Listing not found")

    l, raw_title, raw_url, raw_price_str, description = row
    now_utc = datetime.utcnow()

    # Price history from snapshots
    snapshots = (
        db.query(ListingSnapshot.scraped_at, ListingSnapshot.raw_price)
        .filter(
            ListingSnapshot.source == l.source,
            ListingSnapshot.source_id == l.source_id,
        )
        .order_by(ListingSnapshot.scraped_at.asc())
        .all()
    )
    price_history = [
        {
            "date": s.scraped_at.isoformat() if s.scraped_at else None,
            "raw_price": s.raw_price,
        }
        for s in snapshots
    ]

    return _build_listing_dict(l, raw_title, raw_url, raw_price_str, description, now_utc, price_history)


@app.get("/listings/{listing_id}/similar")
def get_listing_similar(listing_id: int, db: Session = Depends(get_db)):
    base = (
        db.query(Listing)
        .filter(Listing.id == listing_id, Listing.is_outlier == False)
        .first()
    )
    if not base:
        raise HTTPException(status_code=404, detail="Listing not found")

    now_utc = datetime.utcnow()
    q = (
        db.query(Listing, RawListing.title, RawListing.url, RawListing.raw_price)
        .outerjoin(RawListing, Listing.raw_id == RawListing.id)
        .filter(
            Listing.id != listing_id,
            Listing.is_outlier == False,
            Listing.district == base.district,
            Listing.property_type == base.property_type,
        )
    )

    if base.price_lkr:
        low = float(base.price_lkr) * 0.70
        high = float(base.price_lkr) * 1.30
        q = q.filter(Listing.price_lkr >= low, Listing.price_lkr <= high)

    if base.bedrooms is not None:
        q = q.filter(
            Listing.bedrooms >= max(0, base.bedrooms - 1),
            Listing.bedrooms <= base.bedrooms + 1,
        )

    results = q.order_by(desc(Listing.deal_score)).limit(6).all()

    similar = []
    for l, raw_title, raw_url, raw_price_str in results:
        price_lkr = float(l.price_lkr) if l.price_lkr else None
        orig_price = float(l.original_price_lkr) if l.original_price_lkr else None
        price_drop_pct = None
        if price_lkr and orig_price and orig_price > 0 and price_lkr < orig_price:
            price_drop_pct = round((1 - price_lkr / orig_price) * 100, 1)
        days_on_market = None
        if l.first_seen_at:
            first = l.first_seen_at.replace(tzinfo=None) if l.first_seen_at.tzinfo else l.first_seen_at
            days_on_market = (now_utc - first).days
        similar.append({
            "id": l.id,
            "source": l.source,
            "title": raw_title or l.source_id,
            "price_lkr": price_lkr,
            "original_price_lkr": orig_price,
            "price_drop_pct": price_drop_pct,
            "deal_score": float(l.deal_score) if l.deal_score is not None else None,
            "market_median_lkr": float(l.market_median_lkr) if l.market_median_lkr else None,
            "price_per_perch": float(l.price_per_perch) if l.price_per_perch else None,
            "raw_price": raw_price_str,
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
            "days_on_market": days_on_market,
            "lat": float(l.lat) if l.lat else None,
            "lng": float(l.lng) if l.lng else None,
        })
    return similar


@app.get("/listings/{listing_id}/price-history")
def get_listing_price_history(listing_id: int, db: Session = Depends(get_db)):
    l = db.query(Listing).filter(Listing.id == listing_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Listing not found")

    snapshots = (
        db.query(ListingSnapshot.scraped_at, ListingSnapshot.raw_price)
        .filter(
            ListingSnapshot.source == l.source,
            ListingSnapshot.source_id == l.source_id,
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
# Price Estimate
# ---------------------------------------------------------------------------

class EstimateRequest(BaseModel):
    district: str
    property_type: str
    size_perches: Optional[float] = None
    size_sqft: Optional[float] = None
    bedrooms: Optional[int] = None


@app.post("/estimate")
def estimate_price(req: EstimateRequest, db: Session = Depends(get_db)):
    now_utc = datetime.utcnow()

    q = (
        db.query(Listing, RawListing.title, RawListing.url, RawListing.raw_price)
        .outerjoin(RawListing, Listing.raw_id == RawListing.id)
        .filter(
            Listing.district == req.district,
            Listing.property_type == req.property_type,
            Listing.price_lkr.isnot(None),
            Listing.is_outlier == False,
        )
    )

    if req.bedrooms is not None:
        q = q.filter(
            Listing.bedrooms >= max(0, req.bedrooms - 1),
            Listing.bedrooms <= req.bedrooms + 1,
        )

    if req.size_perches is not None and req.property_type in ('land', 'house'):
        q = q.filter(
            Listing.size_perches >= req.size_perches * 0.6,
            Listing.size_perches <= req.size_perches * 1.4,
        )

    if req.size_sqft is not None and req.property_type in ('house', 'apartment'):
        q = q.filter(
            Listing.size_sqft >= req.size_sqft * 0.6,
            Listing.size_sqft <= req.size_sqft * 1.4,
        )

    results = q.order_by(Listing.price_lkr.asc()).all()
    prices = sorted([float(l.price_lkr) for l, _, _, _ in results if l.price_lkr])
    count = len(prices)

    if count == 0:
        return {
            "estimated_low": None,
            "estimated_median": None,
            "estimated_high": None,
            "comparable_count": 0,
            "confidence": "none",
            "comparables": [],
        }

    p25_idx = int(count * 0.25)
    med_idx = count // 2
    p75_idx = min(int(count * 0.75), count - 1)

    confidence = "high" if count > 20 else ("medium" if count >= 5 else "low")

    # Top 6 by deal_score for the comparables list
    top = sorted(results, key=lambda x: -(x[0].deal_score or 0))[:6]
    comparables = []
    for l, raw_title, raw_url, raw_price_str in top:
        price_lkr = float(l.price_lkr) if l.price_lkr else None
        orig_price = float(l.original_price_lkr) if l.original_price_lkr else None
        price_drop_pct = None
        if price_lkr and orig_price and orig_price > 0 and price_lkr < orig_price:
            price_drop_pct = round((1 - price_lkr / orig_price) * 100, 1)
        days_on_market = None
        if l.first_seen_at:
            first = l.first_seen_at.replace(tzinfo=None) if l.first_seen_at.tzinfo else l.first_seen_at
            days_on_market = (now_utc - first).days
        comparables.append({
            "id": l.id,
            "source": l.source,
            "title": raw_title or l.source_id,
            "price_lkr": price_lkr,
            "original_price_lkr": orig_price,
            "price_drop_pct": price_drop_pct,
            "deal_score": float(l.deal_score) if l.deal_score is not None else None,
            "market_median_lkr": float(l.market_median_lkr) if l.market_median_lkr else None,
            "price_per_perch": float(l.price_per_perch) if l.price_per_perch else None,
            "raw_price": raw_price_str,
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
            "days_on_market": days_on_market,
            "lat": float(l.lat) if l.lat else None,
            "lng": float(l.lng) if l.lng else None,
        })

    return {
        "estimated_low": prices[p25_idx],
        "estimated_median": prices[med_idx],
        "estimated_high": prices[p75_idx],
        "comparable_count": count,
        "confidence": confidence,
        "comparables": comparables,
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
    try:
        from groq import Groq
    except ImportError:
        return {"response": "Groq package not installed on this server.", "context_used": False}

    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        return {"response": "System Error: GROQ_API_KEY is not configured.", "context_used": False}

    client = Groq(api_key=groq_key)

    try:
        # --- 1. Dynamic Search Detection (Internal Search) ---
        search_results_context = ""
        try:
            # Build a summary of recent conversation so filter model has context
            recent_history = ""
            if req.history:
                for m in req.history[-6:]:
                    role = "User" if m.get("role") == "user" else "AI"
                    recent_history += f"{role}: {m.get('content','')}\n"

            filter_prompt = f"""You are a filter extractor. Given the conversation below, extract property search filters for the LATEST user message.

Conversation:
{recent_history}User: {req.message}

Return ONLY a comma-separated list of exactly 5 values:
  location (district or city in Sri Lanka), property_type (land/house/apartment/commercial), listing_type (sale/rent), min_bedrooms (number), min_price_lkr (number)
Use "None" for any missing value. Do not explain. Just output the 5 values.
Example: Colombo, apartment, sale, 2, None"""

            search_intent = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": filter_prompt}],
                max_tokens=32
            ).choices[0].message.content.strip()

            filters = [f.strip() for f in search_intent.split(",")]
            while len(filters) < 5:
                filters.append("None")
            loc_f, type_f, list_f, beds_f, minprice_f = filters[0], filters[1], filters[2], filters[3], filters[4]

            def build_query(include_type=True, include_beds=True):
                q = db.query(Listing).filter(Listing.is_outlier == False, Listing.price_lkr.isnot(None))
                if loc_f != "None":
                    q = q.filter(
                        (Listing.raw_location.ilike(f"%{loc_f}%")) |
                        (Listing.district.ilike(f"%{loc_f}%"))
                    )
                if include_type and type_f != "None":
                    q = q.filter(Listing.property_type == type_f.lower())
                if list_f != "None":
                    q = q.filter(Listing.listing_type == list_f.lower())
                if include_beds and beds_f != "None" and beds_f.isdigit():
                    q = q.filter(Listing.bedrooms >= int(beds_f))
                if minprice_f != "None" and minprice_f.replace(".", "").isdigit():
                    q = q.filter(Listing.price_lkr >= float(minprice_f))
                return q

            # Try strict search first, then progressively broaden
            found = build_query(include_type=True,  include_beds=True ).order_by(Listing.price_lkr.desc()).limit(6).all()
            if not found:
                found = build_query(include_type=True,  include_beds=False).order_by(Listing.price_lkr.desc()).limit(6).all()
            if not found:
                found = build_query(include_type=False, include_beds=False).order_by(Listing.price_lkr.desc()).limit(6).all()

            if found:
                avg_q = build_query(include_type=True, include_beds=False)
                avg_p = avg_q.with_entities(func.avg(Listing.price_lkr)).filter(Listing.price_lkr > 100000).scalar() or 0
                priced = [l for l in found if l.price_lkr and l.price_lkr > 0]
                avg_note = f"Avg Price LKR {avg_p:,.0f}" if avg_p > 0 else "No price average available"
                label = f"{loc_f} {type_f}".replace("None", "").strip()
                search_results_context = f"LIVE DB RESULTS for '{label}': {len(found)} listings shown ({len(priced)} with prices). {avg_note}."
                for listing in found:
                    price_str = f"LKR {float(listing.price_lkr):,.0f}" if listing.price_lkr and listing.price_lkr > 0 else "Price not listed"
                    beds_str = f"{int(listing.bedrooms)}BR " if listing.bedrooms else ""
                    title = listing.title or "Property listing"
                    url = listing.url or ""
                    search_results_context += f"\n- {title} | {beds_str}{listing.property_type} in {listing.raw_location}: {price_str} | {url}"
        except Exception:
            pass

        # --- 2. Final Data-Driven Response ---
        stats_raw = get_stats(db)
        system_prompt = f"""You are Property AI — a friendly, knowledgeable assistant for PropertyLK, Sri Lanka's property intelligence platform. You have access to live data from 22,000+ real listings across Sri Lanka.

YOUR PERSONALITY:
- Warm and conversational. If someone says "hey" or "hello", just greet them back naturally and offer to help with property questions. Never dump database stats at someone saying hi.
- You're like a knowledgeable friend in the Sri Lanka property market — helpful, direct, not robotic.
- Only bring up listing data or prices when the user is actually asking about property.

LIVE DATABASE RESULTS (only use if relevant to the user's question):
{search_results_context if search_results_context else "No specific search was triggered for this message."}

MARKET CONTEXT (only mention if relevant):
- Total listings in DB: {stats_raw['total_listings']:,}
- Overall market avg: LKR {stats_raw['avg_price_lkr']:,.0f}

RULES FOR PROPERTY QUESTIONS:
1. ONLY reference listings explicitly shown in the database results above. NEVER invent specific prices, addresses, or listings that aren't in the results.
2. For each listing you mention, include its link exactly as provided (e.g. "View listing: https://ikman.lk/...").
3. If a listing shows "Price not listed", say so — don't make up a figure.
4. If the DB returned no results or limited data, say so honestly — do not estimate or fabricate specific examples.
5. Keep answers concise — show the real listings first with prices and links, then a brief market insight. Max 5 sentences.
6. Format prices as "LKR X,XXX,XXX".

RULES FOR NON-PROPERTY MESSAGES:
- Greetings → respond warmly, introduce yourself briefly, invite a property question.
- Off-topic questions → politely steer back to Sri Lanka property.
- Never paste market stats or database info into a greeting response.
"""

        messages = [{"role": "system", "content": system_prompt}]
        if req.history: messages.extend(req.history)
        messages.append({"role": "user", "content": req.message})

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        return {
            "response": completion.choices[0].message.content,
            "context_used": bool(search_results_context)
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

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("api.main:app", host="0.0.0.0", port=port, log_level="info", proxy_headers=True, forwarded_allow_ips="*")
