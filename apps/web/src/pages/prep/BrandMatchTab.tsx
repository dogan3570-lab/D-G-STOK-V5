// ==================== MARKA ESLESTIRME V3.0 ====================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';

interface V3Stats {
  totalXmlBrands: number; totalProducts: number; matchedProducts: number; unmatchedProducts: number;
  xmlBrandUsage: number; dgBrandUsage: number; readyProducts: number; errorProducts: number;
  aiSuggested: number; lastUpdate?: string;
}
interface BrandRow { xmlBrand: string; productCount: number; matchedCount: number; matchedBrand: string; brandType: string; dgBrandId: string; }
interface PreviewData { xmlBrand: string; productName: string; category: string; barcode: string; selectedBrand: string; finalTitle: string; finalBrand: string; }

export default function BrandMatchTab() {
  const [stats, setStats] = useState<V3Stats | null>(null);
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [brandInput, setBrandInput] = useState('DG STORE');
  const [systemBrands, setSystemBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedXmlBrand, setSelectedXmlBrand] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchStats = useCallback(async () => {
    try {
      const r = await apiFetch<any>('/brands/stats');
      if (r.ok && r.data?.stats) setStats(r.data.stats);
    } catch {}
  }, []);
  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search) p.append('search', search);
      const r = await apiFetch<any>(`/brands/list?${p}`);
      if (r.ok && r.data) { setRows(r.data.items || []); setTotal(r.data.pagination?.total || 0); }
    } finally { setLoading(false); }
  }, [page, pageSize, search]);
  const fetchBrands = useCallback(async () => { try { const r = await apiFetch<any>('/brands'); if (r.ok && r.data) setSystemBrands(r.data.items || []); } catch {} }, []);
  const fetchDefaultBrand = useCallback(async () => { try { const r = await apiFetch<any>('/brands/default-brand'); if (r.ok && r.data) { setBrandInput(r.data.defaultBrand); } } catch {} }, []);
  const fetchPreview = useCallback(async (name: string) => { try { const r = await apiFetch<any>(`/brands/preview/${encodeURIComponent(name)}`); if (r.ok && r.data?.preview) setPreview(r.data.preview); } catch {} }, []);

  useEffect(() => { fetchStats(); fetchBrands(); fetchDefaultBrand(); }, []);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleSearch = (value: string) => { setSearch(value); clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => setPage(1), 300); };

  const handleQuickMatch = async (xmlBrand: string, customBrandName?: string) => {
    if (!customBrandName) return;
    const r = await apiFetch<any>('/brands/match', { method: 'POST', body: JSON.stringify({ xmlBrandName: xmlBrand, customBrandName }) });
    if (r.ok) { showToast('success', `✅ ${xmlBrand} → ${customBrandName}`); setSelectedXmlBrand(null); setPreview(null); fetchStats(); fetchRows(); }
  };

  const handleAiMatch = async () => { setAiRunning(true); try { const r = await apiFetch<any>('/brands/ai-match', { method: 'POST' }); if (r.ok) { showToast('success', `🤖 ${r.data?.matchedCount || 0} eslestirildi`); fetchStats(); fetchRows(); } } finally { setAiRunning(false); } };
  const handleSaveDefaultBrand = async () => { if (!brandInput.trim()) return; const r = await apiFetch<any>('/brands/default-brand', { method: 'PUT', body: JSON.stringify({ brand: brandInput.trim() }) }); if (r.ok) showToast('success', `✅ ${brandInput.trim()}`); };

  const handleRowClick = async (row: BrandRow) => {
    if (selectedXmlBrand === row.xmlBrand) { setSelectedXmlBrand(null); setPreview(null); return; }
    setSelectedXmlBrand(row.xmlBrand);
    await fetchPreview(row.xmlBrand);
  };

  const fmtDate = () => {
    if (!stats?.lastUpdate) return '...';
    try { return new Date(stats.lastUpdate).toLocaleTimeString('tr-TR'); } catch { return '...'; }
  };

  return (
    <div className="space-y-3">
      {/* KPI */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Kpi title="XML Marka" val={stats.totalXmlBrands} c="blue" />
          <Kpi title="Ürün" val={stats.totalProducts} c="blue" />
          <Kpi title="Eşleşen" val={stats.matchedProducts} c="green" />
          <Kpi title="Eşleşmeyen" val={stats.unmatchedProducts} c="yellow" />
          <Kpi title="DG Kullanım" val={stats.dgBrandUsage} c="purple" />
          <Kpi title="XML Kullanım" val={stats.xmlBrandUsage} c="cyan" />
          <Kpi title="Hazır" val={stats.readyProducts} c="green" />
          <Kpi title="Hatalı" val={stats.errorProducts} c="red" />
          <Kpi title="AI" val={stats.aiSuggested} c="pink" />
          <Kpi title="Güncelleme" val={fmtDate()} c="slate" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-3">
        <input type="text" defaultValue={search} onChange={e => handleSearch(e.target.value)} placeholder="Ara..."
          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white w-32" />
        <div className="flex gap-1">
          {[50,100,200,500,1000].map(s => (
            <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
              className={`rounded px-3 py-1.5 text-xs font-medium ${pageSize === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <input type="text" value={brandInput} onChange={e => setBrandInput(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white font-bold w-28 text-center uppercase" />
          <button onClick={handleSaveDefaultBrand} className="rounded-lg bg-green-600 px-3 py-2 text-xs text-white hover:bg-green-700">💾 Kaydet</button>
          <button onClick={handleAiMatch} disabled={aiRunning} className="rounded-lg bg-purple-600 px-3 py-2 text-xs text-white hover:bg-purple-700 disabled:opacity-50">🤖 AI Eşleştir</button>
          <button onClick={() => { fetchStats(); fetchRows(); }} className="rounded-lg bg-slate-600 px-3 py-2 text-xs text-white hover:bg-slate-500">🔄</button>
          <span className="text-sm text-slate-500">{total} kayıt</span>
        </div>
      </div>

      {/* TABLO */}
      <div className="w-full rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
          <table className="w-full">
            <thead className="bg-slate-700/80 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">XML Markası</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Ürün</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Gönderilecek Marka</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Yeni Marka Gir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-sm text-slate-500">✅ Tüm markalar eşleştirilmiş</td></tr>
              ) : rows.map(row => (
                <tr key={row.xmlBrand}
                  className={`cursor-pointer transition-colors ${selectedXmlBrand === row.xmlBrand ? 'bg-blue-900/20' : 'hover:bg-slate-700/20'}`}
                  onClick={() => handleRowClick(row)}>
                  <td className="px-4 py-3 text-sm font-medium text-white">{row.xmlBrand}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{row.productCount.toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${row.brandType === 'XML' ? 'text-slate-400' : 'text-green-400'}`}>{row.matchedBrand}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${row.brandType === 'XML' ? 'bg-slate-500/10 text-slate-400' : 'bg-green-500/10 text-green-400'}`}>{row.brandType}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">{row.matchedCount > 0 ? '✅ Eşleşti' : '⏳ Bekliyor'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <input type="text" placeholder="Marka® gir..."
                        className="w-24 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white"
                        id={`b_${row.xmlBrand.replace(/\s/g,'_')}`} />
                      <button onClick={() => {
                        const el = document.getElementById(`b_${row.xmlBrand.replace(/\s/g,'_')}`) as HTMLInputElement;
                        if (el?.value?.trim()) handleQuickMatch(row.xmlBrand, el.value.trim());
                        else showToast('warning', 'Marka adı yazın');
                      }} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 font-medium">🔗 Uygula</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700 bg-slate-800/60">
            <span className="text-xs text-slate-500">Sayfa {page}/{Math.ceil(total / pageSize)}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">◀ Önceki</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="rounded px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">Sonraki ▶</button>
            </div>
          </div>
        )}
      </div>

      {/* CANLI ÖNİZLEME */}
      {preview && (
        <div className="w-full rounded-xl border-2 border-green-700/30 bg-slate-800/50 overflow-hidden">
          <div className="p-4 border-b border-green-700/20 bg-green-900/20">
            <h3 className="text-base font-bold text-white">👁️ Canlı Önizleme: {preview.xmlBrand}</h3>
          </div>
          <div className="grid grid-cols-2 gap-0">
            <div className="p-4 border-r border-slate-700">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">📄 XML Verisi</h4>
              <div className="space-y-3">
                <InfoRow label="Marka" value={preview.xmlBrand} />
                <InfoRow label="Ürün Adı" value={preview.productName} />
                <InfoRow label="Kategori" value={preview.category || '-'} />
                <InfoRow label="Barkod" value={preview.barcode || '-'} />
              </div>
            </div>
            <div className="p-4 bg-green-900/10">
              <h4 className="text-xs font-bold text-green-400 uppercase mb-3">✅ Pazaryerine Gidecek</h4>
              <div className="space-y-3">
                <div className="bg-green-800/20 rounded-lg p-3 border border-green-700/30">
                  <div className="text-xs text-green-400 mb-1">Marka</div>
                  <div className="text-lg font-black text-green-300">{preview.finalBrand}<span className="text-green-500 text-xl">®</span></div>
                </div>
                <div className="bg-green-800/20 rounded-lg p-3 border border-green-700/30">
                  <div className="text-xs text-green-400 mb-1">Ürün Adı (Pazaryerinde)</div>
                  <div className="text-base font-bold text-green-300">{preview.finalTitle}</div>
                </div>
                <InfoRow label="Kategori" value={preview.category || '-'} />
                <InfoRow label="Barkod" value={preview.barcode || '-'} />
              </div>
            </div>
          </div>
          <div className="p-4 bg-green-600/10 border-t border-green-600/20 text-center">
            <div className="text-sm font-bold text-green-400">✓ Pazaryerine Bu Şekilde Gönderilecek</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ title, val, c }: { title: string; val: string | number; c: string }) {
  const m: Record<string, string> = {
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400', green: 'border-green-500/20 bg-green-500/5 text-green-400',
    yellow: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400', red: 'border-red-500/20 bg-red-500/5 text-red-400',
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400', cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
    pink: 'border-pink-500/20 bg-pink-500/5 text-pink-400', slate: 'border-slate-500/20 bg-slate-500/5 text-slate-400',
  };
  return <div className={`rounded-xl border p-3 ${m[c] || m.blue}`}><div className="text-xs uppercase font-semibold opacity-80">{title}</div><div className="text-lg font-black mt-1">{typeof val === 'number' ? val.toLocaleString('tr-TR') : val}</div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-slate-500">{label}</div><div className="text-sm font-medium text-white">{value}</div></div>;
}
