// ==================== MARKA ESLESTIRME V3.0 (Sade) ====================
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';

interface V3Stats {
  totalXmlBrands: number; totalProducts: number; matchedProducts: number; unmatchedProducts: number;
  xmlBrandUsage: number; dgBrandUsage: number; readyProducts: number; errorProducts: number;
  activeBrands: number; aiSuggested: number; lastUpdate: string;
}
interface BrandRow { xmlBrand: string; productCount: number; matchedCount: number; matchedBrand: string; brandType: string; dgBrandId: string; }
interface PreviewData { xmlBrand: string; productName: string; category: string; barcode: string; sku: string; selectedBrand: string; finalTitle: string; finalBrand: string; formatDescription?: string; }

export default function BrandMatchTab() {
  const [stats, setStats] = useState<V3Stats | null>(null);
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [defaultBrand, setDefaultBrand] = useState('DG STORE');
  const [brandInput, setBrandInput] = useState('DG STORE');
  const [systemBrands, setSystemBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedXmlBrand, setSelectedXmlBrand] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchStats = useCallback(async () => { const r = await apiFetch<V3Stats>('/brands/v3/stats'); if (r.ok && r.data) setStats(r.data); }, []);
  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search) p.append('search', search);
      const r = await apiFetch<{ items: BrandRow[]; pagination: { total: number } }>(`/brands/v3/list?${p}`);
      if (r.ok && r.data) { setRows(r.data.items || []); setTotal(r.data.pagination?.total || 0); }
    } finally { setLoading(false); }
  }, [page, pageSize, search]);
  const fetchBrands = useCallback(async () => { const r = await apiFetch<{ items: Array<{ id: string; name: string }> }>('/brands'); if (r.ok && r.data) setSystemBrands(r.data.items || []); }, []);
  const fetchDefaultBrand = useCallback(async () => { const r = await apiFetch<{ defaultBrand: string }>('/brands/v3/default-brand'); if (r.ok && r.data) { setDefaultBrand(r.data.defaultBrand); setBrandInput(r.data.defaultBrand); } }, []);
  const fetchPreview = useCallback(async (name: string) => { const r = await apiFetch<{ preview: PreviewData }>(`/brands/v3/preview/${encodeURIComponent(name)}`); if (r.ok && r.data?.preview) setPreview(r.data.preview); }, []);

  useEffect(() => { fetchStats(); fetchBrands(); fetchDefaultBrand(); }, []);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleSearch = (value: string) => { setSearch(value); clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => setPage(1), 300); };

  const handleQuickMatch = async (xmlBrand: string, customBrandName?: string) => {
    if (!customBrandName) return;
    const r = await apiFetch<any>('/brands/v3/match', { method: 'POST', body: JSON.stringify({ xmlBrandName: xmlBrand, customBrandName }) });
    if (r.ok) { showToast('success', `✅ ${xmlBrand} → ${customBrandName}`); fetchStats(); fetchRows(); }
  };

  const handleAiMatch = async () => { setAiRunning(true); try { const r = await apiFetch<any>('/brands/v3/ai-match', { method: 'POST' }); if (r.ok) { showToast('success', `🤖 ${r.data?.matchedCount || 0} eslestirildi`); fetchStats(); fetchRows(); } } finally { setAiRunning(false); } };
  const handleSaveDefaultBrand = async () => { if (!brandInput.trim()) return; const r = await apiFetch<any>('/brands/v3/default-brand', { method: 'PUT', body: JSON.stringify({ brand: brandInput.trim() }) }); if (r.ok) { setDefaultBrand(brandInput.trim()); showToast('success', `✅ ${brandInput.trim()}`); } };

  const handleRowClick = (row: BrandRow) => { setSelectedXmlBrand(row.xmlBrand); fetchPreview(row.xmlBrand); };

  return (
    <div className="space-y-3">
      {/* KPI */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          <Kpi title="XML Marka" val={stats.totalXmlBrands} c="blue" />
          <Kpi title="Ürün" val={stats.totalProducts} c="blue" />
          <Kpi title="Eşleşen" val={stats.matchedProducts} c="green" />
          <Kpi title="Eşleşmeyen" val={stats.unmatchedProducts} c="yellow" />
          <Kpi title="DG Kullanım" val={stats.dgBrandUsage} c="purple" />
          <Kpi title="XML Kullanım" val={stats.xmlBrandUsage} c="cyan" />
          <Kpi title="Hazır" val={stats.readyProducts} c="green" />
          <Kpi title="Hatalı" val={stats.errorProducts} c="red" />
          <Kpi title="AI" val={stats.aiSuggested} c="pink" />
          <Kpi title="Güncelleme" val={new Date(stats.lastUpdate).toLocaleTimeString('tr-TR')} c="slate" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/50 p-2">
        <input type="text" defaultValue={search} onChange={e => handleSearch(e.target.value)} placeholder="Ara..."
          className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white w-28" />
        <div className="flex gap-0.5">
          {[50,100,200,500,1000].map(s => (
            <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
              className={`rounded px-2 py-1 text-[9px] font-medium ${pageSize === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{s}</button>
          ))}
        </div>
        <input type="text" value={brandInput} onChange={e => setBrandInput(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white font-bold w-24 text-center uppercase" />
        <button onClick={handleSaveDefaultBrand} className="rounded-lg bg-green-600 px-2 py-1.5 text-[9px] text-white hover:bg-green-700">💾</button>
        <button onClick={handleAiMatch} disabled={aiRunning} className="rounded-lg bg-purple-600 px-2 py-1.5 text-[9px] text-white hover:bg-purple-700 disabled:opacity-50">🤖 AI</button>
        <button onClick={() => { fetchStats(); fetchRows(); }} className="rounded-lg bg-slate-600 px-2 py-1.5 text-[9px] text-white hover:bg-slate-500">🔄</button>
        <span className="text-[10px] text-slate-500 ml-auto">{total} kayıt</span>
      </div>

      {/* TABLO (UST) + ONIZLEME (ALT) */}
      <div className="flex flex-col gap-2">
        {/* TABLO */}
        <div className="w-full rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            <table className="w-full">
              <thead className="bg-slate-700/80 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-400">XML Markası</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-400">Ürün</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-400">Gönderilecek Marka</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-400">Tip</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-400">Durum</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-slate-400">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8"><div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500 text-xs">✅ Tüm markalar eşleştirilmiş</td></tr>
                ) : rows.map(row => (
                  <tr key={row.xmlBrand}
                    className={`cursor-pointer transition-colors ${selectedXmlBrand === row.xmlBrand ? 'bg-blue-900/20' : 'hover:bg-slate-700/20'}`}
                    onClick={() => handleRowClick(row)}>
                    <td className="px-2 py-2 text-xs font-medium text-white">{row.xmlBrand}</td>
                    <td className="px-2 py-2 text-xs text-slate-300">{row.productCount.toLocaleString('tr-TR')}</td>
                    <td className="px-2 py-2">
                      <span className={`text-xs ${row.brandType === 'XML' ? 'text-slate-400' : 'text-green-400'}`}>{row.matchedBrand}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`text-[9px] px-1 py-0.5 rounded ${row.brandType === 'XML' ? 'bg-slate-500/10 text-slate-400' : 'bg-green-500/10 text-green-400'}`}>{row.brandType}</span>
                    </td>
                    <td className="px-2 py-2 text-xs">{row.matchedCount > 0 ? '✅' : '⏳'}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input type="text" placeholder="Marka®"
                          className="w-14 rounded border border-slate-600 bg-slate-700 px-1 py-0.5 text-[9px] text-white"
                          id={`b_${row.xmlBrand.replace(/\s/g,'_')}`} />
                        <button onClick={() => {
                          const el = document.getElementById(`b_${row.xmlBrand.replace(/\s/g,'_')}`) as HTMLInputElement;
                          if (el?.value?.trim()) handleQuickMatch(row.xmlBrand, el.value.trim());
                          else showToast('warning', 'Marka adı yazın');
                        }} className="rounded bg-green-600 px-1.5 py-0.5 text-[8px] text-white hover:bg-green-700">🔗</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > pageSize && (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-700 bg-slate-800/60">
              <span className="text-[9px] text-slate-500">{page}/{Math.ceil(total / pageSize)}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded px-2 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700 disabled:opacity-30">◀</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total} className="rounded px-2 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700 disabled:opacity-30">▶</button>
              </div>
            </div>
          )}
        </div>

        {/* CANLI ÖNİZLEME */}
        {preview && (
          <div className="w-full rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
            <div className="p-2 border-b border-slate-700 bg-slate-800/80">
              <h3 className="text-xs font-semibold text-white">👁️ Canlı Önizleme: {preview.xmlBrand}</h3>
            </div>
            <div className="grid grid-cols-2 gap-0 text-[11px]">
              <div className="p-2 border-r border-slate-700">
                <div className="text-[9px] font-semibold text-slate-500 mb-1">📄 XML</div>
                <div className="space-y-1">
                  <Row label="Marka" val={preview.xmlBrand} />
                  <Row label="Ürün" val={preview.productName} />
                  <Row label="Kategori" val={preview.category || '-'} />
                </div>
              </div>
              <div className="p-2 bg-green-900/10">
                <div className="text-[9px] font-semibold text-green-400 mb-1">✅ Pazaryeri</div>
                <div className="space-y-1">
                  <Row label="Marka" val={`${preview.finalBrand}®`} />
                  <Row label="Ürün" val={preview.finalTitle} />
                  <Row label="Kategori" val={preview.category || '-'} />
                </div>
              </div>
            </div>
            <div className="p-2 bg-green-600/10 border-t border-green-600/20 text-center text-[10px] text-green-400">✓ Bu Şekilde Gönderilecek</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ title, val, c }: { title: string; val: string | number; c: string }) {
  const m: Record<string, string> = { blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400', green: 'border-green-500/20 bg-green-500/5 text-green-400', yellow: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400', red: 'border-red-500/20 bg-red-500/5 text-red-400', purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400', cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400', pink: 'border-pink-500/20 bg-pink-500/5 text-pink-400', slate: 'border-slate-500/20 bg-slate-500/5 text-slate-400' };
  return <div className={`rounded-lg border p-1.5 ${m[c] || m.blue}`}><div className="text-[8px] uppercase opacity-70">{title}</div><div className="text-xs font-bold">{typeof val === 'number' ? val.toLocaleString('tr-TR') : val}</div></div>;
}
function Row({ label, val }: { label: string; val: string }) {
  return <div><div className="text-[9px] text-slate-500">{label}</div><div className="text-xs text-white font-medium truncate">{val}</div></div>;
}
