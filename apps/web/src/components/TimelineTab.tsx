'use client';

import { useEffect, useState, useCallback } from 'react';

interface TimelineTabProps {
  serial: string;
}

interface TimelineEvent {
  time: string;
  type: string;
  severity?: string;
  description: string;
}

const TYPE_COLORS: Record<string, string> = {
  battery: 'bg-blue-500/20 text-blue-400',
  wifi: 'bg-emerald-500/20 text-emerald-400',
  roam: 'bg-purple-500/20 text-purple-400',
  connection: 'bg-red-500/20 text-red-400',
  anomaly: 'bg-amber-500/20 text-amber-400',
};

export default function TimelineTab({ serial }: TimelineTabProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      const o = reset ? 0 : offset;
      const params = new URLSearchParams({ limit: '200', offset: String(o) });
      if (search) params.set('search', search);

      const res = await fetch(`/api/devices/${serial}/timeline?${params}`);
      const data = await res.json();

      if (reset) {
        setEvents(data.events);
        setOffset(200);
      } else {
        setEvents((prev) => [...prev, ...data.events]);
        setOffset(o + 200);
      }
      setTotal(data.total);
      setLoading(false);
    },
    [serial, search, offset]
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial, search]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 flex-1"
        />
        <span className="text-xs text-slate-500">
          {events.length} of {total} events
        </span>
      </div>

      <div className="space-y-1">
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-800/50">
            <span className="font-mono text-xs text-slate-500 w-48 shrink-0">
              {new Date(e.time).toLocaleString()}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[e.type] || 'bg-slate-700 text-slate-300'}`}>
              {e.type}
            </span>
            <span className="text-sm text-slate-300 truncate">{e.description}</span>
          </div>
        ))}
      </div>

      {events.length < total && (
        <div className="text-center mt-4">
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
