import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { serial: string } }
) {
  const device = await prisma.device.findFirst({
    where: { serialNumber: params.serial },
    include: {
      logImports: {
        where: { status: { not: 'deleted' } },
        orderBy: { logStartTime: 'desc' },
      },
      operatorSessions: { orderBy: { sessionStart: 'asc' } },
      _count: {
        select: {
          batteryReadings: true,
          wifiReadings: true,
          roamEvents: true,
          connectionEvents: true,
          anomalies: true,
          systemEvents: true,
        },
      },
    },
  });

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...device,
    logImports: device.logImports.map((li) => ({
      ...li,
      fileSizeBytes: li.fileSizeBytes ? Number(li.fileSizeBytes) : null,
    })),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { serial: string } }
) {
  const device = await prisma.device.findFirst({
    where: { serialNumber: params.serial },
  });

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  // Delete all related data via cascade
  await prisma.device.delete({ where: { id: device.id } });

  return NextResponse.json({ success: true });
}
