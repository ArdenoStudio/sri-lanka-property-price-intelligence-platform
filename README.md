<div align="center">
  <img src="dashboard/public/ardeno-logo.svg" alt="Ardeno Studio" height="48" />
  <br /><br />
  <img src="dashboard/public/favicon.svg" alt="Nilam" height="64" />

  <h1>Sri Lanka Property Price Intelligence Platform</h1>
  <p><strong>An Ardeno Studio Production</strong></p>

  <p>
    <img src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white" />
    <img src="https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB" />
    <img src="https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white" />
    <img src="https://img.shields.io/badge/Deployed-Fly.io-7B36ED?style=flat" />
    <img src="https://img.shields.io/badge/Frontend-Vercel-black?style=flat&logo=vercel" />
  </p>
</div>

---

A full-stack real estate intelligence platform that aggregates, cleans, and analyses property listings across Sri Lanka — surfacing market trends, deal scores, and price benchmarks by district, property type, and bedroom count.

## Features

- **Multi-source scraping** — ikman.lk, LankaPropertyWeb, house.lk scraped daily
- **Smart deal scoring** — compares each listing against comparable properties (same bedroom count, district, and type) rather than a broad market average
- **Price trends** — monthly median and average price charts per district and property type
- **Geocoding** — all listings enriched with lat/lng via Nominatim (OSM)
- **Heatmaps** — live price density map across Sri Lanka
- **Pipeline dashboard** — real-time status of scrapers, cleaner, geocoder, and aggregator jobs

## Stack

| Layer | Tech |
|---|---|
| Backend API | FastAPI + SQLAlchemy + PostgreSQL (Supabase) |
| Frontend | React + Vite + Tailwind CSS |
| Scraping | Playwright (ikman), httpx + BeautifulSoup (LPW, house.lk) |
| Geocoding | Nominatim / OSM |
| Deployment | Fly.io (API) + Vercel (frontend) |

## Project Structure

```
.
├── api/                # FastAPI backend + aggregation logic
├── dashboard/          # React frontend (Vite)
│   └── public/         # Favicon + Ardeno logo assets
├── db/                 # Models, migrations, connection
│   └── migrations/     # SQL migration files (001–004)
├── scraper/            # ikman, LPW, house.lk scrapers + cleaner + geocoder
├── scheduler/          # APScheduler background jobs
├── tests/              # Unit tests
├── _ikman_catchup_runner.py
├── _lpw_catchup_runner.py
├── _houseLk_catchup_runner.py
├── _process_runner.py  # Cleaner → geocoder → aggregates pipeline
├── Dockerfile
├── fly.toml            # Fly.io deployment config
└── render.yaml         # Render deployment config (alternative)
```

## Local Setup

1. **Clone & install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Environment variables**
   ```bash
   cp .env.example .env
   # Fill in DATABASE_URL, GROQ_API_KEY, NOMINATIM_USER_AGENT
   ```

3. **Run API locally**
   ```bash
   uvicorn api.main:app --reload --port 8080
   ```

4. **Run frontend locally**
   ```bash
   cd dashboard && npm install && npm run dev
   ```

## Running the Pipeline

```bash
# Scrape all sources
python _ikman_catchup_runner.py
python _lpw_catchup_runner.py
python _houseLk_catchup_runner.py

# Clean → geocode → compute aggregates + deal scores
python _process_runner.py
```

## Deployment

### API (Fly.io)
```bash
fly launch --no-deploy        # first time only
fly secrets set DATABASE_URL="..." GROQ_API_KEY="..."
fly deploy
```

### Frontend (Vercel)
Set `VITE_API_URL` to your Fly.io app URL in Vercel environment variables, then push to trigger a deploy.

## Database Migrations

```bash
# Apply migrations in order via Supabase SQL editor or psql
db/migrations/001_initial.sql
db/migrations/002_add_history_jobs_locations.sql
db/migrations/003_deal_score_days_on_market.sql
db/migrations/004_bedroom_bucket_aggregates.sql
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `GET /stats` | Platform-wide stats |
| `GET /listings` | Paginated listings with filters |
| `GET /districts` | District list with metadata |
| `GET /heatmap` | Lat/lng + price data for map |
| `GET /trends/{district}/{type}` | Monthly price trend |
| `POST /trigger/aggregate` | Re-run aggregates + deal scores |
| `GET /pipeline/status` | Scraper + job run status |

---

<div align="center">
  <sub>Built by <a href="https://ardeno.studio">Ardeno Studio</a></sub>
</div>
