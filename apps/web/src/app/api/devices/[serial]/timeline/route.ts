import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { serial: string } }
) {
  const device = await prisma.device.findFirst({
    where: { serialNumber: params.serial },
  });

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';

  type TimelineEvent = {
    time: Date;
    type: string;
    severity?: string;
    description: string;
  };

  const events: TimelineEvent[] = [];

  const [battery, wifi, roams, connections, anomalies] = await Promise.all([
    prisma.batteryReading.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'desc' },
      take: 500,
      select: { serverTime: true, percentRemaining: true, runtimeMinutes: true, volts: true, temperatureC: true },
    }),
    prisma.wifiReading.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'desc' },
      take: 500,
      select: { serverTime: true, signalStrengthPct: true, accessPointMac: true },
    }),
    prisma.roamEvent.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'desc' },
      take: 500,
      select: { serverTime: true, fromAp: true, toAp: true },
    }),
    prisma.connectionEvent.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'desc' },
      take: 500,
      select: { serverTime: true, eventType: true, host: true, port: true, errorDetail: true },
    }),
    prisma.anomaly.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'desc' },
      take: 200,
      select: { serverTime: true, severity: true, title: true, family: true },
    }),
  ]);

  battery.forEach((b) => events.push({
    time: b.serverTime,
    type: 'battery',
    description: `Battery: ${b.percentRemaining}%, ${b.runtimeMinutes}min, ${Number(b.volts)}V, ${Number(b.temperatureC)}°C`,
  }));

  wifi.forEach((w) => events.push({
    time: w.serverTime,
    type: 'wifi',
    description: `WiFi: ${w.signalStrengthPct}% signal${w.accessPointMac ? ` (AP: ${w.accessPointMac})` : ''}`,
  }));

  roams.forEach((r) => events.push({
    time: r.serverTime,
    type: 'roam',
    description: `Roam: ${r.fromAp} → ${r.toAp}`,
  }));

  connections.forEach((c) => events.push({
    time: c.serverTime,
    type: 'connection',
    description: `Connection ${c.eventType}: ${c.host}:${c.port}${c.errorDetail ? ` (${c.errorDetail})` : ''}`,
  }));

  anomalies.forEach((a) => events.push({
    time: a.serverTime,
    type: 'anomaly',
    severity: a.severity,
    description: `[${a.family}] ${a.title}`,
  }));

  events.sort((a, b) => b.time.getTime() - a.time.getTime());

  let filtered = events;
  if (search) {
    const q = search.toLowerCase();
    filtered = events.filter((e) => e.description.toLowerCase().includes(q));
  }

  return NextResponse.json({
    total: filtered.length,
    events: filtered.slice(offset, offset + limit),
  });
}
