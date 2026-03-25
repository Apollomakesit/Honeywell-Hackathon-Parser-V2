'use client';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'battery', label: 'Battery' },
  { id: 'wifi', label: 'WiFi & Roaming' },
  { id: 'anomalies', label: 'Anomalies' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'rawlog', label: 'Raw Log' },
  { id: 'trends', label: 'Trends' },
  { id: 'thresholds', label: 'Thresholds' },
];

interface TabBarProps {
  active: string;
  onChange: (tab: string) => void;
}

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div className="flex border-b border-slate-700/50">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            active === t.id
              ? 'text-blue-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.label}
          {active === t.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
