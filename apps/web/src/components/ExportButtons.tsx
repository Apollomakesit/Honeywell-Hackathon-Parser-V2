'use client';

interface ExportButtonsProps {
  serial: string;
}

export default function ExportButtons({ serial }: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <a
        href={`/api/devices/${serial}/export/csv`}
        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-medium text-slate-300 transition-colors"
      >
        Export CSV
      </a>
      <a
        href={`/api/devices/${serial}/export/html`}
        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-medium text-slate-300 transition-colors"
      >
        Export HTML
      </a>
    </div>
  );
}
