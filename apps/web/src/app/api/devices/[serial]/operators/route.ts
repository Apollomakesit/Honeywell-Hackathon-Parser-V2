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

  const sessions = await prisma.operatorSession.findMany({
    where: { deviceId: device.id },
    orderBy: { sessionStart: 'asc' },
    select: {
      id: true,
      operatorExtId: true,
      operatorName: true,
      sessionStart: true,
      sessionEnd: true,
      readingCount: true,
    },
  });

  return NextResponse.json(sessions);
}
