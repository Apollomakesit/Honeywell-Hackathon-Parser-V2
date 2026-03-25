'use client';
import { useEffect, useState } from 'react';

interface Insight {
  severity: 'ok' | 'info' | 'warning' | 'critical';
  category: 'battery' | 'wifi' | 'roaming' | 'connection' | 'system';
  title: string;
  detail: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string; label: string }> = {
  critical: { bg: 'bg-red-900/20', border: 'border-red-600', icon: '🔴', label: 'CRITICAL' },
  warning: { bg: 'bg-amber-900/20', border: 'border-amber-500', icon: '🟠', label: 'WARNING' },
  info: { bg: 'bg-blue-900/20', border: 'border-blue-500', icon: '🔵', label: 'INFO' },
  ok: { bg: 'bg-green-900/20', border: 'border-green-600', icon: '🟢', label: 'OK' },
};

const CATEGORY_LABELS: Record<string, string> = {
  battery: '🔋 Battery',
  wifi: '📶 WiFi',
  roaming: '📡 Roaming',
  connection: '🔗 Connection',
  system: '⚙️ System',
};

export default function InsightsPanel({ serial }: { serial: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/devices/${serial}/insights`)
      .then(r => r.json())
      .then(setInsights)
      .catch(() => setInsights([]))
      .finally(() => setLoading(false));
  }, [serial]);

  if (loading) return <div className="text-zinc-500 text-sm py-2">Generating insights…</div>;
  if (!insights.length) return null;

  const critCount = insights.filter(i => i.severity === 'critical').length;
  const warnCount = insights.filter(i => i.severity === 'warning').length;
  const okCount = insights.filter(i => i.severity === 'ok' || i.severity === 'info').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-zinc-300">Auto-Generated Insights</h3>
        <div className="flex gap-2 text-xs">
          {critCount > 0 && <span className="px-2 py-0.5 bg-red-900/30 text-red-400 rounded-full">{critCount} critical</span>}
          {warnCount > 0 && <span className="px-2 py-0.5 bg-amber-900/30 text-amber-400 rounded-full">{warnCount} warning</span>}
          {okCount > 0 && <span className="px-2 py-0.5 bg-green-900/30 text-green-400 rounded-full">{okCount} ok</span>}
        </div>
      </div>
      <div className="grid gap-2">
        {insights
          .sort((a, b) => {
            const order = { critical: 0, warning: 1, info: 2, ok: 3 };
            return order[a.severity] - order[b.severity];
          })
          .map((insight, i) => {
            const s = SEVERITY_STYLES[insight.severity];
            return (
              <div key={i} className={`${s.bg} border-l-2 ${s.border} rounded-r-md px-3 py-2`}>
                <div className="flex items-center gap-2 text-sm">
                  <span>{s.icon}</span>
                  <span className="font-medium text-zinc-200">{insight.title}</span>
                  <span className="text-[10px] text-zinc-500 ml-auto">{CATEGORY_LABELS[insight.category] || insight.category}</span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 ml-6">{insight.detail}</p>
              </div>
            );
          })}
      </div>
    </div>
  );
}
