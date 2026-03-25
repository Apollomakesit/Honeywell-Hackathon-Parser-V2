"""Pydantic data models for parsed log events."""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DeviceInfo(BaseModel):
    serial_number: str
    terminal_name: Optional[str] = None
    firmware_version: Optional[str] = None
    mac_address: Optional[str] = None
    platform_version: Optional[str] = None
    ip_address: Optional[str] = None
    log_start_time: Optional[datetime] = None
    log_stop_time: Optional[datetime] = None
    log_type: str = "standard"


class BatteryRecord(BaseModel):
    server_time: datetime
    device_time: str
    tick: int
    line_number: int
    runtime_minutes: Optional[int] = None
    percent_remaining: Optional[int] = None
    volts: Optional[float] = None
    energy_consumption: Optional[int] = None
    temperature_c: Optional[float] = None


class WifiRecord(BaseModel):
    server_time: datetime
    device_time: str
    tick: int
    line_number: int
    signal_strength_pct: Optional[int] = None
    signal_samples: list[int] = []
    access_point_mac: Optional[str] = None
    operator_name: Optional[str] = None
    cpu_usage: Optional[float] = None
    ram_load_pct: Optional[int] = None
    flash_avail_kb: Optional[int] = None


class RoamRecord(BaseModel):
    server_time: datetime
    device_time: str
    tick: int
    line_number: int
    from_ap: str
    to_ap: str


class ConnectionRecord(BaseModel):
    server_time: datetime
    device_time: str
    tick: int
    line_number: int
    event_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    connection_count: Optional[int] = None
    error_count: Optional[int] = None
    error_detail: Optional[str] = None


class OperatorSessionRecord(BaseModel):
    operator_ext_id: Optional[str] = None
    operator_name: str
    session_start: datetime
    session_end: datetime
    reading_count: int = 0


class AnomalyRecord(BaseModel):
    family: str
    severity: str
    rule_id: str
    title: str
    description: Optional[str] = None
    tooltip: Optional[str] = None
    first_line: int
    last_line: int
    trigger_lines: str
    server_time: datetime
    device_time: Optional[str] = None
    tick: Optional[int] = None
    offending_value: Optional[str] = None
    threshold_value: Optional[str] = None


class SystemEventRecord(BaseModel):
    server_time: datetime
    device_time: str
    tick: int
    line_number: int
    event_type: str
    description: str


class ParseResult(BaseModel):
    device: DeviceInfo
    filename: str
    line_count: int
    file_size_bytes: int
    battery_count: int
    wifi_count: int
    roam_count: int
    connection_count: int
    anomaly_count: int
    operator_count: int
    system_event_count: int
    status: str = "completed"
    error_message: Optional[str] = None
