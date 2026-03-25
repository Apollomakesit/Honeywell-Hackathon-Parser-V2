'use client';

import { useEffect, useState, useCallback } from 'react';

interface ThresholdItem {
  ruleId: string;
  label: string;
  family: string;
  unit: string;
  defaultValue: number;
  value: number;
  enabled: boolean;
  isCustom: boolean;
}

interface ThresholdsTabProps {
  serial: string;
}

export default function ThresholdsTab({ serial }: ThresholdsTabProps) {
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/devices/${serial}/thresholds`);
    const data = await res.json();
    setThresholds(data);
    setLoading(false);
    setDirty(false);
  }, [serial]);

  useEffect(() => { load(); }, [load]);

  const updateValue = (ruleId: string, value: number) => {
    setThresholds((prev) => prev.map((t) => t.ruleId === ruleId ? { ...t, value, isCustom: true } : t));
    setDirty(true);
  };

  const toggleEnabled = (ruleId: string) => {
    setThresholds((prev) => prev.map((t) => t.ruleId === ruleId ? { ...t, enabled: !t.enabled, isCustom: true } : t));
    setDirty(true);
  };

  const resetToDefaults = async () => {
    await fetch(`/api/devices/${serial}/thresholds`, { method: 'DELETE' });
    load();
  };

  const save = async () => {
    setSaving(true);
    await fetch(`/api/devices/${serial}/thresholds`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thresholds: thresholds.map((t) => ({ ruleId: t.ruleId, value: t.value, enabled: t.enabled })) }),
    });
    setSaving(false);
    setDirty(false);
  };

  const families = Array.from(new Set(thresholds.map(t => t.family)));

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading thresholds…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Alert Thresholds</h2>
          <p className="text-xs text-slate-500 mt-1">Configure per-device alerting thresholds. Changes affect future log analysis.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetToDefaults}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg"
          >
            Reset Defaults
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-40 transition"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {families.map((family) => (
        <div key={family} className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800/50">
            <h3 className="text-sm font-medium text-slate-300">{family}</h3>
          </div>
          <div className="divide-y divide-slate-800/30">
            {thresholds.filter(t => t.family === family).map((t) => (
              <div key={t.ruleId} className="flex items-center gap-4 px-4 py-3">
                <button
                  onClick={() => toggleEnabled(t.ruleId)}
                  className={`w-9 h-5 rounded-full transition-colors ${t.enabled ? 'bg-blue-600' : 'bg-slate-700'} relative`}
                >
                  <span className={`absolute w-3.5 h-3.5 bg-white rounded-full top-[3px] transition-transform ${t.enabled ? 'left-[18px]' : 'left-[3px]'}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${t.enabled ? 'text-slate-200' : 'text-slate-500'}`}>{t.label}</p>
                  <p className="text-xs text-slate-600">
                    Rule: {t.ruleId} · Default: {t.defaultValue}{t.unit}
                    {t.isCustom && <span className="ml-2 text-amber-500">• modified</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={t.value}
                    onChange={(e) => updateValue(t.ruleId, parseFloat(e.target.value) || 0)}
                    className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 text-right font-mono"
                    disabled={!t.enabled}
                  />
                  <span className="text-xs text-slate-500 w-10">{t.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
