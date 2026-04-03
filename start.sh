#!/bin/bash

# Sri Lanka Property Price Intelligence Platform - Unified Start Script
# Runs both the API and the Scheduler Worker in parallel

echo "Ardeno Studio: Launching Property Intelligence Platform..."

# Start the Scheduler in the background (non-blocking, don't fail if it crashes)
echo "Ardeno Studio: Starting Scheduler Worker..."
python scheduler/jobs.py &
SCHEDULER_PID=$!
echo "Ardeno Studio: Scheduler started with PID $SCHEDULER_PID"

# Start the API (This is the main process - must always run)
echo "Ardeno Studio: Starting API Server on port ${PORT:-8000}..."
exec python api/main.py
