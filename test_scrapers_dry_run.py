"""
Dry run test to validate scraper setup without actually scraping.
Checks imports, configuration, and shows what would be scraped.
"""
import sys
from pathlib import Path

print("="*80)
print("SCRAPER VALIDATION TEST")
print("="*80)
print()

# Test 1: Check Python version
print("✓ Python version:", sys.version.split()[0])

# Test 2: Check imports
print("\nChecking dependencies...")
required_modules = [
    ("dotenv", "python-dotenv"),
    ("structlog", "structlog"),
    ("playwright", "playwright"),
    ("sqlalchemy", "sqlalchemy"),
    ("fastapi", "fastapi"),
]

missing = []
for module, package in required_modules:
    try:
        __import__(module)
        print(f"  ✓ {package}")
    except ImportError:
        print(f"  ✗ {package} - NOT INSTALLED")
        missing.append(package)

if missing:
    print(f"\n⚠ Missing packages: {', '.join(missing)}")
    print("Install with: pip install -r requirements.txt")
else:
    print("\n✓ All dependencies installed")

# Test 3: Check environment
print("\nChecking environment configuration...")
env_file = Path(".env")
if env_file.exists():
    print("  ✓ .env file exists")
    with open(env_file) as f:
        content = f.read()
        if "DATABASE_URL" in content:
            print("  ✓ DATABASE_URL configured")
        if "PROXY_URL" in content:
            print("  ✓ PROXY_URL setting available (optional)")
else:
    print("  ✗ .env file not found")
    print("    Run: cp .env.example .env")

# Test 4: Check scraper files
print("\nChecking scraper modules...")
scrapers = [
    "scraper/ikman.py",
    "scraper/lamudi.py",
    "scraper/lpw.py",
    "scraper/stealth_browser.py",
]

for scraper in scrapers:
    if Path(scraper).exists():
        print(f"  ✓ {scraper}")
    else:
        print(f"  ✗ {scraper} - NOT FOUND")

# Test 5: Check automation scripts
print("\nChecking automation scripts...")
scripts = [
    "run_all_scrapers.py",
    "daily_scraper.py",
    "setup_cron.sh",
]

for script in scripts:
    if Path(script).exists():
        print(f"  ✓ {script}")
    else:
        print(f"  ✗ {script} - NOT FOUND")

# Test 6: Show scraping targets
print("\n" + "="*80)
print("SCRAPING TARGETS")
print("="*80)

targets = [
    {
        "name": "Ikman.lk",
        "url": "https://ikman.lk/en/ads/sri-lanka/property",
        "coverage": "Main feed + 18 thin districts + rent/commercial categories",
        "challenges": "Cloudflare challenges, rate limiting",
        "bypass": "Stealth mode, rotating UAs, proxy support"
    },
    {
        "name": "House.lk (Lamudi)",
        "url": "https://house.lk",
        "coverage": "Sale, rent, and land listings",
        "challenges": "Cloudflare with fingerprinting",
        "bypass": "Real Chrome browser, stealth scripts, proxy"
    },
    {
        "name": "LankaPropertyWeb",
        "url": "https://www.lankapropertyweb.com",
        "coverage": "Sale, rent, land, apartments + district filters",
        "challenges": "Simple rate limiting",
        "bypass": "Delays, rotating UAs"
    }
]

for i, target in enumerate(targets, 1):
    print(f"\n{i}. {target['name']}")
    print(f"   URL: {target['url']}")
    print(f"   Coverage: {target['coverage']}")
    print(f"   Challenges: {target['challenges']}")
    print(f"   Bypass: {target['bypass']}")

# Test 7: Show next steps
print("\n" + "="*80)
print("NEXT STEPS")
print("="*80)
print("""
1. Install all dependencies:
   pip install -r requirements.txt
   playwright install chromium
   playwright install chrome

2. Configure environment:
   cp .env.example .env
   # Edit .env with your database settings

3. Test scrapers (quick):
   python run_all_scrapers.py --test

4. Run full scraping:
   python run_all_scrapers.py

5. Setup daily automation:
   # Option A: Python scheduler
   python daily_scraper.py

   # Option B: Cron
   ./setup_cron.sh

6. Monitor results:
   # Check logs and database
   python db_stats.py

For troubleshooting, see SCRAPER_README.md
""")

print("="*80)
