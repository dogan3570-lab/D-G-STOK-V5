// ==================== MARKA ESLESTIRME V3.0 ====================
// Kategori mantiginda: KPI + urun tablosu + marka paneli
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';

interface BrandStats {
  totalSystemBrands: number; matchedProducts: number; unmatchedProducts: number;
  totalMappings: number; totalLogs: number; xmlBrandUsage: number; dgBrandUsage: number; prefixEnabledCount: number;
}

interface ProductItem {
  id: string; title: string | null; xmlKey: string;
  brand?: { id: string; name: string } | null;
  brandId: string | null; brandMatch: boolean;
  sku: string | null; barcode: string | null; stock: number;
  salePrice: number | null; purchasePrice: number | null;
  images: string | null; status: string;
  category?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string } | null;
  updatedAt: string;
}

interface BrandItem { id: string; name: string; prefixEnabled: boolean; prefixFormat: string; productCount: number; }
interface XmlBrand { name: string; sourceName: string; }

const PAGE_SIZES = [50, 100, 200, 500];

export default function BrandMatchTab() {
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');

  // Brand matching state
  const [systemBrands, setSystemBrands] = useState<BrandItem[]>([]);
  const [xmlBrands, setXmlBrands] = useState<XmlBrand[]>([]);
  const [selectedXmlBrand, setSelectedXmlBrand] = useState<string | null>(null);
  const [selectedDgBrandId, setSelectedDgBrandId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiRunning, setAiRunning] = useState(false);

  const fetchStats = useCallback(async () => {
    const res = await apiFetch<any>('/brands/stats');
    if (res.ok && res.data) setStats(res.data);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), unbranded: 'true' });
      if (search) params.append('search', search);
      const res = await apiFetch<{ items: ProductItem[]; pagination: { total: number } }>(`/brands/products?${params}`);
      if (res.ok && res.data) {
        setProducts(res.data.items || []);
        setTotal(res.data.pagination?.total || 0);
      }
    } finally { setLoading(false); }
  }, [page, pageSize, search]);

  const fetchBrandData = useCallback(async () => {
    const [sysRes, xmlRes] = await Promise.all([
      apiFetch<{ items: BrandItem[] }>('/brands'),
      apiFetch<{ items: XmlBrand[] }>('/brands/xml-brands'),
    ]);
    if (sysRes.ok && sysRes.data) setSystemBrands(sysRes.data.items || []);
    if (xmlRes.ok && xmlRes.data) setXmlBrands(xmlRes.data.items || []);
  }, []);

  useEffect(() => { fetchStats(); fetchBrandData(); }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === products.length ? new Set() : new Set(products.map(p => p.id)));
  };

  const handleMatch = async () => {
    if (selectedIds.size === 0 || !selectedDgBrandId) {
      showToast('warning', 'Ürün ve marka seçin');
      return;
    }
    const res = await apiFetch<any>('/brands/match', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: Array.from(selectedIds), dgBrandId: selectedDgBrandId }),
    });
    if (res.ok) {
      showToast('success', `✅ ${selectedIds.size} ürün eşleştirildi`);
      setSelectedIds(new Set());
      setSelectedDgBrandId('');
      fetchData(); fetchStats();
    } else showToast('error', res.error?.message || 'Eşleştirme başarısız');
  };

  const handleAiMatch = async () => {
    setAiRunning(true);
    try {
      const res = await apiFetch<any>('/brands/ai-match', { method: 'POST', body: JSON.stringify({}) });
      if (res.ok) showToast('success', `🤖 ${res.data?.matchedCount || 0} ürün eşleştirildi`);
      fetchData(); fetchStats();
    } finally { setAiRunning(false); }
  };

  const allSelected = products.length > 0 && selectedIds.size === products.length;

  return (
    <div className="space-y-4">
      {/* KPI kartlari */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard title="Sistem Markası" value={(stats.totalSystemBrands ?? 0).toLocaleString('tr-TR')} color="blue" />
          <KpiCard title="Eşleşen Ürün" value={(stats.matchedProducts ?? 0).toLocaleString('tr-TR')} color="green" />
          <KpiCard title="Eşleşmeyen" value={(stats.unmatchedProducts ?? 0).toLocaleString('tr-TR')} color="yellow" />
          <KpiCard title="XML Kullanım" value={(stats.xmlBrandUsage ?? 0).toLocaleString('tr-TR')} color="purple" />
          <KpiCard title="DG Kullanım" value={(stats.dgBrandUsage ?? 0).toLocaleString('tr-TR')} color="cyan" />
        </div>
      )}

      {/* AI + aksiyon bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Ürün ara..." className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white placeholder-slate-400 w-56" />
          <div className="flex gap-1">
            {PAGE_SIZES.map(s => (
              <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
                className={`rounded px-2.5 py-1.5 text-xs font-medium ${pageSize === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{s}</button>
            ))}
          </div>
        </div>
        <button onClick={handleAiMatch} disabled={aiRunning}
          className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
          {aiRunning ? '⏳' : '🤖'} AI ile Eşleştir
        </button>
      </div>

      {/* Urun tablosu + Marka paneli */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* SOL: Urun tablosu */}
        <div className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-700/50 sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-700/50 px-3 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                      className="rounded border-slate-600 bg-slate-700 text-blue-600" />
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 min-w-[180px]">Ürün</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 min-w-[120px]">XML Marka</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 min-w-[120px]">Eşleşen Marka</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 min-w-[60px]">Stok</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 min-w-[80px]">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      Yükleniyor...
                    </div>
                  </td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-500">
                    <div className="text-4xl mb-2">✅</div>
                    <div className="text-sm font-medium text-slate-400">Tüm ürünler eşleştirilmiş</div>
                  </td></tr>
                ) : products.map(p => (
                  <tr key={p.id} className={`transition-colors ${selectedIds.has(p.id) ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'}`}>
                    <td className="sticky left-0 z-10 bg-slate-800/30 px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                        className="rounded border-slate-600 bg-slate-700 text-blue-600" />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-xs font-medium text-white truncate max-w-[170px]" title={p.title || p.xmlKey}>{p.title || p.xmlKey}</div>
                      <div className="text-[10px] text-slate-500">{p.sku || p.xmlKey}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{p.brand?.name || '-'}</td>
                    <td className="px-3 py-2.5">
                      {p.brandId && p.brandMatch ? (
                        <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">{p.brand?.name || '✅ Eşleşmiş'}</span>
                      ) : (
                        <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <span className={p.stock > 0 ? 'text-green-400' : 'text-red-400'}>{p.stock}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[10px]">
                      <span className={`font-medium ${p.brandMatch ? 'text-green-400' : 'text-yellow-400'}`}>
                        {p.brandMatch ? '✅ Eşleşti' : '⏳ Bekliyor'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SAG: Marka paneli */}
        <div className="w-full lg:w-72 shrink-0 rounded-xl border border-slate-700 bg-slate-800/50 flex flex-col max-h-[500px]">
          <div className="p-3 border-b border-slate-700">
            <h3 className="text-xs font-semibold text-slate-300 mb-2">🏷️ Marka Eşleştir</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {/* XML Markalari */}
            <div>
              <label className="text-[10px] text-slate-400 mb-1 block">XML Markası Seç</label>
              <div className="max-h-28 overflow-y-auto space-y-0.5 border border-slate-700 rounded-lg p-1">
                {xmlBrands.map(b => (
                  <button key={b.name} onClick={() => setSelectedXmlBrand(b.name)}
                    className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${
                      selectedXmlBrand === b.name ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-700/50'
                    }`}>
                    {b.name} <span className="text-[10px] text-slate-500">{b.sourceName}</span>
                  </button>
                ))}
                {xmlBrands.length === 0 && <div className="text-[10px] text-slate-500 text-center py-2">XML markası yok</div>}
              </div>
            </div>
            {/* DG Marka Secimi */}
            <div>
              <label className="text-[10px] text-slate-400 mb-1 block">DG STOK Markası</label>
              <select value={selectedDgBrandId} onChange={e => setSelectedDgBrandId(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white">
                <option value="">Marka seç...</option>
                {systemBrands.map(b => <option key={b.id} value={b.id}>{b.name} ({b.productCount})</option>)}
              </select>
            </div>
          </div>
          {selectedDgBrandId && (
            <div className="p-3 border-t border-slate-700 bg-slate-800/80">
              <button onClick={handleMatch} disabled={selectedIds.size === 0}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                🔗 {selectedIds.size > 0 ? `${selectedIds.size} Ürünü Eşleştir` : 'Önce ürün seçin'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sayfalama */}
      {total > pageSize && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/50">
          <span className="text-xs text-slate-500">Toplam {total} ürün</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="rounded px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">◀</button>
            <span className="px-3 py-1 text-xs text-slate-400">Sayfa {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}
              className="rounded px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">▶</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    green: 'border-green-500/20 bg-green-500/5 text-green-400',
    yellow: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-400',
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400',
    cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
  };
  return (
    <div className={`rounded-xl border p-3 backdrop-blur-sm ${colorMap[color] || colorMap.blue}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{title}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}
