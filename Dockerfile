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

# Expose port 8000 for Railway proxy
EXPOSE 8000
EXPOSE 8080

# Default command: App Server
CMD ["python", "api/main.py"]
