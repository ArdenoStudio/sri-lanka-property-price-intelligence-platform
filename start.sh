#!/bin/bash

# Sri Lanka Property Price Intelligence Platform - Start Script
# The API startup_event handles the scheduler in-process, so we only need uvicorn here.

export PYTHONPATH=.:$PYTHONPATH

echo "Ardeno Studio: Launching Property Intelligence Platform..."

# Start the API (scheduler is started in-process via FastAPI startup_event)
echo "Ardeno Studio: Starting API Server on port ${PORT:-8080}..."
exec python -m uvicorn api.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8080}" \
    --proxy-headers \
    --forwarded-allow-ips="*"
