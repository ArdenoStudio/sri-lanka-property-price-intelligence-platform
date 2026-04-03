FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set python path
ENV PYTHONPATH=/app
ENV PORT=8080
# Unbuffer Python stdout/stderr so logs appear immediately in Railway
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

# Use shell form so $PORT is expanded by the shell — most reliable Railway pattern
CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'
