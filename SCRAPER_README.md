# Property Scrapers - Setup & Usage Guide

This document describes how to run the property scrapers, handle captchas, and set up daily automation.

## Overview

The platform scrapes property listings from 3 major Sri Lankan property websites:

1. **Ikman.lk** - Largest classified ads platform
2. **House.lk** (formerly Lamudi) - Property listings with Cloudflare protection
3. **LankaPropertyWeb.com** - Traditional property portal

## Quick Start

### 1. Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
playwright install chrome  # Optional: Real Chrome for better bypass
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env and configure:
# - DATABASE_URL (your PostgreSQL connection)
# - PROXY_URL (optional, for bypassing blocks)
# - Scraper settings (retries, timeouts, etc.)
```

### 3. Run Scrapers

```bash
# Run all scrapers (production mode)
python run_all_scrapers.py

# Test mode (fewer pages, faster)
python run_all_scrapers.py --test

# Run specific scraper only
python run_all_scrapers.py --source ikman
python run_all_scrapers.py --source lamudi
python run_all_scrapers.py --source lpw
```

## Handling Captchas & Blocks

### Common Issues

All three sites implement various anti-bot measures:

- **Ikman**: Cloudflare challenges, rate limiting
- **House.lk**: Cloudflare with browser fingerprinting
- **LPW**: Simple rate limiting

### Solutions

#### 1. Use Stealth Mode (Built-in)

The scrapers automatically use stealth techniques:
- Rotating user agents
- Browser fingerprint randomization
- Anti-automation detection bypass
- Realistic delays and behavior

#### 2. Use Proxies

For persistent blocking, configure a proxy:

```bash
# In .env file:
PROXY_URL=http://username:password@proxy-server:port

# Or use residential proxy services:
# - Bright Data (formerly Luminati)
# - Smartproxy
# - Oxylabs
```

#### 3. Manual Captcha Solving (Ikman)

If Ikman shows Cloudflare captcha:

```bash
# Run the interactive captcha solver
python _ikman_solve_captcha.py

# This opens a browser window where you solve the captcha manually
# Cookies are saved and reused by the scraper
```

#### 4. Adjust Scraper Settings

In `.env` file:

```bash
# Increase retries
SCRAPER_MAX_RETRIES=5

# Increase delays between requests
SCRAPER_BACKOFF_BASE_SECONDS=5
SCRAPER_BACKOFF_MAX_SECONDS=120

# Allow more consecutive blocks before stopping
SCRAPER_STOP_AFTER_BLOCKS=5
```

## Daily Automation

### Option 1: Python Scheduler (Recommended)

Use the built-in APScheduler:

```bash
# Run scheduler (default: 2 AM daily)
python daily_scraper.py

# Custom schedule time
python daily_scraper.py --time "03:30"

# Run once immediately
python daily_scraper.py --run-now
```

### Option 2: Cron (Linux/Mac)

```bash
# Setup cron job
chmod +x setup_cron.sh
./setup_cron.sh

# View cron jobs
crontab -l

# Edit cron schedule
crontab -e
```

### Option 3: Systemd Service (Linux)

Create `/etc/systemd/system/property-scraper.service`:

```ini
[Unit]
Description=Daily Property Scraper
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/sri-lanka-property-price-intelligence-platform
ExecStart=/usr/bin/python3 daily_scraper.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable property-scraper
sudo systemctl start property-scraper
sudo systemctl status property-scraper
```

### Option 4: Docker Compose (Production)

Add to `docker-compose.yml`:

```yaml
services:
  scraper:
    build: .
    command: python daily_scraper.py
    restart: unless-stopped
    env_file: .env
    depends_on:
      - db
```

## Monitoring & Logs

### View Scraper Results

```bash
# Logs are written to stdout (use structured logging)
# Redirect to file:
python run_all_scrapers.py > logs/scraper_$(date +%Y%m%d).log 2>&1

# View database stats
python db_stats.py
```

### Check for Blocks/Errors

Look for these indicators in logs:

```
blocked_by_site
captcha
unusual traffic
access denied
rate limited
```

### Success Metrics

After each run, check:
- Total listings found
- New listings added
- Failed scrapers (should be 0)
- Processing success

## Troubleshooting

### Issue: "Blocked by Cloudflare"

**Solution:**
1. Use real Chrome instead of Chromium: `playwright install chrome`
2. Add proxy: set `PROXY_URL` in `.env`
3. Increase delays: set `SCRAPER_BACKOFF_BASE_SECONDS=10`
4. Use residential proxies (not datacenter IPs)

### Issue: "No listings found"

**Solution:**
1. Check if site selectors changed (websites update HTML)
2. Verify site is accessible: visit URL in browser
3. Check browser console for errors
4. Update selectors in respective scraper file

### Issue: "Database connection failed"

**Solution:**
1. Verify PostgreSQL is running: `pg_isready`
2. Check `DATABASE_URL` in `.env`
3. Ensure database exists: `createdb nilam_db`
4. Run migrations: `alembic upgrade head`

### Issue: "Playwright browser not found"

**Solution:**
```bash
# Install browsers
playwright install chromium
playwright install chrome

# Or install system-wide
sudo playwright install-deps
```

## Advanced Configuration

### Custom Scraping Locations

Edit scraper files to add custom districts/locations:

```python
# In scraper/ikman.py
THIN_DISTRICTS = [
    "jaffna", "vavuniya", "batticaloa",
    # Add your custom locations here
    "your-custom-district",
]
```

### Adjust Pagination

```python
# In run_all_scrapers.py
found, new = await scrape_ikman_full(
    db,
    main_pages=100,      # Increase for more data
    district_pages=30,
    extra_pages=20,
    headless=True
)
```

### Resource Blocking

To speed up scraping, resource blocking is enabled by default (blocks images, CSS, fonts). To disable:

```python
# In scraper file
page = await browser.new_page(block_resources=False)
```

## Performance Tips

1. **Run in headless mode** (default) for production
2. **Use resource blocking** to load pages faster
3. **Add delays** between requests to avoid detection
4. **Use proxies** to distribute load
5. **Run during off-peak hours** (2-4 AM)
6. **Monitor success rates** and adjust retry logic

## Support

For issues or questions:
1. Check logs for error details
2. Review this README
3. Check site accessibility in browser
4. Verify database connectivity
5. Test with `--test` flag first

## File Structure

```
├── run_all_scrapers.py          # Main scraper runner
├── daily_scraper.py             # Scheduler for daily automation
├── setup_cron.sh                # Cron setup script
├── scraper/
│   ├── ikman.py                 # Ikman scraper
│   ├── lamudi.py                # House.lk scraper
│   ├── lpw.py                   # LPW scraper
│   ├── stealth_browser.py       # Anti-detection utilities
│   ├── cleaner.py               # Data cleaning
│   └── geocoder.py              # Geocoding
├── _ikman_solve_captcha.py      # Manual captcha solver
└── requirements.txt             # Python dependencies
```

## License

Part of the Sri Lanka Property Price Intelligence Platform.
