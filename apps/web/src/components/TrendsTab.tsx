'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

interface TrendEntry {
  importId: string;
  filename: string;
  logStart: string;
  logStop: string;
  lineCount: number | null;
  battery: { count: number; avg: number | null; min: number | null };
  wifi: { count: number; avg: number | null; min: number | null };
  roams: number;
  connections: number;
  criticals: number;
  warnings: number;
  totalAnomalies: number;
}

interface TrendsTabProps {
  serial: string;
}

const chartTooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' },
};

const fmtDate = (t: string) => {
  const d = new Date(t);
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function TrendsTab({ serial }: TrendsTabProps) {
  const [data, setData] = useState<TrendEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/devices/${serial}/trends`);
    const json = await res.json();
    setData(json.imports || []);
    setLoading(false);
  }, [serial]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading trends…</div>;

  if (data.length === 0) {
    return <div className="p-6 text-sm text-slate-500">No log imports found for this device.</div>;
  }

  const chartData = data.map((d, idx) => ({
    name: `Import ${idx + 1}`,
    date: fmtDate(d.logStart),
    avgBattery: d.battery.avg,
    minBattery: d.battery.min,
    avgWifi: d.wifi.avg,
    minWifi: d.wifi.min,
    roams: d.roams,
    connections: d.connections,
    criticals: d.criticals,
    warnings: d.warnings,
    totalAnomalies: d.totalAnomalies,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Trend Analysis</h2>
        <p className="text-xs text-slate-500 mt-1">
          Comparing {data.length} log import{data.length > 1 ? 's' : ''} for device {serial}
        </p>
      </div>

      {/* Import summary table */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/50 text-slate-500">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-right">Lines</th>
              <th className="px-3 py-2 text-right">Avg Bat %</th>
              <th className="px-3 py-2 text-right">Min Bat %</th>
              <th className="px-3 py-2 text-right">Avg WiFi %</th>
              <th className="px-3 py-2 text-right">Roams</th>
              <th className="px-3 py-2 text-right">Conn</th>
              <th className="px-3 py-2 text-right">Criticals</th>
              <th className="px-3 py-2 text-right">Warnings</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.importId} className="border-b border-slate-800/30 hover:bg-slate-800/30">
                <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                <td className="px-3 py-2 text-slate-300 font-mono">{fmtDate(d.logStart)}</td>
                <td className="px-3 py-2 text-right text-slate-300">{d.lineCount ?? '—'}</td>
                <td className="px-3 py-2 text-right text-slate-300">{d.battery.avg ?? '—'}%</td>
                <td className="px-3 py-2 text-right text-slate-300">{d.battery.min ?? '—'}%</td>
                <td className="px-3 py-2 text-right text-slate-300">{d.wifi.avg ?? '—'}%</td>
                <td className="px-3 py-2 text-right text-slate-300">{d.roams}</td>
                <td className="px-3 py-2 text-right text-slate-300">{d.connections}</td>
                <td className="px-3 py-2 text-right text-red-400">{d.criticals}</td>
                <td className="px-3 py-2 text-right text-amber-400">{d.warnings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Battery trend chart */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Battery Trend Across Imports</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} width={35} />
            <Tooltip {...chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="avgBattery" name="Avg %" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="minBattery" name="Min %" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* WiFi trend chart */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">WiFi Signal Trend Across Imports</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} width={35} />
            <Tooltip {...chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="avgWifi" name="Avg Signal %" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="minWifi" name="Min Signal %" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Anomalies & Events bar chart */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Events & Anomalies Per Import</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} width={35} />
            <Tooltip {...chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="roams" name="AP Roams" fill="#06b6d4" />
            <Bar dataKey="criticals" name="Criticals" fill="#ef4444" />
            <Bar dataKey="warnings" name="Warnings" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
