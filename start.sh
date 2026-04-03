#!/bin/bash

# Sri Lanka Property Price Intelligence Platform - Unified Start Script
# Runs both the API and the Scheduler Worker in parallel

# Exit immediately if a command exits with a non-zero status
set -e

echo "Ardeno Studio: Launching Property Intelligence Platform..."

# Start the Scheduler in the background
echo "Ardeno Studio: Starting Scheduler Worker..."
python scheduler/jobs.py &

# Start the API (This will be the main process)
echo "Ardeno Studio: Starting API Server on port ${PORT:-8000}..."
python api/main.py
