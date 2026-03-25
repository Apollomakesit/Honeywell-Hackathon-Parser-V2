"""All regex matchers for Vocollect Talkman log parsing."""

import re

# Line timestamp pattern
LINE_PATTERN = re.compile(
    r'^\((.+?)\)\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+-\s+(\d+):\s+(.*)'
)

# Skip prefixes — voice recognition engine internals (~95% of lines)
SKIP_PREFIXES = (
    'SPCHDET', 'DECODER', 'Recognition message', 'RecogEvent',
    'handling REX', '^^', 'Entering:', 'Transitioning',
    'VoiceArtisan', 'VKillSpeech', 'Starting recognizer',
    'Started recognizer', 'Resetting back', 'Using start',
    '> Recognizer', '< Recognizer', 'checkGrammar',
    '> RecognizerService', '< RecognizerService',
    'Saw first content', 'Received new recognized',
    '[DisplayMessageBrowser', 'Reject due to length',
    '> virtual bool BT::Bluetooth',
    'PLATFORM LOG:',
    'Continuous Socket:',
)

# Battery comprehensive
BATTERY_FULL = re.compile(
    r'VocollectPowerMgmtService.*'
    r'\[TTE \(min\): (\d+)\].*'
    r'\[PercentCharge: (\d+)%\].*'
    r'\[Volts: ([\d.]+)\].*'
    r'\[EnergyConsumption: (-?\d+) mAh\].*'
    r'\[Temperature: ([\d.]+)deg C\]'
)

# WiFi signal strength
WIFI_SIGNAL = re.compile(
    r'SURVEY: Signal Strength:\s+(\d+)%\s+\(\s*([\d\s]+)\)'
)

# WiFi access point
WIFI_AP = re.compile(r'SURVEY: Access Point:\s+([\dA-Fa-f:]+)')

# Operator identity
OPERATOR = re.compile(
    r'Terminal SN\s*=\s*(\w+)\s+Current Operator ID\s*=\s*(\w+),\s+'
    r'Current Operator Name\s*=\s*(.+?)[\r]*$'
)

# AP Roaming (AP MON format)
ROAM_EVENT = re.compile(
    r'AP MON: ROAMED from AP ([\dA-Fa-f:]+) to AP ([\dA-Fa-f:]+)'
)

# AP Roaming (SURVEY format)
SURVEY_ROAM = re.compile(
    r'SURVEY: Roamed from AP:\s*([\dA-Fa-f:]+)\s+to AP:\s*([\dA-Fa-f:]+)'
)

# Connection failures
CONN_FAILED = re.compile(
    r'Continuous Socket: \[Host = ([\d.]+), port = (\d+).*?'
    r'Connection Count = (\d+), Error Count = (\d+)\]\s+'
    r'Connection Failed\s*\((.+?)\)'
)

# CPU usage
CPU_USAGE = re.compile(r'Average CPU usage during last minute:\s+([\d.]+)%')

# RAM usage
RAM_USAGE = re.compile(r'RAM \(heap\): Load (\d+)%, Avail (\d+)K, Used (\d+)K')

# Flash usage
FLASH_USAGE = re.compile(r'FLASH: Avail\(Clean\) (\d+)KB, Used (\d+)KB')

# MAC address
MAC_ADDRESS = re.compile(r'Hardware \(MAC\) Address:\s+([\dA-Fa-f:]+)')

# Platform version
PLATFORM_VER = re.compile(r'Terminal Platform Version\s*=\s*(.+)')

# Headset
HEADSET = re.compile(r'(SRX\s*\d?\s*wireless headset is connected), ID = ([\dA-Fa-f]+)')

# Warning messages
WARNING_MSG = re.compile(r'^WARNING!\s+(.+)', re.IGNORECASE)

# Hex error codes
HEX_ERROR = re.compile(r'(?:Error|error|ERROR).*?(0x[0-9A-Fa-f]{4})')


def should_skip(event_text: str) -> bool:
    """Check if a line is voice recognition noise that should be skipped."""
    return event_text.startswith(SKIP_PREFIXES)
