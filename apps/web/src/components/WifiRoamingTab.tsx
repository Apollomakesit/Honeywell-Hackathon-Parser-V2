'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

interface WifiRoamingTabProps {
  serial: string;
}

const chartTooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' },
};

const fmtTime = (t: string) => {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function WifiRoamingTab({ serial }: WifiRoamingTabProps) {
  const [wifi, setWifi] = useState<{ serverTime: string; signalStrengthPct: number }[]>([]);
  const [roams, setRoams] = useState<{ serverTime: string; fromAp: string; toAp: string }[]>([]);
  const [conns, setConns] = useState<{ serverTime: string; eventType: string }[]>([]);

  useEffect(() => {
    fetch(`/api/devices/${serial}/wifi`).then((r) => r.json()).then(setWifi);
    fetch(`/api/devices/${serial}/roams`).then((r) => r.json()).then(setRoams);
    fetch(`/api/devices/${serial}/connections`).then((r) => r.json()).then(setConns);
  }, [serial]);

  const roamBuckets = useMemo(() => {
    if (!roams.length) return [];
    const buckets: Record<string, number> = {};
    roams.forEach((r) => {
      const d = new Date(r.serverTime);
      const mins = d.getMinutes() < 30 ? '00' : '30';
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}T${d.getHours().toString().padStart(2, '0')}:${mins}`;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, count]) => ({ time, count }));
  }, [roams]);

  const apTable = useMemo(() => {
    const counts: Record<string, number> = {};
    roams.forEach((r) => {
      counts[r.fromAp] = (counts[r.fromAp] || 0) + 1;
      counts[r.toAp] = (counts[r.toAp] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([mac, count]) => ({ mac, count }));
  }, [roams]);

  const connBuckets = useMemo(() => {
    if (!conns.length) return [];
    const buckets: Record<string, number> = {};
    conns.forEach((c) => {
      const d = new Date(c.serverTime);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}T${d.getHours().toString().padStart(2, '0')}:00`;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, count]) => ({ time, count }));
  }, [conns]);

  return (
    <div className="p-6 space-y-6">
      {/* Signal Strength */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Signal Strength (%)</h3>
        {wifi.length > 0 ? (
          <ResponsiveContainer width="100%" height={288}>
            <AreaChart data={wifi}>
              <defs>
                <linearGradient id="wifiFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="serverTime" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
              <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="6 3" />
              <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="6 3" />
              <Area type="monotone" dataKey="signalStrengthPct" stroke="#10b981" fill="url(#wifiFill)" dot={false} name="Signal %" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-500 text-sm">No WiFi data.</div>
        )}
      </div>

      {/* Roaming Events */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Roaming Events (30-min buckets)</h3>
        {roamBuckets.length > 0 ? (
          <ResponsiveContainer width="100%" height={192}>
            <BarChart data={roamBuckets}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="count" name="Roams">
                {roamBuckets.map((entry, i) => (
                  <Cell key={i} fill={entry.count > 5 ? '#f59e0b' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-500 text-sm">No roam events.</div>
        )}
      </div>

      {/* AP Table */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Access Points ({apTable.length})</h3>
        {apTable.length > 0 ? (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-400 text-xs font-medium">AP MAC</th>
                  <th className="text-right py-2 text-slate-400 text-xs font-medium">Roam Count</th>
                </tr>
              </thead>
              <tbody>
                {apTable.map((row, i) => (
                  <tr key={row.mac} className={i % 2 === 0 ? 'bg-slate-800/30' : ''}>
                    <td className="py-1.5 font-mono text-xs text-slate-200">{row.mac}</td>
                    <td className="py-1.5 text-right text-xs text-slate-300">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-slate-500 text-sm">No AP data.</div>
        )}
      </div>

      {/* Connection Failures */}
      {connBuckets.length > 0 && (
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Connection Failures (hourly)</h3>
          <ResponsiveContainer width="100%" height={192}>
            <BarChart data={connBuckets}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="count" fill="#ef4444" name="Failures" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
