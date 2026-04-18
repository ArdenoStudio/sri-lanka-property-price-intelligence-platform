#!/bin/bash
#
# Daily Property Scraper - Automated Script
# This script runs all property scrapers daily with error handling and logging
#
# Add to crontab with:
#   crontab -e
#   0 2 * * * /path/to/daily_scraper.sh >> /var/log/property_scraper.log 2>&1
#
# This runs at 2 AM every day

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/scraper_$(date +%Y%m%d_%H%M%S).log"
VENV_PATH="$SCRIPT_DIR/venv"
LOCK_FILE="$SCRIPT_DIR/.scraper.lock"
MAX_RETRIES=3
RETRY_DELAY=300  # 5 minutes

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Function to send notification (optional - configure as needed)
send_notification() {
    local status=$1
    local message=$2

    # Example: send to Slack, Discord, email, etc.
    # Uncomment and configure as needed:

    # Slack webhook example:
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"Scraper $status: $message\"}" \
    #   "$SLACK_WEBHOOK_URL"

    # Email example:
    # echo "$message" | mail -s "Property Scraper $status" admin@example.com

    log "NOTIFICATION: $status - $message"
}

# Check for lock file (prevent concurrent runs)
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        log "ERROR: Scraper already running (PID: $PID)"
        exit 1
    else
        log "WARNING: Stale lock file found, removing"
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

# Cleanup function
cleanup() {
    log "Cleaning up..."
    rm -f "$LOCK_FILE"
}

# Ensure cleanup on exit
trap cleanup EXIT INT TERM

log "========================================="
log "Starting Daily Property Scraper"
log "========================================="

# Change to script directory
cd "$SCRIPT_DIR"

# Activate virtual environment
if [ -d "$VENV_PATH" ]; then
    log "Activating virtual environment"
    source "$VENV_PATH/bin/activate"
else
    log "WARNING: Virtual environment not found at $VENV_PATH"
fi

# Check database connectivity
log "Checking database connectivity..."
if ! python3 -c "from db.connection import SessionLocal; db = SessionLocal(); db.close(); print('OK')" 2>&1 | tee -a "$LOG_FILE"; then
    log "ERROR: Database connection failed"
    send_notification "FAILED" "Database connection failed"
    exit 1
fi

log "Database connection OK"

# Run scrapers with retry logic
run_with_retry() {
    local attempt=1
    local success=false

    while [ $attempt -le $MAX_RETRIES ]; do
        log "Attempt $attempt of $MAX_RETRIES"

        # Run the master scraper script
        if python3 run_all_scrapers.py \
            --ikman-pages 50 \
            --lpw-pages 15 \
            --lamudi-pages 20 \
            2>&1 | tee -a "$LOG_FILE"; then
            success=true
            break
        else
            log "ERROR: Scraper failed on attempt $attempt"
            if [ $attempt -lt $MAX_RETRIES ]; then
                log "Waiting $RETRY_DELAY seconds before retry..."
                sleep $RETRY_DELAY
            fi
        fi

        attempt=$((attempt + 1))
    done

    if [ "$success" = true ]; then
        return 0
    else
        return 1
    fi
}

# Run scrapers
log "Running scrapers..."
if run_with_retry; then
    log "SUCCESS: All scrapers completed successfully"
    send_notification "SUCCESS" "Daily scraping completed successfully"
    EXIT_CODE=0
else
    log "ERROR: Scrapers failed after $MAX_RETRIES attempts"
    send_notification "FAILED" "Daily scraping failed after $MAX_RETRIES attempts"
    EXIT_CODE=1
fi

# Cleanup old logs (keep last 30 days)
log "Cleaning up old logs..."
find "$LOG_DIR" -name "scraper_*.log" -type f -mtime +30 -delete 2>&1 | tee -a "$LOG_FILE"

# Database maintenance (optional)
log "Running database maintenance..."
python3 -c "
from db.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    # Vacuum and analyze
    db.execute(text('VACUUM ANALYZE'))
    print('Database maintenance completed')
except Exception as e:
    print(f'Database maintenance error: {e}')
finally:
    db.close()
" 2>&1 | tee -a "$LOG_FILE"

log "========================================="
log "Daily Scraper Finished (Exit Code: $EXIT_CODE)"
log "========================================="

exit $EXIT_CODE
