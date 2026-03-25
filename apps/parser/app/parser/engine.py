"""Stream parsing pipeline for Vocollect Talkman log files."""

import uuid
from datetime import datetime

from .matchers import (
    LINE_PATTERN, BATTERY_FULL, WIFI_SIGNAL, WIFI_AP, OPERATOR,
    ROAM_EVENT, SURVEY_ROAM, CONN_FAILED, CPU_USAGE, RAM_USAGE,
    FLASH_USAGE, MAC_ADDRESS, PLATFORM_VER, HEADSET, WARNING_MSG,
    HEX_ERROR, should_skip,
)
from .anomalies import ANOMALY_RULES, detect_roam_storms, detect_connection_bursts
from .error_codes import ERROR_CODES


def parse_server_time(s: str) -> datetime:
    """Parse '2/28/24 2:31:24 PM CET' -> datetime."""
    parts = s.rsplit(' ', 1)
    time_str = parts[0]
    return datetime.strptime(time_str, '%m/%d/%y %I:%M:%S %p')


def parse_log_file(file_path: str) -> dict:
    """
    Stream-parse a log file line by line. Never loads full file to RAM.
    Returns all parsed data in a structured dict.
    """
    metadata: dict[str, str] = {}
    battery_batch: list[dict] = []
    wifi_batch: list[dict] = []
    roam_batch: list[dict] = []
    conn_batch: list[dict] = []
    anomaly_batch: list[dict] = []
    system_batch: list[dict] = []

    # State machine
    last_seen_ap: str | None = None
    current_operator: str | None = None
    current_operator_id: str | None = None
    operator_sessions: list[dict] = []
    operator_session_start: datetime | None = None
    operator_reading_count: int = 0
    last_tick: int = 0
    last_fired: dict[str, bool] = {}
    header_parsed: bool = False
    line_number: int = 0

    # Pending wifi data from survey block
    pending_cpu: float | None = None
    pending_ram_load: int | None = None
    pending_flash_avail: int | None = None

    # Track roam ticks for dedup
    seen_roam_ticks: set[int] = set()

    # Last server_time for session close
    last_server_time: datetime | None = None

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

            try:
                server_time = parse_server_time(server_time_str)
            except ValueError:
                continue

            last_server_time = server_time

            # Connection failure check BEFORE skip
            if 'Connection Failed' in event_text:
                cm = CONN_FAILED.search(event_text)
                if cm:
                    host, port, conn_count, err_count, error_detail = cm.groups()
                    conn_batch.append({
                        "server_time": server_time,
                        "device_time": device_time,
                        "tick": tick,
                        "line_number": line_number,
                        "event_type": "connection_failed",
                        "host": host,
                        "port": int(port),
                        "connection_count": int(conn_count),
                        "error_count": int(err_count),
                        "error_detail": error_detail,
                    })
                continue

            # Skip noise lines
            if should_skip(event_text):
                continue

            # Tick reset detection
            if last_tick > 0 and tick < last_tick - 1000000:
                rule = ANOMALY_RULES["TICK_RESET"]
                anomaly_batch.append({
                    "family": rule["family"],
                    "severity": rule["severity"],
                    "rule_id": "TICK_RESET",
                    "title": rule["title"],
                    "description": f"Tick dropped from {last_tick} to {tick}",
                    "tooltip": rule["tooltip"],
                    "first_line": line_number,
                    "last_line": line_number,
                    "trigger_lines": str(line_number),
                    "server_time": server_time,
                    "device_time": device_time,
                    "tick": tick,
                    "offending_value": str(tick),
                    "threshold_value": str(last_tick),
                })
            last_tick = tick

            # --- MATCHER 1: Battery ---
            bm = BATTERY_FULL.search(event_text)
            if bm:
                runtime_min = int(bm.group(1))
                percent = int(bm.group(2))
                volts = float(bm.group(3))
                energy = int(bm.group(4))
                temp_c = float(bm.group(5))

                battery_batch.append({
                    "server_time": server_time,
                    "device_time": device_time,
                    "tick": tick,
                    "line_number": line_number,
                    "runtime_minutes": runtime_min,
                    "percent_remaining": percent,
                    "volts": volts,
                    "energy_consumption": energy,
                    "temperature_c": temp_c,
                })

                # Anomaly checks with dedup
                _check_threshold(anomaly_batch, last_fired, "BATT_PCT_CRIT", percent, 5,
                                 line_number, server_time, device_time, tick, recover_above=5)
                _check_threshold(anomaly_batch, last_fired, "BATT_PCT_WARN", percent, 15,
                                 line_number, server_time, device_time, tick, recover_above=15)
                _check_threshold(anomaly_batch, last_fired, "BATT_RUNTIME", runtime_min, 30,
                                 line_number, server_time, device_time, tick, recover_above=30)
                _check_threshold_above(anomaly_batch, last_fired, "BATT_TEMP_HIGH", temp_c, 45,
                                       line_number, server_time, device_time, tick, recover_below=45)
                _check_threshold(anomaly_batch, last_fired, "BATT_TEMP_LOW", temp_c, -10,
                                 line_number, server_time, device_time, tick, recover_above=-10)
                continue

            # --- MATCHER 3: WiFi AP ---
            am = WIFI_AP.search(event_text)
            if am:
                last_seen_ap = am.group(1)
                continue

            # --- MATCHER 2: WiFi Signal ---
            wm = WIFI_SIGNAL.search(event_text)
            if wm:
                signal_pct = int(wm.group(1))
                samples_str = wm.group(2).strip()
                samples = [int(x) for x in samples_str.split() if x]

                wifi_rec = {
                    "server_time": server_time,
                    "device_time": device_time,
                    "tick": tick,
                    "line_number": line_number,
                    "signal_strength_pct": signal_pct,
                    "signal_samples": samples,
                    "access_point_mac": last_seen_ap,
                    "operator_name": current_operator,
                    "cpu_usage": pending_cpu,
                    "ram_load_pct": pending_ram_load,
                    "flash_avail_kb": pending_flash_avail,
                }
                wifi_batch.append(wifi_rec)

                # Reset pending survey data
                pending_cpu = None
                pending_ram_load = None
                pending_flash_avail = None

                # WiFi anomaly checks
                _check_threshold(anomaly_batch, last_fired, "WIFI_CRIT", signal_pct, 20,
                                 line_number, server_time, device_time, tick, recover_above=20)
                _check_threshold(anomaly_batch, last_fired, "WIFI_WARN", signal_pct, 30,
                                 line_number, server_time, device_time, tick, recover_above=30)
                continue

            # --- MATCHER 4: Operator ---
            om = OPERATOR.search(event_text)
            if om:
                _serial, op_id, op_name = om.groups()
                op_name = op_name.strip()
                if op_name != current_operator:
                    # Close previous session
                    if current_operator and operator_session_start:
                        operator_sessions.append({
                            "operator_ext_id": current_operator_id,
                            "operator_name": current_operator,
                            "session_start": operator_session_start,
                            "session_end": server_time,
                            "reading_count": operator_reading_count,
                        })
                    current_operator = op_name
                    current_operator_id = op_id
                    operator_session_start = server_time
                    operator_reading_count = 0
                else:
                    operator_reading_count += 1
                continue

            # --- MATCHER 5: Roam (AP MON) ---
            rm = ROAM_EVENT.search(event_text)
            if rm:
                if tick not in seen_roam_ticks:
                    seen_roam_ticks.add(tick)
                    roam_batch.append({
                        "server_time": server_time,
                        "device_time": device_time,
                        "tick": tick,
                        "line_number": line_number,
                        "from_ap": rm.group(1),
                        "to_ap": rm.group(2),
                    })
                continue

            # --- MATCHER 5b: Roam (SURVEY) ---
            srm = SURVEY_ROAM.search(event_text)
            if srm:
                if tick not in seen_roam_ticks:
                    seen_roam_ticks.add(tick)
                    roam_batch.append({
                        "server_time": server_time,
                        "device_time": device_time,
                        "tick": tick,
                        "line_number": line_number,
                        "from_ap": srm.group(1),
                        "to_ap": srm.group(2),
                    })
                continue

            # --- MATCHER 7: CPU ---
            cpu_m = CPU_USAGE.search(event_text)
            if cpu_m:
                pending_cpu = float(cpu_m.group(1))
                continue

            # --- MATCHER 7: RAM ---
            ram_m = RAM_USAGE.search(event_text)
            if ram_m:
                pending_ram_load = int(ram_m.group(1))
                continue

            # --- MATCHER 7: Flash ---
            flash_m = FLASH_USAGE.search(event_text)
            if flash_m:
                pending_flash_avail = int(flash_m.group(1))
                continue

            # --- MATCHER 7: MAC ---
            mac_m = MAC_ADDRESS.search(event_text)
            if mac_m:
                metadata["mac_address"] = mac_m.group(1)
                continue

            # --- MATCHER 7: Platform ---
            plat_m = PLATFORM_VER.search(event_text)
            if plat_m:
                metadata["platform_version"] = plat_m.group(1).strip()
                continue

            # --- MATCHER 7: Headset ---
            hs_m = HEADSET.search(event_text)
            if hs_m:
                system_batch.append({
                    "server_time": server_time,
                    "device_time": device_time,
                    "tick": tick,
                    "line_number": line_number,
                    "event_type": "headset_connected",
                    "description": f"{hs_m.group(1)}, ID={hs_m.group(2)}",
                })
                continue

            # --- MATCHER 8: Warning ---
            warn_m = WARNING_MSG.search(event_text)
            if warn_m:
                msg = warn_m.group(1).strip()
                system_batch.append({
                    "server_time": server_time,
                    "device_time": device_time,
                    "tick": tick,
                    "line_number": line_number,
                    "event_type": "warning",
                    "description": msg,
                })
                if 'messages lost' in msg.lower():
                    rule = ANOMALY_RULES["MSGS_LOST"]
                    anomaly_batch.append({
                        "family": rule["family"],
                        "severity": rule["severity"],
                        "rule_id": "MSGS_LOST",
                        "title": rule["title"],
                        "description": msg,
                        "tooltip": rule["tooltip"],
                        "first_line": line_number,
                        "last_line": line_number,
                        "trigger_lines": str(line_number),
                        "server_time": server_time,
                        "device_time": device_time,
                        "tick": tick,
                        "offending_value": None,
                        "threshold_value": None,
                    })
                continue

            # --- MATCHER 9: Hex error ---
            hex_m = HEX_ERROR.search(event_text)
            if hex_m:
                code = hex_m.group(1).lower()
                if code in ERROR_CODES:
                    desc, family, severity = ERROR_CODES[code]
                    system_batch.append({
                        "server_time": server_time,
                        "device_time": device_time,
                        "tick": tick,
                        "line_number": line_number,
                        "event_type": f"error_{code}",
                        "description": f"{code}: {desc}",
                    })
                    anomaly_batch.append({
                        "family": family,
                        "severity": severity,
                        "rule_id": f"HEX_{code.upper()}",
                        "title": desc,
                        "description": event_text[:200],
                        "tooltip": f"Hardware/firmware error code {code}",
                        "first_line": line_number,
                        "last_line": line_number,
                        "trigger_lines": str(line_number),
                        "server_time": server_time,
                        "device_time": device_time,
                        "tick": tick,
                        "offending_value": code,
                        "threshold_value": None,
                    })
                continue

    # Finalize last operator session
    if current_operator and operator_session_start and last_server_time:
        operator_sessions.append({
            "operator_ext_id": current_operator_id,
            "operator_name": current_operator,
            "session_start": operator_session_start,
            "session_end": last_server_time,
            "reading_count": operator_reading_count,
        })

    # Post-processing: roam storms
    roam_storms = detect_roam_storms(roam_batch)
    anomaly_batch.extend(roam_storms)

    # Post-processing: connection bursts
    conn_bursts = detect_connection_bursts(conn_batch)
    anomaly_batch.extend(conn_bursts)

    # Build device info from header
    log_start = None
    log_stop = None
    if "Log Start Time" in metadata:
        try:
            log_start = parse_server_time(metadata["Log Start Time"])
        except ValueError:
            pass
    if "Log Stop Time" in metadata:
        try:
            log_stop = parse_server_time(metadata["Log Stop Time"])
        except ValueError:
            pass

    serial = metadata.get("Terminal Serial Number", metadata.get("Terminal Name", "unknown"))

    return {
        "device": {
            "serial_number": serial,
            "terminal_name": metadata.get("Terminal Name"),
            "firmware_version": metadata.get("Firmware Version"),
            "mac_address": metadata.get("mac_address"),
            "platform_version": metadata.get("platform_version"),
            "ip_address": metadata.get("IP Address"),
            "log_start_time": log_start,
            "log_stop_time": log_stop,
            "log_type": metadata.get("Log Type", "standard"),
        },
        "line_count": line_number,
        "battery": battery_batch,
        "wifi": wifi_batch,
        "roams": roam_batch,
        "connections": conn_batch,
        "anomalies": anomaly_batch,
        "operators": operator_sessions,
        "system_events": system_batch,
    }


def _check_threshold(anomaly_batch, last_fired, rule_id, value, threshold,
                     line_number, server_time, device_time, tick, recover_above):
    """Fire anomaly when value drops below threshold, dedup until recovery."""
    rule = ANOMALY_RULES[rule_id]
    if value <= threshold:
        if not last_fired.get(rule_id):
            last_fired[rule_id] = True
            anomaly_batch.append({
                "family": rule["family"],
                "severity": rule["severity"],
                "rule_id": rule_id,
                "title": rule["title"],
                "description": f"Value: {value}, Threshold: {threshold}",
                "tooltip": rule["tooltip"],
                "first_line": line_number,
                "last_line": line_number,
                "trigger_lines": str(line_number),
                "server_time": server_time,
                "device_time": device_time,
                "tick": tick,
                "offending_value": str(value),
                "threshold_value": str(threshold),
            })
    elif value > recover_above:
        last_fired[rule_id] = False


def _check_threshold_above(anomaly_batch, last_fired, rule_id, value, threshold,
                           line_number, server_time, device_time, tick, recover_below):
    """Fire anomaly when value exceeds threshold."""
    rule = ANOMALY_RULES[rule_id]
    if value > threshold:
        if not last_fired.get(rule_id):
            last_fired[rule_id] = True
            anomaly_batch.append({
                "family": rule["family"],
                "severity": rule["severity"],
                "rule_id": rule_id,
                "title": rule["title"],
                "description": f"Value: {value}, Threshold: {threshold}",
                "tooltip": rule["tooltip"],
                "first_line": line_number,
                "last_line": line_number,
                "trigger_lines": str(line_number),
                "server_time": server_time,
                "device_time": device_time,
                "tick": tick,
                "offending_value": str(value),
                "threshold_value": str(threshold),
            })
    elif value < recover_below:
        last_fired[rule_id] = False
