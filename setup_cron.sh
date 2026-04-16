#!/bin/bash
# Setup cron job for daily scraping
# This script adds a cron job to run scrapers daily at 2 AM

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_PATH=$(which python3)
LOG_FILE="$SCRIPT_DIR/logs/daily_scraper.log"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Cron job command
CRON_CMD="0 2 * * * cd $SCRIPT_DIR && $PYTHON_PATH daily_scraper.py --run-now >> $LOG_FILE 2>&1"

echo "Setting up daily scraper cron job..."
echo "Command: $CRON_CMD"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "daily_scraper.py"; then
    echo "Cron job already exists. Removing old one..."
    crontab -l | grep -v "daily_scraper.py" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

echo "✓ Cron job added successfully!"
echo ""
echo "The scrapers will run daily at 2:00 AM"
echo "Logs will be written to: $LOG_FILE"
echo ""
echo "To view current cron jobs: crontab -l"
echo "To remove this cron job: crontab -e (then delete the daily_scraper.py line)"
echo ""
echo "To change the schedule time, edit this script and change '0 2 * * *' to your desired time:"
echo "  0 2 * * * = 2:00 AM daily"
echo "  0 14 * * * = 2:00 PM daily"
echo "  30 3 * * * = 3:30 AM daily"
