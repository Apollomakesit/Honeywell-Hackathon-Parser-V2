'use client';

import { Info } from 'lucide-react';
import ContextViewer from './ContextViewer';

interface AnomalyData {
  id: string;
  family: string;
  severity: string;
  title: string;
  description: string | null;
  tooltip: string | null;
  serverTime: string;
  offendingValue: string | null;
  thresholdValue: string | null;
  triggerLines: string;
}

interface AnomalyCardProps {
  anomaly: AnomalyData;
}

export default function AnomalyCard({ anomaly }: AnomalyCardProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 mb-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          anomaly.severity === 'CRITICAL'
            ? 'bg-red-500/20 text-red-400'
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          {anomaly.severity}
        </span>
        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
          {anomaly.family}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {new Date(anomaly.serverTime).toLocaleString()}
        </span>
      </div>

      <h4 className="font-medium text-slate-100 mt-2">{anomaly.title}</h4>

      {anomaly.description && (
        <p className="text-sm text-slate-400 mt-1">
          {anomaly.offendingValue && (
            <>
              Offending value: <span className="text-red-400 font-mono font-semibold">{anomaly.offendingValue}</span>
              {anomaly.thresholdValue && (
                <span className="text-slate-500"> (threshold: {anomaly.thresholdValue})</span>
              )}
              {' — '}
            </>
          )}
          {anomaly.description}
        </p>
      )}

      {anomaly.tooltip && (
        <div className="group relative inline-flex items-center gap-1 mt-2 cursor-help">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-500">Info</span>
          <div className="absolute bottom-full left-0 mb-2 w-72 p-2 bg-slate-900 border border-slate-600 rounded-lg text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
            {anomaly.tooltip}
          </div>
        </div>
      )}

      <ContextViewer lines={`Line(s): ${anomaly.triggerLines}`} />
    </div>
  );
}
