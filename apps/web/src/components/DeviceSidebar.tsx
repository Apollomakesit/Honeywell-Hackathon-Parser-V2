'use client';

import { Upload, AlertTriangle, AlertCircle } from 'lucide-react';

interface DeviceEntry {
  id: string;
  serialNumber: string;
  firmwareVersion: string | null;
  firstSeen: string;
  lastSeen: string;
  operators: string[];
  criticalCount: number;
  warningCount: number;
  logImports: { logStartTime: string; logStopTime: string }[];
}

interface DeviceSidebarProps {
  devices: DeviceEntry[];
  selected: string | null;
  onSelect: (serial: string) => void;
  onUploadClick: () => void;
}

export default function DeviceSidebar({ devices, selected, onSelect, onUploadClick }: DeviceSidebarProps) {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-700/50 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-slate-700/50">
        <button
          onClick={onUploadClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          <Upload className="w-4 h-4" /> Upload More
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {devices.map((d) => {
          const isSelected = d.serialNumber === selected;
          const li = d.logImports[0];
          const startStr = li ? new Date(li.logStartTime).toLocaleDateString() : '';
          const stopStr = li ? new Date(li.logStopTime).toLocaleDateString() : '';
          const timeframe = startStr === stopStr ? startStr : `${startStr} – ${stopStr}`;

          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.serialNumber)}
              className={`w-full text-left p-3 border-b border-slate-800 transition-colors ${
                isSelected
                  ? 'border-l-2 border-l-blue-500 bg-slate-800/50'
                  : 'border-l-2 border-l-transparent hover:bg-slate-800/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100 text-sm">{d.serialNumber}</span>
                <div className="flex gap-1">
                  {d.criticalCount > 0 && (
                    <span className="flex items-center gap-0.5 bg-red-500/20 text-red-400 text-xs font-medium px-1.5 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                      {d.criticalCount}
                    </span>
                  )}
                  {d.warningCount > 0 && (
                    <span className="flex items-center gap-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium px-1.5 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      {d.warningCount}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                {d.firmwareVersion ? d.firmwareVersion.split('_').slice(-1)[0] : '—'}
              </div>
              <div className="text-xs text-slate-500 truncate">{timeframe}</div>
              {d.operators.length > 0 && (
                <div className="text-xs text-slate-400 mt-1 truncate">
                  {d.operators.length} operator{d.operators.length > 1 ? 's' : ''}: {d.operators.join(', ')}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
