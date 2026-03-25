import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { serial: string } }
) {
  const device = await prisma.device.findFirst({
    where: { serialNumber: params.serial },
    include: {
      logImports: { where: { status: { not: 'deleted' } }, orderBy: { logStartTime: 'desc' } },
      operatorSessions: { orderBy: { sessionStart: 'asc' } },
      _count: {
        select: {
          batteryReadings: true,
          wifiReadings: true,
          roamEvents: true,
          connectionEvents: true,
        },
      },
    },
  });

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const anomalies = await prisma.anomaly.findMany({
    where: { deviceId: device.id },
    orderBy: { serverTime: 'desc' },
  });

  const logImport = device.logImports[0];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Device Report — ${device.serialNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    h1 { color: #f1f5f9; margin-bottom: 0.5rem; }
    h2 { color: #94a3b8; font-size: 1.1rem; margin: 1.5rem 0 0.75rem; border-bottom: 1px solid #334155; padding-bottom: 0.25rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid #1e293b; }
    th { color: #94a3b8; font-size: 0.85rem; font-weight: 500; }
    td { color: #e2e8f0; font-size: 0.9rem; }
    tr:nth-child(even) td { background: #1e293b; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
    .critical { background: rgba(239,68,68,0.2); color: #f87171; }
    .warning { background: rgba(245,158,11,0.2); color: #fbbf24; }
    .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .stat { background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; padding: 1rem; flex: 1; min-width: 140px; }
    .stat-label { color: #94a3b8; font-size: 0.8rem; }
    .stat-value { color: #f1f5f9; font-size: 1.5rem; font-weight: 600; }
    .mono { font-family: 'Courier New', monospace; }
    .subtitle { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <h1>Device Report: ${device.serialNumber}</h1>
  <p class="subtitle">Generated ${new Date().toISOString()}</p>

  <h2>Device Information</h2>
  <table>
    <tr><th>Serial Number</th><td class="mono">${device.serialNumber}</td></tr>
    <tr><th>Terminal Name</th><td>${device.terminalName || '—'}</td></tr>
    <tr><th>Firmware</th><td class="mono">${device.firmwareVersion || '—'}</td></tr>
    <tr><th>MAC Address</th><td class="mono">${device.macAddress || '—'}</td></tr>
    <tr><th>Platform Version</th><td>${device.platformVersion || '—'}</td></tr>
    <tr><th>IP Address</th><td class="mono">${logImport?.ipAddress || '—'}</td></tr>
    <tr><th>Log Start</th><td>${logImport?.logStartTime?.toISOString() || '—'}</td></tr>
    <tr><th>Log Stop</th><td>${logImport?.logStopTime?.toISOString() || '—'}</td></tr>
  </table>

  <h2>Statistics</h2>
  <div class="stats">
    <div class="stat"><div class="stat-label">Battery Readings</div><div class="stat-value">${device._count.batteryReadings}</div></div>
    <div class="stat"><div class="stat-label">WiFi Surveys</div><div class="stat-value">${device._count.wifiReadings}</div></div>
    <div class="stat"><div class="stat-label">AP Roams</div><div class="stat-value">${device._count.roamEvents}</div></div>
    <div class="stat"><div class="stat-label">Connection Events</div><div class="stat-value">${device._count.connectionEvents}</div></div>
    <div class="stat"><div class="stat-label">Anomalies</div><div class="stat-value">${anomalies.length}</div></div>
  </div>

  <h2>Operators</h2>
  <table>
    <tr><th>Name</th><th>ID</th><th>Start</th><th>End</th><th>Readings</th></tr>
    ${device.operatorSessions.map((o) => `
    <tr>
      <td>${o.operatorName}</td>
      <td class="mono">${o.operatorExtId || '—'}</td>
      <td>${o.sessionStart.toISOString()}</td>
      <td>${o.sessionEnd.toISOString()}</td>
      <td>${o.readingCount}</td>
    </tr>`).join('')}
  </table>

  <h2>Anomalies (${anomalies.length})</h2>
  <table>
    <tr><th>Time</th><th>Severity</th><th>Family</th><th>Title</th><th>Value</th><th>Threshold</th></tr>
    ${anomalies.map((a) => `
    <tr>
      <td>${a.serverTime.toISOString()}</td>
      <td><span class="badge ${a.severity.toLowerCase()}">${a.severity}</span></td>
      <td>${a.family}</td>
      <td>${a.title}</td>
      <td class="mono">${a.offendingValue || '—'}</td>
      <td class="mono">${a.thresholdValue || '—'}</td>
    </tr>`).join('')}
  </table>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="device_${params.serial}_report.html"`,
    },
  });
}
