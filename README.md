# Sri Lanka Property Price Intelligence Platform
## Phase 1: Silent Data Collection

A data pipeline that scrapes property listings from Ikman.lk and LankaPropertyWeb daily, cleans and geocodes them, stores them in PostgreSQL, and exposes a FastAPI backend.

### Project Structure
```
.
├── api/             # FastAPI backend
├── db/              # Migrations and connection logic
├── scraper/         # Scraping, cleaning, and geocoding logic
├── scheduler/       # APScheduler jobs
├── tests/           # Unit tests
├── docker-compose.yml
└── Dockerfile
```

### Setup & Run (Local)

1. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in the values.
   ```bash
   cp .env.example .env
   ```

2. **Run with Docker**:
   ```bash
   docker-compose up --build
   ```

### Deployment (Railway)

1.  **Push to GitHub**: Push this code to a private repo.
2.  **New Project**: Create a new Railway project from your repo.
3.  **PostgreSQL**: Add a PostgreSQL service in Railway (it includes PostGIS).
4.  **Services**:
    *   **API**: Railway will auto-detect the Dockerfile. Set the start command to:
        `uvicorn api.main:app --host 0.0.0.0 --port ${PORT}`
    *   **Scheduler**: Create a second service from the *same repo*. Set the start command to:
        `python -m scheduler.jobs`
5. **Variables**: Link the PostgreSQL variables (or set `DATABASE_URL` for Supabase) to both services.

### Initializing the Database (Supabase/Production)

Once your `DATABASE_URL` is set in Railway, you need to create the tables. You can do this by running the initialization script from your local machine (if your IP is allowed) or via Railway's "CMD" override once:

```bash
docker exec -it <container_id> python scripts/init_db.py
```
Or simply add this to your Docker start command temporarily:
`python scripts/init_db.py && uvicorn api.main:app --host 0.0.0.0 --port ${PORT}`

3. **Verify API**:
   - Docs: http://localhost:8000/docs
   - Health: http://localhost:8000/health
   - Stats: http://localhost:8000/stats

### Components

- **Ikman Scraper**: Playwright-based, runs daily at 02:00 UTC.
- **LPW Scraper**: httpx-based (with Playwright fallback), runs daily at 02:30 UTC.
- **Cleaner**: Parses raw data into structured LKR prices, perches, and sqft. Runs at 04:00 UTC.
- **Geocoder**: Enriches listings with Lat/Lng via Nominatim (OSM). Runs at 05:00 UTC.
- **Scheduler**: Manages all background jobs with persistence in Postgres.

### Tests
Run tests locally (requires requirements installed):
```bash
pytest tests/
```
