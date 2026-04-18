# 🚀 How to Run All 3 Scrapers with Captcha Bypass

## Quick Start

### 1. Install Dependencies

```bash
# Activate virtual environment
source venv/bin/activate

# Install Python packages
pip install -r requirements.txt

# Install Playwright browsers (IMPORTANT for captcha bypass!)
playwright install chrome chromium
```

### 2. Test System Readiness

```bash
# Run system test
python3 test_scrapers.py
```

### 3. Run All Scrapers

```bash
# Test mode (quick check - 1-2 pages each)
python3 run_all_scrapers.py --test

# Standard run (recommended for daily use)
python3 run_all_scrapers.py

# Full scrape (includes all districts and categories)
python3 run_all_scrapers.py --full
```

---

## What Was Created

### ✅ Enhanced Scraper System

1. **`run_all_scrapers.py`** - Master script that runs all 3 scrapers
   - Ikman.lk scraper
   - LankaPropertyWeb scraper
   - House.lk (Lamudi) scraper
   - Automatic data cleaning and geocoding

2. **`scraper/stealth.py`** - Advanced anti-detection module
   - Browser fingerprint randomization
   - Captcha detection and bypass
   - Cloudflare challenge auto-wait
   - Human behavior simulation
   - WebGL/Canvas fingerprint spoofing

3. **`daily_scraper.sh`** - Automated daily runner
   - Error handling and retry logic
   - Lock file to prevent concurrent runs
   - Automatic log rotation
   - Database maintenance
   - Notification hooks (Slack/Email ready)

4. **`test_scrapers.py`** - System verification script
   - Tests all dependencies
   - Verifies database connection
   - Quick 1-page scrape test

5. **Systemd Service** - Alternative to cron
   - `property-scraper.service`
   - `property-scraper.timer`

---

## Captcha Bypass Features

### 🛡️ Built-in Anti-Detection

All scrapers now include:

- **Stealth Mode**: Hides automation indicators
- **User Agent Rotation**: Random real browser fingerprints
- **Cloudflare Bypass**: Auto-waits for challenges (up to 30s)
- **Resource Blocking**: Blocks images/CSS for faster, stealthier scraping
- **Human Simulation**: Random delays, mouse movements, scrolling
- **Fingerprint Randomization**: Varies viewport, locale, timezone

### 🔄 Automatic Retry Logic

- Exponential backoff on failures (5s → 10s → 20s...)
- Stops after 3 consecutive blocks (configurable)
- Auto-switches user agent on retry
- Supports proxy rotation

### 🌐 Proxy Support

```bash
# Single proxy via environment
export PROXY_URL="http://user:pass@proxy.com:8080"
python3 run_all_scrapers.py

# Proxy rotation via file
cat > proxies.txt <<EOF
http://user1:pass1@proxy1.com:8080
http://user2:pass2@proxy2.com:8080
EOF

python3 run_all_scrapers.py --proxy-file proxies.txt
```

---

## Daily Automation Setup

### Option 1: Cron (Recommended)

```bash
# Make script executable
chmod +x daily_scraper.sh

# Edit crontab
crontab -e

# Add this line (runs at 2 AM daily)
0 2 * * * /home/user/sri-lanka-property-price-intelligence-platform/daily_scraper.sh >> /var/log/property_scraper.log 2>&1
```

### Option 2: Systemd Timer

```bash
# Install service
sudo cp property-scraper.service /etc/systemd/system/
sudo cp property-scraper.timer /etc/systemd/system/

# Edit paths in service file
sudo nano /etc/systemd/system/property-scraper.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable property-scraper.timer
sudo systemctl start property-scraper.timer

# Check status
sudo systemctl status property-scraper.timer
```

---

## Usage Examples

### Run Specific Scrapers

```bash
# Only ikman
python3 run_all_scrapers.py --scrapers ikman

# Only lpw and lamudi
python3 run_all_scrapers.py --scrapers lpw lamudi
```

### Custom Page Limits

```bash
python3 run_all_scrapers.py \
  --ikman-pages 100 \
  --lpw-pages 30 \
  --lamudi-pages 50
```

### Skip Data Processing

```bash
# Run scrapers only, skip cleaning/geocoding
python3 run_all_scrapers.py --skip-processing
```

### Full Scrape Mode

```bash
# Scrapes main feed + thin districts + extra categories
python3 run_all_scrapers.py --full
```

---

## Monitoring & Logs

### View Real-time Logs

```bash
# Cron logs
tail -f /var/log/property_scraper.log

# Systemd logs
sudo journalctl -u property-scraper.service -f

# Application logs
tail -f logs/scraper_*.log
```

### Check Last Run Status

```bash
# View summary from log
tail -30 /var/log/property_scraper.log

# Check database
psql -U your_user -d property_db -c "SELECT * FROM scrape_run ORDER BY finished_at DESC LIMIT 5;"
```

---

## Troubleshooting

### Playwright Not Installed

```bash
# Error: No module named 'playwright'
pip install playwright
playwright install chrome chromium
```

### Database Connection Failed

```bash
# Check PostgreSQL
sudo systemctl status postgresql
sudo systemctl start postgresql

# Verify .env settings
cat .env | grep DATABASE_URL
```

### Captcha Blocking

If you're getting blocked (403/429 errors):

1. **Add Proxy**:
   ```bash
   export PROXY_URL="http://user:pass@proxy.com:8080"
   ```

2. **Use Residential Proxies** (best for captcha bypass):
   - BrightData
   - Smartproxy
   - Oxylabs

3. **Reduce Pages**:
   ```bash
   python3 run_all_scrapers.py --ikman-pages 10
   ```

4. **Run During Off-Peak** (2-5 AM Sri Lanka time)

5. **Enable Full Chrome** (better than Chromium):
   ```bash
   playwright install chrome
   ```

### Memory Issues

```bash
# Run scrapers one at a time
python3 run_all_scrapers.py --scrapers ikman
python3 run_all_scrapers.py --scrapers lpw
python3 run_all_scrapers.py --scrapers lamudi
```

---

## Performance Tips

### Faster Scraping

- Use `--skip-processing` to scrape only
- Block resources (already enabled)
- Use SSD for database
- Increase database connection pool

### More Data

- Use `--full` mode
- Increase page limits (--ikman-pages 200)
- Run multiple times per day
- Enable district-specific scraping

### Better Captcha Bypass

- Use **residential proxies** (not datacenter)
- Install **Google Chrome** (not just Chromium)
- Run during **low-traffic hours**
- Add **random delays** between scrapers
- Keep **session cookies** (already implemented)

---

## Summary

✅ **What You Have Now:**
- 3 working scrapers with advanced captcha bypass
- Daily automation via cron or systemd
- Comprehensive error handling and retries
- Proxy support and rotation
- Human behavior simulation
- Cloudflare auto-bypass
- Complete logging and monitoring

✅ **Next Steps:**
1. Run `python3 test_scrapers.py` to verify setup
2. Test with `python3 run_all_scrapers.py --test`
3. Setup daily automation with `crontab -e`
4. Monitor logs at `/var/log/property_scraper.log`

📚 **Full Documentation:** See `SCRAPER_GUIDE.md`

🐛 **Issues?** Check logs first, then see troubleshooting section above.

**Happy Scraping! 🏠🚀**
