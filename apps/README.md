# Honeywell Vocollect Data Log Parser

Full-stack web application for parsing and analyzing Honeywell Vocollect Talkman device log files. Ingests 160MB+ log files (1.6M+ lines), extracts structured telemetry data, detects anomalies, and renders an interactive engineering dashboard.

## Architecture

- **Next.js 14** — React frontend with App Router, API routes, dark themed dashboard
- **Python FastAPI** — Stream parser with regex matchers, anomaly detection
- **PostgreSQL** — Structured telemetry storage via Prisma ORM

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 16+

### Setup

```bash
# 1. Install web dependencies
cd apps/web
npm install
cp .env.example .env   # Configure DATABASE_URL and PARSER_URL

# 2. Run database migrations
npx prisma migrate dev

# 3. Install parser dependencies
cd ../parser
pip install -r requirements.txt

# 4. Start parser service
DATABASE_URL=postgresql://... uvicorn app.main:app --port 8000

# 5. Start web app (new terminal)
cd ../web
npm run dev
```

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | web, parser | PostgreSQL connection string |
| `PARSER_URL` | web | Parser service URL (default: `http://localhost:8000`) |

## Features

- **File Upload**: Drag-and-drop .txt/.zip log files
- **Stream Parser**: Line-by-line parsing — never loads full file to RAM
- **Battery Monitoring**: Charge %, runtime, voltage, temperature, energy consumption
- **WiFi Analysis**: Signal strength, AP roaming, access point mapping
- **Connection Tracking**: Socket failures, error bursts
- **Anomaly Detection**: 11+ rules with severity levels, threshold crossing dedup
- **Operator Sessions**: Track who used each device and when
- **Interactive Charts**: Recharts-powered time series with reference lines
- **Export**: CSV and HTML report generation
- **Deduplication**: Prevents re-importing the same log timeframe

## Railway Deployment

1. Create 3 Railway services: `web` (Next.js), `parser` (Python), `db` (PostgreSQL plugin)
2. Set `DATABASE_URL` on both web and parser services
3. Set `PARSER_URL` on web service to `http://parser.railway.internal:8000`
4. Deploy both services

## Data Model

- `devices` — One row per physical terminal
- `log_imports` — One row per uploaded file
- `battery_readings` — ~500/day per device
- `wifi_readings` — ~1,430/day per device
- `roam_events` — ~340/day per device
- `connection_events` — 0-800+/day per device
- `anomalies` — Detected issues with severity, context, tooltips
- `operator_sessions` — Who used the device and when
- `system_events` — Headset connections, warnings, errors
