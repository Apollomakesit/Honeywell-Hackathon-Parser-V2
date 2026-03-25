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

  const anomalies = await prisma.anomaly.findMany({
    where: { deviceId: device.id },
    orderBy: { serverTime: 'desc' },
    select: {
      id: true,
      family: true,
      severity: true,
      ruleId: true,
      title: true,
      description: true,
      tooltip: true,
      firstLine: true,
      lastLine: true,
      triggerLines: true,
      serverTime: true,
      deviceTime: true,
      tick: true,
      offendingValue: true,
      thresholdValue: true,
      detectedAt: true,
    },
  });

  return NextResponse.json(
    anomalies.map((a) => ({ ...a, tick: a.tick ? Number(a.tick) : null }))
  );
}
