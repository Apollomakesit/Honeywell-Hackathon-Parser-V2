'use client';

import { ReactNode } from 'react';

interface StatsCardProps {
  icon: ReactNode;
  value: number | string;
  label: string;
  color: 'blue' | 'emerald' | 'purple' | 'red' | 'amber';
}

const colorMap = {
  blue: 'bg-blue-500/5 border-blue-500/20',
  emerald: 'bg-emerald-500/5 border-emerald-500/20',
  purple: 'bg-purple-500/5 border-purple-500/20',
  red: 'bg-red-500/5 border-red-500/20',
  amber: 'bg-amber-500/5 border-amber-500/20',
};

export default function StatsCard({ icon, value, label, color }: StatsCardProps) {
  return (
    <div className={`border rounded-xl p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-3">
        <div className="text-slate-400">{icon}</div>
        <div>
          <div className="text-2xl font-bold text-slate-100">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}
