FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

WORKDIR /app

# Install system dependencies (for psycopg2 and others)
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

# Set permissions for the start script
RUN chmod +x start.sh

# Default command: Unified start script
CMD ["bash", "start.sh"]
