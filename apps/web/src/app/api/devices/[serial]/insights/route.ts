import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface Insight {
  severity: 'ok' | 'info' | 'warning' | 'critical';
  category: 'battery' | 'wifi' | 'roaming' | 'connection' | 'system';
  title: string;
  detail: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { serial: string } }
) {
  const device = await prisma.device.findFirst({
    where: { serialNumber: params.serial },
    include: {
      logImports: { where: { status: { not: 'deleted' } }, orderBy: { logStartTime: 'desc' }, take: 1 },
    },
  });

  if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [battAgg, wifiAgg, roamCount, connCount, anomalyCounts, battReadings, wifiReadings] = await Promise.all([
    prisma.batteryReading.aggregate({
      where: { deviceId: device.id },
      _avg: { percentRemaining: true, temperatureC: true },
      _min: { percentRemaining: true, temperatureC: true },
      _max: { temperatureC: true },
      _count: { id: true },
    }),
    prisma.wifiReading.aggregate({
      where: { deviceId: device.id },
      _avg: { signalStrengthPct: true },
      _min: { signalStrengthPct: true },
      _count: { id: true },
    }),
    prisma.roamEvent.count({ where: { deviceId: device.id } }),
    prisma.connectionEvent.count({ where: { deviceId: device.id } }),
    prisma.anomaly.groupBy({
      by: ['severity'],
      where: { deviceId: device.id },
      _count: { id: true },
    }),
    // Get first and last battery reading for drain rate
    prisma.batteryReading.findMany({
      where: { deviceId: device.id },
      orderBy: { serverTime: 'asc' },
      select: { serverTime: true, percentRemaining: true },
      take: 1,
    }),
    // Get low WiFi readings count
    prisma.wifiReading.count({
      where: { deviceId: device.id, signalStrengthPct: { lt: 30 } },
    }),
  ]);

  const lastBatt = await prisma.batteryReading.findFirst({
    where: { deviceId: device.id },
    orderBy: { serverTime: 'desc' },
    select: { serverTime: true, percentRemaining: true },
  });

  const insights: Insight[] = [];
  const criticals = anomalyCounts.find(a => a.severity === 'CRITICAL')?._count.id || 0;
  const warnings = anomalyCounts.find(a => a.severity === 'WARNING')?._count.id || 0;

  // Battery drain rate
  if (battReadings[0] && lastBatt && battReadings[0].percentRemaining != null && lastBatt.percentRemaining != null) {
    const hours = (lastBatt.serverTime.getTime() - battReadings[0].serverTime.getTime()) / 3600000;
    if (hours > 0) {
      const drainRate = Math.round(((battReadings[0].percentRemaining - lastBatt.percentRemaining) / hours) * 10) / 10;
      const hoursToEmpty = lastBatt.percentRemaining > 0 && drainRate > 0
        ? Math.round(lastBatt.percentRemaining / drainRate * 10) / 10
        : null;

      if (drainRate > 10) {
        insights.push({
          severity: 'critical', category: 'battery',
          title: 'Very high battery drain rate',
          detail: `Battery is draining at ${drainRate}%/hour. ${hoursToEmpty ? `Estimated ${hoursToEmpty}h to empty.` : ''} Check for software bugs or excessive radio activity.`,
        });
      } else if (drainRate > 5) {
        insights.push({
          severity: 'warning', category: 'battery',
          title: 'Elevated battery drain rate',
          detail: `Battery drain rate is ${drainRate}%/hour. ${hoursToEmpty ? `Estimated ${hoursToEmpty}h to empty.` : ''} This is above typical for voice picking.`,
        });
      } else if (drainRate > 0) {
        insights.push({
          severity: 'ok', category: 'battery',
          title: 'Normal battery drain',
          detail: `Battery drain rate is ${drainRate}%/hour (${battReadings[0].percentRemaining}% → ${lastBatt.percentRemaining}% over ${Math.round(hours * 10) / 10}h).${hoursToEmpty ? ` ~${hoursToEmpty}h remaining.` : ''}`,
        });
      }
    }
  }

  // Battery level
  const avgBatt = battAgg._avg.percentRemaining ? Math.round(battAgg._avg.percentRemaining) : null;
  const minBatt = battAgg._min.percentRemaining;
  if (minBatt != null && minBatt <= 5) {
    insights.push({ severity: 'critical', category: 'battery', title: 'Battery reached critical level', detail: `Minimum battery was ${minBatt}% — device was at risk of shutdown. Avg: ${avgBatt}%.` });
  } else if (minBatt != null && minBatt <= 15) {
    insights.push({ severity: 'warning', category: 'battery', title: 'Battery dropped below warning level', detail: `Minimum battery was ${minBatt}%. Avg battery: ${avgBatt}%.` });
  } else if (avgBatt != null) {
    insights.push({ severity: 'ok', category: 'battery', title: 'Battery levels healthy', detail: `Average ${avgBatt}%, minimum ${minBatt}%.` });
  }

  // Temperature
  const maxTemp = battAgg._max.temperatureC ? Number(battAgg._max.temperatureC) : null;
  const minTemp = battAgg._min.temperatureC ? Number(battAgg._min.temperatureC) : null;
  if (maxTemp != null && maxTemp > 45) {
    insights.push({ severity: 'critical', category: 'battery', title: 'Battery overheating detected', detail: `Maximum temperature reached ${maxTemp}°C (threshold: 45°C). Sustained heat degrades lithium-ion cells.` });
  } else if (minTemp != null && minTemp < -10) {
    insights.push({ severity: 'warning', category: 'battery', title: 'Low temperature detected', detail: `Temperature dropped to ${minTemp}°C. Cold reduces capacity and increases internal resistance.` });
  }

  // WiFi signal
  const avgWifi = wifiAgg._avg.signalStrengthPct ? Math.round(wifiAgg._avg.signalStrengthPct) : null;
  const minWifi = wifiAgg._min.signalStrengthPct;
  if (minWifi != null && minWifi < 20) {
    insights.push({ severity: 'critical', category: 'wifi', title: 'Critical WiFi signal detected', detail: `Signal dropped to ${minWifi}% (< 20% CRITICAL). Avg signal: ${avgWifi}%. ${wifiReadings} surveys below 30%.` });
  } else if (minWifi != null && minWifi < 30) {
    insights.push({ severity: 'warning', category: 'wifi', title: 'Weak WiFi signal zones', detail: `Signal dropped to ${minWifi}%. ${wifiReadings} surveys below 30% warning threshold. Avg: ${avgWifi}%.` });
  } else if (avgWifi != null) {
    insights.push({ severity: 'ok', category: 'wifi', title: 'WiFi signal strength adequate', detail: `Average ${avgWifi}%, minimum ${minWifi}%.` });
  }

  // Roaming
  if (roamCount > 100) {
    insights.push({ severity: 'warning', category: 'roaming', title: 'High roaming activity', detail: `${roamCount} AP roam events detected. Investigate coverage overlap or AP power imbalance.` });
  } else if (roamCount > 0) {
    insights.push({ severity: 'info', category: 'roaming', title: 'Roaming activity normal', detail: `${roamCount} AP roam events across the log period.` });
  }

  // Connection failures
  if (connCount > 50) {
    insights.push({ severity: 'critical', category: 'connection', title: 'Excessive connection failures', detail: `${connCount} connection failures detected. Internal communication service may be unstable.` });
  } else if (connCount > 0) {
    insights.push({ severity: 'warning', category: 'connection', title: 'Connection failures present', detail: `${connCount} connection failure(s) detected during the log period.` });
  }

  // Anomaly summary
  if (criticals > 0) {
    insights.push({ severity: 'critical', category: 'system', title: `${criticals} critical anomalies detected`, detail: `Plus ${warnings} warnings. Review the Anomalies tab for details.` });
  } else if (warnings > 0) {
    insights.push({ severity: 'warning', category: 'system', title: `${warnings} warning anomalies detected`, detail: 'No critical issues, but warnings should be reviewed.' });
  } else {
    insights.push({ severity: 'ok', category: 'system', title: 'No anomalies detected', detail: 'All readings within normal thresholds.' });
  }

  return NextResponse.json(insights);
}
