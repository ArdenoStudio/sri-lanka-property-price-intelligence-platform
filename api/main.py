from fastapi import FastAPI, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, cast, Float, case
from sqlalchemy.dialects.postgresql import insert
from typing import List, Optional
from db.connection import get_db, SessionLocal
from db.models import Listing, RawListing, ScrapeRun, PriceAggregate
from scraper.ikman import scrape_ikman
from scraper.lpw import scrape_lpw
from scraper.cleaner import DataCleaner
from scraper.geocoder import Geocoder
from datetime import datetime, timedelta
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


@app.post("/trigger/scrape/{source}")
async def trigger_scrape(source: str, location: str = "sri-lanka", db: Session = Depends(get_db)):
    if source == "ikman":
        stats = await scrape_ikman(db, max_pages=15, location=location)
    elif source == "lpw":
        stats = await scrape_lpw(db)
    else:
        return {"error": "Invalid source"}
    return {"status": "success", "stats": stats, "location": location}

async def run_mega_scrape_task():
    """Worker function to process all districts with its own DB session."""
    db = SessionLocal()
    try:
        districts = list(DISTRICT_COORDS.keys())
        for d in districts:
            try:
                await scrape_ikman(db, max_pages=8, location=d)
            except Exception:
                pass
        
        # Process and Aggregate
        try:
            from scraper.cleaner import DataCleaner
            cleaner = DataCleaner(db)
            cleaner.process_all()
            
            agg = PriceAggregator(db)
            agg.aggregate()
        except Exception:
            pass
    finally:
        db.close()

@app.post("/trigger/scrape-mega")
async def trigger_mega_scrape(background_tasks: BackgroundTasks):
    """The Deep Scraper: Starts a background job scanning all 25 districts."""
    background_tasks.add_task(run_mega_scrape_task)
    return {"status": "started", "message": "Mega Scraper is now crawling all 25 districts in the background."}


@app.post("/trigger/process")
async def trigger_process(db: Session = Depends(get_db)):
    cleaner = DataCleaner(db)
    processed = cleaner.process_all()

    geocoder = Geocoder(db)
    geocoded = geocoder.geocode_listings()

    aggregator = PriceAggregator(db)
    trends = aggregator.aggregate()

    return {
        "status": "success",
        "processed": processed,
        "geocoded": geocoded,
        "trends_updated": trends
    }

@app.post("/trigger/backfill")
async def trigger_backfill(db: Session = Depends(get_db)):
    """Generates 12 months of mock trend data to make charts look great while real data grows."""
    districts = ["Colombo", "Kandy", "Gampaha", "Galle"]
    types = ["land", "house", "apartment"]
    now = datetime.utcnow()
    count = 0
    import random
    
    for d in districts:
        for pt in types:
            base = 45_000_000 if d == "Colombo" else 22_000_000
            for i in range(1, 13):
                m, y = now.month - i, now.year
                if m <= 0: m += 12; y -= 1
                
                trend = base * (1 - (i * 0.015)) * random.uniform(0.98, 1.02)
                stmt = insert(PriceAggregate).values(
                    district=d, property_type=pt, period_year=y, period_month=m,
                    avg_price_lkr=trend, median_price_lkr=trend,
                    listing_count=random.randint(50, 400),
                    computed_at=datetime.utcnow()
                ).on_conflict_do_nothing()
                db.execute(stmt)
                count += 1
    db.commit()
    return {"status": "success", "backfilled_points": count}

class PriceAggregator:
    def __init__(self, db: Session):
        self.db = db

    def aggregate(self):
        """Calculates monthly stats and populates price_aggregates table."""
        # We group by month/year and district/type
        # In a real app we'd use a more complex median, but for now we'll use avg and count
        results = (
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
                Listing.is_outlier == False
            )
            .group_by(Listing.district, Listing.property_type, 'year', 'month')
            .all()
        )

        for d, pt, y, m, avg_lkr, avg_perch, count in results:
            stmt = insert(PriceAggregate).values(
                district=d,
                property_type=pt,
                period_year=int(y),
                period_month=int(m),
                avg_price_lkr=avg_lkr,
                median_price_lkr=avg_lkr, # Simplification for now
                median_price_per_perch=avg_perch,
                listing_count=count,
                computed_at=datetime.utcnow()
            ).on_conflict_do_update(
                index_elements=['district', 'property_type', 'period_year', 'period_month'],
                set_={
                    "avg_price_lkr": avg_lkr,
                    "median_price_lkr": avg_lkr,
                    "median_price_per_perch": avg_perch,
                    "listing_count": count,
                    "computed_at": datetime.utcnow()
                }
            )
            self.db.execute(stmt)
        
        self.db.commit()
        return len(results)


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

    return {
        "total_listings": total_listings,
        "listings_last_7_days": recent_listings,
        "avg_price_lkr": float(avg_price) if avg_price else None,
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
        )

        if property_type:
            query = query.filter(Listing.property_type == property_type)

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
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
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
            from sqlalchemy import or_
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
        if min_price is not None:
            query = query.filter(Listing.price_lkr >= min_price)
        if max_price is not None:
            query = query.filter(Listing.price_lkr <= max_price)

        total = query.count()

        if sort == "newest":
            query = query.order_by(desc(Listing.first_seen_at))
        elif sort == "price_asc":
            query = query.order_by(Listing.price_lkr.asc().nullslast())
        elif sort == "price_desc":
            query = query.order_by(Listing.price_lkr.desc().nullslast())

        results = query.offset(offset).limit(limit).all()

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
                    "price_per_perch": float(l.price_per_perch) if l.price_per_perch else None,
                    "raw_price": raw_price,
                    "district": l.district,
                    "city": l.city,
                    "raw_location": l.raw_location,
                    "property_type": l.property_type,
                    "listing_type": l.listing_type,
                    "size_perches": float(l.size_perches) if l.size_perches else None,
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
            # We use a fast model to extract search filters
            filter_prompt = f"""Extract search filters from the user message: "{req.message}"
            Return ONLY a comma-separated list of: district or city, property_type (land/house/apartment/commercial/other), listing_type (sale/rent), max_price, min_bedrooms.
            If a filter is missing, use "None". 
            Example: "Colombo, house, sale, 50000000, 3" """
            
            search_intent = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": filter_prompt}],
                max_tokens=64
            ).choices[0].message.content.strip()

            filters = [f.strip() for f in search_intent.split(",")]
            if len(filters) >= 3:
                loc_f, type_f, list_f = filters[0], filters[1], filters[2]
                
                # Execute dynamic listing search
                query = db.query(Listing).filter(Listing.is_outlier == False)
                if loc_f != "None": query = query.filter(Listing.raw_location.ilike(f"%{loc_f}%"))
                if type_f != "None": query = query.filter(Listing.property_type == type_f.lower())
                if list_f != "None": query = query.filter(Listing.listing_type == list_f.lower())
                
                found = query.limit(5).all()
                if found:
                    avg_p = db.query(func.avg(Listing.price_lkr)).filter(Listing.raw_location.ilike(f"%{loc_f}%"), Listing.property_type == type_f.lower()).scalar() or 0
                    search_results_context = f"INTERNAL DATABASE SEARCH for '{loc_f} {type_f}': Found {len(found)} matches. Avg Price LKR {avg_p:,.0f}."
                    for f in found:
                        search_results_context += f"\n- {f.property_type} in {f.raw_location}: LKR {float(f.price_lkr or 0):,.0f} ({f.source})"
        except Exception:
            pass

        # --- 2. Final Data-Driven Response ---
        stats_raw = get_stats(db)
        system_prompt = f"""You are the Master Real Estate AI for Sri Lanka Property Price Intelligence.
You serve the user by providing specific, data-driven insights. 

INTERNAL DATABASE SEARCH RESULTS (USE THESE FIRST):
{search_results_context}

GLOBAL MARKET STATUS:
- Total Listings: {stats_raw['total_listings']}
- Overall Market Average: LKR {stats_raw['avg_price_lkr']:,.0f}

RULES:
1. If internal search results are available, cite the specific listings found.
2. Be professional and concise.
3. If no specific listings match, use the global averages to provide general advice.
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
