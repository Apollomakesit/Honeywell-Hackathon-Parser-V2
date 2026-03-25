"""Anomaly detection rules and post-processing logic."""

from datetime import datetime, timedelta


ANOMALY_RULES = {
    "BATT_PCT_WARN": {
        "family": "BATTERY",
        "severity": "WARNING",
        "check": lambda pct: pct <= 15,
        "title": "Battery below 15%",
        "tooltip": "Device battery is low. Operator should swap batteries soon to avoid mid-task shutdown.",
    },
    "BATT_PCT_CRIT": {
        "family": "BATTERY",
        "severity": "CRITICAL",
        "check": lambda pct: pct <= 5,
        "title": "Battery critically low — shutdown imminent",
        "tooltip": "Device will auto-shutdown shortly. Unsent ODRs queued in flash.",
    },
    "BATT_RUNTIME": {
        "family": "BATTERY",
        "severity": "WARNING",
        "check": lambda rt: rt <= 30,
        "title": "Runtime ≤ 30 minutes",
        "tooltip": "TTE (Time To Empty) — battery controller estimate of remaining runtime based on current draw.",
    },
    "BATT_TEMP_HIGH": {
        "family": "BATTERY",
        "severity": "WARNING",
        "check": lambda t: t > 45,
        "title": "Battery temperature exceeds 45°C",
        "tooltip": "A700x battery rated -20°C to +50°C. Sustained heat degrades lithium-ion cells.",
    },
    "BATT_TEMP_LOW": {
        "family": "BATTERY",
        "severity": "WARNING",
        "check": lambda t: t < -10,
        "title": "Battery temperature below -10°C",
        "tooltip": "Cold temperatures reduce capacity and increase internal resistance.",
    },
    "WIFI_WARN": {
        "family": "WIFI",
        "severity": "WARNING",
        "check": lambda s: s < 30,
        "title": "WiFi signal below 30%",
        "tooltip": "Signal Strength % maps to RSSI. Below 30% (~-75 dBm) expect packet loss and latency.",
    },
    "WIFI_CRIT": {
        "family": "WIFI",
        "severity": "CRITICAL",
        "check": lambda s: s < 20,
        "title": "WiFi signal critically low",
        "tooltip": "Device barely maintaining connection. ODRs queued in flash. Voice task data stalls.",
    },
    "CONN_BURST": {
        "family": "SOCKET",
        "severity": "CRITICAL",
        "title": "Connection failure burst",
        "tooltip": "Rapid consecutive failures to local socket (port 15008) — internal comms service is down or restarting.",
    },
    "ROAM_STORM": {
        "family": "WIFI",
        "severity": "WARNING",
        "title": "Roaming storm detected",
        "tooltip": "Frequent AP changes in short window — coverage overlap zone or AP power imbalance.",
    },
    "TICK_RESET": {
        "family": "SYSTEM",
        "severity": "WARNING",
        "title": "Device reboot detected",
        "tooltip": "Tick counter reset indicates the device restarted. Check for battery pull, crash, or forced reset.",
    },
    "MSGS_LOST": {
        "family": "SYSTEM",
        "severity": "WARNING",
        "title": "Log messages lost",
        "tooltip": "Internal log buffer overflowed. Some events not captured during high-activity period.",
    },
}


def detect_roam_storms(roam_events: list[dict], window_minutes: int = 5, threshold: int = 5) -> list[dict]:
    """Detect roaming storms using a sliding window."""
    if len(roam_events) < threshold:
        return []

    anomalies = []
    window = timedelta(minutes=window_minutes)
    i = 0
    last_storm_end = None

    while i < len(roam_events):
        window_start = roam_events[i]["server_time"]
        window_end = window_start + window
        count = 0
        j = i

        while j < len(roam_events) and roam_events[j]["server_time"] <= window_end:
            count += 1
            j += 1

        if count > threshold:
            if last_storm_end is None or window_start > last_storm_end:
                rule = ANOMALY_RULES["ROAM_STORM"]
                anomalies.append({
                    "family": rule["family"],
                    "severity": rule["severity"],
                    "rule_id": "ROAM_STORM",
                    "title": rule["title"],
                    "description": f"{count} roams in {window_minutes}-minute window",
                    "tooltip": rule["tooltip"],
                    "first_line": roam_events[i]["line_number"],
                    "last_line": roam_events[j - 1]["line_number"],
                    "trigger_lines": str(roam_events[i]["line_number"]),
                    "server_time": window_start,
                    "device_time": roam_events[i].get("device_time"),
                    "tick": roam_events[i].get("tick"),
                    "offending_value": str(count),
                    "threshold_value": str(threshold),
                })
                last_storm_end = window_end
        i += 1

    return anomalies


def detect_connection_bursts(conn_events: list[dict], window_seconds: int = 60, threshold: int = 10) -> list[dict]:
    """Detect connection failure bursts."""
    if len(conn_events) < threshold:
        return []

    anomalies = []
    window = timedelta(seconds=window_seconds)
    i = 0
    last_burst_end = None

    while i < len(conn_events):
        window_start = conn_events[i]["server_time"]
        window_end = window_start + window
        count = 0
        j = i

        while j < len(conn_events) and conn_events[j]["server_time"] <= window_end:
            count += 1
            j += 1

        if count > threshold:
            if last_burst_end is None or window_start > last_burst_end:
                rule = ANOMALY_RULES["CONN_BURST"]
                anomalies.append({
                    "family": rule["family"],
                    "severity": rule["severity"],
                    "rule_id": "CONN_BURST",
                    "title": rule["title"],
                    "description": f"{count} connection failures in {window_seconds}s",
                    "tooltip": rule["tooltip"],
                    "first_line": conn_events[i]["line_number"],
                    "last_line": conn_events[j - 1]["line_number"],
                    "trigger_lines": str(conn_events[i]["line_number"]),
                    "server_time": window_start,
                    "device_time": conn_events[i].get("device_time"),
                    "tick": conn_events[i].get("tick"),
                    "offending_value": str(count),
                    "threshold_value": str(threshold),
                })
                last_burst_end = window_end
        i += 1

    return anomalies
