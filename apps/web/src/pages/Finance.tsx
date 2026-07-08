import React, { useEffect, useState } from 'react';

interface FinanceItem {
  id: string;
  type: string;
  amount: number;
  profit: number | null;
  commission: number | null;
  vat: number | null;
  description: string | null;
  date: string;
}

interface FinanceSummary {
  type: string;
  _sum: { amount: number | null; profit: number | null; commission: number | null; vat: number | null };
}

export default function Finance() {
  const [items, setItems] = useState<FinanceItem[]>([]);
  const [summary, setSummary] = useState<FinanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => { fetchFinance(); }, [typeFilter]);

  async function fetchFinance() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      const response = await fetch(`/finance?${params}`, { credentials: 'include' });
      const data = await response.json();
      setItems(data.items || []);
      setSummary(data.summary || []);
    } catch (error) {
      console.error('Error fetching finance:', error);
    } finally {
      setLoading(false);
    }
  }

  const typeLabels: Record<string, string> = {
    sale: 'Satış',
    expense: 'Gider',
    refund: 'İade',
    commission: 'Komisyon',
    cargo: 'Kargo',
    other: 'Diğer',
  };

  const typeColors: Record<string, string> = {
    sale: 'text-green-400',
    expense: 'text-red-400',
    refund: 'text-orange-400',
    commission: 'text-yellow-400',
    cargo: 'text-blue-400',
    other: 'text-slate-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Finans</h2>
          <p className="text-sm text-slate-400">Gelir-gider takibi ve finansal raporlar</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          {summary.map((s) => (
            <div key={s.type} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
              <div className="text-sm text-slate-400">{typeLabels[s.type] || s.type}</div>
              <div className={`text-2xl font-bold ${typeColors[s.type] || 'text-white'}`}>
                ₺{(s._sum.amount || 0).toFixed(2)}
              </div>
              {s._sum.profit !== null && (
                <div className="text-xs text-slate-500 mt-1">Kar: ₺{s._sum.profit.toFixed(2)}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {['', 'sale', 'expense', 'refund', 'commission', 'cargo', 'other'].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              typeFilter === t ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}>
            {t ? typeLabels[t] || t : 'Tümü'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">💰</div>
            <div>Finans kaydı bulunamadı</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Tür</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Tutar</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Kar</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Komisyon</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">KDV</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Açıklama</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {items.map((item) => (
                  <tr key={item.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`font-medium ${typeColors[item.type] || 'text-white'}`}>
                        {typeLabels[item.type] || item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-white">₺{item.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{item.profit !== null ? `₺${item.profit.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{item.commission !== null ? `₺${item.commission.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{item.vat !== null ? `₺${item.vat.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{item.description || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{new Date(item.date).toLocaleDateString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
