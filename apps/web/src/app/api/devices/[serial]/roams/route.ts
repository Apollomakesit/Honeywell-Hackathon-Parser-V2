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

  const roams = await prisma.roamEvent.findMany({
    where: { deviceId: device.id },
    orderBy: { serverTime: 'asc' },
    select: {
      serverTime: true,
      deviceTime: true,
      tick: true,
      lineNumber: true,
      fromAp: true,
      toAp: true,
    },
  });

  return NextResponse.json(
    roams.map((r) => ({ ...r, tick: Number(r.tick) }))
  );
}
