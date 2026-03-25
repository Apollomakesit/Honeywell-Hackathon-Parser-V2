'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-400 mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function BatteryTab({ serial }: BatteryTabProps) {
  const [data, setData] = useState<BatteryReading[]>([]);

  useEffect(() => {
    fetch(`/api/devices/${serial}/battery`)
      .then((r) => r.json())
      .then(setData);
  }, [serial]);

  if (!data.length) return <div className="p-6 text-slate-400">No battery data available.</div>;

  return (
    <div className="p-6 space-y-6">
      <ChartCard title="Battery Level (%)">
        <ResponsiveContainer width="100%" height={288}>
          <AreaChart data={data}>
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
            <ReferenceLine y={15} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: '15%', fill: '#f59e0b', fontSize: 11 }} />
            <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="6 3" label={{ value: '5%', fill: '#ef4444', fontSize: 11 }} />
            <Area type="monotone" dataKey="percentRemaining" stroke="#3b82f6" fill="url(#battFill)" dot={false} name="Battery %" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Runtime (minutes)">
        <ResponsiveContainer width="100%" height={224}>
          <LineChart data={data}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="serverTime" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
            <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="6 3" />
            <Line type="monotone" dataKey="runtimeMinutes" stroke="#8b5cf6" dot={false} name="Runtime" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Temperature (°C)">
        <ResponsiveContainer width="100%" height={224}>
          <LineChart data={data}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="serverTime" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={fmtTime} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip {...chartTooltipStyle} labelFormatter={(l) => new Date(l).toLocaleString()} />
            <Line type="monotone" dataKey="temperatureC" stroke="#f59e0b" dot={false} name="Temp °C" />
          </LineChart>
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
