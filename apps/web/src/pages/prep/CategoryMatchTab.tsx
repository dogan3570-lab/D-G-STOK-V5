// ==================== KATEGORI ESLESTIRME V2.0 ====================
// Otomatik analiz, sadece eslesmeyenleri goster, Pazaryeri kategori agaci
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';

interface PrepStats {
  totalProducts: number; autoMatched: number; manualPending: number;
  errorCount: number; completionPercent: number;
}

interface ProductItem {
  id: string; title: string | null; xmlKey: string;
  supplierCategory: string | null; category?: { id: string; name: string } | null;
  categoryId: string | null; categoryMatch: boolean;
  aiScore: number | null; status: string;
  sku: string | null; barcode: string | null; images: string | null;
}

interface SystemCategory { id: string; name: string; parentId: string | null; children: SystemCategory[]; }

interface Marketplace { id: string; key: string; name: string; }

export default function CategoryMatchTab() {
  const [stats, setStats] = useState<PrepStats | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [activeMpId, setActiveMpId] = useState('');
  const [systemTree, setSystemTree] = useState<SystemCategory[]>([]);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [catSearch, setCatSearch] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const activeMp = useMemo(() => marketplaces.find(m => m.id === activeMpId), [marketplaces, activeMpId]);

  const fetchStats = useCallback(async () => {
    const res = await apiFetch<any>('/categories/stats');
    if (res.ok && res.data) {
      const d = res.data;
      setStats({
        totalProducts: d.totalXmlCategories || 0,
        autoMatched: d.matchedCategories || 0,
        manualPending: d.unmatchedProducts || 0,
        errorCount: d.errorCategories || 0,
        completionPercent: d.totalXmlCategories > 0
          ? Math.round(((d.matchedCategories || 0) / (d.totalXmlCategories || 1)) * 100)
          : 0,
      });
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), uncategorized: 'true' });
      const res = await apiFetch<{ items: ProductItem[]; pagination: { total: number } }>(`/categories/products?${params}`);
      if (res.ok && res.data) {
        setProducts(res.data.items || []);
        setTotal(res.data.pagination?.total || 0);
      }
    } finally { setLoading(false); }
  }, [page, pageSize]);

  const fetchMarketplaces = useCallback(async () => {
    const res = await apiFetch<{ items: Marketplace[] }>('/marketplaces');
    if (res.ok && res.data?.items) {
      setMarketplaces(res.data.items);
      if (res.data.items.length > 0 && !activeMpId) setActiveMpId(res.data.items[0].id);
    }
  }, [activeMpId]);

  const fetchTree = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeMpId) params.append('marketplaceId', activeMpId);
    const res = await apiFetch<{ items: SystemCategory[] }>(`/categories/tree?${params}`);
    if (res.ok && res.data) setSystemTree(res.data.items || []);
  }, [activeMpId]);

  useEffect(() => { fetchStats(); fetchMarketplaces(); }, []);
  useEffect(() => { fetchTree(); }, [activeMpId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMatch = async (ids: string[], categoryId: string) => {
    const res = await apiFetch<any>('/categories/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, productIds: ids }),
    });
    if (res.ok) {
      showToast('success', `✅ ${ids.length} ürün eşleştirildi`);
      setSelectedIds(new Set());
      setSelectedCatId('');
      fetchData(); fetchStats();
    } else showToast('error', res.error?.message || 'Eşleştirme başarısız');
  };

  const handleAiMatch = async () => {
    setAiRunning(true);
    try {
      const res = await apiFetch<any>('/categories/ai-match', { method: 'POST', body: JSON.stringify({}) });
      if (res.ok) showToast('success', `🤖 ${res.data?.matchedCount || 0} ürün eşleştirildi`);
      fetchData(); fetchStats();
    } finally { setAiRunning(false); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === products.length ? new Set() : new Set(products.map(p => p.id)));
  };

  const toggleCatExpand = (id: string) => {
    setExpandedCats(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const filteredTree = useMemo(() => {
    if (!catSearch) return systemTree;
    const filter = (nodes: SystemCategory[]): SystemCategory[] =>
      nodes.filter(c => {
        const match = c.name.toLowerCase().includes(catSearch.toLowerCase());
        const children = filter(c.children || []);
        return match || children.length > 0;
      }).map(c => ({ ...c, children: filter(c.children || []) }));
    return filter(systemTree);
  }, [systemTree, catSearch]);

  const renderTree = (nodes: SystemCategory[], depth = 0): React.ReactNode =>
    nodes.map(cat => {
      const hasChildren = cat.children?.length > 0;
      const expanded = expandedCats.has(cat.id);
      return (
        <div key={cat.id}>
          <button type="button" onClick={() => setSelectedCatId(cat.id)}
            className={`w-full flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors text-left ${
              selectedCatId === cat.id ? 'bg-blue-600/30 text-blue-200 font-medium' : 'hover:bg-slate-600/50 text-slate-300'
            }`} style={{ paddingLeft: `${6 + depth * 14}px` }}>
            {hasChildren ? (
              <span role="button" tabIndex={-1} onClick={e => { e.stopPropagation(); toggleCatExpand(cat.id); }}
                className="w-3.5 text-center text-slate-500 hover:text-white shrink-0">{expanded ? '▼' : '▶'}</span>
            ) : <span className="w-3.5 text-slate-600 shrink-0">•</span>}
            <span className="truncate flex-1">{cat.name}</span>
          </button>
          {hasChildren && expanded && renderTree(cat.children, depth + 1)}
        </div>
      );
    }, [expandedCats, selectedCatId, toggleCatExpand]);

  return (
    <div className="space-y-4">
      {/* Ust bilgi kartlari */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard title="Toplam Ürün" value={(stats.totalProducts ?? 0).toLocaleString('tr-TR')} color="blue" />
          <KpiCard title="Otomatik Eşleşen" value={(stats.autoMatched ?? 0).toLocaleString('tr-TR')} color="green" />
          <KpiCard title="Manuel Bekleyen" value={(stats.manualPending ?? 0).toLocaleString('tr-TR')} color="yellow" />
          <KpiCard title="Hatalı" value={(stats.errorCount ?? 0).toLocaleString('tr-TR')} color="red" />
          <KpiCard title="Tamamlanan %" value={`%${stats.completionPercent ?? 0}`} color="purple" />
        </div>
      )}

      {/* Pazaryeri secici + AI butonu */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-2.5 backdrop-blur-sm">
        <div className="flex gap-1 flex-wrap">
          {marketplaces.map(mp => (
            <button key={mp.id} onClick={() => setActiveMpId(mp.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeMpId === mp.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}>{mp.name}</button>
          ))}
        </div>
        <button onClick={handleAiMatch} disabled={aiRunning}
          className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50">
          {aiRunning ? '⏳' : '🤖'} AI ile Eşleştir
        </button>
      </div>

      {/* Urun listesi + Kategori paneli */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* SOL: Urun tablosu */}
        <div className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50 sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-700/50 px-3 py-3 w-10">
                    <input type="checkbox" checked={products.length > 0 && selectedIds.size === products.length}
                      onChange={toggleSelectAll} className="rounded border-slate-600 bg-slate-700 text-blue-600" />
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 min-w-[180px]">Ürün</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 min-w-[160px]">XML Kategorisi</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 min-w-[200px]">
                    {activeMp?.name || 'Pazaryeri'} Kategori Ağacı
                  </th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 min-w-[60px]">AI Güven</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-400 min-w-[60px]">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Yükleniyor...</td></tr>
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
                    <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[150px] truncate" title={p.supplierCategory || ''}>
                      {p.supplierCategory || '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      {p.categoryId ? (
                        <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded truncate inline-block max-w-[180px]" title={p.category?.name || ''}>
                          {p.category?.name || '✅ Eşleşmiş'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {p.aiScore != null ? (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          p.aiScore >= 0.85 ? 'bg-green-500/10 text-green-400' :
                          p.aiScore >= 0.70 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                        }`}>%{Math.round(p.aiScore * 100)}</span>
                      ) : <span className="text-[10px] text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[10px]">
                      <span className={`font-medium ${p.categoryMatch ? 'text-green-400' : 'text-yellow-400'}`}>
                        {p.categoryMatch ? '✅ Eşleşti' : '⏳ Bekliyor'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SAG: Kategori paneli */}
        <div className="w-full lg:w-72 shrink-0 rounded-xl border border-slate-700 bg-slate-800/50 flex flex-col max-h-[500px]">
          <div className="p-3 border-b border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-300">{activeMp?.name || 'Pazaryeri'} Kategorileri</h3>
              {selectedCatId && (
                <button onClick={() => setSelectedCatId('')} className="text-[10px] text-slate-500 hover:text-white">✕</button>
              )}
            </div>
            <input type="text" value={catSearch} onChange={e => setCatSearch(e.target.value)}
              placeholder="Kategori ara..." className="w-full rounded-lg border border-slate-600 bg-slate-700 pl-2.5 pr-2.5 py-1.5 text-xs text-white placeholder-slate-400" />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {renderTree(filteredTree)}
            {filteredTree.length === 0 && catSearch && (
              <div className="text-[10px] text-slate-500 text-center py-4">Kategori bulunamadı</div>
            )}
          </div>
          {selectedCatId && (
            <div className="p-3 border-t border-slate-700 bg-slate-800/80">
              <button onClick={() => { if (selectedIds.size > 0) handleMatch(Array.from(selectedIds), selectedCatId); }}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
                🔗 {selectedIds.size > 0 ? `${selectedIds.size} Ürünü Eşleştir` : 'Kategori Seçili'}
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
  };
  return (
    <div className={`rounded-xl border p-3 backdrop-blur-sm ${colorMap[color] || colorMap.blue}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{title}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}
