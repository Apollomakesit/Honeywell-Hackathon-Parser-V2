'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface RawLogTabProps {
  serial: string;
}

interface LogLine {
  lineNumber: number;
  content: string;
  category: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  battery: 'text-blue-400',
  wifi: 'text-emerald-400',
  roam: 'text-purple-400',
  connection: 'text-red-400',
  error: 'text-red-500',
  warning: 'text-amber-400',
  operator: 'text-cyan-400',
  system: 'text-slate-400',
  header: 'text-yellow-300',
  noise: 'text-slate-600',
};

const CATEGORY_BG: Record<string, string> = {
  battery: 'bg-blue-500/5',
  wifi: 'bg-emerald-500/5',
  roam: 'bg-purple-500/5',
  connection: 'bg-red-500/5',
  error: 'bg-red-500/10',
  warning: 'bg-amber-500/5',
  operator: 'bg-cyan-500/5',
  system: '',
  header: 'bg-yellow-500/5',
  noise: '',
};

export default function RawLogTab({ serial }: RawLogTabProps) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(value);
      setOffset(0);
    }, 300);
  };

  const load = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      const o = reset ? 0 : offset;
      const params = new URLSearchParams({ limit: '500', offset: String(o) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (category !== 'all') params.set('category', category);

      const res = await fetch(`/api/devices/${serial}/logs?${params}`);
      const data = await res.json();

      if (reset) {
        setLines(data.lines);
        setOffset(500);
      } else {
        setLines((prev) => [...prev, ...data.lines]);
        setOffset(o + 500);
      }
      setTotal(data.total);
      if (data.categories) setCategories(data.categories);
      setLoading(false);
    },
    [serial, debouncedSearch, category, offset]
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial, debouncedSearch, category]);

  const highlightSearchTerm = (content: string) => {
    if (!debouncedSearch) return content;
    const idx = content.toLowerCase().indexOf(debouncedSearch.toLowerCase());
    if (idx === -1) return content;
    return (
      <>
        {content.slice(0, idx)}
        <mark className="bg-yellow-500/40 text-yellow-200 rounded px-0.5">
          {content.slice(idx, idx + debouncedSearch.length)}
        </mark>
        {content.slice(idx + debouncedSearch.length)}
      </>
    );
  };

  return (
    <div className="p-6 flex flex-col h-full">
      {/* Search and filter controls */}
      <div className="flex items-center gap-3 mb-3">
        <input
          type="text"
          placeholder="Search raw log lines… (e.g. 'Battery', 'AP MON', 'Connection Failed', '0x1402')"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 flex-1"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setOffset(0); }}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {lines.length} of {total} lines
        </span>
      </div>

      {/* Quick filter chips */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-slate-500">Quick:</span>
        {['battery', 'wifi', 'roam', 'connection', 'error', 'warning'].map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setCategory(cat);
              setOffset(0);
            }}
            className={`px-2 py-0.5 text-xs rounded-full transition-all ${
              category === cat
                ? `${CATEGORY_COLORS[cat]} ring-1 ring-current bg-slate-800`
                : 'text-slate-500 hover:text-slate-300 bg-slate-800/50'
            }`}
          >
            {cat}
          </button>
        ))}
        {category !== 'all' && (
          <button
            onClick={() => { setCategory('all'); setOffset(0); }}
            className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Log viewer */}
      <div className="bg-slate-950 border border-slate-700/50 rounded-lg overflow-auto flex-1 font-mono text-xs">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-900 z-10">
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-3 py-2 text-slate-500 w-16">Line</th>
              <th className="text-left px-3 py-2 text-slate-500 w-24">Category</th>
              <th className="text-left px-3 py-2 text-slate-500">Content</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr
                key={line.lineNumber}
                onClick={() => setHighlightLine(line.lineNumber === highlightLine ? null : line.lineNumber)}
                className={`border-b border-slate-800/30 cursor-pointer hover:bg-slate-800/50 transition-colors ${
                  highlightLine === line.lineNumber ? 'bg-blue-500/10' : CATEGORY_BG[line.category || ''] || ''
                }`}
              >
                <td className="px-3 py-1 text-slate-600 select-none align-top">{line.lineNumber}</td>
                <td className="px-3 py-1 align-top">
                  {line.category && (
                    <span className={`${CATEGORY_COLORS[line.category] || 'text-slate-500'}`}>
                      {line.category}
                    </span>
                  )}
                </td>
                <td className={`px-3 py-1 whitespace-pre-wrap break-all ${
                  CATEGORY_COLORS[line.category || ''] || 'text-slate-300'
                }`}>
                  {highlightSearchTerm(line.content)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {lines.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-500">
            {debouncedSearch || category !== 'all'
              ? 'No log lines match your filters'
              : 'No raw log data stored for this device. Re-upload the log file to populate.'}
          </div>
        )}
      </div>

      {/* Load more */}
      {lines.length < total && (
        <div className="text-center mt-4">
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
          >
            {loading ? 'Loading...' : `Load More (${total - lines.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
