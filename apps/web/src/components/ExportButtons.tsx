'use client';

import { useState } from 'react';
import { generatePDF } from '@/lib/pdfExport';

interface ExportButtonsProps {
  serial: string;
}

export default function ExportButtons({ serial }: ExportButtonsProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      await generatePDF(serial);
    } catch (e) {
      console.error('PDF generation failed', e);
    } finally {
      setPdfLoading(false);
    }
  };

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
      <button
        onClick={handlePDF}
        disabled={pdfLoading}
        className="px-3 py-1.5 bg-red-900/30 hover:bg-red-800/40 border border-red-700/40 rounded-lg text-xs font-medium text-red-300 transition-colors disabled:opacity-50"
      >
        {pdfLoading ? 'Generating…' : 'Export PDF'}
      </button>
    </div>
  );
}
