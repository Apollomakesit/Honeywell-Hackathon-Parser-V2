import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { serial: string } }
) {
  const device = await prisma.device.findFirst({
    where: { serialNumber: params.serial },
  });

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const [battery, wifi, roams, connections, anomalies] = await Promise.all([
    prisma.batteryReading.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'asc' },
      select: { serverTime: true, percentRemaining: true, runtimeMinutes: true, volts: true, energyConsumption: true, temperatureC: true },
    }),
    prisma.wifiReading.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'asc' },
      select: { serverTime: true, signalStrengthPct: true, accessPointMac: true },
    }),
    prisma.roamEvent.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'asc' },
      select: { serverTime: true, fromAp: true, toAp: true },
    }),
    prisma.connectionEvent.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'asc' },
      select: { serverTime: true, eventType: true, host: true, port: true, errorDetail: true },
    }),
    prisma.anomaly.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'asc' },
      select: { serverTime: true, severity: true, family: true, title: true, offendingValue: true },
    }),
  ]);

  const rows: string[] = ['timestamp,category,severity,value,detail'];

  battery.forEach((b) => {
    rows.push(`${b.serverTime.toISOString()},battery,,${b.percentRemaining}%,"Runtime: ${b.runtimeMinutes}min, Volts: ${Number(b.volts)}V, Temp: ${Number(b.temperatureC)}°C, Energy: ${b.energyConsumption}mAh"`);
  });

  wifi.forEach((w) => {
    rows.push(`${w.serverTime.toISOString()},wifi,,${w.signalStrengthPct}%,"AP: ${w.accessPointMac || 'unknown'}"`);
  });

  roams.forEach((r) => {
    rows.push(`${r.serverTime.toISOString()},roam,,,${r.fromAp} → ${r.toAp}`);
  });

  connections.forEach((c) => {
    rows.push(`${c.serverTime.toISOString()},connection,,,"${c.eventType}: ${c.host}:${c.port} ${c.errorDetail || ''}"`);
  });

  anomalies.forEach((a) => {
    rows.push(`${a.serverTime.toISOString()},anomaly,${a.severity},${a.offendingValue || ''},"[${a.family}] ${a.title}"`);
  });

  const csv = rows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="device_${params.serial}_export.csv"`,
    },
  });
}
