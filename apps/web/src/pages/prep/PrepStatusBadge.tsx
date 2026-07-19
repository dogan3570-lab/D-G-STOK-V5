// ==================== DURUM GOSTERGESI V6.0 ====================
// Her adim icin ✅ / ❌ / ⚠️ badge + [Düzenle] butonu
import React from 'react';
import type { StatusType } from './types';

interface PrepStatusBadgeProps {
  icon: string;
  status: StatusType;
  label: string;
  detail?: string;
  onEdit: () => void;
}

const STYLES: Record<StatusType, string> = {
  completed:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  ready:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  missing:    'text-red-400 bg-red-500/10 border-red-500/20',
  review:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  no_template: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const ICONS: Record<StatusType, string> = {
  completed:   '✅',
  ready:       '✅',
  missing:     '❌',
  review:      '⚠️',
  no_template: '❌',
};

export default function PrepStatusBadge({ icon, status, label, detail, onEdit }: PrepStatusBadgeProps) {
  return (
    <div className={`rounded-lg border p-2.5 ${STYLES[status]} backdrop-blur-sm`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <span>{icon}</span> {label}
        </span>
        <span className="text-xs font-medium">{ICONS[status]} {detail || statusLabel(status)}</span>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="w-full rounded-md px-2.5 py-1.5 text-xs font-medium transition-all
          bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white
          border border-white/5 hover:border-white/10"
      >
        Düzenle
      </button>
    </div>
  );
}

function statusLabel(status: StatusType): string {
  switch (status) {
    case 'completed': return 'Tamamlandı';
    case 'ready':     return 'Hazır';
    case 'missing':   return 'Eksik';
    case 'review':    return 'İncelenecek';
    case 'no_template': return 'Şablon Yok';
  }
}
