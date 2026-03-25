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
        orderBy: { logStartTime: 'asc' },
        select: { id: true, filename: true, logStartTime: true, logStopTime: true, lineCount: true },
      },
    },
  });

  if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const trends = await Promise.all(
    device.logImports.map(async (imp) => {
      const [batteryAgg, wifiAgg, roamCount, connCount, anomalyAgg] = await Promise.all([
        prisma.batteryReading.aggregate({
          where: { logImportId: imp.id },
          _avg: { percentRemaining: true },
          _min: { percentRemaining: true },
          _count: { id: true },
        }),
        prisma.wifiReading.aggregate({
          where: { logImportId: imp.id },
          _avg: { signalStrengthPct: true },
          _min: { signalStrengthPct: true },
          _count: { id: true },
        }),
        prisma.roamEvent.count({ where: { logImportId: imp.id } }),
        prisma.connectionEvent.count({ where: { logImportId: imp.id } }),
        prisma.anomaly.groupBy({
          by: ['severity'],
          where: { logImportId: imp.id },
          _count: { id: true },
        }),
      ]);

      const severityCounts: Record<string, number> = {};
      anomalyAgg.forEach((a) => { severityCounts[a.severity] = a._count.id; });

      return {
        importId: imp.id,
        filename: imp.filename,
        logStart: imp.logStartTime,
        logStop: imp.logStopTime,
        lineCount: imp.lineCount,
        battery: {
          count: batteryAgg._count.id,
          avg: batteryAgg._avg.percentRemaining ? Math.round(batteryAgg._avg.percentRemaining) : null,
          min: batteryAgg._min.percentRemaining,
        },
        wifi: {
          count: wifiAgg._count.id,
          avg: wifiAgg._avg.signalStrengthPct ? Math.round(wifiAgg._avg.signalStrengthPct) : null,
          min: wifiAgg._min.signalStrengthPct,
        },
        roams: roamCount,
        connections: connCount,
        criticals: severityCounts['CRITICAL'] || 0,
        warnings: severityCounts['WARNING'] || 0,
        totalAnomalies: Object.values(severityCounts).reduce((s, c) => s + c, 0),
      };
    })
  );

  return NextResponse.json({ serial: device.serialNumber, imports: trends });
}
