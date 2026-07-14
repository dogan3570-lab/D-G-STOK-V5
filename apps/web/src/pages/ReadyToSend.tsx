// ==================== GONDERIME HAZIR V2.0 ====================
// Kaynak bazli, hizli, toplu gonderim
import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/ui/Toast';

interface ReadyItem {
  id: string; title: string | null; xmlKey: string;
  sku: string | null; barcode: string | null; stock: number;
  salePrice: number | null;
  categoryMatch: boolean; brandMatch: boolean; variantMatch: boolean;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string } | null;
  images: string | null; status: string; updatedAt: string;
}
interface Marketplace { id: string; key: string; name: string; }
interface XmlSourceItem { id: string; name: string; count?: number; }

export default function ReadyToSend() {
  const [products, setProducts] = useState<ReadyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [xmlSources, setXmlSources] = useState<XmlSourceItem[]>([]);
  const [selectedMpId, setSelectedMpId] = useState('');
  const [selectedXmlId, setSelectedXmlId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(pageSize), status: 'READY', categoryMatch: 'true', brandMatch: 'true' });
      if (selectedXmlId) p.append('xmlSourceId', selectedXmlId);
      const r = await apiFetch<any>(`/products?${p}`);
      if (r.ok && r.data) { setProducts(r.data.items || []); setTotal(r.data.pagination?.total || 0); }
    } finally { setLoading(false); }
  }, [page, pageSize, selectedXmlId]);

  useEffect(() => {
    const init = async () => {
      const [mpRes, xmlRes] = await Promise.all([
        apiFetch<any>('/marketplaces'),
        apiFetch<any>('/xml-sources'),
      ]);
      if (mpRes.ok && mpRes.data) setMarketplaces(mpRes.data.items || []);
      if (xmlRes.ok && xmlRes.data) setXmlSources(xmlRes.data.items || []);
    };
    init();
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSelect = (id: string) => { setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const toggleSelectAll = () => { setSelectedIds(prev => prev.size === products.length ? new Set() : new Set(products.map(p => p.id))); };
  const allSelected = products.length > 0 && selectedIds.size === products.length;

  const handleSend = async (ids?: string[]) => {
    const targetIds = ids || Array.from(selectedIds);
    if (targetIds.length === 0 || !selectedMpId) { showToast('warning', 'Ürün ve pazaryeri seçin'); return; }
    setSending(true);
    try {
      const r = await apiFetch<any>('/products/prepare', { method: 'POST', body: JSON.stringify({ ids: targetIds, marketplaceId: selectedMpId }) });
      if (r.ok) {
        showToast('success', `✅ ${r.data?.readyCount || 0} ürün gönderildi`);
        setSelectedIds(new Set()); fetchData();
      }
    } finally { setSending(false); }
  };

  const handleSendAll = async () => {
    if (!selectedMpId) { showToast('warning', 'Pazaryeri seçin'); return; }
    setSending(true);
    try {
      showToast('info', '⏳ Tüm ürünler gönderiliyor...');
      const r = await apiFetch<any>('/products/prepare', { method: 'POST', body: JSON.stringify({ marketplaceId: selectedMpId }) });
      if (r.ok) showToast('success', `✅ ${r.data?.readyCount || 0} ürün gönderildi`);
      fetchData();
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi title="Gönderime Hazır" val={total} c="green" />
        <Kpi title="Seçili" val={selectedIds.size} c="purple" />
        <Kpi title="Pazaryeri" val={marketplaces.length} c="slate" />
        <Kpi title="XML Kaynak" val={xmlSources.length} c="blue" />
      </div>

      {/* Ust Panel */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-3">
        <div className="flex gap-1 flex-wrap">
          {marketplaces.map(mp => (
            <button key={mp.id} onClick={() => setSelectedMpId(mp.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${selectedMpId === mp.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {mp.name}
            </button>
          ))}
        </div>
        <select value={selectedXmlId} onChange={e => { setSelectedXmlId(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white">
          <option value="">Tüm XML Kaynakları</option>
          {xmlSources.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div className="flex gap-1 ml-auto">
          <button onClick={handleSendAll} disabled={!selectedMpId || sending}
            className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50">
            {sending ? '⏳' : '📤 Tümünü Gönder'}
          </button>
          <button onClick={() => handleSend()} disabled={selectedIds.size === 0 || !selectedMpId || sending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            🚀 {selectedIds.size > 0 ? `${selectedIds.size} Ürün Gönder` : 'Seç ve Gönder'}
          </button>
        </div>
      </div>

      {/* Sayfalama */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">{total} ürün hazır</span>
        <div className="flex gap-1 ml-auto">
          {[50,100,200,500].map(s => (
            <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
              className={`rounded px-2.5 py-1.5 text-xs font-medium ${pageSize === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Tablo */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-700/80 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded border-slate-600 bg-slate-700 text-blue-600" /></th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">Ürün</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">XML Kaynak</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">Kategori</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">Marka</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">Varyant</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">Stok</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">Fiyat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" /></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-slate-500">✅ Gönderime hazır ürün yok</td></tr>
              ) : products.map(p => (
                <tr key={p.id} className={`transition-colors ${selectedIds.has(p.id) ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'}`}>
                  <td className="px-3 py-2.5"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded border-slate-600 bg-slate-700 text-blue-600" /></td>
                  <td className="px-3 py-2.5">
                    <div className="text-sm font-medium text-white truncate max-w-[200px]" title={p.title || p.xmlKey}>{p.title || p.xmlKey}</div>
                    <div className="text-[10px] text-slate-500">{p.sku || p.xmlKey}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{p.xmlSource?.name || '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-green-400">{p.category?.name || '✅'}</td>
                  <td className="px-3 py-2.5 text-xs text-green-400">{p.brand?.name || '✅'}</td>
                  <td className="px-3 py-2.5 text-xs">{p.variantMatch ? '✅' : '❌'}</td>
                  <td className="px-3 py-2.5 text-sm font-medium">{p.stock}</td>
                  <td className="px-3 py-2.5 text-xs">{p.salePrice ? `${p.salePrice.toFixed(2)} TL` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700 bg-slate-800/60">
            <span className="text-xs text-slate-500">{page}/{Math.ceil(total / pageSize)}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded px-3 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">◀</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="rounded px-3 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">▶</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ title, val, c }: { title: string; val: string | number; c: string }) {
  const m: Record<string, string> = { green: 'border-green-500/20 bg-green-500/5 text-green-400', purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400', blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400', slate: 'border-slate-500/20 bg-slate-500/5 text-slate-400' };
  return <div className={`rounded-xl border p-3 ${m[c] || m.blue}`}><div className="text-xs uppercase font-semibold opacity-80">{title}</div><div className="text-lg font-black mt-1">{typeof val === 'number' ? val.toLocaleString('tr-TR') : val}</div></div>;
}
