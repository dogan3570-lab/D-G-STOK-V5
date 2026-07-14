import React from 'react';

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'cyan' | 'teal' | 'slate' | 'purple';
  loading?: boolean;
}

const COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
  green: 'border-green-500/20 bg-green-500/10 text-green-400',
  red: 'border-red-500/20 bg-red-500/10 text-red-400',
  yellow: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400',
  orange: 'border-orange-500/20 bg-orange-500/10 text-orange-400',
  cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400',
  teal: 'border-teal-500/20 bg-teal-500/10 text-teal-400',
  slate: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  purple: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
};

export default function KpiCard({ title, value, subtitle, icon, color = 'slate', loading = false }: KpiCardProps) {
  const valColor = COLOR_MAP[color] || COLOR_MAP.slate;
  const valClass = valColor.split(' ')[2] || 'text-white';

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <div className="h-3 w-20 bg-slate-700 rounded mb-2" />
        <div className="h-6 w-12 bg-slate-700 rounded" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-3 ${valColor.split(' ').slice(0, 2).join(' ')} backdrop-blur-sm`}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400 truncate">{icon ? `${icon} ${title}` : title}</div>
      </div>
      <div className={`mt-1 text-lg font-semibold ${valClass}`}>
        {typeof value === 'number' ? value.toLocaleString('tr-TR') : value}
      </div>
      {subtitle && <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}
