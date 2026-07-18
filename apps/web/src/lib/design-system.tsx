// ==================== DG STOK V5.0 DESIGN SYSTEM V3 ====================
// Stripe / Power BI / Linear kalitesinde profesyonel ERP UI
// =====================================================================

import React, { useState } from 'react';

// ==================== TYPOGRAPHY ====================

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// ==================== MINI SPARKLINE ====================

export function Sparkline({ data, color = 'emerald', height = 24 }: { data: number[]; color?: string; height?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 60;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * height}`).join(' ');
  const colorMap: Record<string, string> = { emerald: '#34d399', blue: '#60a5fa', violet: '#a78bfa', amber: '#fbbf24', rose: '#fb7185', cyan: '#22d3ee' };
  const stroke = colorMap[color] || '#34d399';
  return (
    <svg width={w} height={height} className="opacity-60">
      <polyline fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

// ==================== KPI CARD V3 ====================

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  sparklineData?: number[];
  color: 'blue' | 'emerald' | 'violet' | 'cyan' | 'amber' | 'rose';
}

const COLOR_MAP = {
  blue: { from: 'from-blue-500/10', to: 'to-blue-600/5', border: 'border-blue-500/20', accent: 'bg-blue-500', text: 'text-blue-400' },
  emerald: { from: 'from-emerald-500/10', to: 'to-emerald-600/5', border: 'border-emerald-500/20', accent: 'bg-emerald-500', text: 'text-emerald-400' },
  violet: { from: 'from-violet-500/10', to: 'to-violet-600/5', border: 'border-violet-500/20', accent: 'bg-violet-500', text: 'text-violet-400' },
  cyan: { from: 'from-cyan-500/10', to: 'to-cyan-600/5', border: 'border-cyan-500/20', accent: 'bg-cyan-500', text: 'text-cyan-400' },
  amber: { from: 'from-amber-500/10', to: 'to-amber-600/5', border: 'border-amber-500/20', accent: 'bg-amber-500', text: 'text-amber-400' },
  rose: { from: 'from-rose-500/10', to: 'to-rose-600/5', border: 'border-rose-500/20', accent: 'bg-rose-500', text: 'text-rose-400' },
};

export function KpiCard({ label, value, icon, trend, sparklineData, color }: KpiCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className={`group relative flex-shrink-0 w-[240px] overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-br ${c.from} ${c.to} p-4 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20`}>
      <div className={`absolute top-0 left-0 w-full h-0.5 ${c.accent} opacity-60`} />
      <div className="flex items-start justify-between mb-1">
        <p className="text-[13px] font-medium text-slate-400 tracking-wide">{label}</p>
        <span className="text-xl opacity-60 transition-transform duration-300 group-hover:scale-110 group-hover:opacity-100">{icon}</span>
      </div>
      <p className={`text-[28px] font-bold tracking-tight ${c.text} mb-1`}>{value}</p>
      <div className="flex items-center justify-between">
        {trend && (
          <div className="flex items-center gap-1">
            <span className={`text-xs font-medium ${trend.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {trend.positive ? '↑' : '↓'} %{Math.abs(trend.value).toFixed(1)}
            </span>
          </div>
        )}
        {sparklineData && <Sparkline data={sparklineData} color={color} />}
      </div>
    </div>
  );
}

// ==================== KPI ROW ====================

export function KpiRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
      {children}
    </div>
  );
}

// ==================== SECTION ====================

export function Section({ children, className, padding = 'p-5' }: { children: React.ReactNode; className?: string; padding?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm ${padding} ${className || ''}`}>
      {children}
    </div>
  );
}

// ==================== FILTERBAR ====================

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/30 px-4 py-2.5 backdrop-blur-sm">
      {children}
    </div>
  );
}

export function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-600/50 bg-slate-700/50 px-2.5 py-1.5 text-xs text-white focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all" />
  );
}

export function ExportBtn({ format, icon, onClick }: { format: string; icon?: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-700/50 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-all">
      {icon && <span>{icon}</span>}{format}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || 'Ara...'}
        className="w-48 rounded-lg border border-slate-600/50 bg-slate-700/50 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all" />
    </div>
  );
}

// ==================== EMPTY STATE ====================

export function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3 opacity-30">{icon}</span>
      <h3 className="text-base font-semibold text-slate-400">{title}</h3>
      <p className="text-sm text-slate-600 max-w-md mt-1">{description}</p>
    </div>
  );
}

// ==================== TABLE ====================

export function Table({ headers, rows, emptyMessage, toolbar }: {
  headers: string[];
  rows: Array<Record<string, any>>;
  emptyMessage?: string;
  toolbar?: React.ReactNode;
}) {
  return (
    <div>
      {toolbar && <div className="flex items-center gap-2 mb-3">{toolbar}</div>}
      {rows.length === 0 ? (
        <EmptyState icon="📋" title="Veri bulunamadı" description={emptyMessage || ''} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/50">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/80">
                {headers.map((h, i) => (
                  <th key={i} className="sticky top-0 px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/80">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {rows.map((row, ri) => (
                <tr key={ri} className="transition-colors duration-150 hover:bg-slate-700/20 even:bg-slate-800/20">
                  {headers.map((h, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-sm text-slate-300">{row[h] ?? '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== ACCORDION MENU ====================

interface AccordionItem {
  id: string; label: string; icon: string; count?: number;
  children: Array<{ id: string; label: string; icon?: string }>;
}

export function AccordionMenu({ items, activeParent, activeChild, onParentChange, onChildChange }: {
  items: AccordionItem[]; activeParent: string; activeChild: string;
  onParentChange: (id: string) => void; onChildChange: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(activeParent);
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => {
        const isExpanded = item.id === expanded;
        const isActive = item.id === activeParent;
        return (
          <div key={item.id} className="relative">
            <button onClick={() => {
              setExpanded(isExpanded ? '' : item.id);
              onParentChange(item.id);
              if (item.children[0]) onChildChange(item.children[0].id);
            }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                isActive ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 border border-transparent'
              }`}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.count != null && <span className="text-[10px] text-slate-500">({item.count})</span>}
            </button>
            {isExpanded && (
              <div className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-slate-700/50 bg-slate-800 p-2 shadow-xl z-50 backdrop-blur-sm">
                {item.children.map(child => (
                  <button key={child.id} onClick={() => { onParentChange(item.id); onChildChange(child.id); }}
                    className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all ${
                      activeChild === child.id && activeParent === item.id ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                    }`}>
                    {child.icon && <span>{child.icon}</span>}
                    <span>{child.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==================== SUMMARY CARD ====================

export function SummaryCard({ label, value, icon, color = 'text-slate-200' }: { label: string; value: string; icon: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-700/20 p-3 border border-slate-700/30">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`text-sm font-semibold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
