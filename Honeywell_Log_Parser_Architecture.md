# Honeywell Vocollect Data Log Parser — Architecture Blueprint

## For: GTS Hackathon 2026 — Team EMEA
### Deployment Target: Railway | Stack: Next.js + Python + PostgreSQL

---

## 1. System Overview

The parser ingests `.zip`/`.txt` Vocollect Talkman device logs (1.6M+ lines per file), extracts structured telemetry, detects anomalies, and surfaces findings through an interactive web dashboard where engineers can upload, browse, search, and export device health intelligence.

### Core Architectural Principles

- **Parse once, query forever** — raw logs are streamed through a Python parser that emits structured records into PostgreSQL. The UI never touches raw text.
- **Device-centric data model** — every record belongs to a Device → LogImport → Event chain. Uploading a new log for the same serial number extends the device profile, never duplicates it.
- **Anomaly-first navigation** — the default view surfaces detected issues ranked by severity. Engineers drill down, not dig around.
- **Export as a first-class feature** — PDF, CSV, and HTML summary reports are generated server-side from the same structured data.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RAILWAY DEPLOYMENT                       │
│                                                                 │
│  ┌──────────────────────┐    ┌───────────────────────────────┐  │
│  │   Next.js App        │    │   Python Parser Service       │  │
│  │   (Frontend + API)   │◄──►│   (FastAPI)                   │  │
│  │                      │    │                               │  │
│  │  • React SPA         │    │  • Stream parser engine       │  │
│  │  • API Routes (CRUD) │    │  • Regex event extractors     │  │
│  │  • File upload proxy │    │  • Anomaly detection rules    │  │
│  │  • Export generators │    │  • Deduplication logic        │  │
│  │  • Chart renderers   │    │  • Structured JSON emitter    │  │
│  └──────────┬───────────┘    └──────────────┬────────────────┘  │
│             │                               │                   │
│             ▼                               ▼                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL                             │   │
│  │                                                           │   │
│  │  devices │ log_imports │ operator_sessions                │   │
│  │  battery_readings │ wifi_readings │ roam_events           │   │
│  │  anomalies │ connection_events │ system_events            │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Object Storage (Railway Volume or S3-compatible)         │  │
│  │  • Raw uploaded .zip/.txt files                           │  │
│  │  • Generated PDF/HTML/CSV exports                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Railway Service Layout

| Service | Runtime | Purpose |
|---------|---------|---------|
| `web` | Node.js 20 | Next.js app — UI, API routes, export generation |
| `parser` | Python 3.11 | FastAPI — log parsing, anomaly detection |
| `db` | PostgreSQL 16 | Persistent structured storage |
| `volume` | Railway Volume | Raw file storage (mount to both services) |

---

## 3. Data Model (PostgreSQL Schema)

### 3.1 Core Tables

```sql
-- ═══════════════════════════════════════════════
-- DEVICE IDENTITY (one row per physical terminal)
-- ═══════════════════════════════════════════════
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number   VARCHAR(20) UNIQUE NOT NULL,   -- e.g. "7623205329"
    terminal_name   VARCHAR(50),
    firmware_version VARCHAR(100),                  -- e.g. "VCL-20231214123659_V4.7.1.no_NO_12"
    mac_address     VARCHAR(17),                    -- e.g. "54:f8:2a:d5:8b:a1"
    platform_version VARCHAR(20),                   -- e.g. "VIPV_83.0"
    first_seen      TIMESTAMPTZ NOT NULL,
    last_seen       TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════
-- LOG IMPORTS (one row per uploaded file)
-- ═══════════════════════════════════════════════
CREATE TABLE log_imports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500),                   -- path in volume storage
    log_start_time  TIMESTAMPTZ NOT NULL,
    log_stop_time   TIMESTAMPTZ NOT NULL,
    log_type        VARCHAR(20) DEFAULT 'standard',
    ip_address      INET,
    line_count      INTEGER,
    file_size_bytes BIGINT,
    status          VARCHAR(20) DEFAULT 'processing', -- processing | complete | failed | deleted
    error_message   TEXT,
    imported_at     TIMESTAMPTZ DEFAULT now(),
    -- Dedup constraint: same device + same time window = same log
    UNIQUE(device_id, log_start_time, log_stop_time)
);

-- ═══════════════════════════════════════════════
-- OPERATOR SESSIONS (who used the device and when)
-- ═══════════════════════════════════════════════
CREATE TABLE operator_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    log_import_id   UUID NOT NULL REFERENCES log_imports(id) ON DELETE CASCADE,
    operator_ext_id VARCHAR(20),                    -- e.g. "2892388"
    operator_name   VARCHAR(100) NOT NULL,          -- e.g. "Michael Krogtoft"
    session_start   TIMESTAMPTZ NOT NULL,
    session_end     TIMESTAMPTZ NOT NULL,
    reading_count   INTEGER DEFAULT 0               -- how many survey lines in this session
);
CREATE INDEX idx_ops_device ON operator_sessions(device_id);
CREATE INDEX idx_ops_name ON operator_sessions(operator_name);
```

### 3.2 Telemetry Tables

```sql
-- ═══════════════════════════════════════════════
-- BATTERY READINGS (~500 per 24h log, every ~3 min)
-- Extracted from: VocollectPowerMgmtService lines
-- ═══════════════════════════════════════════════
CREATE TABLE battery_readings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    log_import_id       UUID NOT NULL REFERENCES log_imports(id) ON DELETE CASCADE,
    server_time         TIMESTAMPTZ NOT NULL,
    device_time         TIME NOT NULL,
    tick                BIGINT NOT NULL,
    line_number         INTEGER NOT NULL,
    runtime_minutes     INTEGER,          -- TTE (min): 123
    percent_remaining   SMALLINT,         -- PercentCharge: 32%
    volts               DECIMAL(5,3),     -- Volts: 3.414
    energy_consumption  INTEGER,          -- EnergyConsumption: -3435 mAh
    temperature_c       DECIMAL(4,1)      -- Temperature: 9.7deg C
);
CREATE INDEX idx_battery_device_time ON battery_readings(device_id, server_time);

-- ═══════════════════════════════════════════════
-- WIFI SURVEY READINGS (~1400 per 24h log, every ~1 min)
-- Extracted from: SURVEY: Signal Strength lines
-- ═══════════════════════════════════════════════
CREATE TABLE wifi_readings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id               UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    log_import_id           UUID NOT NULL REFERENCES log_imports(id) ON DELETE CASCADE,
    server_time             TIMESTAMPTZ NOT NULL,
    device_time             TIME NOT NULL,
    tick                    BIGINT NOT NULL,
    line_number             INTEGER NOT NULL,
    signal_strength_pct     SMALLINT,      -- 43%
    signal_samples          SMALLINT[],    -- {48,43,41,42,36,39,47,46,46,43}
    access_point_mac        VARCHAR(17),   -- from preceding SURVEY: Access Point line
    operator_name           VARCHAR(100)   -- from Terminal SN line in same survey block
);
CREATE INDEX idx_wifi_device_time ON wifi_readings(device_id, server_time);

-- ═══════════════════════════════════════════════
-- ROAM EVENTS (~300-350 per 24h log)
-- Extracted from: AP MON: ROAMED lines
-- ═══════════════════════════════════════════════
CREATE TABLE roam_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    log_import_id   UUID NOT NULL REFERENCES log_imports(id) ON DELETE CASCADE,
    server_time     TIMESTAMPTZ NOT NULL,
    device_time     TIME NOT NULL,
    tick            BIGINT NOT NULL,
    line_number     INTEGER NOT NULL,
    from_ap         VARCHAR(17) NOT NULL,
    to_ap           VARCHAR(17) NOT NULL
);
CREATE INDEX idx_roam_device_time ON roam_events(device_id, server_time);

-- ═══════════════════════════════════════════════
-- CONNECTION EVENTS
-- Extracted from: Connection Failed, Continuous Socket lines
-- ═══════════════════════════════════════════════
CREATE TABLE connection_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    log_import_id   UUID NOT NULL REFERENCES log_imports(id) ON DELETE CASCADE,
    server_time     TIMESTAMPTZ NOT NULL,
    device_time     TIME NOT NULL,
    tick            BIGINT NOT NULL,
    line_number     INTEGER NOT NULL,
    event_type      VARCHAR(30) NOT NULL,  -- 'connection_failed' | 'socket_error' | 'socket_ok'
    host            VARCHAR(50),
    port            INTEGER,
    connection_count INTEGER,
    error_count     INTEGER,
    error_detail    TEXT                    -- e.g. "[Errno 111] Connection refused"
);
CREATE INDEX idx_conn_device_time ON connection_events(device_id, server_time);
```

### 3.3 Anomaly Table

```sql
-- ═══════════════════════════════════════════════
-- ANOMALIES (detected during parsing)
-- ═══════════════════════════════════════════════
CREATE TABLE anomalies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    log_import_id   UUID NOT NULL REFERENCES log_imports(id) ON DELETE CASCADE,
    
    -- Classification
    family          VARCHAR(30) NOT NULL,  -- BATTERY | WIFI | BLUETOOTH | SOCKET | SYSTEM | VOICE
    severity        VARCHAR(10) NOT NULL,  -- INFO | WARNING | CRITICAL
    rule_id         VARCHAR(50) NOT NULL,  -- machine-readable rule identifier
    
    -- Human-readable
    title           VARCHAR(200) NOT NULL, -- e.g. "Battery below 15%"
    description     TEXT,                  -- what happened + what it means
    tooltip         TEXT,                  -- short technical explanation for hover
    
    -- Location in log
    first_line      INTEGER NOT NULL,
    last_line       INTEGER NOT NULL,
    context_before  TEXT,                  -- 5 lines before (for context viewer)
    trigger_lines   TEXT NOT NULL,         -- the actual offending lines
    context_after   TEXT,                  -- 5 lines after
    
    -- Timestamps
    server_time     TIMESTAMPTZ NOT NULL,
    device_time     TIME,
    tick            BIGINT,
    
    -- Offending value (for highlighting)
    offending_value VARCHAR(100),          -- the actual number/string that triggered
    threshold_value VARCHAR(100),          -- what the threshold was
    
    detected_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_anomaly_device ON anomalies(device_id);
CREATE INDEX idx_anomaly_family ON anomalies(family);
CREATE INDEX idx_anomaly_severity ON anomalies(severity);
CREATE INDEX idx_anomaly_time ON anomalies(server_time);
```

---

## 4. Parser Engine (Python FastAPI Service)

### 4.1 Parsing Pipeline

```
Upload (.zip / .txt)
        │
        ▼
┌─────────────────────┐
│  1. FILE HANDLER    │  Unzip if needed, validate encoding (UTF-8 / Latin-1)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  2. HEADER PARSER   │  Extract: serial, firmware, IP, start/stop time, MAC
│                     │  → UPSERT device record (find-or-create by serial)
│                     │  → INSERT log_import (with dedup check)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  3. STREAM PARSER   │  Line-by-line generator (never load full file to RAM)
│                     │  Each line → parse timestamp → route to matchers
└────────┬────────────┘
         │
         ├──► Battery Matcher ──► battery_readings + anomaly check
         ├──► WiFi Matcher ──► wifi_readings + anomaly check
         ├──► Roam Matcher ──► roam_events + anomaly check
         ├──► Connection Matcher ──► connection_events + anomaly check
         ├──► Operator Matcher ──► operator_sessions (state machine)
         ├──► System Matcher ──► system_events
         └──► Catch-All ──► hex error code lookup → anomalies
                │
                ▼
┌─────────────────────┐
│  4. POST-PROCESS    │  Compute session boundaries, aggregate stats,
│                     │  detect multi-line anomaly patterns (e.g. roam storms)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  5. BATCH INSERT    │  Bulk insert all records (psycopg COPY for speed)
│                     │  Update log_import status → 'complete'
└─────────────────────┘
```

### 4.2 Regex Matchers (Proven Patterns from Actual Logs)

```python
import re
from dataclasses import dataclass
from typing import Optional

# ─── TIMESTAMP PARSER ───────────────────────────────────
# Matches: (2/28/24 2:31:24 PM CET) 14:14:42.069 - 43767026: <event>
LINE_PATTERN = re.compile(
    r'^\((\d{1,2}/\d{1,2}/\d{2,4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M\s+\w+)\)\s+'
    r'(\d{2}:\d{2}:\d{2}\.\d{3})\s+-\s+(\d+):\s+(.*)',
    re.DOTALL
)

# ─── BATTERY (comprehensive line) ───────────────────────
# VocollectPowerMgmtService : Battery properties>> [TTE (min): 123]; [PercentCharge: 32%]; [Volts: 3.414]; [EnergyConsumption: -3398 mAh]; [Temperature: 9.7deg C]
BATTERY_FULL = re.compile(
    r'VocollectPowerMgmtService.*'
    r'\[TTE \(min\): (\d+)\].*'
    r'\[PercentCharge: (\d+)%\].*'
    r'\[Volts: ([\d.]+)\].*'
    r'\[EnergyConsumption: (-?\d+) mAh\].*'
    r'\[Temperature: ([\d.]+)deg C\]'
)

# ─── BATTERY (simple lines) ─────────────────────────────
BATTERY_RUNTIME = re.compile(r'Battery runtime(?: remaining:?)?\s+(\d+)\s+minutes')
BATTERY_PERCENT = re.compile(r'Battery percent remaining:\s+(\d+)')

# ─── WIFI SURVEY ────────────────────────────────────────
# SURVEY: Signal Strength: 43% ( 48 43 41 42 36 39 47 46 46 43  )
WIFI_SIGNAL = re.compile(
    r'SURVEY: Signal Strength:\s+(\d+)%\s+\(\s*([\d\s]+)\)'
)
WIFI_AP = re.compile(r'SURVEY: Access Point:\s+([\dA-Fa-f:]+)')

# ─── ROAMING ────────────────────────────────────────────
# AP MON: ROAMED from AP 48:4A:E9:CD:6C:D4 to AP 48:4A:E9:CD:42:D4
ROAM_EVENT = re.compile(
    r'AP MON: ROAMED from AP ([\dA-Fa-f:]+) to AP ([\dA-Fa-f:]+)'
)

# ─── OPERATOR ───────────────────────────────────────────
# Terminal SN = 7623205329   Current Operator ID = 2892388,  Current Operator Name = Michael Krogtoft
OPERATOR = re.compile(
    r'Terminal SN\s*=\s*(\w+)\s+Current Operator ID\s*=\s*(\w+),\s+'
    r'Current Operator Name\s*=\s*(.+?)[\r\n]*$'
)

# ─── CONNECTION FAILURES ────────────────────────────────
# Continuous Socket: [Host = 127.0.0.1, port = 15008, Timeout = 5, Connection Count = 441, Error Count = 440] Connection Failed ([Errno 111] Connection refused)
CONN_FAILED = re.compile(
    r'Continuous Socket: \[Host = ([\d.]+), port = (\d+), Timeout = (\d+), '
    r'Connection Count = (\d+), Error Count = (\d+)\]\s+Connection Failed\s*\((.+)\)'
)

# ─── HEX ERROR CODES ────────────────────────────────────
HEX_ERROR = re.compile(r'(?:Error|error|ERROR).*?(0x[0-9A-Fa-f]{4})')

# ─── WARNING MESSAGES ───────────────────────────────────
WARNING_MSG = re.compile(r'^WARNING!?\s+(.+)', re.IGNORECASE)
```

### 4.3 Anomaly Detection Rules

```python
ANOMALY_RULES = [
    # ─── BATTERY ────────────────────────────────────
    {
        "rule_id": "BATT_LOW_WARN",
        "family": "BATTERY",
        "severity": "WARNING",
        "condition": lambda r: r.percent_remaining is not None and r.percent_remaining <= 15,
        "title": "Battery below 15%",
        "tooltip": "Device battery has dropped to a level where operator should swap batteries soon to avoid mid-task shutdown.",
        "offending": lambda r: f"{r.percent_remaining}%",
        "threshold": "≤ 15%"
    },
    {
        "rule_id": "BATT_LOW_CRIT",
        "family": "BATTERY",
        "severity": "CRITICAL",
        "condition": lambda r: r.percent_remaining is not None and r.percent_remaining <= 5,
        "title": "Battery critically low — shutdown imminent",
        "tooltip": "Device will auto-shutdown shortly. Any unsent ODRs are queued in flash but task progress may be lost.",
        "offending": lambda r: f"{r.percent_remaining}%",
        "threshold": "≤ 5%"
    },
    {
        "rule_id": "BATT_RUNTIME_LOW",
        "family": "BATTERY",
        "severity": "WARNING",
        "condition": lambda r: r.runtime_minutes is not None and r.runtime_minutes <= 30,
        "title": "Battery runtime ≤ 30 minutes",
        "tooltip": "TTE (Time To Empty) estimate from the battery controller. Below 30 min the device warns the operator audibly.",
        "offending": lambda r: f"{r.runtime_minutes} min",
        "threshold": "≤ 30 min"
    },
    {
        "rule_id": "BATT_TEMP_HIGH",
        "family": "BATTERY",
        "severity": "WARNING",
        "condition": lambda r: r.temperature_c is not None and r.temperature_c > 45,
        "title": "Battery temperature exceeds 45°C",
        "tooltip": "The A700x battery is rated for -20°C to +50°C. Sustained high temps degrade lithium-ion cells and reduce capacity.",
        "offending": lambda r: f"{r.temperature_c}°C",
        "threshold": "> 45°C"
    },
    {
        "rule_id": "BATT_TEMP_LOW",
        "family": "BATTERY",
        "severity": "WARNING",
        "condition": lambda r: r.temperature_c is not None and r.temperature_c < -10,
        "title": "Battery temperature below -10°C",
        "tooltip": "Cold temperatures reduce battery capacity and increase internal resistance. Below -20°C the battery may not function.",
        "offending": lambda r: f"{r.temperature_c}°C",
        "threshold": "< -10°C"
    },
    
    # ─── WIFI ───────────────────────────────────────
    {
        "rule_id": "WIFI_SIGNAL_WARN",
        "family": "WIFI",
        "severity": "WARNING",
        "condition": lambda r: r.signal_strength_pct is not None and r.signal_strength_pct < 30,
        "title": "WiFi signal below 30%",
        "tooltip": "Signal Strength percentage maps to RSSI. Below 30% (~-75 dBm), packet loss and latency increase. Roaming may become unreliable.",
        "offending": lambda r: f"{r.signal_strength_pct}%",
        "threshold": "< 30%"
    },
    {
        "rule_id": "WIFI_SIGNAL_CRIT",
        "family": "WIFI",
        "severity": "CRITICAL",
        "condition": lambda r: r.signal_strength_pct is not None and r.signal_strength_pct < 20,
        "title": "WiFi signal critically low — below 20%",
        "tooltip": "At this level the device is barely maintaining a connection. ODRs will be queued in flash. Voice task data transmission will stall.",
        "offending": lambda r: f"{r.signal_strength_pct}%",
        "threshold": "< 20%"
    },
    
    # ─── ROAMING ────────────────────────────────────
    # (Detected in post-processing via windowed aggregation)
    {
        "rule_id": "ROAM_STORM",
        "family": "WIFI",
        "severity": "WARNING",
        "condition": "post_process",  # >5 roams in 5 minutes
        "title": "Roaming storm detected",
        "tooltip": "Frequent AP changes in a short window indicate the device is in a coverage overlap zone or APs have misconfigured power. This causes latency spikes and potential data loss."
    },
    
    # ─── CONNECTIONS ────────────────────────────────
    {
        "rule_id": "CONN_FAIL_BURST",
        "family": "SOCKET",
        "severity": "CRITICAL",
        "condition": "post_process",  # >10 failures in 1 min
        "title": "Connection failure burst",
        "tooltip": "Rapid consecutive connection failures to the local socket (port 15008) indicate the internal comms service is down or restarting. This blocks ODR transmission and task data sync."
    },
    {
        "rule_id": "CONN_ERROR_RATIO",
        "family": "SOCKET",
        "severity": "WARNING",
        "condition": lambda r: r.error_count and r.connection_count and (r.error_count / r.connection_count) > 0.9,
        "title": "Socket error ratio > 90%",
        "tooltip": "The Continuous Socket error-to-connection ratio is abnormally high, suggesting persistent internal communication issues."
    },
    
    # ─── SYSTEM ─────────────────────────────────────
    {
        "rule_id": "TICK_RESET",
        "family": "SYSTEM",
        "severity": "WARNING",
        "condition": "post_process",  # tick drops significantly between consecutive lines
        "title": "Device tick counter reset — likely reboot",
        "tooltip": "The device tick is an incrementing millisecond counter. A large decrease indicates the device restarted. Check for battery pull, crash, or forced reset."
    },
    {
        "rule_id": "MESSAGES_LOST",
        "family": "SYSTEM",
        "severity": "WARNING",
        "condition": lambda line: "WARNING! Messages lost!" in line,
        "title": "Log messages lost",
        "tooltip": "The device's internal log buffer overflowed. Some events were not captured in this log. This can happen during high-activity periods or when the log service is under load."
    },
]
```

### 4.4 Hex Error Code Lookup Table

The parser ships with a static dictionary built from the A700x reference docs:

```python
ERROR_CODE_DB = {
    "0x1402": {"msg": "Process message service receive error", "family": "SOCKET", "severity": "WARNING"},
    "0x1403": {"msg": "Process message service send error", "family": "SOCKET", "severity": "WARNING"},
    "0x1410": {"msg": "Vocollect NTI registration failed", "family": "SOCKET", "severity": "CRITICAL"},
    "0x1414": {"msg": "Unable to spawn barcode process", "family": "SYSTEM", "severity": "CRITICAL"},
    "0x1602": {"msg": "Warning, low flash memory", "family": "SYSTEM", "severity": "WARNING"},
    "0x1603": {"msg": "Low flash memory — must upload data now", "family": "SYSTEM", "severity": "CRITICAL"},
    "0x2112": {"msg": "Flash is full — device turning off", "family": "SYSTEM", "severity": "CRITICAL"},
    # ... (full table from A700x_Datalog_Parser_Reference.md Section 10)
}
```

---

## 5. Deduplication & Device Profile Merging

### Upload Flow Decision Tree

```
New file uploaded
       │
       ▼
 Parse header → extract serial_number, log_start_time, log_stop_time
       │
       ▼
 ┌─────────────────────────────────────────┐
 │ SELECT * FROM devices                    │
 │ WHERE serial_number = :sn               │
 └──────────────┬──────────────────────────┘
                │
        ┌───────┴───────┐
        │ EXISTS?       │
        ▼               ▼
       YES              NO
        │                │
        │                └──► INSERT new device record
        │                     INSERT new log_import
        │
        ▼
 ┌─────────────────────────────────────────┐
 │ SELECT * FROM log_imports               │
 │ WHERE device_id = :id                   │
 │ AND log_start_time = :start             │
 │ AND log_stop_time = :stop               │
 └──────────────┬──────────────────────────┘
                │
        ┌───────┴───────┐
        │ EXISTS?       │
        ▼               ▼
       YES              NO
        │                │
        │                └──► INSERT new log_import
        │                     Parse file normally
        │                     Update device.last_seen
        │                     Merge new operators
        │
        ▼
  DUPLICATE — reject with message:
  "This exact log timeframe has already been imported
   for device {serial}. No new data added."
```

### Operator Session Detection

Operators are detected from the `Terminal SN ... Current Operator Name` lines that appear in every survey block (~1/minute). The parser maintains a state machine:

```python
class OperatorTracker:
    def __init__(self):
        self.current_operator = None
        self.session_start = None
        self.sessions = []
    
    def observe(self, operator_name, operator_id, timestamp):
        if operator_name != self.current_operator:
            # Close previous session
            if self.current_operator:
                self.sessions.append({
                    "name": self.current_operator,
                    "ext_id": self._current_id,
                    "start": self.session_start,
                    "end": timestamp
                })
            # Open new session
            self.current_operator = operator_name
            self._current_id = operator_id
            self.session_start = timestamp
    
    def finalize(self, last_timestamp):
        if self.current_operator:
            self.sessions.append({
                "name": self.current_operator,
                "ext_id": self._current_id,
                "start": self.session_start,
                "end": last_timestamp
            })
        return self.sessions
```

---

## 6. Frontend Architecture (Next.js)

### 6.1 Page Structure

```
/                           → Dashboard (upload zone + device list)
/devices                    → All devices grid
/devices/[serial]           → Device profile (metadata + sessions + imports)
/devices/[serial]/logs/[id] → Log explorer (timeline + anomalies + charts)
/devices/[serial]/anomalies → All anomalies for device (filterable)
/export/[logImportId]       → Export page (PDF / CSV / HTML generation)
```

### 6.2 Dashboard Page (`/`)

```
┌─────────────────────────────────────────────────────────────────┐
│  HONEYWELL DATA LOG PARSER                           [Settings] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │     ┌──────────┐                                        │    │
│  │     │  📁 + 📋 │  Drag & drop .zip or .txt log files    │    │
│  │     └──────────┘  or click to browse                    │    │
│  │                                                         │    │
│  │  Accepted: .zip, .txt  •  Max: 200MB                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌── ACTIVE IMPORTS ────────────────────────────────────────┐   │
│  │ ● Processing   Log_7623205329_2024-02-28...  ██████░ 78% │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌── DEVICES ───────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  ┌──────────────────────┐  ┌──────────────────────┐      │   │
│  │  │ SN: 7623205329       │  │ SN: 7623205333       │      │   │
│  │  │ FW: V4.7.1           │  │ FW: V4.7.1           │      │   │
│  │  │ Operators: 2         │  │ Operators: 2         │      │   │
│  │  │ Logs: 1              │  │ Logs: 1              │      │   │
│  │  │ Anomalies: 12 ⚠ 3 🔴│  │ Anomalies: 8 ⚠ 1 🔴 │      │   │
│  │  │ Last seen: 2/29/24   │  │ Last seen: 2/29/24   │      │   │
│  │  │ [View] [Delete]      │  │ [View] [Delete]      │      │   │
│  │  └──────────────────────┘  └──────────────────────┘      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Log Explorer Page (`/devices/[serial]/logs/[id]`)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    Device 7623205329 • Log 2/28/24 14:30 – 2/29/24 14:31│
│  Operator: Michael Krogtoft (14:14 – 09:02) → Truls Ilseth     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Anomalies ▼] [Battery ▼] [WiFi ▼] [Timeline ▼] [Export ▼]   │
│                                                                 │
│  ┌── ANOMALY TIMELINE ──────────────────────────────────────┐   │
│  │  14:00───15:00───16:00───17:00───...───09:00───10:00     │   │
│  │    ▲ ▲       ▲              ▲ ▲▲▲         ▲              │   │
│  │    │ │       │              │ │││         │              │   │
│  │   🟡🟡     🔴             🟡🟡🟡🔴       🟡              │   │
│  │  WiFi  Batt             Roam storm    Conn fail          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌── CHARTS (toggle view) ──────────────────────────────────┐   │
│  │  [Battery %] [Signal %] [Temperature] [Energy]           │   │
│  │                                                          │   │
│  │  100%┤                                                   │   │
│  │   80%┤━━━━━                                              │   │
│  │   60%┤      ━━━━━                                        │   │
│  │   40%┤           ━━━━━━━━━                               │   │
│  │   20%┤                    ━━━━━━━━━━━━━━━                │   │
│  │    0%┼──────────────────────────────────►                 │   │
│  │     14:00  16:00  18:00  20:00  22:00  00:00  02:00      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌── ANOMALIES ─────────────────────────────────────────────┐   │
│  │  Filter: [All ▼] [CRITICAL ▼] [BATTERY ▼] [Search...]   │   │
│  │                                                          │   │
│  │  🔴 CRITICAL • 09:03:52 • SOCKET                        │   │
│  │     Connection failure burst                             │   │
│  │     Error Count jumped from 2→440 in under 1 minute      │   │
│  │     Offending: 440 errors / 441 attempts (99.8%)  ⓘ     │   │
│  │     [View Context ▶]                                     │   │
│  │                                                          │   │
│  │  🟡 WARNING • 14:15:18 • WIFI                           │   │
│  │     WiFi signal below 30%                                │   │
│  │     Signal at 29% (samples: 38 45 29 35 38 33...)  ⓘ    │   │
│  │     [View Context ▶]                                     │   │
│  │                                                          │   │
│  │  🟡 WARNING • 22:41:03 • BATTERY                        │   │
│  │     Battery runtime ≤ 30 minutes                         │   │
│  │     Runtime: 28 min at 8% charge, 3.312V  ⓘ             │   │
│  │     [View Context ▶]                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌── CONTEXT VIEWER (expanded) ─────────────────────────────┐   │
│  │  Line 553560   (2/29/24 9:03:56 AM) 09:03:49.554        │   │
│  │  Line 553561   ... normal log line ...                   │   │
│  │  Line 553562   ... normal log line ...                   │   │
│  │ ►Line 553563   Continuous Socket: [...Error Count = 440] │◄──│── highlighted
│  │ ►Line 553564   Connection Failed ([Errno 111]...)        │◄──│── highlighted
│  │  Line 553565   ... normal log line ...                   │   │
│  │  Line 553566   ... normal log line ...                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4 Tooltip System

Every anomaly card has an ⓘ icon. Hover reveals a tooltip with plain-English technical explanation:

| Term | Tooltip |
|------|---------|
| TTE | Time To Empty — the battery controller's estimate of remaining runtime in minutes based on current draw rate |
| RSSI | Received Signal Strength Indicator — measured in dBm. The device reports this as a percentage where 100% ≈ -30 dBm and 0% ≈ -90 dBm |
| Roam | When a device switches from one Access Point to another. Frequent roaming indicates coverage overlap or power imbalance between APs |
| ODR | Output Data Record — a completed work transaction (e.g. a pick confirmation) queued for upload to the host system |
| Tick | Internal millisecond counter that increments from boot. A reset (drop to a small number) indicates a device reboot |
| Continuous Socket | Internal inter-process communication channel on port 15008. Failures here block data sync |
| EnergyConsumption | Cumulative battery discharge in milliamp-hours since last full charge. Increasingly negative = more energy used |

### 6.5 Key React Components

```
src/
├── app/
│   ├── page.tsx                    # Dashboard with upload zone
│   ├── devices/
│   │   ├── page.tsx                # Device grid
│   │   └── [serial]/
│   │       ├── page.tsx            # Device profile
│   │       ├── logs/[id]/page.tsx  # Log explorer
│   │       └── anomalies/page.tsx  # Anomaly browser
│   └── api/
│       ├── upload/route.ts         # File upload → forward to parser
│       ├── devices/route.ts        # CRUD devices
│       ├── anomalies/route.ts      # Query anomalies
│       ├── telemetry/route.ts      # Battery, WiFi, Roam data for charts
│       ├── export/pdf/route.ts     # Server-side PDF generation
│       ├── export/csv/route.ts     # CSV export
│       └── export/html/route.ts    # Standalone HTML report
├── components/
│   ├── upload/
│   │   ├── DropZone.tsx            # Drag-and-drop file upload
│   │   └── ImportProgress.tsx      # Real-time parsing progress
│   ├── devices/
│   │   ├── DeviceCard.tsx          # Device summary card
│   │   └── DeviceProfile.tsx       # Full device view with sessions
│   ├── explorer/
│   │   ├── AnomalyTimeline.tsx     # Horizontal timeline with markers
│   │   ├── AnomalyCard.tsx         # Single anomaly with expand
│   │   ├── ContextViewer.tsx       # Log line context with highlights
│   │   ├── TelemetryChart.tsx      # Recharts line/area chart
│   │   └── FilterBar.tsx           # Family/severity/search filters
│   ├── export/
│   │   └── ExportMenu.tsx          # PDF/CSV/HTML export buttons
│   └── shared/
│       ├── Tooltip.tsx             # Technical term tooltip
│       └── SeverityBadge.tsx       # CRITICAL/WARNING/INFO badge
├── lib/
│   ├── prisma.ts                   # Prisma client
│   ├── tooltips.ts                 # Tooltip text database
│   └── api-client.ts              # Typed API client for parser service
└── prisma/
    └── schema.prisma               # Database schema (mirrors Section 3)
```

### 6.6 Chart Library: Recharts

Use Recharts (already available in React artifacts) for all telemetry visualizations:

| Chart | X-Axis | Y-Axis | Notes |
|-------|--------|--------|-------|
| Battery Drain | server_time | percent_remaining | Area chart, red zone below 15% |
| Battery Runtime | server_time | runtime_minutes | Line chart with 30-min threshold line |
| Temperature | server_time | temperature_c | Line chart, warning zones at extremes |
| Energy Consumption | server_time | energy_consumption | Line chart (cumulative, increasingly negative) |
| WiFi Signal | server_time | signal_strength_pct | Area chart, red zone below 30% |
| Roam Frequency | server_time (bucketed 5min) | roam_count | Bar chart, threshold line at 5/window |

All charts should support: zoom/pan, anomaly markers overlaid as vertical lines, operator session shading (different background color per operator), and click-to-jump-to-anomaly.

---

## 7. Export System

### 7.1 PDF Export (Server-Side)

Generate using `puppeteer` or `@react-pdf/renderer` on the Next.js server:

**Report Structure:**
1. Cover page: Device serial, firmware, time range, generated date
2. Executive Summary: total anomalies by severity, total runtime, operators
3. Battery Health: drain chart + anomaly table
4. WiFi Quality: signal chart + roam chart + anomaly table
5. Connection Health: failure timeline + error ratio
6. Full Anomaly Log: all detected issues with context

### 7.2 CSV Export

One CSV per data domain:
- `device_7623205329_battery.csv` — all battery readings
- `device_7623205329_wifi.csv` — all signal readings
- `device_7623205329_anomalies.csv` — all anomalies with context
- `device_7623205329_roaming.csv` — all roam events

### 7.3 HTML Export

A self-contained single `.html` file with embedded CSS and data (no external dependencies) that can be opened in any browser offline. Uses the same chart library bundled inline.

---

## 8. Delete Without Affecting Database Integrity

When a user deletes an import:

```sql
-- Soft delete: mark as deleted, keep device profile intact
UPDATE log_imports SET status = 'deleted' WHERE id = :import_id;

-- Hard delete (if requested): cascade removes all child records
-- but preserves the device record if other imports exist
DELETE FROM log_imports WHERE id = :import_id;
-- CASCADE removes: battery_readings, wifi_readings, roam_events,
--                   connection_events, anomalies, operator_sessions
--                   (all linked by log_import_id)

-- Clean up orphaned device only if no imports remain
DELETE FROM devices WHERE id = :device_id
AND NOT EXISTS (SELECT 1 FROM log_imports WHERE device_id = :device_id AND status != 'deleted');
```

The raw file is also removed from volume storage on hard delete.

---

## 9. Performance Considerations

| Concern | Solution |
|---------|----------|
| 1.6M-line files | Stream parser (Python generator), never load to RAM. Process in ~30-60s on Railway |
| Bulk inserts | Use `psycopg.copy` or batch `INSERT ... VALUES` (1000 rows per batch) |
| Chart rendering | Pre-aggregate: downsample to 500 points for charts using `NTILE` or time bucketing |
| File upload UX | Chunked upload with progress bar. Show real-time parsing status via SSE or polling |
| Search in anomalies | PostgreSQL full-text search on anomaly title + description |
| Cold starts on Railway | Use Railway's always-on option for the parser service, or accept ~2s cold start |

### Prisma Query Example (Downsampled Battery Chart)

```typescript
// Get ~500 evenly spaced battery readings for chart
const readings = await prisma.$queryRaw`
  SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (ORDER BY server_time) as rn,
           COUNT(*) OVER () as total
    FROM battery_readings
    WHERE device_id = ${deviceId} AND log_import_id = ${importId}
  ) sub
  WHERE rn % GREATEST(total / 500, 1) = 0
  ORDER BY server_time
`;
```

---

## 10. Railway Deployment Configuration

### `railway.toml` (Root)

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/health"
```

### Service Environment Variables

```bash
# Next.js (web service)
DATABASE_URL=postgresql://user:pass@db.railway.internal:5432/logparser
PARSER_URL=http://parser.railway.internal:8000
NEXT_PUBLIC_APP_URL=https://logparser.up.railway.app

# Python (parser service)
DATABASE_URL=postgresql://user:pass@db.railway.internal:5432/logparser
UPLOAD_DIR=/data/uploads

# PostgreSQL (Railway plugin)
# Auto-configured by Railway
```

### Monorepo Structure

```
honeywell-log-parser/
├── apps/
│   ├── web/                    # Next.js app
│   │   ├── src/
│   │   ├── prisma/
│   │   ├── package.json
│   │   └── next.config.js
│   └── parser/                 # Python FastAPI service
│       ├── app/
│       │   ├── main.py         # FastAPI entry
│       │   ├── parser/
│       │   │   ├── engine.py   # Stream parser
│       │   │   ├── matchers.py # Regex matchers
│       │   │   ├── anomalies.py# Detection rules
│       │   │   └── models.py   # Pydantic models
│       │   ├── db/
│       │   │   └── repository.py # DB operations
│       │   └── api/
│       │       ├── upload.py   # Upload endpoint
│       │       └── health.py   # Health check
│       ├── requirements.txt
│       └── Dockerfile
├── packages/
│   └── shared/                 # Shared types/constants
│       └── error-codes.json    # Hex error code database
└── README.md
```

---

## 11. Hackathon Scoring Optimization

| Criteria | How This Architecture Scores |
|----------|------------------------------|
| **Easy to use** | Drag-and-drop upload, auto-detection of device/operators, zero config for end user |
| **Scalable** | Config-driven anomaly rules (add new rules without code changes), modular matchers, Prisma migrations for schema evolution |
| **Underline offending values** | Every anomaly stores `offending_value` and `threshold_value`, rendered as highlighted red text in context viewer |
| **Additional reporting** | PDF, CSV, HTML export built in. Web dashboard is itself a rich report. Charts with Recharts. |
| **Presentation quality** | Architecture is self-documenting. This doc + the live demo cover it. |

---

## 12. Implementation Priority (5-Day Sprint)

| Day | Focus | Deliverable |
|-----|-------|-------------|
| **Mon** | Parser engine + DB schema | Working Python parser that reads both sample logs and emits structured JSON. PostgreSQL schema deployed on Railway. |
| **Tue** | Next.js scaffold + upload flow | File upload → parser → DB pipeline working end-to-end. Device cards visible on dashboard. |
| **Wed** | Log explorer + anomaly cards | Anomaly list with severity badges, context viewer with highlighted offending lines, filter bar. |
| **Thu** | Charts + exports | Recharts battery/wifi/temperature charts. PDF and CSV export working. |
| **Fri** | Polish + presentation | Tooltips, dark mode, responsive cleanup, PPT deck, edge case hardening. |

---

*Architecture designed for GTS Hackathon 2026 — Team EMEA. Targeting Railway deployment with Next.js + Python + PostgreSQL.*
