# FULL-STACK BUILD PROMPT — Honeywell Vocollect Data Log Parser
# Railway + Next.js + Python FastAPI + PostgreSQL

Build a production-grade **Honeywell Vocollect Data Log Parser** — a full-stack web application deployed to Railway. The system ingests device log files (160MB, 1.6M lines each), parses them through a Python regex engine, stores structured telemetry in PostgreSQL, and renders an interactive engineering dashboard in Next.js.

This is for a hackathon with real judges evaluating: ease of use, scalability, ability to underline offending values, and additional reporting (PDF/web/CSV exports). Build everything fully functional — no placeholders, no TODOs, no stubs.

---

## ARCHITECTURE OVERVIEW

```
Railway Deployment (3 services):

┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Next.js App    │────▶│  Python Parser   │────▶│  PostgreSQL  │
│   (web)          │     │  (FastAPI)       │     │  (db)        │
│                  │     │                  │     │              │
│ • React frontend │     │ • Stream parser  │     │ • devices    │
│ • API routes     │     │ • Regex matchers │     │ • log_imports│
│ • File upload    │     │ • Anomaly detect │     │ • battery    │
│ • Export gen     │     │ • Dedup logic    │     │ • wifi       │
│ • Chart renders  │     │ • Batch insert   │     │ • roams      │
└──────────────────┘     └──────────────────┘     │ • anomalies  │
                                                   │ • operators  │
                                                   │ • connections│
                                                   │ • system_evts│
                                                   └──────────────┘
```

---

## PART 1: PROJECT STRUCTURE

```
honeywell-log-parser/
├── apps/
│   ├── web/                          # Next.js 14 (App Router)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                    # Dashboard
│   │   │   │   ├── globals.css
│   │   │   │   └── api/
│   │   │   │       ├── upload/route.ts         # POST: file upload → forward to parser
│   │   │   │       ├── devices/route.ts        # GET: list devices
│   │   │   │       ├── devices/[serial]/route.ts       # GET: device detail
│   │   │   │       ├── devices/[serial]/battery/route.ts
│   │   │   │       ├── devices/[serial]/wifi/route.ts
│   │   │   │       ├── devices/[serial]/roams/route.ts
│   │   │   │       ├── devices/[serial]/connections/route.ts
│   │   │   │       ├── devices/[serial]/anomalies/route.ts
│   │   │   │       ├── devices/[serial]/operators/route.ts
│   │   │   │       ├── devices/[serial]/timeline/route.ts
│   │   │   │       ├── devices/[serial]/export/csv/route.ts
│   │   │   │       └── devices/[serial]/export/html/route.ts
│   │   │   ├── components/
│   │   │   │   ├── UploadZone.tsx
│   │   │   │   ├── DeviceSidebar.tsx
│   │   │   │   ├── TabBar.tsx
│   │   │   │   ├── OverviewTab.tsx
│   │   │   │   ├── BatteryTab.tsx
│   │   │   │   ├── WifiRoamingTab.tsx
│   │   │   │   ├── AnomaliesTab.tsx
│   │   │   │   ├── TimelineTab.tsx
│   │   │   │   ├── AnomalyCard.tsx
│   │   │   │   ├── ContextViewer.tsx
│   │   │   │   ├── StatsCard.tsx
│   │   │   │   └── ExportButtons.tsx
│   │   │   └── lib/
│   │   │       ├── db.ts                       # Prisma client singleton
│   │   │       └── tooltips.ts                 # Technical term definitions
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── package.json
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── next.config.js
│   │
│   └── parser/                       # Python FastAPI
│       ├── app/
│       │   ├── main.py               # FastAPI app entry
│       │   ├── parser/
│       │   │   ├── __init__.py
│       │   │   ├── engine.py         # Stream parsing pipeline
│       │   │   ├── matchers.py       # All regex matchers
│       │   │   ├── anomalies.py      # Anomaly detection rules
│       │   │   ├── models.py         # Pydantic data models
│       │   │   └── error_codes.py    # Hex error code lookup
│       │   ├── db/
│       │   │   ├── __init__.py
│       │   │   ├── connection.py     # asyncpg pool
│       │   │   └── repository.py     # Bulk insert operations
│       │   └── api/
│       │       ├── __init__.py
│       │       └── upload.py         # Upload endpoint
│       ├── requirements.txt
│       └── Dockerfile
│
└── README.md
```

---

## PART 2: POSTGRESQL SCHEMA (prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Device {
  id              String   @id @default(uuid())
  serialNumber    String   @unique @map("serial_number")
  terminalName    String?  @map("terminal_name")
  firmwareVersion String?  @map("firmware_version")
  macAddress      String?  @map("mac_address")
  platformVersion String?  @map("platform_version")
  firstSeen       DateTime @map("first_seen")
  lastSeen        DateTime @map("last_seen")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  logImports       LogImport[]
  batteryReadings  BatteryReading[]
  wifiReadings     WifiReading[]
  roamEvents       RoamEvent[]
  connectionEvents ConnectionEvent[]
  anomalies        Anomaly[]
  operatorSessions OperatorSession[]
  systemEvents     SystemEvent[]

  @@map("devices")
}

model LogImport {
  id            String   @id @default(uuid())
  deviceId      String   @map("device_id")
  filename      String
  logStartTime  DateTime @map("log_start_time")
  logStopTime   DateTime @map("log_stop_time")
  logType       String   @default("standard") @map("log_type")
  ipAddress     String?  @map("ip_address")
  lineCount     Int?     @map("line_count")
  fileSizeBytes BigInt?  @map("file_size_bytes")
  status        String   @default("processing")
  errorMessage  String?  @map("error_message")
  importedAt    DateTime @default(now()) @map("imported_at")

  device           Device             @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  batteryReadings  BatteryReading[]
  wifiReadings     WifiReading[]
  roamEvents       RoamEvent[]
  connectionEvents ConnectionEvent[]
  anomalies        Anomaly[]
  operatorSessions OperatorSession[]
  systemEvents     SystemEvent[]

  @@unique([deviceId, logStartTime, logStopTime])
  @@map("log_imports")
}

model BatteryReading {
  id               String   @id @default(uuid())
  deviceId         String   @map("device_id")
  logImportId      String   @map("log_import_id")
  serverTime       DateTime @map("server_time")
  deviceTime       String   @map("device_time")
  tick             BigInt
  lineNumber       Int      @map("line_number")
  runtimeMinutes   Int?     @map("runtime_minutes")
  percentRemaining Int?     @map("percent_remaining")
  volts            Decimal? @db.Decimal(5, 3)
  energyConsumption Int?    @map("energy_consumption")
  temperatureC     Decimal? @map("temperature_c") @db.Decimal(4, 1)

  device    Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  logImport LogImport @relation(fields: [logImportId], references: [id], onDelete: Cascade)

  @@index([deviceId, serverTime])
  @@map("battery_readings")
}

model WifiReading {
  id                String   @id @default(uuid())
  deviceId          String   @map("device_id")
  logImportId       String   @map("log_import_id")
  serverTime        DateTime @map("server_time")
  deviceTime        String   @map("device_time")
  tick              BigInt
  lineNumber        Int      @map("line_number")
  signalStrengthPct Int?     @map("signal_strength_pct")
  signalSamples     Int[]    @map("signal_samples")
  accessPointMac    String?  @map("access_point_mac")
  operatorName      String?  @map("operator_name")
  cpuUsage          Decimal? @map("cpu_usage") @db.Decimal(5, 2)
  ramLoadPct        Int?     @map("ram_load_pct")
  flashAvailKb      Int?     @map("flash_avail_kb")

  device    Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  logImport LogImport @relation(fields: [logImportId], references: [id], onDelete: Cascade)

  @@index([deviceId, serverTime])
  @@map("wifi_readings")
}

model RoamEvent {
  id          String   @id @default(uuid())
  deviceId    String   @map("device_id")
  logImportId String   @map("log_import_id")
  serverTime  DateTime @map("server_time")
  deviceTime  String   @map("device_time")
  tick        BigInt
  lineNumber  Int      @map("line_number")
  fromAp      String   @map("from_ap")
  toAp        String   @map("to_ap")

  device    Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  logImport LogImport @relation(fields: [logImportId], references: [id], onDelete: Cascade)

  @@index([deviceId, serverTime])
  @@map("roam_events")
}

model ConnectionEvent {
  id              String   @id @default(uuid())
  deviceId        String   @map("device_id")
  logImportId     String   @map("log_import_id")
  serverTime      DateTime @map("server_time")
  deviceTime      String   @map("device_time")
  tick            BigInt
  lineNumber      Int      @map("line_number")
  eventType       String   @map("event_type")
  host            String?
  port            Int?
  connectionCount Int?     @map("connection_count")
  errorCount      Int?     @map("error_count")
  errorDetail     String?  @map("error_detail")

  device    Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  logImport LogImport @relation(fields: [logImportId], references: [id], onDelete: Cascade)

  @@index([deviceId, serverTime])
  @@map("connection_events")
}

model OperatorSession {
  id            String   @id @default(uuid())
  deviceId      String   @map("device_id")
  logImportId   String   @map("log_import_id")
  operatorExtId String?  @map("operator_ext_id")
  operatorName  String   @map("operator_name")
  sessionStart  DateTime @map("session_start")
  sessionEnd    DateTime @map("session_end")
  readingCount  Int      @default(0) @map("reading_count")

  device    Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  logImport LogImport @relation(fields: [logImportId], references: [id], onDelete: Cascade)

  @@index([deviceId])
  @@index([operatorName])
  @@map("operator_sessions")
}

model Anomaly {
  id              String   @id @default(uuid())
  deviceId        String   @map("device_id")
  logImportId     String   @map("log_import_id")
  family          String
  severity        String
  ruleId          String   @map("rule_id")
  title           String
  description     String?
  tooltip         String?
  firstLine       Int      @map("first_line")
  lastLine        Int      @map("last_line")
  triggerLines    String   @map("trigger_lines")
  serverTime      DateTime @map("server_time")
  deviceTime      String?  @map("device_time")
  tick            BigInt?
  offendingValue  String?  @map("offending_value")
  thresholdValue  String?  @map("threshold_value")
  detectedAt      DateTime @default(now()) @map("detected_at")

  device    Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  logImport LogImport @relation(fields: [logImportId], references: [id], onDelete: Cascade)

  @@index([deviceId])
  @@index([family])
  @@index([severity])
  @@index([serverTime])
  @@map("anomalies")
}

model SystemEvent {
  id          String   @id @default(uuid())
  deviceId    String   @map("device_id")
  logImportId String   @map("log_import_id")
  serverTime  DateTime @map("server_time")
  deviceTime  String   @map("device_time")
  tick        BigInt
  lineNumber  Int      @map("line_number")
  eventType   String   @map("event_type")
  description String

  device    Device    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  logImport LogImport @relation(fields: [logImportId], references: [id], onDelete: Cascade)

  @@index([deviceId, serverTime])
  @@map("system_events")
}
```

---

## PART 3: PYTHON PARSER — EXACT REGEX PATTERNS (from real log analysis)

Every regex below was reverse-engineered from actual 1.6M-line Vocollect Talkman log files. Do NOT modify these patterns — they match the real data exactly.

### 3A: Line timestamp parser

Every event line in the log has this format:
```
(2/28/24 2:31:24 PM CET) 14:14:42.069 - 43767026: SRX 3 wireless headset is connected
```

```python
import re

LINE_PATTERN = re.compile(
    r'^\((.+?)\)\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+-\s+(\d+):\s+(.*)'
)
# Groups: server_time_str, device_time, tick, event_text
```

Server time format: `M/D/YY h:mm:ss AM/PM TZ` — parse with:
```python
from datetime import datetime

def parse_server_time(s: str) -> datetime:
    """Parse '2/28/24 2:31:24 PM CET' → datetime"""
    # Strip timezone suffix (CET, EST, etc.)
    parts = s.rsplit(' ', 1)
    time_str = parts[0]
    return datetime.strptime(time_str, '%m/%d/%y %I:%M:%S %p')
```

### 3B: Header parser

The log file starts with a header block before the `---` separator:
```
Log Start Time: 2/28/24 2:30:53 PM CET
Log Stop Time: 2/29/24 2:31:47 PM CET
Log Type: standard
Terminal Name: 7623205329
Terminal Serial Number: 7623205329
Firmware Version: VCL-20231214123659_V4.7.1.no_NO_12
IP Address: 172.17.75.98

----------------------------------------
```

Parse by splitting each line on the first `: ` (colon-space). Header ends at the `---` line. Map the keys to metadata fields.

### 3C: Skip-prefix optimization (CRITICAL FOR PERFORMANCE)

Before running ANY regex matcher on a line's event_text, check these prefixes. If the event_text starts with any of them, SKIP to the next line immediately. These are voice recognition engine internals — they constitute ~95% of all log lines and are irrelevant to telemetry analysis. This single optimization reduces parsing time by 10-20x.

```python
SKIP_PREFIXES = (
    'SPCHDET', 'DECODER', 'Recognition message', 'RecogEvent',
    'handling REX', '^^', 'Entering:', 'Transitioning',
    'VoiceArtisan', 'VKillSpeech', 'Starting recognizer',
    'Started recognizer', 'Resetting back', 'Using start',
    '> Recognizer', '< Recognizer', 'checkGrammar',
    '> RecognizerService', '< RecognizerService',
    'Saw first content', 'Received new recognized',
    '[DisplayMessageBrowser', 'Reject due to length',
    '> virtual bool BT::Bluetooth',  # BT socket connect noise
    'PLATFORM LOG:',                  # platform syslog mirrors
    'Continuous Socket:',             # high-volume socket status (handled separately for failures only)
)

def should_skip(event_text: str) -> bool:
    return event_text.startswith(SKIP_PREFIXES)
```

**EXCEPTION**: `Continuous Socket:` lines should ONLY be processed by the connection failure matcher (check for "Connection Failed" in the line). Skip the "Transmission Completed" variants — there are thousands of them and they carry no diagnostic value.

### 3D: Matchers (ordered by priority)

**MATCHER 1 — Battery comprehensive** (~500 hits per 24h file)

Real line:
```
VocollectPowerMgmtService : Battery properties>> [TTE (min): 123]; [PercentCharge: 32%]; [Volts: 3.414]; [EnergyConsumption: -3398 mAh]; [Temperature: 9.7deg C]
```

```python
BATTERY_FULL = re.compile(
    r'VocollectPowerMgmtService.*'
    r'\[TTE \(min\): (\d+)\].*'
    r'\[PercentCharge: (\d+)%\].*'
    r'\[Volts: ([\d.]+)\].*'
    r'\[EnergyConsumption: (-?\d+) mAh\].*'
    r'\[Temperature: ([\d.]+)deg C\]'
)
# Groups: runtime_min, percent, volts, energy_mah, temp_c
```

This is the gold mine — 5 data series from one regex match. Data ranges observed in real files:
- percent: 14% → 100% (drains down during shift, recharges between shifts)
- runtime: 0 → 1448 minutes
- volts: 3.3 → 4.2
- energy: -5800 → 0 mAh (increasingly negative = more energy used)
- temp: 1.6°C → 35.2°C

**MATCHER 2 — WiFi signal strength** (~1430 hits per 24h file)

Real line:
```
SURVEY: Signal Strength: 43% ( 48 43 41 42 36 39 47 46 46 43  )
```

```python
WIFI_SIGNAL = re.compile(
    r'SURVEY: Signal Strength:\s+(\d+)%\s+\(\s*([\d\s]+)\)'
)
# Groups: signal_pct, sample_values_string
# Split sample_values_string on whitespace to get int array
```

**MATCHER 3 — WiFi access point** (~1430 hits, fires 1 line before signal strength)

Real line:
```
SURVEY: Access Point: 48:4A:E9:CD:6C:D4
```

```python
WIFI_AP = re.compile(r'SURVEY: Access Point:\s+([\dA-Fa-f:]+)')
```

Track `last_seen_ap` as state and attach it to the next signal strength reading.

**MATCHER 4 — Operator identity** (~1430 hits, fires in same survey block)

Real line:
```
Terminal SN = 7623205329      Current Operator ID = 2892388,  Current Operator Name = Michael Krogtoft
```

```python
OPERATOR = re.compile(
    r'Terminal SN\s*=\s*(\w+)\s+Current Operator ID\s*=\s*(\w+),\s+'
    r'Current Operator Name\s*=\s*(.+?)[\r]*$'
)
# Groups: serial, operator_id, operator_name
```

Use a state machine: track `current_operator_name`. When name changes → close previous operator session, open new one. Real data: Device 329 has Michael Krogtoft (14:14 Feb 28 → 09:02 Feb 29) then Truls Ilseth (09:03 → end). Device 333 has John Johansen then Sinisa Duric.

**MATCHER 5 — AP Roaming** (~340 hits per 24h file)

Real line:
```
AP MON: ROAMED from AP 48:4A:E9:CD:6C:D4 to AP 48:4A:E9:CD:42:D4
```

```python
ROAM_EVENT = re.compile(
    r'AP MON: ROAMED from AP ([\dA-Fa-f:]+) to AP ([\dA-Fa-f:]+)'
)
# Groups: from_ap, to_ap
```

There is ALSO a survey-block roam line with slightly different format — parse both:
```
SURVEY: Roamed from AP: 48:4A:E9:CD:6C:D4 to AP: 48:4A:E9:CD:42:D4
```

```python
SURVEY_ROAM = re.compile(
    r'SURVEY: Roamed from AP:\s*([\dA-Fa-f:]+)\s+to AP:\s*([\dA-Fa-f:]+)'
)
```

Deduplicate roams that have the same tick value (AP MON and SURVEY lines for the same roam event fire within 1 tick).

**MATCHER 6 — Connection failures** (0-827 per file)

Real line:
```
Continuous Socket: [Host = 127.0.0.1, port = 15008, Timeout = 5, Connection Count = 441, Error Count = 440] Connection Failed ([Errno 111] Connection refused)
```

```python
CONN_FAILED = re.compile(
    r'Continuous Socket: \[Host = ([\d.]+), port = (\d+).*?'
    r'Connection Count = (\d+), Error Count = (\d+)\]\s+'
    r'Connection Failed\s*\((.+?)\)'
)
# Groups: host, port, conn_count, err_count, error_detail
```

**IMPORTANT**: Only match lines containing "Connection Failed". Lines with "Transmission Completed" are normal operation — skip them (they are in the SKIP_PREFIXES via "Continuous Socket:"). The connection failure matcher should run BEFORE the skip check, or have its own check: `if 'Connection Failed' in event_text`.

**MATCHER 7 — System health from survey block**

CPU: `Average CPU usage during last minute: 65.78%`
```python
CPU_USAGE = re.compile(r'Average CPU usage during last minute:\s+([\d.]+)%')
```

RAM: `RAM (heap): Load 13%, Avail 131648K, Used 819572K`
```python
RAM_USAGE = re.compile(r'RAM \(heap\): Load (\d+)%, Avail (\d+)K, Used (\d+)K')
```

Flash: `FLASH: Avail(Clean) 1519987KB, Used 1040989KB`
```python
FLASH_USAGE = re.compile(r'FLASH: Avail\(Clean\) (\d+)KB, Used (\d+)KB')
```

MAC: `Hardware (MAC) Address: 54:f8:2a:d5:8b:a1`
```python
MAC_ADDRESS = re.compile(r'Hardware \(MAC\) Address:\s+([\dA-Fa-f:]+)')
```

Platform: `Terminal Platform Version = VIPV_83.0`
```python
PLATFORM_VER = re.compile(r'Terminal Platform Version\s*=\s*(.+)')
```

Headset: `SRX 3 wireless headset is connected, ID = 00142806163B`
```python
HEADSET = re.compile(r'(SRX\s*\d?\s*wireless headset is connected), ID = ([\dA-Fa-f]+)')
```

Store CPU, RAM, Flash readings in the wifi_readings table (they fire in the same survey block, same timestamp). Store MAC, platform version in device metadata (update on first occurrence).

**MATCHER 8 — Warning messages**

```python
WARNING_MSG = re.compile(r'^WARNING!\s+(.+)', re.IGNORECASE)
```

Real example: `WARNING! Messages lost!`

**MATCHER 9 — Hex error codes**

```python
HEX_ERROR = re.compile(r'(?:Error|error|ERROR).*?(0x[0-9A-Fa-f]{4})')
```

Lookup table (include all these):
```python
ERROR_CODES = {
    "0x1402": ("Receive error", "SOCKET", "WARNING"),
    "0x1403": ("Send error", "SOCKET", "WARNING"),
    "0x1406": ("GetIdFromName error", "SOCKET", "WARNING"),
    "0x140a": ("Config file close error", "SYSTEM", "WARNING"),
    "0x140f": ("Config file delete error", "SYSTEM", "WARNING"),
    "0x1410": ("NTI registration failed", "SOCKET", "CRITICAL"),
    "0x1411": ("Unrecognized message", "SYSTEM", "WARNING"),
    "0x1414": ("Unable to spawn barcode process", "SYSTEM", "CRITICAL"),
    "0x1415": ("Unable to spawn serial process", "SYSTEM", "CRITICAL"),
    "0x1417": ("Bad FTP command", "SOCKET", "WARNING"),
    "0x141b": ("Bad socket command", "SOCKET", "WARNING"),
    "0x1425": ("Socket host/IP bad", "SOCKET", "CRITICAL"),
    "0x1426": ("Socket service/port bad", "SOCKET", "CRITICAL"),
    "0x1427": ("Unable to send file via socket", "SOCKET", "CRITICAL"),
    "0x1602": ("Low flash memory", "SYSTEM", "WARNING"),
    "0x1603": ("Low flash — must upload now", "SYSTEM", "CRITICAL"),
    "0x2112": ("Flash full — device turning off", "SYSTEM", "CRITICAL"),
    "0x1216": ("Retraining word failed", "VOICE", "WARNING"),
    "0x1217": ("Initializing operator failed", "VOICE", "CRITICAL"),
    "0x1218": ("Failed to load task phonetic file", "VOICE", "CRITICAL"),
    "0x1219": ("Failed to load task audio file", "VOICE", "CRITICAL"),
    "0x1600": ("File Manager init failed", "SYSTEM", "CRITICAL"),
}
```

### 3E: Anomaly detection rules

```python
ANOMALY_RULES = {
    # Battery
    "BATT_PCT_WARN":  {"family": "BATTERY", "severity": "WARNING",  "check": lambda pct: pct <= 15,
                       "title": "Battery below 15%", "tooltip": "Device battery is low. Operator should swap batteries soon to avoid mid-task shutdown."},
    "BATT_PCT_CRIT":  {"family": "BATTERY", "severity": "CRITICAL", "check": lambda pct: pct <= 5,
                       "title": "Battery critically low — shutdown imminent", "tooltip": "Device will auto-shutdown shortly. Unsent ODRs queued in flash."},
    "BATT_RUNTIME":   {"family": "BATTERY", "severity": "WARNING",  "check": lambda rt: rt <= 30,
                       "title": "Runtime ≤ 30 minutes", "tooltip": "TTE (Time To Empty) — battery controller estimate of remaining runtime based on current draw."},
    "BATT_TEMP_HIGH": {"family": "BATTERY", "severity": "WARNING",  "check": lambda t: t > 45,
                       "title": "Battery temperature exceeds 45°C", "tooltip": "A700x battery rated -20°C to +50°C. Sustained heat degrades lithium-ion cells."},
    "BATT_TEMP_LOW":  {"family": "BATTERY", "severity": "WARNING",  "check": lambda t: t < -10,
                       "title": "Battery temperature below -10°C", "tooltip": "Cold temperatures reduce capacity and increase internal resistance."},

    # WiFi
    "WIFI_WARN":      {"family": "WIFI", "severity": "WARNING",  "check": lambda s: s < 30,
                       "title": "WiFi signal below 30%", "tooltip": "Signal Strength % maps to RSSI. Below 30% (~-75 dBm) expect packet loss and latency."},
    "WIFI_CRIT":      {"family": "WIFI", "severity": "CRITICAL", "check": lambda s: s < 20,
                       "title": "WiFi signal critically low", "tooltip": "Device barely maintaining connection. ODRs queued in flash. Voice task data stalls."},

    # Socket
    "CONN_BURST":     {"family": "SOCKET", "severity": "CRITICAL",
                       "title": "Connection failure burst", "tooltip": "Rapid consecutive failures to local socket (port 15008) — internal comms service is down or restarting."},

    # System
    "ROAM_STORM":     {"family": "WIFI", "severity": "WARNING",
                       "title": "Roaming storm detected", "tooltip": "Frequent AP changes in short window — coverage overlap zone or AP power imbalance."},
    "TICK_RESET":     {"family": "SYSTEM", "severity": "WARNING",
                       "title": "Device reboot detected", "tooltip": "Tick counter reset indicates the device restarted. Check for battery pull, crash, or forced reset."},
    "MSGS_LOST":      {"family": "SYSTEM", "severity": "WARNING",
                       "title": "Log messages lost", "tooltip": "Internal log buffer overflowed. Some events not captured during high-activity period."},
}
```

**Anomaly deduplication**: Track `last_fired: dict[rule_id, bool]`. Once a rule fires (e.g., BATT_PCT_WARN at 15%), don't fire again until the value recovers above the threshold. Only create ONE anomaly per threshold crossing.

**Post-processing anomalies** (after all lines parsed):
1. **Roam storms**: Scan roam_events with sliding 5-minute window. If >5 roams in any window → create ROAM_STORM anomaly at the window start time.
2. **Connection bursts**: If >10 connection failures within 60 seconds → create CONN_BURST anomaly.
3. **Tick resets**: If tick drops by >1,000,000 between consecutive event lines → create TICK_RESET anomaly.

### 3F: Stream parsing pipeline

```python
async def parse_log_file(file_path: str, db_pool) -> dict:
    """
    Stream-parse a log file line by line. Never load full file to RAM.
    Returns summary stats.
    """
    metadata = {}
    battery_batch = []
    wifi_batch = []
    roam_batch = []
    conn_batch = []
    anomaly_batch = []
    system_batch = []

    # State machine
    last_seen_ap = None
    current_operator = None
    current_operator_id = None
    operator_sessions = []
    operator_session_start = None
    operator_reading_count = 0
    last_tick = 0
    last_fired = {}
    header_parsed = False
    line_number = 0

    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        for raw_line in f:
            line_number += 1
            line = raw_line.strip()

            # Parse header
            if not header_parsed:
                if line.startswith('---'):
                    header_parsed = True
                    continue
                if ': ' in line:
                    key, _, value = line.partition(': ')
                    metadata[key.strip()] = value.strip()
                continue

            # Parse timestamp
            m = LINE_PATTERN.match(line)
            if not m:
                continue
            server_time_str, device_time, tick_str, event_text = m.groups()
            tick = int(tick_str)
            event_text = event_text.strip()
            server_time = parse_server_time(server_time_str)

            # Connection failure check BEFORE skip (because Continuous Socket is in skip list)
            if 'Connection Failed' in event_text:
                cm = CONN_FAILED.match(event_text) if event_text.startswith('Continuous') else None
                if cm:
                    conn_batch.append({...})
                    # Check for burst anomaly
                continue  # Don't process further

            # Skip noise lines
            if should_skip(event_text):
                continue

            # Route through matchers (in order)
            # ... battery, wifi_ap, wifi_signal, operator, roam, cpu, ram, flash, mac, platform, headset, warning, hex_error

            # Tick reset detection
            if last_tick > 0 and tick < last_tick - 1000000:
                anomaly_batch.append(tick_reset_anomaly)
            last_tick = tick

    # Post-processing
    # Finalize last operator session
    # Detect roam storms
    # Detect connection bursts

    # UPSERT device → INSERT log_import → BULK INSERT all batches
    # Use INSERT ... ON CONFLICT for device upsert
    # Use executemany or COPY for batch inserts

    return summary_stats
```

### 3G: Database operations

```python
# Device UPSERT
INSERT INTO devices (id, serial_number, terminal_name, firmware_version, mac_address, platform_version, first_seen, last_seen)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (serial_number) DO UPDATE SET
    firmware_version = COALESCE(EXCLUDED.firmware_version, devices.firmware_version),
    mac_address = COALESCE(EXCLUDED.mac_address, devices.mac_address),
    platform_version = COALESCE(EXCLUDED.platform_version, devices.platform_version),
    last_seen = GREATEST(EXCLUDED.last_seen, devices.last_seen),
    updated_at = now()
RETURNING id;

# Log import dedup check
SELECT id FROM log_imports
WHERE device_id = $1 AND log_start_time = $2 AND log_stop_time = $3;
-- If exists → reject duplicate
-- If not → INSERT new log_import

# Batch inserts — use executemany with 1000-row batches for each table
```

### 3H: FastAPI upload endpoint

```python
@router.post("/api/parse")
async def upload_and_parse(file: UploadFile):
    """
    Accept uploaded .txt or .zip file.
    If .zip: extract the .txt file inside.
    Parse and store in PostgreSQL.
    Return device summary + anomaly count.
    """
    # Save uploaded file to temp location
    # If zip: extract with zipfile module
    # Call parse_log_file()
    # Return JSON summary
```

---

## PART 4: NEXT.JS FRONTEND

### 4A: Theme

Dark professional theme throughout. Consistent Tailwind classes:

- Page: `bg-slate-950 text-slate-100 min-h-screen`
- Cards: `bg-slate-900 border border-slate-700/50 rounded-xl p-6`
- Elevated: `bg-slate-800 rounded-lg`
- Labels: `text-slate-400 text-sm`
- Values: `text-slate-100`
- Muted: `text-slate-500 text-xs`
- Accent: `text-blue-400`, `bg-blue-500`
- Warning badge: `bg-amber-500/20 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full`
- Critical badge: `bg-red-500/20 text-red-400 text-xs font-medium px-2 py-0.5 rounded-full`
- Family tag: `bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full`
- Chart axis ticks: `{ fill: '#94a3b8', fontSize: 11 }`
- Chart grid: `stroke="#334155"`
- Chart tooltip: `contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}`
- Chart colors: blue `#3b82f6`, amber `#f59e0b`, red `#ef4444`, emerald `#10b981`, purple `#8b5cf6`

### 4B: Page layout

```
┌─ Header bar (h-14, bg-slate-900, border-b border-slate-700/50) ─────────────┐
│  Logo/Title                                        Export CSV │ Export HTML │  │
├─ Sidebar (w-64) ─┬─ Main Content ──────────────────────────────────────────┤
│                   │  Tab Bar: Overview │ Battery │ WiFi │ Anomalies │ Time  │
│  [Upload btn]     │                                                        │
│                   │  ┌─ Tab Content ──────────────────────────────────────┐ │
│  Device 329  ●3🔴 │  │                                                    │ │
│  Device 333  ●1🟡 │  │  (varies by tab — see below)                       │ │
│                   │  │                                                    │ │
│                   │  └────────────────────────────────────────────────────┘ │
└───────────────────┴────────────────────────────────────────────────────────┘
```

When no devices exist yet → show full-width centered UploadZone instead of sidebar+main.

### 4C: Upload Zone

Centered card (max-w-xl), dashed border (`border-2 border-dashed border-slate-600 hover:border-blue-500`), drag-and-drop:
- Upload icon (lucide)
- "Drop log files here" title
- "Supports .txt and .zip Vocollect Talkman log files" subtitle
- Hidden file input, accepts `.txt,.zip`, multiple
- On drop/select: POST each file to `/api/upload` with FormData
- Show upload progress per file
- When parsing completes: auto-select the device and show dashboard

### 4D: Sidebar (DeviceSidebar)

Per device card (clickable):
- Serial number: `font-semibold text-slate-100`
- Firmware: `text-xs text-slate-500`
- Log timeframe: `text-xs text-slate-500`
- Operators: count + names abbreviated
- Anomaly badge: red dot + critical count, amber dot + warning count
- Selected state: `border-l-2 border-blue-500 bg-slate-800/50`

"Upload More" button at top of sidebar.

### 4E: Tab content

**OVERVIEW TAB**

Row 1 — two cards side by side:
- **Device Info**: grid of label-value pairs (Serial, Terminal Name, Firmware, MAC, IP, Platform Version, Log Start, Log Stop, Duration)
- **Operators**: list of operator sessions with name, ID, session times, duration, colored left border per operator

Row 2 — four StatsCards:
1. Battery icon + reading count + "Battery readings" (blue tint: `bg-blue-500/5 border border-blue-500/20`)
2. Wifi icon + survey count + "WiFi surveys" (emerald tint)
3. Radio icon + roam count + "AP roams" (purple tint)
4. AlertTriangle icon + anomaly count + "Anomalies" (red tint if any critical, amber otherwise)

Row 3 — two mini sparkline AreaCharts (h-32): battery % over time (blue), signal % over time (emerald). `dot={false}`, minimal styling, hover tooltip only.

**BATTERY TAB**

Five Recharts cards stacked:
1. **Battery Level (%)** — AreaChart h-72. Y: 0-100. Blue gradient fill. `ReferenceLine` at y=15 amber dashed, y=5 red dashed.
2. **Runtime (min)** — LineChart h-56. Purple. `ReferenceLine` at y=30 amber dashed.
3. **Temperature (°C)** — LineChart h-56. Amber.
4. **Voltage (V)** — LineChart h-56. Emerald.
5. **Energy (mAh)** — LineChart h-56. Red. Values negative.

All charts: `dot={false}`, dark tooltip, XAxis with HH:MM formatter, ~10 ticks.

**WIFI & ROAMING TAB**

1. **Signal Strength (%)** — AreaChart h-72. Emerald. `ReferenceLine` at y=30, y=20.
2. **Roaming Events** — BarChart h-48. Bucket roams into 30-min windows. Blue bars, amber if count >5.
3. **Access Point Table** — HTML table showing: AP MAC (font-mono), roam count (times appeared as from or to). Sort descending. Alternating row colors.
4. **Connection Failures** — BarChart h-48. Red bars bucketed hourly. Only render if connection events exist.

**ANOMALIES TAB**

Filter bar: severity select + family select + search input + "Showing X of Y" counter.

Anomaly cards (bg-slate-800 rounded-xl p-4 mb-3):
- Header: severity badge + family tag + timestamp (ml-auto)
- Title: `font-medium text-slate-100`
- Description: `text-sm text-slate-400`. Offending value: `text-red-400 font-mono font-semibold`. Threshold: `text-slate-500`.
- Tooltip icon (Info from lucide, 14px) — hover shows plain-English explanation
- "View Context" toggle: expands a `font-mono text-xs bg-slate-950 p-3 rounded-lg` block showing the trigger log line(s), highlighted with `border-l-2 border-red-500`

**TIMELINE TAB**

Merged sorted list of all events (battery, wifi, roam, connection, anomaly). Most recent first.

Per row: timestamp (font-mono text-xs text-slate-500 w-48) + type badge (colored pill) + description (text-sm text-slate-300 truncate).

Search bar. Paginate — show 200 at a time with "Load more".

### 4F: Export

**CSV**: GET `/api/devices/[serial]/export/csv`. Columns: timestamp, category, severity, value, detail. Include all battery readings, wifi, roams, connection failures, anomalies. Respond with `Content-Disposition: attachment; filename="device_[serial]_export.csv"`.

**HTML Summary**: GET `/api/devices/[serial]/export/html`. Generate self-contained HTML with inline dark CSS. Contains: device info table, operator list, stats summary, full anomaly list with severity badges.

### 4G: Delete import

Each log import has a delete button. Hitting it:
1. Soft-deletes the log_import (sets status = 'deleted')
2. CASCADE deletes all child records (battery, wifi, roams, connections, anomalies, operators)
3. If device has no remaining non-deleted imports → remove device too
4. Refresh sidebar

### 4H: Deduplication on upload

When a new file is uploaded:
1. Parser extracts serial_number + log_start_time + log_stop_time from header
2. Check: does a log_import exist with same device + same start + same stop?
3. If yes → reject with message "This exact log timeframe already imported for device {serial}"
4. If same device but different timeframe → add new log_import, parse normally, update device.last_seen
5. If new device → create device + log_import

---

## PART 5: TECHNICAL TERM TOOLTIPS

Include these tooltip definitions in the frontend for hover-explanations:

```typescript
export const TOOLTIPS: Record<string, string> = {
  "TTE": "Time To Empty — battery controller's estimate of remaining runtime in minutes based on current draw rate.",
  "RSSI": "Received Signal Strength Indicator — measured in dBm. Device reports as %, where 100% ≈ -30 dBm, 0% ≈ -90 dBm.",
  "Roam": "When device switches from one Access Point to another. Frequent roaming = coverage overlap or AP power imbalance.",
  "ODR": "Output Data Record — completed work transaction (e.g., pick confirmation) queued for upload to host system.",
  "Tick": "Internal millisecond counter incrementing from boot. A reset (drop to small number) indicates device reboot.",
  "Continuous Socket": "Internal inter-process communication channel on port 15008. Failures block ODR transmission and task data sync.",
  "Energy Consumption": "Cumulative battery discharge in milliamp-hours since last full charge. Increasingly negative = more used.",
  "EAP": "Extensible Authentication Protocol — enterprise WiFi auth. Failures here mean the device can't join the network.",
  "Flash": "Internal non-volatile storage. Low flash warnings mean the device may lose data or shut down.",
  "Signal Samples": "10 consecutive RSSI measurements. Wide variance indicates unstable RF environment.",
  "CAM": "Constantly Aware Mode — WiFi radio always on. Best connectivity but highest power draw.",
  "PSP": "Power Save Polling — WiFi radio sleeps in intervals. Saves battery but may reduce connectivity.",
  "VocollectPowerMgmtService": "Internal battery monitoring service that reports charge level, runtime, voltage, temperature every ~3 minutes.",
  "SRX": "Honeywell's wireless Bluetooth headset series for voice-directed work terminals.",
};
```

---

## PART 6: RAILWAY DEPLOYMENT

### Environment variables

```bash
# Next.js
DATABASE_URL=postgresql://...  # Railway PostgreSQL plugin URL
PARSER_URL=http://parser.railway.internal:8000

# Python parser
DATABASE_URL=postgresql://...  # Same PostgreSQL
PORT=8000
```

### railway.toml (web)

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npx prisma migrate deploy && npm start"
healthcheckPath = "/api/health"
```

### Dockerfile (parser)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### requirements.txt

```
fastapi==0.109.0
uvicorn==0.27.0
asyncpg==0.29.0
python-multipart==0.0.6
pydantic==2.5.3
```

---

## PART 7: WHAT THE REAL DATA LOOKS LIKE (for validation)

After parsing the two sample log files, your database should contain approximately:

**Device 7623205329:**
- Firmware: VCL-20231214123659_V4.7.1.no_NO_12
- IP: 172.17.75.98 | MAC: 54:f8:2a:d5:8b:a1
- Log: 2/28/24 2:30 PM → 2/29/24 2:31 PM (24 hours)
- 1,631,052 lines
- Operators: Michael Krogtoft (Feb 28 14:14 → Feb 29 09:02), Truls Ilseth (Feb 29 09:03 → end)
- ~500 battery readings (32% → 14% → recharge → 100% → drain again)
- ~1,430 WiFi surveys (signal range 28%-65%)
- ~345 roam events across 28 unique APs
- ~827 connection failures (burst at 09:03 during operator switch)
- Temperature range: 1.6°C → 35.2°C
- Should trigger anomalies: BATT_PCT_WARN (at 15%), WIFI_WARN (at 28-29%), CONN_BURST (09:03 burst), MSGS_LOST

**Device 7623205333:**
- Firmware: VCL-20231214123659_V4.7.1.no_NO_12
- IP: 172.17.75.109
- Log: 2/28/24 2:30 PM → 2/29/24 2:31 PM (24 hours)
- 1,596,142 lines
- Operators: John Johansen, Sinisa Duric
- ~500 battery readings (26% → 18% → recharge → drain)
- ~1,425 WiFi surveys
- ~335 roam events across 36 unique APs
- 0 connection failures — healthy device
- Temperature range: ~24°C (warmer environment)
- Should trigger anomalies: BATT_PCT_WARN (at 18%, close to threshold), WIFI_WARN (if signal drops below 30%)
