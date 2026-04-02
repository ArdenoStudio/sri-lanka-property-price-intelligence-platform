import os
from sqlalchemy import create_engine, text
from db.connection import DATABASE_URL
from db.models import Base
import structlog

logger = structlog.get_logger()

def init_db():
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        return

    # Fix postgres scheme for SQLAlchemy if needed
    db_url = DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(db_url)
    
    try:
        with engine.connect() as conn:
            # Enable PostGIS
            logger.info("Enabling PostGIS extension...")
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.commit()
            
            # Create tables
            logger.info("Creating tables...")
            Base.metadata.create_all(bind=engine)
            logger.info("Database initialized successfully!")
            
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise

if __name__ == "__main__":
    init_db()
