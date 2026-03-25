"""Bulk insert operations for parsed log data."""

import uuid
from datetime import datetime
import asyncpg


BATCH_SIZE = 1000


async def upsert_device(conn: asyncpg.Connection, device: dict) -> str:
    """Upsert device and return device ID."""
    device_id = str(uuid.uuid4())
    row = await conn.fetchrow(
        """
        INSERT INTO devices (id, serial_number, terminal_name, firmware_version, mac_address,
                             platform_version, first_seen, last_seen, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
        ON CONFLICT (serial_number) DO UPDATE SET
            firmware_version = COALESCE(EXCLUDED.firmware_version, devices.firmware_version),
            mac_address = COALESCE(EXCLUDED.mac_address, devices.mac_address),
            platform_version = COALESCE(EXCLUDED.platform_version, devices.platform_version),
            last_seen = GREATEST(EXCLUDED.last_seen, devices.last_seen),
            updated_at = now()
        RETURNING id
        """,
        device_id,
        device["serial_number"],
        device.get("terminal_name"),
        device.get("firmware_version"),
        device.get("mac_address"),
        device.get("platform_version"),
        device.get("log_start_time") or datetime.utcnow(),
        device.get("log_stop_time") or datetime.utcnow(),
    )
    return str(row["id"])


async def check_duplicate_import(conn: asyncpg.Connection, device_id: str,
                                  log_start: datetime, log_stop: datetime) -> str | None:
    """Check if this exact log timeframe was already imported. Returns existing ID or None."""
    row = await conn.fetchrow(
        """SELECT id FROM log_imports
           WHERE device_id = $1 AND log_start_time = $2 AND log_stop_time = $3
           AND status != 'deleted'""",
        device_id, log_start, log_stop,
    )
    return str(row["id"]) if row else None


async def insert_log_import(conn: asyncpg.Connection, device_id: str, filename: str,
                             device: dict, line_count: int, file_size: int) -> str:
    """Insert a log_import record and return its ID."""
    import_id = str(uuid.uuid4())
    await conn.execute(
        """INSERT INTO log_imports (id, device_id, filename, log_start_time, log_stop_time,
                                    log_type, ip_address, line_count, file_size_bytes, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)""",
        import_id, device_id, filename,
        device.get("log_start_time") or datetime.utcnow(),
        device.get("log_stop_time") or datetime.utcnow(),
        device.get("log_type", "standard"),
        device.get("ip_address"),
        line_count, file_size, "completed",
    )
    return import_id


async def bulk_insert_battery(conn: asyncpg.Connection, device_id: str,
                               import_id: str, records: list[dict]):
    """Batch insert battery readings."""
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        await conn.executemany(
            """INSERT INTO battery_readings (id, device_id, log_import_id, server_time,
                                             device_time, tick, line_number, runtime_minutes,
                                             percent_remaining, volts, energy_consumption, temperature_c)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)""",
            [
                (str(uuid.uuid4()), device_id, import_id, r["server_time"],
                 r["device_time"], r["tick"], r["line_number"], r.get("runtime_minutes"),
                 r.get("percent_remaining"), r.get("volts"), r.get("energy_consumption"),
                 r.get("temperature_c"))
                for r in batch
            ],
        )


async def bulk_insert_wifi(conn: asyncpg.Connection, device_id: str,
                            import_id: str, records: list[dict]):
    """Batch insert wifi readings."""
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        await conn.executemany(
            """INSERT INTO wifi_readings (id, device_id, log_import_id, server_time,
                                          device_time, tick, line_number, signal_strength_pct,
                                          signal_samples, access_point_mac, operator_name,
                                          cpu_usage, ram_load_pct, flash_avail_kb)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)""",
            [
                (str(uuid.uuid4()), device_id, import_id, r["server_time"],
                 r["device_time"], r["tick"], r["line_number"],
                 r.get("signal_strength_pct"), r.get("signal_samples", []),
                 r.get("access_point_mac"), r.get("operator_name"),
                 r.get("cpu_usage"), r.get("ram_load_pct"), r.get("flash_avail_kb"))
                for r in batch
            ],
        )


async def bulk_insert_roams(conn: asyncpg.Connection, device_id: str,
                             import_id: str, records: list[dict]):
    """Batch insert roam events."""
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        await conn.executemany(
            """INSERT INTO roam_events (id, device_id, log_import_id, server_time,
                                        device_time, tick, line_number, from_ap, to_ap)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
            [
                (str(uuid.uuid4()), device_id, import_id, r["server_time"],
                 r["device_time"], r["tick"], r["line_number"],
                 r["from_ap"], r["to_ap"])
                for r in batch
            ],
        )


async def bulk_insert_connections(conn: asyncpg.Connection, device_id: str,
                                   import_id: str, records: list[dict]):
    """Batch insert connection events."""
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        await conn.executemany(
            """INSERT INTO connection_events (id, device_id, log_import_id, server_time,
                                              device_time, tick, line_number, event_type,
                                              host, port, connection_count, error_count, error_detail)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)""",
            [
                (str(uuid.uuid4()), device_id, import_id, r["server_time"],
                 r["device_time"], r["tick"], r["line_number"],
                 r["event_type"], r.get("host"), r.get("port"),
                 r.get("connection_count"), r.get("error_count"), r.get("error_detail"))
                for r in batch
            ],
        )


async def bulk_insert_anomalies(conn: asyncpg.Connection, device_id: str,
                                 import_id: str, records: list[dict]):
    """Batch insert anomalies."""
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        await conn.executemany(
            """INSERT INTO anomalies (id, device_id, log_import_id, family, severity,
                                      rule_id, title, description, tooltip, first_line,
                                      last_line, trigger_lines, server_time, device_time,
                                      tick, offending_value, threshold_value)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)""",
            [
                (str(uuid.uuid4()), device_id, import_id, r["family"], r["severity"],
                 r["rule_id"], r["title"], r.get("description"), r.get("tooltip"),
                 r["first_line"], r["last_line"], r["trigger_lines"],
                 r["server_time"], r.get("device_time"), r.get("tick"),
                 r.get("offending_value"), r.get("threshold_value"))
                for r in batch
            ],
        )


async def bulk_insert_operators(conn: asyncpg.Connection, device_id: str,
                                 import_id: str, records: list[dict]):
    """Batch insert operator sessions."""
    for r in records:
        await conn.execute(
            """INSERT INTO operator_sessions (id, device_id, log_import_id, operator_ext_id,
                                              operator_name, session_start, session_end, reading_count)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
            str(uuid.uuid4()), device_id, import_id,
            r.get("operator_ext_id"), r["operator_name"],
            r["session_start"], r["session_end"], r.get("reading_count", 0),
        )


async def bulk_insert_system_events(conn: asyncpg.Connection, device_id: str,
                                     import_id: str, records: list[dict]):
    """Batch insert system events."""
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        await conn.executemany(
            """INSERT INTO system_events (id, device_id, log_import_id, server_time,
                                          device_time, tick, line_number, event_type, description)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
            [
                (str(uuid.uuid4()), device_id, import_id, r["server_time"],
                 r["device_time"], r["tick"], r["line_number"],
                 r["event_type"], r["description"])
                for r in batch
            ],
        )


async def store_parse_results(pool: asyncpg.Pool, filename: str, file_size: int,
                               parsed: dict) -> dict:
    """Store all parsed data in PostgreSQL. Returns summary."""
    device_info = parsed["device"]

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Upsert device
            device_id = await upsert_device(conn, device_info)

            # Check for duplicate import
            if device_info.get("log_start_time") and device_info.get("log_stop_time"):
                dup = await check_duplicate_import(
                    conn, device_id,
                    device_info["log_start_time"],
                    device_info["log_stop_time"],
                )
                if dup:
                    return {
                        "status": "duplicate",
                        "message": f"This exact log timeframe already imported for device {device_info['serial_number']}",
                        "device_id": device_id,
                        "serial_number": device_info["serial_number"],
                    }

            # Insert log import
            import_id = await insert_log_import(
                conn, device_id, filename, device_info,
                parsed["line_count"], file_size,
            )

            # Bulk insert all data
            await bulk_insert_battery(conn, device_id, import_id, parsed["battery"])
            await bulk_insert_wifi(conn, device_id, import_id, parsed["wifi"])
            await bulk_insert_roams(conn, device_id, import_id, parsed["roams"])
            await bulk_insert_connections(conn, device_id, import_id, parsed["connections"])
            await bulk_insert_anomalies(conn, device_id, import_id, parsed["anomalies"])
            await bulk_insert_operators(conn, device_id, import_id, parsed["operators"])
            await bulk_insert_system_events(conn, device_id, import_id, parsed["system_events"])

    return {
        "status": "completed",
        "device_id": device_id,
        "serial_number": device_info["serial_number"],
        "import_id": import_id,
        "battery_count": len(parsed["battery"]),
        "wifi_count": len(parsed["wifi"]),
        "roam_count": len(parsed["roams"]),
        "connection_count": len(parsed["connections"]),
        "anomaly_count": len(parsed["anomalies"]),
        "operator_count": len(parsed["operators"]),
        "system_event_count": len(parsed["system_events"]),
        "line_count": parsed["line_count"],
    }
