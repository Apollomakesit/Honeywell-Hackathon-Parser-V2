import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Default threshold values for each rule
const DEFAULTS: Record<string, { value: number; label: string; family: string; unit: string }> = {
  BATT_PCT_WARN:  { value: 15, label: 'Battery Warning %', family: 'BATTERY', unit: '%' },
  BATT_PCT_CRIT:  { value: 5,  label: 'Battery Critical %', family: 'BATTERY', unit: '%' },
  BATT_RUNTIME:   { value: 30, label: 'Min Runtime (min)', family: 'BATTERY', unit: 'min' },
  BATT_TEMP_HIGH: { value: 45, label: 'Max Battery Temp', family: 'BATTERY', unit: '°C' },
  BATT_TEMP_LOW:  { value: -10, label: 'Min Battery Temp', family: 'BATTERY', unit: '°C' },
  WIFI_WARN:      { value: 30, label: 'WiFi Warning %', family: 'WIFI', unit: '%' },
  WIFI_CRIT:      { value: 20, label: 'WiFi Critical %', family: 'WIFI', unit: '%' },
  ROAM_STORM:     { value: 5,  label: 'Roam Storm Count', family: 'WIFI', unit: 'roams' },
  CONN_BURST:     { value: 10, label: 'Connection Burst', family: 'SOCKET', unit: 'events' },
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { serial: string } }
) {
  const device = await prisma.device.findFirst({ where: { serialNumber: params.serial } });
  if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const overrides = await prisma.alertThreshold.findMany({
    where: { deviceId: device.id },
  });

  const overrideMap = new Map(overrides.map(o => [o.ruleId, o]));

  const thresholds = Object.entries(DEFAULTS).map(([ruleId, def]) => {
    const override = overrideMap.get(ruleId);
    return {
      ruleId,
      label: def.label,
      family: def.family,
      unit: def.unit,
      defaultValue: def.value,
      value: override ? override.value : def.value,
      enabled: override ? override.enabled : true,
      isCustom: !!override,
    };
  });

  return NextResponse.json(thresholds);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { serial: string } }
) {
  const device = await prisma.device.findFirst({ where: { serialNumber: params.serial } });
  if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const updates: { ruleId: string; value: number; enabled: boolean }[] = body.thresholds;

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const validRuleIds = Object.keys(DEFAULTS);

  for (const u of updates) {
    if (!validRuleIds.includes(u.ruleId)) continue;
    if (typeof u.value !== 'number' || !isFinite(u.value)) continue;

    await prisma.alertThreshold.upsert({
      where: { deviceId_ruleId: { deviceId: device.id, ruleId: u.ruleId } },
      update: { value: u.value, enabled: u.enabled },
      create: { deviceId: device.id, ruleId: u.ruleId, value: u.value, enabled: u.enabled },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { serial: string } }
) {
  const device = await prisma.device.findFirst({ where: { serialNumber: params.serial } });
  if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.alertThreshold.deleteMany({ where: { deviceId: device.id } });
  return NextResponse.json({ ok: true });
}
