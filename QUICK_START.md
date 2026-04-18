# 🚀 QUICK START - Run All Scrapers Now

## Did the Scrapers Run?

**Not yet** - I've created a complete system for you to run them. The scrapers require:
- Playwright browsers installed
- Database connection configured  
- Proper environment setup

## Run Scrapers Right Now (3 Commands)

### 1️⃣ Install Missing Dependency

```bash
pip install playwright
playwright install chrome
```

### 2️⃣ Test Everything

```bash
python3 test_scrapers.py
```

### 3️⃣ Run All Scrapers

```bash
# Quick test (1-2 pages each)
python3 run_all_scrapers.py --test

# Full run (50+ pages each)
python3 run_all_scrapers.py
```

## Expected Output

```
======================================================================
🚀 ENHANCED PROPERTY SCRAPER - STARTING
======================================================================
Scrapers: ikman, lpw, lamudi
Mode: STANDARD
Time: 2026-04-16 02:00:00 UTC
======================================================================

📱 Running Ikman Scraper...
[*] scraping_page source=ikman page=1
[OK] page_complete found=25 new=23

🏠 Running LankaPropertyWeb Scraper...
[*] scraping_lpw_page page=1
[OK] lpw_page_done found=42 new=38

🏘️  Running House.lk (Lamudi) Scraper...
[*] houseLk_scraping page=1
[OK] houseLk_page_done found=18 new=15

🔄 Processing Data (cleaning & geocoding)...
[OK] Cleaned: 76
[OK] Geocoded: 68

======================================================================
📊 SCRAPING SUMMARY
======================================================================

IKMAN: ✅ SUCCESS
  Found: 1,234
  New: 456

LPW: ✅ SUCCESS
  Found: 567
  New: 234

LAMUDI: ✅ SUCCESS
  Found: 234
  New: 123

──────────────────────────────────────────────────────────────────────
TOTAL FOUND: 2,035
TOTAL NEW: 813
DURATION: 287s (4.8m)
COMPLETED: 2026-04-16 02:05:47 UTC
======================================================================
```

## What If It Fails?

### Missing Playwright
```bash
pip install playwright
playwright install chrome
```

### Database Error
```bash
# Check .env file
cat .env | grep DATABASE_URL

# Test connection
python3 -c "from db.connection import SessionLocal; db = SessionLocal(); print('✅ OK'); db.close()"
```

### Captcha Blocked (403/429)
```bash
# Add proxy
export PROXY_URL="http://user:pass@proxy.com:8080"

# Or reduce pages
python3 run_all_scrapers.py --ikman-pages 10 --lpw-pages 5 --lamudi-pages 5
```

## Setup Daily Automation (2 Minutes)

```bash
# 1. Make script executable
chmod +x daily_scraper.sh

# 2. Add to crontab (runs at 2 AM daily)
crontab -e
# Add this line:
0 2 * * * /home/user/sri-lanka-property-price-intelligence-platform/daily_scraper.sh >> /var/log/property_scraper.log 2>&1

# 3. Done! Check tomorrow's log
tail -f /var/log/property_scraper.log
```

## Files Created for You

1. **`run_all_scrapers.py`** - Main scraper runner
2. **`scraper/stealth.py`** - Captcha bypass utilities  
3. **`daily_scraper.sh`** - Daily automation script
4. **`test_scrapers.py`** - System verification
5. **`property-scraper.service`** - Systemd service
6. **`property-scraper.timer`** - Systemd timer
7. **`SCRAPER_GUIDE.md`** - Complete documentation
8. **`RUN_SCRAPERS_README.md`** - Usage examples

## Summary

✅ **Created:** Complete scraper system with captcha bypass  
✅ **Features:** Auto-retry, proxy support, Cloudflare bypass, stealth mode  
✅ **Automation:** Daily cron job + systemd timer  
✅ **Ready:** Just install Playwright and run!  

**Run now:** `python3 run_all_scrapers.py --test`
