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

  const events = await prisma.connectionEvent.findMany({
    where: { deviceId: device.id },
    orderBy: { serverTime: 'asc' },
    select: {
      serverTime: true,
      deviceTime: true,
      tick: true,
      lineNumber: true,
      eventType: true,
      host: true,
      port: true,
      connectionCount: true,
      errorCount: true,
      errorDetail: true,
    },
  });

  return NextResponse.json(
    events.map((r) => ({ ...r, tick: Number(r.tick) }))
  );
}
