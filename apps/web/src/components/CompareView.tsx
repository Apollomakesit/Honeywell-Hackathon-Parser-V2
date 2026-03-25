'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface CompareViewProps {
  devices: { serialNumber: string }[];
  onClose: () => void;
}

interface DeviceSummary {
  serial: string;
  firmware: string | null;
  mac: string | null;
  platform: string | null;
  logStart: string | null;
  logStop: string | null;
  operators: string[];
  counts: { batteryReadings: number; wifiReadings: number; roamEvents: number; connectionEvents: number; anomalies: number };
  avgBattery: number | null;
  minBattery: number | null;
  avgSignal: number | null;
  minSignal: number | null;
  criticals: number;
  warnings: number;
  totalAnomalies: number;
  batteryData: { time: string; value: number }[];
  wifiData: { time: string; value: number }[];
  anomalies: { serverTime: string; severity: string; family: string; title: string }[];
}

const chartTooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' },
};
const fmtTime = (t: string) => {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

function MetricRow({ label, a, b, better }: { label: string; a: string | number | null; b: string | number | null; better?: 'higher' | 'lower' }) {
  const aVal = typeof a === 'number' ? a : null;
  const bVal = typeof b === 'number' ? b : null;
  let aClass = 'text-slate-200';
  let bClass = 'text-slate-200';
  if (better && aVal !== null && bVal !== null && aVal !== bVal) {
    const aBetter = better === 'higher' ? aVal > bVal : aVal < bVal;
    aClass = aBetter ? 'text-emerald-400' : 'text-red-400';
    bClass = aBetter ? 'text-red-400' : 'text-emerald-400';
  }
  return (
    <tr className="border-b border-slate-800/50">
      <td className="py-2 px-3 text-sm text-slate-400">{label}</td>
      <td className={`py-2 px-3 text-sm font-mono text-center ${aClass}`}>{a ?? '—'}</td>
      <td className={`py-2 px-3 text-sm font-mono text-center ${bClass}`}>{b ?? '—'}</td>
    </tr>
  );
}

export default function CompareView({ devices, onClose }: CompareViewProps) {
  const [serialA, setSerialA] = useState(devices[0]?.serialNumber || '');
  const [serialB, setSerialB] = useState(devices[1]?.serialNumber || '');
  const [data, setData] = useState<{ a: DeviceSummary; b: DeviceSummary } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!serialA || !serialB || serialA === serialB) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/devices/compare?a=${serialA}&b=${serialB}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [serialA, serialB]);

  return (
    <div className="p-6 space-y-6">
      {/* Header with device selectors */}
      <div className="flex items-center gap-4">
        <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200">← Back</button>
        <h2 className="text-lg font-semibold text-slate-100">Device Comparison</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-xs text-slate-500 block mb-1">Device A</label>
          <select
            value={serialA}
            onChange={(e) => setSerialA(e.target.value)}
            className="w-full bg-slate-800 border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-blue-400"
          >
            {devices.map((d) => <option key={d.serialNumber} value={d.serialNumber}>{d.serialNumber}</option>)}
          </select>
        </div>
        <span className="text-slate-600 text-lg mt-5">vs</span>
        <div className="flex-1">
          <label className="text-xs text-slate-500 block mb-1">Device B</label>
          <select
            value={serialB}
            onChange={(e) => setSerialB(e.target.value)}
            className="w-full bg-slate-800 border border-emerald-500/50 rounded-lg px-3 py-2 text-sm text-emerald-400"
          >
            {devices.map((d) => <option key={d.serialNumber} value={d.serialNumber}>{d.serialNumber}</option>)}
          </select>
        </div>
      </div>

      {serialA === serialB && (
        <p className="text-sm text-amber-400">Select two different devices to compare.</p>
      )}

      {loading && <p className="text-sm text-slate-400">Loading comparison...</p>}

      {data && (
        <>
          {/* Metrics comparison table */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="py-3 px-3 text-left text-xs text-slate-500 w-1/3">Metric</th>
                  <th className="py-3 px-3 text-center text-xs text-blue-400 w-1/3">{data.a.serial}</th>
                  <th className="py-3 px-3 text-center text-xs text-emerald-400 w-1/3">{data.b.serial}</th>
                </tr>
              </thead>
              <tbody>
                <MetricRow label="Firmware" a={data.a.firmware} b={data.b.firmware} />
                <MetricRow label="Platform" a={data.a.platform} b={data.b.platform} />
                <MetricRow label="Operators" a={data.a.operators.join(', ') || '—'} b={data.b.operators.join(', ') || '—'} />
                <MetricRow label="Battery Readings" a={data.a.counts.batteryReadings} b={data.b.counts.batteryReadings} />
                <MetricRow label="WiFi Surveys" a={data.a.counts.wifiReadings} b={data.b.counts.wifiReadings} />
                <MetricRow label="AP Roams" a={data.a.counts.roamEvents} b={data.b.counts.roamEvents} better="lower" />
                <MetricRow label="Connection Events" a={data.a.counts.connectionEvents} b={data.b.counts.connectionEvents} better="lower" />
                <MetricRow label="Avg Battery %" a={data.a.avgBattery != null ? `${data.a.avgBattery}%` : null} b={data.b.avgBattery != null ? `${data.b.avgBattery}%` : null} />
                <MetricRow label="Min Battery %" a={data.a.minBattery != null ? `${data.a.minBattery}%` : null} b={data.b.minBattery != null ? `${data.b.minBattery}%` : null} />
                <MetricRow label="Avg WiFi Signal" a={data.a.avgSignal != null ? `${data.a.avgSignal}%` : null} b={data.b.avgSignal != null ? `${data.b.avgSignal}%` : null} />
                <MetricRow label="Min WiFi Signal" a={data.a.minSignal != null ? `${data.a.minSignal}%` : null} b={data.b.minSignal != null ? `${data.b.minSignal}%` : null} />
                <MetricRow label="Critical Anomalies" a={data.a.criticals} b={data.b.criticals} better="lower" />
                <MetricRow label="Warning Anomalies" a={data.a.warnings} b={data.b.warnings} better="lower" />
                <MetricRow label="Total Anomalies" a={data.a.totalAnomalies} b={data.b.totalAnomalies} better="lower" />
              </tbody>
            </table>
          </div>

          {/* Battery comparison chart */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Battery % Comparison</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-blue-400 mb-1">{data.a.serial}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.a.batteryData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={fmtTime} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} width={30} />
                    <Tooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f620" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs text-emerald-400 mb-1">{data.b.serial}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.b.batteryData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={fmtTime} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} width={30} />
                    <Tooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98120" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* WiFi comparison chart */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-3">WiFi Signal Comparison</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-blue-400 mb-1">{data.a.serial}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.a.wifiData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={fmtTime} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} width={30} />
                    <Tooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f620" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs text-emerald-400 mb-1">{data.b.serial}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.b.wifiData}>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={fmtTime} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} width={30} />
                    <Tooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b98120" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Side-by-side anomaly lists */}
          <div className="grid grid-cols-2 gap-4">
            {[data.a, data.b].map((d, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-700/50 rounded-xl p-4">
                <h3 className={`text-sm font-medium mb-3 ${idx === 0 ? 'text-blue-400' : 'text-emerald-400'}`}>
                  {d.serial} — Anomalies ({d.totalAnomalies})
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {d.anomalies.slice(0, 20).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-slate-800/30">
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                        a.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {a.severity}
                      </span>
                      <span className="text-slate-500">{a.family}</span>
                      <span className="text-slate-300 truncate">{a.title}</span>
                    </div>
                  ))}
                  {d.anomalies.length === 0 && <p className="text-slate-500 text-xs">No anomalies</p>}
                  {d.anomalies.length > 20 && <p className="text-slate-500 text-xs pt-1">+{d.anomalies.length - 20} more</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
