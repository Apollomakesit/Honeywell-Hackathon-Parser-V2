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

const EVENT_TYPES = ['battery', 'wifi', 'roam', 'connection', 'anomaly'] as const;

export default function TimelineTab({ serial }: TimelineTabProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(EVENT_TYPES));

  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      const o = reset ? 0 : offset;
      const params = new URLSearchParams({ limit: '200', offset: String(o) });
      if (search) params.set('search', search);
      // Send active type filters
      if (activeTypes.size < EVENT_TYPES.length) {
        params.set('types', Array.from(activeTypes).join(','));
      }

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
    [serial, search, offset, activeTypes]
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial, search, activeTypes]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-3">
        <input
          type="text"
          placeholder="Search events… (e.g. 'battery 5%', 'roam', 'connection failed')"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 flex-1"
        />
        <span className="text-xs text-slate-500">
          {events.length} of {total} events
        </span>
      </div>

      {/* Event type filter chips */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-slate-500 mr-1">Filter:</span>
        {EVENT_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
              activeTypes.has(type)
                ? TYPE_COLORS[type] + ' ring-1 ring-current'
                : 'bg-slate-800 text-slate-600'
            }`}
          >
            {type}
          </button>
        ))}
        {activeTypes.size < EVENT_TYPES.length && (
          <button
            onClick={() => setActiveTypes(new Set(EVENT_TYPES))}
            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-300"
          >
            Reset
          </button>
        )}
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
