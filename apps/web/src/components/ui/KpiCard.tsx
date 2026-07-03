import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const colorClasses = {
  blue: 'border-blue-500/20 bg-blue-500/10',
  green: 'border-green-500/20 bg-green-500/10',
  yellow: 'border-yellow-500/20 bg-yellow-500/10',
  red: 'border-red-500/20 bg-red-500/10',
  purple: 'border-purple-500/20 bg-purple-500/10',
};

const iconBgClasses = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  yellow: 'bg-yellow-600',
  red: 'bg-red-600',
  purple: 'bg-purple-600',
};

export default function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'blue',
}: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]} backdrop-blur-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm text-slate-400">{title}</div>
          <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
        </div>
        {icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBgClasses[color]}`}>
            <span className="text-lg">{icon}</span>
          </div>
        )}
      </div>
      {trend && trendValue && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span
            className={`flex items-center gap-1 font-medium ${
              trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'
            }`}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
          <span className="text-slate-500">geçen aya göre</span>
        </div>
      )}
    </div>
  );
}
