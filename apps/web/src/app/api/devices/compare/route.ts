import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const serialA = searchParams.get('a');
  const serialB = searchParams.get('b');

  if (!serialA || !serialB) {
    return NextResponse.json({ error: 'Provide ?a=serial1&b=serial2' }, { status: 400 });
  }

  const [deviceA, deviceB] = await Promise.all([
    prisma.device.findFirst({
      where: { serialNumber: serialA },
      include: {
        logImports: { where: { status: { not: 'deleted' } }, orderBy: { logStartTime: 'desc' }, take: 1 },
        operatorSessions: { orderBy: { sessionStart: 'asc' } },
        _count: { select: { batteryReadings: true, wifiReadings: true, roamEvents: true, connectionEvents: true, anomalies: true } },
      },
    }),
    prisma.device.findFirst({
      where: { serialNumber: serialB },
      include: {
        logImports: { where: { status: { not: 'deleted' } }, orderBy: { logStartTime: 'desc' }, take: 1 },
        operatorSessions: { orderBy: { sessionStart: 'asc' } },
        _count: { select: { batteryReadings: true, wifiReadings: true, roamEvents: true, connectionEvents: true, anomalies: true } },
      },
    }),
  ]);

  if (!deviceA || !deviceB) {
    return NextResponse.json({ error: 'One or both devices not found' }, { status: 404 });
  }

  // Fetch summary data for both devices in parallel
  const [battA, battB, wifiA, wifiB, anomA, anomB] = await Promise.all([
    prisma.batteryReading.findMany({
      where: { deviceId: deviceA.id },
      orderBy: { serverTime: 'asc' },
      select: { serverTime: true, percentRemaining: true, runtimeMinutes: true, temperatureC: true },
    }),
    prisma.batteryReading.findMany({
      where: { deviceId: deviceB.id },
      orderBy: { serverTime: 'asc' },
      select: { serverTime: true, percentRemaining: true, runtimeMinutes: true, temperatureC: true },
    }),
    prisma.wifiReading.findMany({
      where: { deviceId: deviceA.id },
      orderBy: { serverTime: 'asc' },
      select: { serverTime: true, signalStrengthPct: true },
    }),
    prisma.wifiReading.findMany({
      where: { deviceId: deviceB.id },
      orderBy: { serverTime: 'asc' },
      select: { serverTime: true, signalStrengthPct: true },
    }),
    prisma.anomaly.findMany({
      where: { deviceId: deviceA.id },
      orderBy: { serverTime: 'desc' },
      select: { serverTime: true, severity: true, family: true, title: true },
    }),
    prisma.anomaly.findMany({
      where: { deviceId: deviceB.id },
      orderBy: { serverTime: 'desc' },
      select: { serverTime: true, severity: true, family: true, title: true },
    }),
  ]);

  const buildSummary = (device: typeof deviceA, batt: typeof battA, wifi: typeof wifiA, anom: typeof anomA) => {
    const avgBatt = batt.length ? Math.round(batt.reduce((s, b) => s + (b.percentRemaining || 0), 0) / batt.length) : null;
    const minBatt = batt.length ? Math.min(...batt.map((b) => b.percentRemaining || 100)) : null;
    const avgSignal = wifi.length ? Math.round(wifi.reduce((s, w) => s + (w.signalStrengthPct || 0), 0) / wifi.length) : null;
    const minSignal = wifi.length ? Math.min(...wifi.map((w) => w.signalStrengthPct || 100)) : null;
    const criticals = anom.filter((a) => a.severity === 'CRITICAL').length;
    const warnings = anom.filter((a) => a.severity === 'WARNING').length;
    const li = device!.logImports[0];

    return {
      serial: device!.serialNumber,
      firmware: device!.firmwareVersion,
      mac: device!.macAddress,
      platform: device!.platformVersion,
      logStart: li?.logStartTime,
      logStop: li?.logStopTime,
      operators: device!.operatorSessions.map((o) => o.operatorName),
      counts: device!._count,
      avgBattery: avgBatt,
      minBattery: minBatt,
      avgSignal,
      minSignal,
      criticals,
      warnings,
      totalAnomalies: anom.length,
      batteryData: batt.map((b) => ({ time: b.serverTime, value: b.percentRemaining })),
      wifiData: wifi.map((w) => ({ time: w.serverTime, value: w.signalStrengthPct })),
      anomalies: anom,
    };
  };

  return NextResponse.json({
    a: buildSummary(deviceA, battA, wifiA, anomA),
    b: buildSummary(deviceB, battB, wifiB, anomB),
  });
}
