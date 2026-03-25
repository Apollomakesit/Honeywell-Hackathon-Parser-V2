'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ContextViewerProps {
  lines: string;
}

export default function ContextViewer({ lines }: ContextViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        View Context
      </button>
      {open && (
        <div className="mt-2 font-mono text-xs bg-slate-950 p-3 rounded-lg border-l-2 border-red-500 overflow-x-auto">
          <pre className="text-slate-400 whitespace-pre-wrap break-all">{lines}</pre>
        </div>
      )}
    </div>
  );
}
