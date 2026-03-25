'use client';

import { useEffect, useState } from 'react';
import { Battery, Wifi, Radio, AlertTriangle } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import StatsCard from './StatsCard';
import InsightsPanel from './InsightsPanel';

interface OverviewTabProps {
  serial: string;
}

interface DeviceDetail {
  serialNumber: string;
  terminalName: string | null;
  firmwareVersion: string | null;
  macAddress: string | null;
  platformVersion: string | null;
  firstSeen: string;
  lastSeen: string;
  logImports: { logStartTime: string; logStopTime: string; ipAddress: string | null; lineCount: number | null }[];
  operatorSessions: { operatorName: string; operatorExtId: string | null; sessionStart: string; sessionEnd: string; readingCount: number }[];
  _count: { batteryReadings: number; wifiReadings: number; roamEvents: number; connectionEvents: number; anomalies: number; systemEvents: number };
}

const chartTooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' },
};

const fmtTime = (t: string) => {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const OPERATOR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export default function OverviewTab({ serial }: OverviewTabProps) {
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [batterySparkline, setBatterySparkline] = useState<{ time: string; value: number }[]>([]);
  const [wifiSparkline, setWifiSparkline] = useState<{ time: string; value: number }[]>([]);

  useEffect(() => {
    fetch(`/api/devices/${serial}`)
      .then((r) => r.json())
      .then(setDevice);

    fetch(`/api/devices/${serial}/battery`)
      .then((r) => r.json())
      .then((data: { serverTime: string; percentRemaining: number }[]) =>
        setBatterySparkline(data.map((d) => ({ time: d.serverTime, value: d.percentRemaining })))
      );

    fetch(`/api/devices/${serial}/wifi`)
      .then((r) => r.json())
      .then((data: { serverTime: string; signalStrengthPct: number }[]) =>
        setWifiSparkline(data.map((d) => ({ time: d.serverTime, value: d.signalStrengthPct })))
      );
  }, [serial]);

  if (!device) return <div className="p-6 text-slate-400">Loading...</div>;

  const li = device.logImports[0];
  const duration = li
    ? `${Math.round((new Date(li.logStopTime).getTime() - new Date(li.logStartTime).getTime()) / 3600000)}h`
    : '—';

  return (
    <div className="p-6 space-y-6">
      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Device Information</h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            {[
              ['Serial', device.serialNumber],
              ['Terminal Name', device.terminalName],
              ['Firmware', device.firmwareVersion],
              ['MAC', device.macAddress],
              ['IP', li?.ipAddress],
              ['Platform', device.platformVersion],
              ['Log Start', li ? new Date(li.logStartTime).toLocaleString() : '—'],
              ['Log Stop', li ? new Date(li.logStopTime).toLocaleString() : '—'],
              ['Duration', duration],
              ['Lines', li?.lineCount?.toLocaleString()],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="text-slate-400 text-xs">{label}</div>
                <div className="text-slate-100 font-mono text-xs break-all">{value || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6">
          <h3 className="text-sm font-medium text-slate-400 mb-4">
            Operators ({device.operatorSessions.length})
          </h3>
          <div className="space-y-3">
            {device.operatorSessions.map((op, i) => {
              const dur = Math.round(
                (new Date(op.sessionEnd).getTime() - new Date(op.sessionStart).getTime()) / 60000
              );
              return (
                <div key={i} className={`border-l-2 pl-3`} style={{ borderColor: OPERATOR_COLORS[i % OPERATOR_COLORS.length] }}>
                  <div className="font-medium text-slate-100 text-sm">{op.operatorName}</div>
                  <div className="text-xs text-slate-500">
                    ID: {op.operatorExtId || '—'} · {new Date(op.sessionStart).toLocaleString()} → {new Date(op.sessionEnd).toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-slate-500">{dur} min · {op.readingCount} readings</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<Battery className="w-5 h-5" />} value={device._count.batteryReadings} label="Battery readings" color="blue" />
        <StatsCard icon={<Wifi className="w-5 h-5" />} value={device._count.wifiReadings} label="WiFi surveys" color="emerald" />
        <StatsCard icon={<Radio className="w-5 h-5" />} value={device._count.roamEvents} label="AP roams" color="purple" />
        <StatsCard
          icon={<AlertTriangle className="w-5 h-5" />}
          value={device._count.anomalies}
          label="Anomalies"
          color={device._count.anomalies > 0 ? 'red' : 'amber'}
        />
      </div>

      {/* Row 3: Auto-Generated Insights */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
        <InsightsPanel serial={serial} />
      </div>

      {/* Row 4: Sparklines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4">
          <h4 className="text-xs text-slate-400 mb-2">Battery % Over Time</h4>
          <ResponsiveContainer width="100%" height={128}>
            <AreaChart data={batterySparkline}>
              <defs>
                <linearGradient id="battGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} width={30} />
              <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#battGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4">
          <h4 className="text-xs text-slate-400 mb-2">Signal Strength % Over Time</h4>
          <ResponsiveContainer width="100%" height={128}>
            <AreaChart data={wifiSparkline}>
              <defs>
                <linearGradient id="wifiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} width={30} />
              <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
              <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#wifiGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
