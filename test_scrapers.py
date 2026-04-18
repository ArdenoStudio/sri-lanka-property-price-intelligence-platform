#!/usr/bin/env python3
"""
Quick test script to verify scrapers are ready to run.
Tests imports, database connection, and shows how to run each scraper.
"""
import sys
import asyncio
from datetime import datetime

def test_imports():
    """Test that all required modules can be imported."""
    print("\n🔍 Testing imports...")

    try:
        import playwright
        print("  ✅ playwright")
    except ImportError as e:
        print(f"  ❌ playwright - {e}")
        print("     Run: pip install playwright && playwright install chrome")
        return False

    try:
        import structlog
        print("  ✅ structlog")
    except ImportError:
        print("  ❌ structlog")
        return False

    try:
        from sqlalchemy.orm import Session
        print("  ✅ sqlalchemy")
    except ImportError:
        print("  ❌ sqlalchemy")
        return False

    try:
        from dotenv import load_dotenv
        print("  ✅ python-dotenv")
    except ImportError:
        print("  ❌ python-dotenv")
        return False

    return True

def test_database():
    """Test database connection."""
    print("\n🔍 Testing database connection...")

    try:
        from db.connection import SessionLocal
        db = SessionLocal()
        db.close()
        print("  ✅ Database connection successful")
        return True
    except Exception as e:
        print(f"  ❌ Database connection failed: {e}")
        print("     Check your .env file and ensure PostgreSQL is running")
        return False

def test_scraper_modules():
    """Test that scraper modules can be imported."""
    print("\n🔍 Testing scraper modules...")

    try:
        from scraper.ikman import scrape_ikman, IkmanScraper
        print("  ✅ ikman scraper")
    except ImportError as e:
        print(f"  ❌ ikman scraper - {e}")
        return False

    try:
        from scraper.lpw import scrape_lpw, LPWScraper
        print("  ✅ lpw scraper")
    except ImportError as e:
        print(f"  ❌ lpw scraper - {e}")
        return False

    try:
        from scraper.lamudi import LamudiScraper
        print("  ✅ lamudi scraper")
    except ImportError as e:
        print(f"  ❌ lamudi scraper - {e}")
        return False

    try:
        from scraper.stealth import get_random_fingerprint, setup_stealth_context
        print("  ✅ stealth utilities")
    except ImportError as e:
        print(f"  ❌ stealth utilities - {e}")
        return False

    return True

async def run_quick_test():
    """Run a quick scrape test (1 page from ikman)."""
    print("\n🚀 Running quick scrape test (ikman, 1 page)...")

    try:
        from db.connection import SessionLocal
        from scraper.ikman import scrape_ikman

        db = SessionLocal()
        try:
            start = datetime.now()
            found, new = await scrape_ikman(db, max_pages=1)
            duration = (datetime.now() - start).total_seconds()

            print(f"  ✅ Test scrape completed in {duration:.1f}s")
            print(f"     Found: {found} listings")
            print(f"     New: {new} listings")
            return True
        finally:
            db.close()

    except Exception as e:
        print(f"  ❌ Test scrape failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("="*70)
    print("🔧 SCRAPER SYSTEM TEST")
    print("="*70)

    all_pass = True

    # Test imports
    if not test_imports():
        all_pass = False

    # Test database
    if not test_database():
        all_pass = False

    # Test scraper modules
    if not test_scraper_modules():
        all_pass = False

    # Summary
    print("\n" + "="*70)
    if all_pass:
        print("✅ ALL TESTS PASSED - System ready to scrape!")
        print("="*70)
        print("\n📋 Next steps:")
        print("  1. Test run:  python3 run_all_scrapers.py --test")
        print("  2. Full run:  python3 run_all_scrapers.py")
        print("  3. Setup daily: chmod +x daily_scraper.sh && crontab -e")
        print("\n🚀 Want to run a quick 1-page test now? [y/n]: ", end='')

        try:
            response = input().strip().lower()
            if response == 'y':
                asyncio.run(run_quick_test())
        except KeyboardInterrupt:
            print("\n\nTest skipped.")

    else:
        print("❌ SOME TESTS FAILED - Fix issues above before running")
        print("="*70)
        return 1

    return 0

if __name__ == "__main__":
    sys.exit(main())
