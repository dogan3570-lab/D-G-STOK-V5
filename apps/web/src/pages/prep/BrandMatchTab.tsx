// ==================== MARKA ESLESTIRME V4.0 ====================
// Hizli toplu eslestirme + aktivite logu
import React, { useEffect, useState, useCallback } from 'react';
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
interface ActivityLog {
  id: string; action: string; xmlBrandName?: string; dgBrandName?: string;
  productCount: number; details?: string; createdAt: string;
}

const PAGE_SIZES = [50, 100, 200, 500];

export default function BrandMatchTab() {
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');

  // Brand matching
  const [systemBrands, setSystemBrands] = useState<BrandItem[]>([]);
  const [xmlBrands, setXmlBrands] = useState<XmlBrand[]>([]);
  const [selectedDgBrandId, setSelectedDgBrandId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [aiRunning, setAiRunning] = useState(false);
  const [matchAllTarget, setMatchAllTarget] = useState<string>('');

  // Activity log
  const [activities, setActivities] = useState<ActivityLog[]>([]);

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

  const fetchActivities = useCallback(async () => {
    const res = await apiFetch<{ items: ActivityLog[] }>('/brands/logs?limit=10');
    if (res.ok && res.data) setActivities(res.data.items || []);
  }, []);

  useEffect(() => { fetchStats(); fetchBrandData(); fetchActivities(); }, []);
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
      method: 'POST',
      body: JSON.stringify({ productIds: Array.from(selectedIds), dgBrandId: selectedDgBrandId, xmlBrandName: 'manual_batch' }),
    });
    if (res.ok) {
      showToast('success', `✅ ${selectedIds.size} ürün eşleştirildi`);
      setSelectedIds(new Set()); setSelectedDgBrandId('');
      fetchData(); fetchStats(); fetchActivities();
    } else showToast('error', res.error?.message || 'Eşleştirme başarısız');
  };

  const handleMatchAll = async () => {
    if (!selectedDgBrandId) { showToast('warning', 'Lütfen bir DG STOK markası seçin'); return; }
    setAiRunning(true);
    try {
      showToast('info', '⏳ Tüm ürünler eşleştiriliyor...');
      const res = await apiFetch<any>('/brands/match', {
        method: 'POST',
        body: JSON.stringify({ dgBrandId: selectedDgBrandId, xmlBrandName: 'bulk_all' }),
      });
      if (res.ok) {
        showToast('success', `✅ ${res.data?.matchedCount || 0} ürün toplu eşleştirildi`);
        setSelectedIds(new Set()); setSelectedDgBrandId('');
        fetchData(); fetchStats(); fetchActivities();
      } else showToast('error', res.error?.message || 'Toplu eşleştirme başarısız');
    } finally { setAiRunning(false); }
  };

  const handleAiMatch = async () => {
    setAiRunning(true);
    try {
      showToast('info', '🤖 AI eşleştirme başlıyor...');
      const res = await apiFetch<any>('/brands/ai-match', { method: 'POST', body: JSON.stringify({}) });
      if (res.ok) {
        showToast('success', `🤖 ${res.data?.matchedCount || 0} ürün AI ile eşleştirildi`);
        fetchData(); fetchStats(); fetchActivities();
      }
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
          <span className="text-xs text-slate-500">{total} ürün</span>
        </div>
        <div className="flex gap-2">
          <select value={matchAllTarget} onChange={e => setMatchAllTarget(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white w-40">
            <option value="">Toplu marka seç...</option>
            {systemBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={() => { if (!matchAllTarget) { showToast('warning', 'Marka seçin'); return; } setSelectedDgBrandId(matchAllTarget); handleMatchAll(); }}
            disabled={aiRunning || !matchAllTarget}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
            📋 Tümünü Seç ve Eşleştir
          </button>
          <button onClick={handleAiMatch} disabled={aiRunning}
            className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
            {aiRunning ? '⏳' : '🤖'} AI ile Eşleştir
          </button>
        </div>
      </div>

      {/* Seçim toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-blue-900/20 border border-blue-700/30">
          <span className="text-sm text-blue-300 font-medium">{selectedIds.size} ürün seçili</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds(new Set())}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600">✕ Seçimi Temizle</button>
            <select value={selectedDgBrandId} onChange={e => setSelectedDgBrandId(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white">
              <option value="">Marka seç...</option>
              {systemBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button onClick={handleMatch} disabled={!selectedDgBrandId}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              🔗 Seçilenleri Eşleştir
            </button>
          </div>
        </div>
      )}

      {/* Urun tablosu */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 480px)' }}>
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
                      <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">{p.brand?.name || '✅'}</span>
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
        {/* Sayfalama */}
        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700 bg-slate-800/60">
            <span className="text-xs text-slate-500">Sayfa {page}/{Math.ceil(total / pageSize)} · {total} ürün</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="rounded px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">◀</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}
                className="rounded px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">▶</button>
            </div>
          </div>
        )}
      </div>

      {/* AKTIVITE LOGU */}
      {activities.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-3">
          <h3 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <span>📋</span> Son Eşleştirme Aktiviteleri
          </h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {activities.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-700/20 rounded px-2 py-1">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  a.action === 'BRAND_MATCH' ? 'bg-green-500/10 text-green-400' :
                  a.action === 'AI_MATCH' ? 'bg-purple-500/10 text-purple-400' :
                  a.action === 'BULK_CHANGE' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-slate-500/10 text-slate-400'
                }`}>{a.action}</span>
                {a.dgBrandName && <span className="text-white">{a.dgBrandName}</span>}
                {a.xmlBrandName && <span className="text-slate-500">← {a.xmlBrandName}</span>}
                <span className="text-slate-600">{a.productCount} ürün</span>
                <span className="text-slate-600 ml-auto">{new Date(a.createdAt).toLocaleTimeString('tr-TR')}</span>
              </div>
            ))}
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
