'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area, LineChart, Line, ComposedChart, Scatter, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface BatteryTabProps {
  serial: string;
}

interface BatteryReading {
  serverTime: string;
  percentRemaining: number;
  runtimeMinutes: number;
  volts: number;
  energyConsumption: number;
  temperatureC: number;
}

const chartTooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' },
};

const fmtTime = (t: string) => {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

function StatCard({ label, value, unit, alert }: { label: string; value: string | number | null; unit?: string; alert?: boolean }) {
  return (
    <div className={`bg-slate-800 border rounded-lg p-3 ${alert ? 'border-red-500/40' : 'border-slate-700/50'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-semibold font-mono ${alert ? 'text-red-400' : 'text-slate-100'}`}>
        {value ?? '—'}{unit && <span className="text-xs text-slate-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-3">{title}</h3>
      {children}
    </div>
  );
}

// Custom dot that highlights offending values
function OffendingDot(props: { cx?: number; cy?: number; payload?: { percentRemaining: number }; warnThreshold: number; critThreshold: number }) {
  const { cx, cy, payload, warnThreshold, critThreshold } = props;
  if (!payload || !cx || !cy) return null;
  if (payload.percentRemaining <= critThreshold) {
    return <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#ef4444" strokeWidth={1} />;
  }
  if (payload.percentRemaining <= warnThreshold) {
    return <circle cx={cx} cy={cy} r={3} fill="#f59e0b" stroke="#f59e0b" strokeWidth={1} />;
  }
  return null;
}

function TempDot(props: { cx?: number; cy?: number; payload?: { temperatureC: number } }) {
  const { cx, cy, payload } = props;
  if (!payload || !cx || !cy) return null;
  if (payload.temperatureC > 45) return <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#ef4444" />;
  if (payload.temperatureC < -10) return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" stroke="#3b82f6" />;
  return null;
}

export default function BatteryTab({ serial }: BatteryTabProps) {
  const [data, setData] = useState<BatteryReading[]>([]);

  useEffect(() => {
    fetch(`/api/devices/${serial}/battery`)
      .then((r) => r.json())
      .then(setData);
  }, [serial]);

  // Computed stats
  const stats = useMemo(() => {
    if (!data.length) return null;
    const pcts = data.filter(d => d.percentRemaining != null).map(d => d.percentRemaining);
    const temps = data.filter(d => d.temperatureC != null).map(d => d.temperatureC);
    const volts = data.filter(d => d.volts != null).map(d => d.volts);

    // Drain rate: %/hour based on first and last reading
    let drainRate: number | null = null;
    if (data.length >= 2) {
      const first = data[0];
      const last = data[data.length - 1];
      const hours = (new Date(last.serverTime).getTime() - new Date(first.serverTime).getTime()) / 3600000;
      if (hours > 0 && first.percentRemaining != null && last.percentRemaining != null) {
        drainRate = Math.round(((first.percentRemaining - last.percentRemaining) / hours) * 10) / 10;
      }
    }

    const belowWarn = pcts.filter(p => p <= 15).length;
    const belowCrit = pcts.filter(p => p <= 5).length;

    return {
      avg: pcts.length ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null,
      min: pcts.length ? Math.min(...pcts) : null,
      max: pcts.length ? Math.max(...pcts) : null,
      drainRate,
      avgTemp: temps.length ? Math.round(temps.reduce((s, v) => s + v, 0) / temps.length * 10) / 10 : null,
      maxTemp: temps.length ? Math.max(...temps) : null,
      minTemp: temps.length ? Math.min(...temps) : null,
      avgVolts: volts.length ? Math.round(volts.reduce((s, v) => s + v, 0) / volts.length * 100) / 100 : null,
      readings: data.length,
      belowWarn,
      belowCrit,
    };
  }, [data]);

  // Compute drain rate per reading for drain rate chart
  const drainData = useMemo(() => {
    if (data.length < 2) return [];
    const result: { serverTime: string; drainRate: number }[] = [];
    for (let i = 1; i < data.length; i++) {
      const dt = (new Date(data[i].serverTime).getTime() - new Date(data[i - 1].serverTime).getTime()) / 3600000;
      if (dt > 0 && data[i - 1].percentRemaining != null && data[i].percentRemaining != null) {
        const rate = (data[i - 1].percentRemaining - data[i].percentRemaining) / dt;
        result.push({ serverTime: data[i].serverTime, drainRate: Math.round(rate * 10) / 10 });
      }
    }
    return result;
  }, [data]);

  if (!data.length) return <div className="p-6 text-slate-400">No battery data available.</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Avg Battery" value={stats.avg} unit="%" />
          <StatCard label="Min Battery" value={stats.min} unit="%" alert={stats.min != null && stats.min <= 15} />
          <StatCard label="Drain Rate" value={stats.drainRate} unit="%/hr" alert={stats.drainRate != null && stats.drainRate > 5} />
          <StatCard label="Avg Temp" value={stats.avgTemp} unit="°C" />
          <StatCard label="Max Temp" value={stats.maxTemp} unit="°C" alert={stats.maxTemp != null && stats.maxTemp > 45} />
          <StatCard label="Avg Voltage" value={stats.avgVolts} unit="V" />
          {stats.belowWarn > 0 && (
            <StatCard label="Below 15% Warning" value={stats.belowWarn} unit="readings" alert />
          )}
          {stats.belowCrit > 0 && (
            <StatCard label="Below 5% Critical" value={stats.belowCrit} unit="readings" alert />
          )}
        </div>
      )}

      <ChartCard title="Battery Level (%) — Offending values highlighted">
        <ResponsiveContainer width="100%" height={288}>
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="battFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="serverTime" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
            <ReferenceLine y={15} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: '15% WARNING', fill: '#f59e0b', fontSize: 10 }} />
            <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="6 3" label={{ value: '5% CRITICAL', fill: '#ef4444', fontSize: 10 }} />
            <Area type="monotone" dataKey="percentRemaining" stroke="#3b82f6" fill="url(#battFill)" dot={false} name="Battery %" />
            <Scatter dataKey="percentRemaining" shape={<OffendingDot warnThreshold={15} critThreshold={5} />} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Battery Drain Rate (%/hour) — Higher = faster drain">
        {drainData.length > 0 ? (
          <ResponsiveContainer width="100%" height={224}>
            <AreaChart data={drainData}>
              <defs>
                <linearGradient id="drainFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="serverTime" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
              <Area type="monotone" dataKey="drainRate" stroke="#f59e0b" fill="url(#drainFill)" dot={false} name="Drain %/hr" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-slate-500">Not enough readings to calculate drain rate.</div>
        )}
      </ChartCard>

      <ChartCard title="Runtime (minutes)">
        <ResponsiveContainer width="100%" height={224}>
          <LineChart data={data}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="serverTime" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
            <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: '30min WARNING', fill: '#f59e0b', fontSize: 10 }} />
            <Line type="monotone" dataKey="runtimeMinutes" stroke="#8b5cf6" dot={false} name="Runtime" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Temperature (°C) — Offending values highlighted">
        <ResponsiveContainer width="100%" height={224}>
          <ComposedChart data={data}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="serverTime" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
            <ReferenceLine y={45} stroke="#ef4444" strokeDasharray="6 3" label={{ value: '45°C HIGH', fill: '#ef4444', fontSize: 10 }} />
            <ReferenceLine y={-10} stroke="#3b82f6" strokeDasharray="6 3" label={{ value: '-10°C LOW', fill: '#3b82f6', fontSize: 10 }} />
            <Line type="monotone" dataKey="temperatureC" stroke="#f59e0b" dot={false} name="Temp °C" />
            <Scatter dataKey="temperatureC" shape={<TempDot />} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Voltage (V)">
        <ResponsiveContainer width="100%" height={224}>
          <LineChart data={data}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="serverTime" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
            <Line type="monotone" dataKey="volts" stroke="#10b981" dot={false} name="Volts" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Energy Consumption (mAh)">
        <ResponsiveContainer width="100%" height={224}>
          <LineChart data={data}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="serverTime" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
            <Line type="monotone" dataKey="energyConsumption" stroke="#ef4444" dot={false} name="Energy mAh" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
