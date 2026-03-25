'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Scatter, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

interface WifiRoamingTabProps {
  serial: string;
}

interface WifiReading {
  serverTime: string;
  signalStrengthPct: number;
  signalSamples: number[];
  accessPointMac: string | null;
  operatorName: string | null;
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

// Highlight offending WiFi signal points on chart
function WifiOffendingDot(props: { cx?: number; cy?: number; payload?: { signalStrengthPct: number } }) {
  const { cx, cy, payload } = props;
  if (!payload || !cx || !cy) return null;
  if (payload.signalStrengthPct < 20) return <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#ef4444" />;
  if (payload.signalStrengthPct < 30) return <circle cx={cx} cy={cy} r={3} fill="#f59e0b" stroke="#f59e0b" />;
  return null;
}

// Custom tooltip showing signal samples
function WifiTooltipContent({ active, payload, label }: { active?: boolean; payload?: { payload: WifiReading }[]; label?: string }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const isOffending = d.signalStrengthPct < 30;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs max-w-xs">
      <div className="text-slate-400 mb-1">{label ? new Date(label).toLocaleString() : ''}</div>
      <div className={`text-lg font-bold font-mono ${isOffending ? 'text-red-400' : 'text-emerald-400'}`}>
        {d.signalStrengthPct}%
        {isOffending && <span className="text-xs ml-2 bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">OFFENDING</span>}
      </div>
      {d.signalSamples?.length > 0 && (
        <div className="mt-2">
          <div className="text-slate-500 mb-1">Signal Samples ({d.signalSamples.length}):</div>
          <div className="flex flex-wrap gap-1">
            {d.signalSamples.map((s, i) => (
              <span key={i} className={`font-mono px-1 rounded ${s < 20 ? 'bg-red-500/20 text-red-400' : s < 30 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-300'}`}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {d.accessPointMac && <div className="mt-1 text-slate-500">AP: <span className="font-mono text-slate-300">{d.accessPointMac}</span></div>}
      {d.operatorName && <div className="text-slate-500">Operator: <span className="text-slate-300">{d.operatorName}</span></div>}
    </div>
  );
}

export default function WifiRoamingTab({ serial }: WifiRoamingTabProps) {
  const [wifi, setWifi] = useState<WifiReading[]>([]);
  const [roams, setRoams] = useState<{ serverTime: string; fromAp: string; toAp: string }[]>([]);
  const [conns, setConns] = useState<{ serverTime: string; eventType: string; host: string | null; port: number | null; errorDetail: string | null; connectionCount: number | null; errorCount: number | null }[]>([]);

  useEffect(() => {
    fetch(`/api/devices/${serial}/wifi`).then((r) => r.json()).then(setWifi);
    fetch(`/api/devices/${serial}/roams`).then((r) => r.json()).then(setRoams);
    fetch(`/api/devices/${serial}/connections`).then((r) => r.json()).then(setConns);
  }, [serial]);

  // WiFi summary stats
  const wifiStats = useMemo(() => {
    if (!wifi.length) return null;
    const sigs = wifi.filter(w => w.signalStrengthPct != null).map(w => w.signalStrengthPct);
    const belowWarn = sigs.filter(s => s < 30).length;
    const belowCrit = sigs.filter(s => s < 20).length;
    const uniqueAPs = new Set(wifi.filter(w => w.accessPointMac).map(w => w.accessPointMac)).size;
    return {
      avg: sigs.length ? Math.round(sigs.reduce((s, v) => s + v, 0) / sigs.length) : null,
      min: sigs.length ? Math.min(...sigs) : null,
      max: sigs.length ? Math.max(...sigs) : null,
      surveys: wifi.length,
      belowWarn,
      belowCrit,
      uniqueAPs,
      totalRoams: roams.length,
      totalFailures: conns.length,
    };
  }, [wifi, roams, conns]);

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
      {/* Summary Stats */}
      {wifiStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Avg Signal" value={wifiStats.avg} unit="%" />
          <StatCard label="Min Signal" value={wifiStats.min} unit="%" alert={wifiStats.min != null && wifiStats.min < 30} />
          <StatCard label="Max Signal" value={wifiStats.max} unit="%" />
          <StatCard label="Unique APs" value={wifiStats.uniqueAPs} />
          <StatCard label="Total Roams" value={wifiStats.totalRoams} alert={wifiStats.totalRoams > 50} />
          <StatCard label="Conn Failures" value={wifiStats.totalFailures} alert={wifiStats.totalFailures > 0} />
          {wifiStats.belowWarn > 0 && (
            <StatCard label="Below 30% Warning" value={wifiStats.belowWarn} unit="surveys" alert />
          )}
          {wifiStats.belowCrit > 0 && (
            <StatCard label="Below 20% Critical" value={wifiStats.belowCrit} unit="surveys" alert />
          )}
        </div>
      )}

      {/* Signal Strength with offending highlights */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-400 mb-1">Signal Strength (%) — Offending values highlighted</h3>
        <p className="text-xs text-slate-600 mb-3">Hover data points to see individual signal samples</p>
        {wifi.length > 0 ? (
          <ResponsiveContainer width="100%" height={288}>
            <ComposedChart data={wifi}>
              <defs>
                <linearGradient id="wifiFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="serverTime" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
              <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<WifiTooltipContent />} />
              <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: '30% WARNING', fill: '#f59e0b', fontSize: 10 }} />
              <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="6 3" label={{ value: '20% CRITICAL', fill: '#ef4444', fontSize: 10 }} />
              <Area type="monotone" dataKey="signalStrengthPct" stroke="#10b981" fill="url(#wifiFill)" dot={false} name="Signal %" />
              <Scatter dataKey="signalStrengthPct" shape={<WifiOffendingDot />} />
            </ComposedChart>
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

      {/* Recent Roam Events Detail Table */}
      {roams.length > 0 && (
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Roam Event Details (latest 50)</h3>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-400 font-medium">Time</th>
                  <th className="text-left py-2 text-slate-400 font-medium">From AP</th>
                  <th className="text-center py-2 text-slate-400 font-medium">→</th>
                  <th className="text-left py-2 text-slate-400 font-medium">To AP</th>
                </tr>
              </thead>
              <tbody>
                {roams.slice(-50).reverse().map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-slate-800/30' : ''}>
                    <td className="py-1.5 text-slate-300">{new Date(r.serverTime).toLocaleString()}</td>
                    <td className="py-1.5 font-mono text-slate-200">{r.fromAp}</td>
                    <td className="py-1.5 text-center text-slate-600">→</td>
                    <td className="py-1.5 font-mono text-slate-200">{r.toAp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Connection Failure Details */}
      {conns.length > 0 && (
        <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Connection Failure Details (latest 30)</h3>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-400 font-medium">Time</th>
                  <th className="text-left py-2 text-slate-400 font-medium">Host:Port</th>
                  <th className="text-right py-2 text-slate-400 font-medium">Conn #</th>
                  <th className="text-right py-2 text-slate-400 font-medium">Err #</th>
                  <th className="text-left py-2 text-slate-400 font-medium">Error Detail</th>
                </tr>
              </thead>
              <tbody>
                {conns.slice(-30).reverse().map((c, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-slate-800/30' : ''}>
                    <td className="py-1.5 text-slate-300">{new Date(c.serverTime).toLocaleString()}</td>
                    <td className="py-1.5 font-mono text-slate-200">{c.host || '—'}:{c.port || '—'}</td>
                    <td className="py-1.5 text-right text-slate-300">{c.connectionCount ?? '—'}</td>
                    <td className="py-1.5 text-right text-red-400 font-semibold">{c.errorCount ?? '—'}</td>
                    <td className="py-1.5 text-red-400/80 truncate max-w-xs">{c.errorDetail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
