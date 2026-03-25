import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const devices = await prisma.device.findMany({
    include: {
      logImports: {
        where: { status: { not: 'deleted' } },
        orderBy: { logStartTime: 'desc' },
      },
      anomalies: { select: { severity: true } },
      operatorSessions: { select: { operatorName: true } },
    },
    orderBy: { lastSeen: 'desc' },
  });

  const result = devices.map((d) => ({
    id: d.id,
    serialNumber: d.serialNumber,
    terminalName: d.terminalName,
    firmwareVersion: d.firmwareVersion,
    macAddress: d.macAddress,
    platformVersion: d.platformVersion,
    firstSeen: d.firstSeen,
    lastSeen: d.lastSeen,
    logImports: d.logImports.map((li) => ({
      id: li.id,
      filename: li.filename,
      logStartTime: li.logStartTime,
      logStopTime: li.logStopTime,
      lineCount: li.lineCount,
      fileSizeBytes: li.fileSizeBytes ? Number(li.fileSizeBytes) : null,
      status: li.status,
      ipAddress: li.ipAddress,
    })),
    criticalCount: d.anomalies.filter((a) => a.severity === 'CRITICAL').length,
    warningCount: d.anomalies.filter((a) => a.severity === 'WARNING').length,
    operators: Array.from(new Set(d.operatorSessions.map((o) => o.operatorName))),
  }));

  return NextResponse.json(result);
}
