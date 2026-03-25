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

  const readings = await prisma.batteryReading.findMany({
    where: { deviceId: device.id },
    orderBy: { serverTime: 'asc' },
    select: {
      serverTime: true,
      deviceTime: true,
      tick: true,
      lineNumber: true,
      runtimeMinutes: true,
      percentRemaining: true,
      volts: true,
      energyConsumption: true,
      temperatureC: true,
    },
  });

  return NextResponse.json(
    readings.map((r) => ({
      ...r,
      tick: Number(r.tick),
      volts: r.volts ? Number(r.volts) : null,
      temperatureC: r.temperatureC ? Number(r.temperatureC) : null,
    }))
  );
}
