// ==================== UST OZET KARTLARI V6.0 ====================
// 5 KPI kartı: Toplam | Hazır | Eksik | İncelenecek | Gönderime Hazır
import React from 'react';
import KpiCard from '../../components/ui/KpiCard';
import type { PrepStats } from './types';

interface PrepSummaryProps {
  stats: PrepStats | null;
  loading: boolean;
}

export default function PrepSummary({ stats, loading }: PrepSummaryProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="animate-pulse rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <div className="h-3 w-20 bg-slate-700 rounded mb-2" />
            <div className="h-6 w-12 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-5 gap-3">
      <KpiCard
        title="Toplam Ürün"
        value={stats.total.toLocaleString('tr-TR')}
        icon="📦"
        color="blue"
      />
      <KpiCard
        title="Hazır"
        value={stats.ready.toLocaleString('tr-TR')}
        icon="✅"
        color="green"
      />
      <KpiCard
        title="Eksik"
        value={stats.missing.toLocaleString('tr-TR')}
        icon="❌"
        color="red"
      />
      <KpiCard
        title="İncelenecek"
        value={stats.review.toLocaleString('tr-TR')}
        icon="⚠️"
        color="yellow"
      />
      <KpiCard
        title="Gönderime Hazır"
        value={stats.dispatchReady.toLocaleString('tr-TR')}
        icon="🚀"
        color="cyan"
      />
    </div>
  );
}
