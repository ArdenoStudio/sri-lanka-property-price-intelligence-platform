# 🚀 Sri Lanka Property Scraper - Complete Guide

This guide covers running all 3 property scrapers with enhanced captcha bypass and daily automation.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running Scrapers](#running-scrapers)
4. [Captcha Bypass](#captcha-bypass)
5. [Daily Automation](#daily-automation)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

### Required Software

- Python 3.9+
- PostgreSQL 13+
- Git
- Chrome/Chromium browser (for Playwright)

### System Requirements

- RAM: 4GB minimum, 8GB recommended
- Disk: 10GB free space
- Network: Stable internet connection

---

## Installation

### 1. Clone Repository

```bash
cd /home/user/sri-lanka-property-price-intelligence-platform
```

### 2. Install Python Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# For better captcha bypass, install full Chrome
playwright install chrome
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your settings
nano .env
```

**Required Environment Variables:**

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/property_db
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=property_db

# Scraper Settings
SCRAPER_MAX_RETRIES=3
SCRAPER_BACKOFF_BASE_SECONDS=5
SCRAPER_BACKOFF_MAX_SECONDS=60
SCRAPER_STOP_AFTER_BLOCKS=3

# Optional: Proxy (for better captcha bypass)
PROXY_URL=http://username:password@proxy-server:port

# Geocoding
NOMINATIM_USER_AGENT=property-scraper/1.0 (your@email.com)
```

### 4. Setup Database

```bash
# Run migrations
alembic upgrade head

# Verify connection
python3 -c "from db.connection import SessionLocal; db = SessionLocal(); print('✅ Database connected'); db.close()"
```

---

## Running Scrapers

### Quick Start

```bash
# Run all 3 scrapers (ikman, lpw, lamudi)
python3 run_all_scrapers.py
```

### Command Options

#### Test Mode (Quick Test)

```bash
# Run with only 1-2 pages per scraper
python3 run_all_scrapers.py --test
```

#### Run Specific Scrapers

```bash
# Run only ikman
python3 run_all_scrapers.py --scrapers ikman

# Run ikman and lpw
python3 run_all_scrapers.py --scrapers ikman lpw

# Run all three explicitly
python3 run_all_scrapers.py --scrapers ikman lpw lamudi
```

#### Full Scrape Mode

```bash
# Includes districts and extra categories
python3 run_all_scrapers.py --full
```

#### Custom Page Limits

```bash
# Custom pages for each scraper
python3 run_all_scrapers.py \
  --ikman-pages 100 \
  --lpw-pages 30 \
  --lamudi-pages 40
```

#### Skip Data Processing

```bash
# Skip cleaning and geocoding (run scrapers only)
python3 run_all_scrapers.py --skip-processing
```

#### Use Proxy Rotation

```bash
# Create proxy file (one proxy per line)
cat > proxies.txt <<EOF
http://user:pass@proxy1.com:8080
http://user:pass@proxy2.com:8080
http://user:pass@proxy3.com:8080
EOF

# Run with proxy rotation
python3 run_all_scrapers.py --proxy-file proxies.txt
```

### Individual Scraper Scripts

#### Ikman.lk

```bash
# Standard run (20 pages)
python3 run_scraper.py ikman

# Custom pages
python3 run_scraper.py ikman 50

# Full scrape with districts
python3 -c "
import asyncio
from db.connection import SessionLocal
from scraper.ikman import scrape_ikman_full

async def main():
    db = SessionLocal()
    try:
        found, new = await scrape_ikman_full(db, main_pages=50, district_pages=20)
        print(f'Found: {found}, New: {new}')
    finally:
        db.close()

asyncio.run(main())
"
```

#### LankaPropertyWeb

```bash
# Standard run (15 pages)
python3 run_scraper.py lpw

# Custom pages
python3 run_scraper.py lpw 30

# District-specific scrape
python3 -c "
import asyncio
from db.connection import SessionLocal
from scraper.lpw import scrape_lpw_districts

async def main():
    db = SessionLocal()
    try:
        found, new = await scrape_lpw_districts(db, max_pages=50)
        print(f'Found: {found}, New: {new}')
    finally:
        db.close()

asyncio.run(main())
"
```

#### House.lk (Lamudi)

```bash
# Run lamudi scraper
python3 -c "
import asyncio
from db.connection import SessionLocal
from scraper.lamudi import LamudiScraper

async def main():
    db = SessionLocal()
    try:
        scraper = LamudiScraper(db)
        found, new = await scraper.scrape(max_pages=20)
        print(f'Found: {found}, New: {new}')
    finally:
        db.close()

asyncio.run(main())
"
```

#### Data Processing Only

```bash
# Clean and geocode existing data
python3 run_scraper.py process
```

---

## Captcha Bypass

### Built-in Anti-Detection Features

The scrapers include comprehensive anti-detection mechanisms:

#### 1. **Stealth Mode**
- Removes `navigator.webdriver` flag
- Randomizes canvas fingerprints
- Mocks browser plugins and permissions
- Spoofs WebGL vendor information

#### 2. **Browser Fingerprint Randomization**
- Rotates user agents from real browser pool
- Randomizes viewport sizes
- Varies locale and timezone
- Mimics real Chrome/Firefox/Safari

#### 3. **Human Behavior Simulation**
- Random mouse movements
- Realistic scroll patterns
- Variable page delays (1-3 seconds)
- Natural navigation flow

#### 4. **Automatic Captcha Detection**
- Detects reCAPTCHA, hCaptcha, Cloudflare
- Waits for Cloudflare challenges to complete
- Attempts Turnstile checkbox bypass

#### 5. **Resource Optimization**
- Blocks images, CSS, fonts (faster, less detectable)
- Reduces bandwidth fingerprinting
- Speeds up scraping 3-5x

### Cloudflare Bypass

Cloudflare challenges are automatically handled:

```python
# Automatic Cloudflare wait (built-in)
# The scrapers detect and wait for challenges to complete (up to 30s)
```

**What happens:**
1. Page loads with Cloudflare challenge
2. Scraper detects "Checking if the site connection is secure"
3. Waits for challenge to auto-complete
4. Proceeds once challenge passes

**If challenges fail:**
- Retries with exponential backoff (5s, 10s, 20s...)
- Switches to different user agent
- Uses proxy if configured

### Using Proxies for Enhanced Bypass

Proxies significantly improve captcha bypass:

#### Option 1: Single Proxy (Environment Variable)

```bash
export PROXY_URL="http://username:password@proxy.example.com:8080"
python3 run_all_scrapers.py
```

#### Option 2: Proxy Rotation (File-based)

```bash
# Create proxy list
cat > proxies.txt <<EOF
http://user1:pass1@proxy1.com:8080
http://user2:pass2@proxy2.com:8080
http://user3:pass3@proxy3.com:8080
socks5://user4:pass4@proxy4.com:1080
EOF

# Run with rotation
python3 run_all_scrapers.py --proxy-file proxies.txt
```

**Recommended Proxy Providers:**
- BrightData (datacenter or residential)
- Smartproxy
- Oxylabs
- IPRoyal

### Advanced: Captcha Solving Services

For sites with persistent captchas, integrate solving services:

```python
# Install captcha solver
pip install 2captcha-python

# Add to scraper/stealth.py
from twocaptcha import TwoCaptcha

async def solve_recaptcha(page: Page, sitekey: str):
    """Solve reCAPTCHA using 2Captcha service."""
    solver = TwoCaptcha(os.getenv('2CAPTCHA_API_KEY'))
    
    try:
        result = solver.recaptcha(
            sitekey=sitekey,
            url=page.url
        )
        
        # Inject solution
        await page.evaluate(f'''
            document.getElementById("g-recaptcha-response").innerHTML = "{result['code']}";
        ''')
        
        return True
    except Exception as e:
        log.error("captcha_solve_failed", error=str(e))
        return False
```

### Bypass Tips

1. **Timing is Key**: Run scrapers during off-peak hours (2-5 AM Sri Lanka time)
2. **Rate Limiting**: Keep delays between requests (1-3 seconds)
3. **Session Warmup**: Visit homepage before scraping
4. **Proxy Quality**: Use residential proxies for best results
5. **Browser Choice**: Chrome (`channel="chrome"`) bypasses more than Chromium

---

## Daily Automation

### Option 1: Cron Job (Recommended)

#### Setup Cron

```bash
# Make script executable
chmod +x daily_scraper.sh

# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * /home/user/sri-lanka-property-price-intelligence-platform/daily_scraper.sh >> /var/log/property_scraper.log 2>&1
```

#### Other Cron Schedules

```bash
# Every 12 hours (2 AM and 2 PM)
0 2,14 * * * /path/to/daily_scraper.sh

# Every 6 hours
0 */6 * * * /path/to/daily_scraper.sh

# Twice daily (2 AM and 10 PM)
0 2,22 * * * /path/to/daily_scraper.sh

# Every Monday at 3 AM
0 3 * * 1 /path/to/daily_scraper.sh
```

### Option 2: Systemd Timer

#### Install Service

```bash
# Copy service files
sudo cp property-scraper.service /etc/systemd/system/
sudo cp property-scraper.timer /etc/systemd/system/

# Edit service file to use correct paths/user
sudo nano /etc/systemd/system/property-scraper.service

# Reload systemd
sudo systemctl daemon-reload

# Enable and start timer
sudo systemctl enable property-scraper.timer
sudo systemctl start property-scraper.timer

# Check status
sudo systemctl status property-scraper.timer
```

#### Manage Service

```bash
# View timer status
systemctl list-timers --all | grep property

# View logs
sudo journalctl -u property-scraper.service -f

# Run manually
sudo systemctl start property-scraper.service

# Disable
sudo systemctl stop property-scraper.timer
sudo systemctl disable property-scraper.timer
```

### Option 3: APScheduler (Python)

Create `scheduler.py`:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio
from db.connection import SessionLocal
from scraper.ikman import scrape_ikman
from scraper.lpw import scrape_lpw
from scraper.lamudi import LamudiScraper

async def run_daily_scrape():
    db = SessionLocal()
    try:
        print("Starting daily scrape...")
        
        # Run all scrapers
        await scrape_ikman(db, max_pages=50)
        await scrape_lpw(db, max_pages=15)
        
        lamudi = LamudiScraper(db)
        await lamudi.scrape(max_pages=20)
        
        print("Daily scrape completed")
    finally:
        db.close()

async def main():
    scheduler = AsyncIOScheduler()
    
    # Schedule daily at 2 AM
    scheduler.add_job(
        run_daily_scrape,
        trigger=CronTrigger(hour=2, minute=0),
        id='daily_scrape'
    )
    
    scheduler.start()
    print("Scheduler started. Press Ctrl+C to exit.")
    
    # Keep running
    try:
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        scheduler.shutdown()

if __name__ == "__main__":
    asyncio.run(main())
```

Run with:

```bash
python3 scheduler.py
```

### Monitoring Daily Runs

#### View Logs

```bash
# Cron logs
tail -f /var/log/property_scraper.log

# Systemd logs
sudo journalctl -u property-scraper.service -f

# Application logs
tail -f logs/scraper_*.log
```

#### Log Retention

The `daily_scraper.sh` script automatically cleans logs older than 30 days.

---

## Troubleshooting

### Common Issues

#### 1. Playwright Not Found

```bash
ModuleNotFoundError: No module named 'playwright'
```

**Solution:**
```bash
pip install playwright
playwright install chromium chrome
```

#### 2. Database Connection Failed

```bash
OperationalError: could not connect to server
```

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start if needed
sudo systemctl start postgresql

# Verify DATABASE_URL in .env
echo $DATABASE_URL
```

#### 3. Captcha Blocking

```bash
[ERROR] page_blocked source=ikman status=403
```

**Solutions:**
- Add proxy: `export PROXY_URL="http://..."`
- Reduce pages: `--ikman-pages 10`
- Increase delays in scraper code
- Use residential proxies
- Run during off-peak hours

#### 4. Memory Issues

```bash
FATAL: out of memory
```

**Solutions:**
```bash
# Reduce concurrent scrapers
python3 run_all_scrapers.py --scrapers ikman  # One at a time

# Increase system swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 5. Selector Not Found

```bash
TimeoutError: waiting for selector "a.gtm-ad-item" failed
```

**Solutions:**
- Website structure changed - selectors need updating
- Increase timeout in scraper code
- Check if site is down: `curl -I https://ikman.lk`

---

## Advanced Configuration

### Custom Scraper Settings

Edit `scraper/{ikman,lpw,lamudi}.py` to customize:

```python
# Retry attempts
self.max_retries = 5  # Default: 3

# Backoff timing
self.backoff_base = 10  # Default: 5 seconds
self.backoff_max = 120  # Default: 60 seconds

# Stop after blocks
self.stop_after_blocks = 5  # Default: 3
```

### Performance Tuning

#### Faster Scraping (Risky)

```python
# Reduce delays in scraper code
await asyncio.sleep(random.uniform(0.5, 1.0))  # Was 1.0-2.5
```

#### Safer Scraping (Slower)

```python
# Increase delays
await asyncio.sleep(random.uniform(3.0, 5.0))  # Was 1.0-2.5

# Reduce pages
python3 run_all_scrapers.py --ikman-pages 20  # Was 50
```

### Notifications

Add Slack/Discord/Email notifications in `daily_scraper.sh`:

```bash
send_notification() {
    local status=$1
    local message=$2

    # Slack
    curl -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"Scraper $status: $message\"}" \
      "$SLACK_WEBHOOK_URL"
    
    # Discord
    curl -X POST -H 'Content-Type: application/json' \
      --data "{\"content\":\"Scraper $status: $message\"}" \
      "$DISCORD_WEBHOOK_URL"
    
    # Email
    echo "$message" | mail -s "Property Scraper $status" admin@example.com
}
```

### Database Optimization

```sql
-- Add indexes for faster queries
CREATE INDEX idx_raw_listings_scraped_at ON raw_listing(scraped_at DESC);
CREATE INDEX idx_raw_listings_source_scraped ON raw_listing(source, scraped_at DESC);
CREATE INDEX idx_listing_snapshot_fingerprint ON listing_snapshot(fingerprint);

-- Vacuum regularly
VACUUM ANALYZE raw_listing;
VACUUM ANALYZE listing_snapshot;
```

---

## Summary

### Quick Commands

```bash
# Test all scrapers
python3 run_all_scrapers.py --test

# Full daily scrape
python3 run_all_scrapers.py --full

# With proxy
python3 run_all_scrapers.py --proxy-file proxies.txt

# Setup daily automation
chmod +x daily_scraper.sh
crontab -e
# Add: 0 2 * * * /path/to/daily_scraper.sh >> /var/log/property_scraper.log 2>&1
```

### Support

For issues:
1. Check logs: `tail -f logs/scraper_*.log`
2. Test database: `python3 -c "from db.connection import SessionLocal; SessionLocal()"`
3. Verify dependencies: `pip list | grep playwright`
4. Check GitHub issues or contact support

---

**Happy Scraping! 🏠🚀**
