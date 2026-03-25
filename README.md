# Honeywell Vocollect Data Log Parser

Full-stack web application for parsing and analyzing Honeywell Vocollect Talkman A700x device log files. Ingests 160MB+ log files (1.6M+ lines), extracts structured telemetry data, detects anomalies, and renders an interactive engineering dashboard.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Features](#features)
- [Frontend Structure](#frontend-structure)
- [Backend Structure](#backend-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Data Flow](#data-flow)
- [Anomaly Detection Rules](#anomaly-detection-rules)
- [Railway Deployment](#railway-deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                       │
│  Next.js 14 React App · Recharts · Tailwind CSS          │
└────────────────────────┬────────────────────────────────┘
                         │  HTTP (REST)
┌────────────────────────▼────────────────────────────────┐
│               Next.js API Routes (apps/web)               │
│  /api/devices · /api/upload · /api/devices/[serial]/*    │
│  Prisma ORM Client                                       │
└────────────────────────┬────────────────────────────────┘
          │ Prisma SQL   │ HTTP POST (file upload)
          ▼              ▼
┌─────────────┐   ┌─────────────────────────────────────┐
│ PostgreSQL  │   │  FastAPI Parser (apps/parser)        │
│    16       │◄──│  Stream parser · Regex matchers      │
│             │   │  Anomaly detection · DB repository   │
└─────────────┘   └─────────────────────────────────────┘
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14, React 18, Recharts, Tailwind CSS, Lucide React | Interactive dashboard with dark theme |
| **API Layer** | Next.js App Router API Routes, Prisma Client | REST endpoints for data retrieval |
| **Parser** | Python 3.11+, FastAPI, Pydantic | Stream-based log parsing and anomaly detection |
| **Database** | PostgreSQL 16, Prisma ORM | Structured telemetry storage with indexes |

---

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 16+

### Setup

```bash
# 1. Start PostgreSQL (Docker)
docker run -d --name honeywell-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=honeywell_logs \
  -p 5432:5432 postgres:16

# 2. Install web dependencies
cd apps/web
npm install
echo 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/honeywell_logs' > .env
echo 'PARSER_URL=http://localhost:8000' >> .env

# 3. Apply database schema
npx prisma db push

# 4. Install parser dependencies
cd ../parser
pip install -r requirements.txt

# 5. Start parser service
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/honeywell_logs \
  uvicorn app.main:app --port 8000

# 6. Start web app (new terminal)
cd apps/web
npm run dev
```

Open http://localhost:3000 in your browser.

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | web, parser | PostgreSQL connection string |
| `PARSER_URL` | web | Parser service URL (default: `http://localhost:8000`) |

---

## Features

### Core
- **File Upload** — Drag-and-drop `.txt`/`.zip` log files with progress tracking
- **Stream Parser** — Line-by-line parsing; never loads full file to RAM
- **Deduplication** — Prevents re-importing the same log timeframe

### Dashboard Tabs
| Tab | Description |
|-----|-------------|
| **Overview** | Device info, key stats, operator sessions, anomaly summary |
| **Battery** | Charge %, runtime, voltage, temperature charts with reference lines |
| **WiFi & Roaming** | Signal strength, AP roam timeline, access point mapping |
| **Anomalies** | Filterable anomaly cards with severity, context, suggested actions |
| **Timeline** | Unified event timeline with type filter chips and date-range filtering |
| **Raw Log** | Full log viewer with keyword search, category filtering, line-range navigation |
| **Trends** | Cross-import analysis — battery/WiFi/anomaly trends across multiple uploads |
| **Thresholds** | Per-device configurable alerting thresholds with toggle/value controls |

### Export
- **CSV** — Tabular data export for spreadsheet analysis
- **HTML** — Styled report with device info, stats, operators, anomalies
- **PDF** — Professional report generated client-side via jsPDF with Honeywell branding

### Advanced
- **Device Comparison** — Side-by-side comparison of two devices with overlaid charts, metrics table, and anomaly lists
- **Date Range Filtering** — Filter Timeline events by date range
- **Line Range Filtering** — Filter Raw Log by line number range
- **Event Type Filters** — Toggle battery/wifi/roam/connection/anomaly events on Timeline

---

## Frontend Structure

```
apps/web/
├── next.config.js              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS theme
├── tsconfig.json               # TypeScript config
├── prisma/
│   └── schema.prisma           # Database schema (11 models)
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root HTML layout (dark theme, Inter font)
│   │   ├── page.tsx            # Main dashboard page (device selection, tab routing, compare mode)
│   │   ├── globals.css         # Tailwind imports + custom scrollbar styles
│   │   └── api/                # REST API routes (see API Endpoints section)
│   ├── components/
│   │   ├── DeviceSidebar.tsx   # Left sidebar: device list, serial numbers, anomaly badges
│   │   ├── UploadZone.tsx      # Drag-and-drop file upload with progress bar
│   │   ├── TabBar.tsx          # Horizontal tab navigation (9 tabs)
│   │   ├── OverviewTab.tsx     # Device info cards, stats grid, operator table
│   │   ├── BatteryTab.tsx      # Battery charts (%, voltage, temp) with Recharts
│   │   ├── WifiRoamingTab.tsx  # WiFi signal chart + roam event list
│   │   ├── AnomaliesTab.tsx    # Anomaly list with severity filter
│   │   ├── AnomalyCard.tsx     # Individual anomaly card with context viewer
│   │   ├── TimelineTab.tsx     # Unified event timeline + type filters + date range
│   │   ├── RawLogTab.tsx       # Full log viewer: search, category filter, pagination
│   │   ├── TrendsTab.tsx       # Cross-import trend charts (battery, WiFi, anomalies)
│   │   ├── ThresholdsTab.tsx   # Per-device threshold configuration UI
│   │   ├── CompareView.tsx     # Side-by-side device comparison (charts + metrics)
│   │   ├── ExportButtons.tsx   # CSV, HTML, PDF export buttons
│   │   ├── StatsCard.tsx       # Reusable stat display card
│   │   ├── ContextViewer.tsx   # Log line context popup for anomalies
│   │   └── TabBar.tsx          # Tab navigation with active state
│   └── lib/
│       ├── db.ts               # Prisma client singleton
│       ├── tooltips.ts         # Tooltip definitions for anomaly rules
│       └── pdfExport.ts        # Client-side PDF generation (jsPDF + autotable)
```

### Key Component Details

**`page.tsx`** — Main orchestrator. Manages state for:
- `selectedSerial` — Currently selected device
- `activeTab` — Active dashboard tab
- `compareMode` — Toggle for side-by-side comparison view
- `showUpload` — Upload zone visibility

**`CompareView.tsx`** — Accepts two device serial numbers, fetches comparison data from `/api/devices/compare`, renders:
- Summary metrics table with color-coded better/worse values
- Side-by-side battery % and WiFi signal charts (Recharts AreaChart)
- Side-by-side anomaly lists with severity badges

**`ThresholdsTab.tsx`** — Fetches per-device threshold overrides from `/api/devices/[serial]/thresholds`, renders:
- Toggle switches to enable/disable rules
- Numeric input for threshold values
- Save/Reset buttons with dirty state tracking

**`TrendsTab.tsx`** — Fetches from `/api/devices/[serial]/trends`, renders:
- Import comparison table with key metrics per import
- Battery avg/min trend LineChart across imports
- WiFi signal avg/min trend LineChart
- Events & anomalies BarChart per import

---

## Backend Structure

```
apps/parser/
├── Dockerfile                  # Python container image
├── railway.toml                # Railway deployment config
├── requirements.txt            # Python dependencies
└── app/
    ├── main.py                 # FastAPI app entry point, CORS, routes
    ├── api/
    │   ├── __init__.py
    │   └── upload.py           # POST /upload — file reception, parsing, storage
    ├── db/
    │   ├── __init__.py
    │   ├── connection.py       # psycopg2 connection pool
    │   └── repository.py       # SQL insert functions (batch INSERT for performance)
    └── parser/
        ├── __init__.py
        ├── engine.py           # Main parse loop — stream processes each line
        ├── matchers.py         # Regex patterns for all log line types
        ├── models.py           # Pydantic models for parsed events
        ├── anomalies.py        # Anomaly rules, roam storm / connection burst detection
        └── error_codes.py      # Vocollect error code mappings
```

### Parser Engine (`engine.py`)

The parser processes log files line-by-line in a single pass:

1. **Line parsing** — Extracts timestamp, device time, tick counter, and content via `LINE_PATTERN` regex
2. **Skip filter** — Discards ~95% of lines (voice recognition internals) via `SKIP_PREFIXES`
3. **Matcher dispatch** — Each line is tested against regex matchers:
   - `BATTERY_FULL` / `BATTERY_SHORT` — Battery telemetry
   - `WIFI_SURVEY` — WiFi signal surveys
   - `ROAM_PATTERN` — Access point roaming events
   - `CONN_ESTABLISHED` / `CONN_FAILED` — Socket connections
   - `OPERATOR_PATTERN` — Operator sign-on/off
   - `HEADSET_*` — Headset connection events
   - `MSGS_LOST` — Log buffer overflow detection
4. **Anomaly detection** — Threshold-based checks on each reading:
   - Battery % ≤ 15 (WARNING), ≤ 5 (CRITICAL)
   - Battery temp > 45°C or < -10°C
   - WiFi signal < 30% (WARNING), < 20% (CRITICAL)
5. **Post-processing** — After all lines:
   - Roaming storm detection (sliding window)
   - Connection burst detection (sliding window)
   - Tick reset (reboot) detection
6. **Log line capture** — Every line stored with category label for Raw Log tab

### Database Repository (`repository.py`)

Batch INSERT operations using raw SQL for performance:
- `store_parse_results()` — Orchestrates all inserts in transaction
- `bulk_insert_battery_readings()` — Batch battery data
- `bulk_insert_wifi_readings()` — Batch WiFi data
- `bulk_insert_roam_events()` — Batch roam events
- `bulk_insert_connection_events()` — Batch connection events
- `bulk_insert_anomalies()` — Batch detected anomalies
- `bulk_insert_operator_sessions()` — Batch operator sessions
- `bulk_insert_system_events()` — Batch system events
- `bulk_insert_log_lines()` — Batch all log lines with categories

---

## Database Schema

### Entity Relationship

```
Device (1) ──── (N) LogImport
  │                    │
  │  ┌────────────────┤
  │  │  Each relation goes through both Device and LogImport
  │  │
  ├──┼── BatteryReading
  ├──┼── WifiReading
  ├──┼── RoamEvent
  ├──┼── ConnectionEvent
  ├──┼── Anomaly
  ├──┼── OperatorSession
  ├──┼── SystemEvent
  ├──┼── LogLine
  │
  └──── AlertThreshold (per-device config)
```

### Models

| Model | Table | Description | Key Fields |
|-------|-------|-------------|------------|
| **Device** | `devices` | One row per physical terminal | serialNumber, firmwareVersion, macAddress, platformVersion |
| **LogImport** | `log_imports` | One row per uploaded file | filename, logStartTime, logStopTime, status, lineCount |
| **BatteryReading** | `battery_readings` | ~500/day per device | percentRemaining, volts, temperatureC, runtimeMinutes, energyConsumption |
| **WifiReading** | `wifi_readings` | ~1,430/day per device | signalStrengthPct, signalSamples[], accessPointMac, cpuUsage, ramLoadPct |
| **RoamEvent** | `roam_events` | ~340/day per device | fromAp, toAp (MAC addresses) |
| **ConnectionEvent** | `connection_events` | 0–800+/day per device | eventType, host, port, connectionCount, errorCount, errorDetail |
| **Anomaly** | `anomalies` | Detected issues | severity, family, ruleId, title, offendingValue, thresholdValue, triggerLines |
| **OperatorSession** | `operator_sessions` | Who used each device | operatorName, operatorExtId, sessionStart, sessionEnd, readingCount |
| **SystemEvent** | `system_events` | Headset, warnings, errors | eventType, description |
| **LogLine** | `log_lines` | Every parsed line | lineNumber, content, category |
| **AlertThreshold** | `alert_thresholds` | Per-device threshold overrides | ruleId, value, enabled (nullable deviceId = global) |

### Indexes

- `battery_readings`: (deviceId, serverTime)
- `wifi_readings`: (deviceId, serverTime)
- `roam_events`: (deviceId, serverTime)
- `connection_events`: (deviceId, serverTime)
- `anomalies`: (deviceId), (family), (severity), (serverTime)
- `operator_sessions`: (deviceId), (operatorName)
- `log_lines`: (deviceId, lineNumber), (deviceId, category)
- `alert_thresholds`: (deviceId)

---

## API Endpoints

### Device Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List all devices with counts and latest import info |
| GET | `/api/devices/[serial]` | Full device details with relations |
| GET | `/api/devices/compare?a=SN1&b=SN2` | Side-by-side comparison data for two devices |

### Device Data (per serial)

| Method | Endpoint | Query Params | Description |
|--------|----------|-------------|-------------|
| GET | `/api/devices/[serial]/battery` | — | All battery readings (time series) |
| GET | `/api/devices/[serial]/wifi` | — | All WiFi readings (time series) |
| GET | `/api/devices/[serial]/roams` | — | All AP roam events |
| GET | `/api/devices/[serial]/connections` | — | All connection events |
| GET | `/api/devices/[serial]/anomalies` | — | All anomalies with severity/family |
| GET | `/api/devices/[serial]/operators` | — | All operator sessions |
| GET | `/api/devices/[serial]/timeline` | `types`, `search`, `from`, `to` | Unified event timeline with filters |
| GET | `/api/devices/[serial]/logs` | `search`, `category`, `page`, `lineFrom`, `lineTo` | Raw log lines with pagination |
| GET | `/api/devices/[serial]/trends` | — | Metrics aggregated per log import |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices/[serial]/thresholds` | Get thresholds (defaults + overrides) |
| PUT | `/api/devices/[serial]/thresholds` | Save threshold overrides |
| DELETE | `/api/devices/[serial]/thresholds` | Reset to defaults |

### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices/[serial]/export/csv` | Download CSV report |
| GET | `/api/devices/[serial]/export/html` | Download HTML report |
| — | Client-side | PDF generated via jsPDF in browser |

### Upload & Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload log file (proxies to parser service) |
| GET | `/api/health` | Health check |

---

## Data Flow

### Upload & Parse Flow

```
1. User drops .txt/.zip file on UploadZone
2. POST /api/upload → proxies file to FastAPI parser at PARSER_URL/upload
3. Parser streams file line-by-line:
   a. LINE_PATTERN extracts (serverTime, deviceTime, tick, content)
   b. SKIP_PREFIXES filters ~95% noise lines
   c. Each content line matched against battery/wifi/roam/connection/operator regexes
   d. Matched records checked against anomaly threshold rules
   e. All lines captured to log_lines_batch with category labels
4. Post-parse anomaly detection:
   - Roaming storm: >5 roams in 5-minute sliding window
   - Connection burst: >10 failures in 60-second window
   - Tick reset: non-increasing tick counter = device reboot
5. repository.py batch-inserts all data in single transaction
6. Frontend refreshes device list via /api/devices
```

### Dashboard Rendering

```
1. DeviceSidebar loads /api/devices → shows device list with anomaly badges
2. User selects device → page.tsx sets selectedSerial
3. Active tab component fetches its specific API endpoint
4. Recharts renders time-series data; tables show events
5. Filters (type, date, search) append query params to API calls
```

---

## Anomaly Detection Rules

| Rule ID | Family | Severity | Condition | Description |
|---------|--------|----------|-----------|-------------|
| BATT_PCT_WARN | BATTERY | WARNING | Battery ≤ 15% | Low battery warning |
| BATT_PCT_CRIT | BATTERY | CRITICAL | Battery ≤ 5% | Shutdown imminent |
| BATT_RUNTIME | BATTERY | WARNING | Runtime ≤ 30 min | Time-to-empty low |
| BATT_TEMP_HIGH | BATTERY | WARNING | Temp > 45°C | Overheating risk |
| BATT_TEMP_LOW | BATTERY | WARNING | Temp < -10°C | Cold environment |
| WIFI_WARN | WIFI | WARNING | Signal < 30% | Weak coverage area |
| WIFI_CRIT | WIFI | CRITICAL | Signal < 20% | Barely connected |
| ROAM_STORM | WIFI | WARNING | >5 roams/5min | Coverage overlap issue |
| CONN_BURST | SOCKET | CRITICAL | >10 fails/60sec | Internal comms failure |
| TICK_RESET | SYSTEM | WARNING | Tick decreases | Device reboot detected |
| MSGS_LOST | SYSTEM | WARNING | Buffer overflow | Log messages dropped |

All threshold values are configurable per-device via the Thresholds tab.

---

## Railway Deployment

1. Create 3 Railway services: `web` (Next.js), `parser` (Python), `db` (PostgreSQL plugin)
2. Set `DATABASE_URL` on both web and parser services
3. Set `PARSER_URL` on web service to `http://parser.railway.internal:8000`
4. Deploy both services using their respective `railway.toml` configs
