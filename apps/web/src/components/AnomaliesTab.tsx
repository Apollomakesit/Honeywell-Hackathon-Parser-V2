'use client';

import { useEffect, useState, useMemo } from 'react';
import AnomalyCard from './AnomalyCard';

interface AnomaliesTabProps {
  serial: string;
}

interface AnomalyData {
  id: string;
  family: string;
  severity: string;
  ruleId: string;
  title: string;
  description: string | null;
  tooltip: string | null;
  serverTime: string;
  offendingValue: string | null;
  thresholdValue: string | null;
  triggerLines: string;
}

export default function AnomaliesTab({ serial }: AnomaliesTabProps) {
  const [anomalies, setAnomalies] = useState<AnomalyData[]>([]);
  const [severity, setSeverity] = useState('all');
  const [family, setFamily] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`/api/devices/${serial}/anomalies`)
      .then((r) => r.json())
      .then(setAnomalies);
  }, [serial]);

  const families = useMemo(() => {
    const set = new Set(anomalies.map((a) => a.family));
    return Array.from(set).sort();
  }, [anomalies]);

  const filtered = useMemo(() => {
    return anomalies.filter((a) => {
      if (severity !== 'all' && a.severity !== severity) return false;
      if (family !== 'all' && a.family !== family) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !a.title.toLowerCase().includes(q) &&
          !(a.description || '').toLowerCase().includes(q) &&
          !a.family.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [anomalies, severity, family, search]);

  return (
    <div className="p-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200"
        >
          <option value="all">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
        </select>

        <select
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200"
        >
          <option value="all">All Families</option>
          {families.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search anomalies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 flex-1 min-w-48"
        />

        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {anomalies.length}
        </span>
      </div>

      {/* Anomaly cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {anomalies.length === 0 ? 'No anomalies detected.' : 'No anomalies match the current filters.'}
        </div>
      ) : (
        filtered.map((a) => <AnomalyCard key={a.id} anomaly={a} />)
      )}
    </div>
  );
}
