from sqlalchemy import Column, Integer, BigInteger, String, Text, Boolean, Numeric, DateTime, ForeignKey, Index, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class RawListing(Base):
    __tablename__ = 'raw_listings'

    id = Column(BigInteger, primary_key=True)
    source = Column(String(20), nullable=False)
    source_id = Column(String(100), nullable=False)
    scraped_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    url = Column(Text, nullable=False)
    title = Column(Text)
    raw_price = Column(Text)
    raw_location = Column(Text)
    raw_size = Column(Text)
    property_type = Column(String(30))
    listing_type = Column(String(10))
    description = Column(Text)
    raw_json = Column(JSON)
    is_processed = Column(Boolean, default=False)

    __table_args__ = (
        Index('idx_raw_listings_source_source_id', 'source', 'source_id', unique=True),
        Index('idx_raw_listings_is_processed', 'is_processed'),
    )

class Listing(Base):
    __tablename__ = 'listings'

    id = Column(BigInteger, primary_key=True)
    raw_id = Column(BigInteger, ForeignKey('raw_listings.id'))
    source = Column(String(20), nullable=False)
    source_id = Column(String(100), nullable=False)
    scraped_at = Column(DateTime(timezone=True), nullable=False)
    first_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    price_lkr = Column(Numeric(15, 2))
    price_per_perch = Column(Numeric(15, 2))
    price_per_sqft = Column(Numeric(10, 2))

    raw_location = Column(Text)
    district = Column(String(50))
    city = Column(String(100))
    gn_division = Column(String(100))
    lat = Column(Numeric(9, 6))
    lng = Column(Numeric(9, 6))
    geocode_confidence = Column(String(10))

    property_type = Column(String(30))
    listing_type = Column(String(10))
    size_perches = Column(Numeric(10, 2))
    size_sqft = Column(Numeric(10, 2))
    bedrooms = Column(Integer)
    bathrooms = Column(Integer)

    is_outlier = Column(Boolean, default=False)
    outlier_reason = Column(Text)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(BigInteger, ForeignKey('listings.id'))

    __table_args__ = (
        Index('idx_listings_source_source_id', 'source', 'source_id', unique=True),
        Index('idx_listings_district', 'district'),
        Index('idx_listings_scraped_at', 'scraped_at'),
        Index('idx_listings_property_type', 'property_type'),
        Index('idx_listings_price_lkr', 'price_lkr'),
    )

class PriceAggregate(Base):
    __tablename__ = 'price_aggregates'

    id = Column(BigInteger, primary_key=True)
    district = Column(String(50), nullable=False)
    property_type = Column(String(30), nullable=False)
    period_year = Column(Integer, nullable=False)
    period_month = Column(Integer, nullable=False)
    median_price_lkr = Column(Numeric(15, 2))
    median_price_per_perch = Column(Numeric(15, 2))
    avg_price_lkr = Column(Numeric(15, 2))
    p25_price_lkr = Column(Numeric(15, 2))
    p75_price_lkr = Column(Numeric(15, 2))
    listing_count = Column(Integer)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('idx_price_aggregates_main', 'district', 'property_type', 'period_year', 'period_month', unique=True),
    )

class ScrapeRun(Base):
    __tablename__ = 'scrape_runs'

    id = Column(BigInteger, primary_key=True)
    source = Column(String(20), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False)
    finished_at = Column(DateTime(timezone=True))
    status = Column(String(10))
    listings_found = Column(Integer, default=0)
    listings_new = Column(Integer, default=0)
    error_message = Column(Text)
