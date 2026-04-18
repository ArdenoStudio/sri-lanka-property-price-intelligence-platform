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
# PORT is injected by the host (Fly.io = 8080). Default to 8080 for local.
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

EXPOSE $PORT

# Use shell form so $PORT is expanded by the shell
CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'
