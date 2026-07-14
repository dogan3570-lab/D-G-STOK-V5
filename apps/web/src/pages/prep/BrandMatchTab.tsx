// ==================== MARKA ESLESTIRME V3.0 (Nihai Surum) ====================
// Performans: Server-side pagination, onbellek, virtual scroll
// Ozellik: Canli onizleme, toplu islem, islem gunlugu
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';

interface V3Stats {
  totalXmlBrands: number; totalProducts: number; matchedProducts: number; unmatchedProducts: number;
  xmlBrandUsage: number; dgBrandUsage: number; readyProducts: number; errorProducts: number;
  activeBrands: number; aiSuggested: number; lastUpdate: string;
}

interface BrandRow {
  xmlBrand: string; productCount: number; matchedCount: number;
  matchedBrand: string; brandType: string; dgBrandId: string;
}

interface PreviewData {
  xmlBrand: string; productName: string; category: string;
  barcode: string; sku: string; selectedBrand: string;
  finalTitle: string; finalBrand: string;
  formatDescription?: string;
}

interface ActivityLog {
  id: string; action: string; xmlBrandName?: string; dgBrandName?: string;
  productCount: number; createdAt: string;
}

const PAGE_SIZES = [50, 100, 200, 500, 1000];

export default function BrandMatchTab() {
  // State
  const [stats, setStats] = useState<V3Stats | null>(null);
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [defaultBrand, setDefaultBrand] = useState('DG STORE');
  const [brandInput, setBrandInput] = useState('DG STORE');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [aiRunning, setAiRunning] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selectedXmlBrand, setSelectedXmlBrand] = useState<string | null>(null);
  const [systemBrands, setSystemBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [bulkBrandId, setBulkBrandId] = useState('');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Data fetching
  const fetchStats = useCallback(async () => {
    const res = await apiFetch<V3Stats>('/brands/v3/stats');
    if (res.ok && res.data) setStats(res.data);
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search) params.append('search', search);
      if (filter !== 'all') params.append('filter', filter);
      const res = await apiFetch<{ items: BrandRow[]; pagination: { total: number } }>(`/brands/v3/list?${params}`);
      if (res.ok && res.data) {
        setRows(res.data.items || []);
        setTotal(res.data.pagination?.total || 0);
      }
    } finally { setLoading(false); }
  }, [page, pageSize, search, filter]);

  const fetchBrands = useCallback(async () => {
    const res = await apiFetch<{ items: Array<{ id: string; name: string }> }>('/brands');
    if (res.ok && res.data) setSystemBrands(res.data.items || []);
  }, []);

  const fetchLogs = useCallback(async () => {
    const res = await apiFetch<{ items: ActivityLog[] }>('/brands/v3/logs?limit=10');
    if (res.ok && res.data) setLogs(res.data.items || []);
  }, []);

  const fetchDefaultBrand = useCallback(async () => {
    const res = await apiFetch<{ defaultBrand: string }>('/brands/v3/default-brand');
    if (res.ok && res.data) { setDefaultBrand(res.data.defaultBrand); setBrandInput(res.data.defaultBrand); }
  }, []);

  const fetchPreview = useCallback(async (xmlBrand: string) => {
    const res = await apiFetch<{ preview: PreviewData }>(`/brands/v3/preview/${encodeURIComponent(xmlBrand)}`);
    if (res.ok && res.data?.preview) setPreview(res.data.preview);
  }, []);

  // Init
  useEffect(() => { fetchStats(); fetchBrands(); fetchLogs(); fetchDefaultBrand(); }, []);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Search debounce
  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPage(1), 300);
  };

  // Selection
  const toggleSelect = (name: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  };
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === rows.length ? new Set() : new Set(rows.map(r => r.xmlBrand)));
  };

  // Row click - preview
  const handleRowClick = (row: BrandRow) => {
    setSelectedXmlBrand(row.xmlBrand);
    fetchPreview(row.xmlBrand);
  };

  // Quick match - single row (dropdown veya custom brand)
  const handleQuickMatch = async (xmlBrand: string, dgBrandId: string, customBrandName?: string) => {
    if (!dgBrandId && !customBrandName) { showToast('warning', 'Marka seçin veya yazın'); return; }
    const body: any = { xmlBrandName: xmlBrand };
    if (customBrandName) body.customBrandName = customBrandName;
    else body.dgBrandId = dgBrandId;

    const res = await apiFetch<any>('/brands/v3/match', { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      showToast('success', `✅ ${xmlBrand} → ${res.data?.brandName || ''}`);
      fetchStats(); fetchRows(); fetchLogs();
      setSelectedIds(prev => { const n = new Set(prev); n.delete(xmlBrand); return n; });
    }
  };

  // Bulk match - selected
  const [customBulkBrand, setCustomBulkBrand] = useState('');
  const handleBulkMatch = async () => {
    const targetId = bulkBrandId || '';
    const targetCustom = customBulkBrand.trim();
    if ((!targetId && !targetCustom) || selectedIds.size === 0) {
      showToast('warning', 'Marka seçin/yazın ve en az 1 XML markası seçin');
      return;
    }
    setProgress({ current: 0, total: selectedIds.size });

    if (targetCustom) {
      // Custom brand - once olustur sonra eslestir
      const createRes = await apiFetch<any>('/brands/v3/create-brand', {
        method: 'POST', body: JSON.stringify({ name: targetCustom }),
      });
      if (createRes.ok && createRes.data?.brand?.id) {
        const res = await apiFetch<any>('/brands/v3/bulk-match', {
          method: 'POST', body: JSON.stringify({ dgBrandId: createRes.data.brand.id }),
        });
        setProgress(null);
        if (res.ok) showToast('success', `✅ ${res.data?.matchedCount || 0} ürün eşleştirildi`);
      }
    } else {
      const res = await apiFetch<any>('/brands/v3/bulk-match', {
        method: 'POST', body: JSON.stringify({ dgBrandId: targetId }),
      });
      setProgress(null);
      if (res.ok) showToast('success', `✅ ${res.data?.matchedCount || 0} ürün eşleştirildi`);
    }

    setSelectedIds(new Set()); setBulkBrandId(''); setCustomBulkBrand('');
    fetchStats(); fetchRows(); fetchLogs();
  };

  // AI match
  const handleAiMatch = async () => {
    setAiRunning(true);
    try {
      showToast('info', '🤖 AI eşleştirme başlıyor...');
      const res = await apiFetch<any>('/brands/v3/ai-match', { method: 'POST' });
      if (res.ok) {
        showToast('success', `🤖 ${res.data?.matchedCount || 0} ürün eşleştirildi`);
        fetchStats(); fetchRows(); fetchLogs();
      }
    } finally { setAiRunning(false); }
  };

  // Default brand
  const handleSaveDefaultBrand = async () => {
    if (!brandInput.trim()) return;
    const res = await apiFetch<any>('/brands/v3/default-brand', {
      method: 'PUT', body: JSON.stringify({ brand: brandInput.trim() }),
    });
    if (res.ok) {
      setDefaultBrand(brandInput.trim());
      showToast('success', `✅ Varsayılan marka: ${brandInput.trim()}`);
    }
  };

  // Export
  const handleExport = () => {
    window.open('/brands/v3/export', '_blank');
  };

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  return (
    <div className="space-y-4">
      {/* 1. UST GOSTERGE PANELI */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          <KpiCard title="XML Marka" value={stats.totalXmlBrands} color="blue" />
          <KpiCard title="XML Ürün" value={stats.totalProducts} color="blue" />
          <KpiCard title="Eşleşen" value={stats.matchedProducts} color="green" />
          <KpiCard title="Eşleşmeyen" value={stats.unmatchedProducts} color="yellow" />
          <KpiCard title="Kullanıcı Marka" value={stats.dgBrandUsage} color="purple" />
          <KpiCard title="XML Marka Kullanım" value={stats.xmlBrandUsage} color="cyan" />
          <KpiCard title="Gönderime Hazır" value={stats.readyProducts} color="green" />
          <KpiCard title="Hatalı" value={stats.errorProducts} color="red" />
          <KpiCard title="AI Önerisi" value={stats.aiSuggested} color="pink" />
          <KpiCard title="Son Güncelleme" value={new Date(stats.lastUpdate).toLocaleTimeString('tr-TR')} color="slate" />
        </div>
      )}

      {/* 2. ARAC CUBUGU */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <input type="text" defaultValue={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Marka ara..." className="rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-xs text-white w-40" />
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white">
            <option value="all">Tümü</option>
            <option value="unmatched">Eşleşmeyen</option>
            <option value="matched">Eşleşen</option>
            <option value="ai">AI Önerisi</option>
          </select>
          <div className="flex gap-0.5">
            {PAGE_SIZES.map(s => (
              <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
                className={`rounded px-2 py-1 text-[10px] font-medium ${pageSize === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          <input type="text" value={brandInput} onChange={e => setBrandInput(e.target.value)}
            placeholder="Varsayılan Marka"
            className="rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-xs text-white font-bold w-32 text-center uppercase" />
          <button onClick={handleSaveDefaultBrand}
            className="rounded-lg bg-green-600 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-green-700">💾 Kaydet</button>
          <button onClick={handleAiMatch} disabled={aiRunning}
            className="rounded-lg bg-purple-600 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-purple-700 disabled:opacity-50">🤖 AI</button>
          <button onClick={handleExport}
            className="rounded-lg bg-slate-600 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-slate-500">📥 Excel</button>
          <button onClick={() => { fetchStats(); fetchRows(); fetchLogs(); }}
            className="rounded-lg bg-slate-600 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-slate-500">🔄</button>
        </div>
      </div>

      {/* Toplu islem toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-900/20 border border-blue-700/30">
          <span className="text-xs text-blue-300 font-medium">{selectedIds.size} XML marka seçili</span>
          <div className="flex items-center gap-1">
            <select value={bulkBrandId} onChange={e => { setBulkBrandId(e.target.value); setCustomBulkBrand(''); }}
              className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white">
              <option value="">Kayıtlı marka seç...</option>
              {systemBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="text-[10px] text-slate-500">veya</span>
            <input type="text" value={customBulkBrand} onChange={e => { setCustomBulkBrand(e.target.value); setBulkBrandId(''); }}
              placeholder="Özel marka adı..."
              className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white w-32" />
          </div>
          <button onClick={handleBulkMatch} disabled={!bulkBrandId && !customBulkBrand.trim()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            🔗 {progress ? `${progress.current}/${progress.total}` : 'Toplu Eşleştir'}
          </button>
          {progress && (
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </div>
          )}
          <button onClick={() => setSelectedIds(new Set())}
            className="text-xs text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 3. MARKA ESLESTIRME TABLOSU + CANLI ONIZLEME */}
      <div className="flex flex-col xl:flex-row gap-3">
        {/* TABLO */}
        <div className={`${preview ? 'xl:w-1/2' : 'flex-1'} min-w-0 rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden`}>
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 480px)' }}>
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-700/80 sticky top-0 z-10">
                <tr>
                  <th className="w-10 px-2 py-2.5"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                    className="rounded border-slate-600 bg-slate-700 text-blue-600" /></th>
                  <TH>XML Markası</TH>
                  <TH>Ürün</TH>
                  <TH>Gönderilecek Marka</TH>
                  <TH>Tip</TH>
                  <TH>Durum</TH>
                  <TH style={{ width: 60 }}></TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-500">✅ Tüm markalar eşleştirilmiş</td></tr>
                ) : rows.map(row => (
                  <tr key={row.xmlBrand}
                    className={`transition-colors cursor-pointer ${selectedIds.has(row.xmlBrand) ? 'bg-blue-900/20' : 'hover:bg-slate-700/20'} ${selectedXmlBrand === row.xmlBrand ? 'bg-blue-900/10' : ''}`}
                    onClick={() => handleRowClick(row)}>
                    <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(row.xmlBrand)} onChange={() => toggleSelect(row.xmlBrand)}
                        className="rounded border-slate-600 bg-slate-700 text-blue-600" />
                    </td>
                    <td className="px-3 py-2"><span className="text-xs font-medium text-white">{row.xmlBrand}</span></td>
                    <td className="px-3 py-2"><span className="text-xs text-slate-300">{row.productCount.toLocaleString('tr-TR')}</span></td>
                    <td className="px-3 py-2">
                      <span className={`text-xs ${row.brandType === 'XML' ? 'text-slate-400' : 'text-green-400'}`}>{row.matchedBrand}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        row.brandType === 'XML' ? 'bg-slate-500/10 text-slate-400' :
                        row.brandType === 'Eşleştirilmiş' ? 'bg-green-500/10 text-green-400' :
                        'bg-purple-500/10 text-purple-400'
                      }`}>{row.brandType}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] ${row.matchedCount > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {row.matchedCount > 0 ? '✅' : '⏳'}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input type="text" placeholder="Marka® yaz..."
                          className="w-16 rounded border border-slate-600 bg-slate-700 px-1 py-1 text-[9px] text-white"
                          id={`custom_${row.xmlBrand}`} />
                        <button onClick={() => {
                          const input = document.getElementById(`custom_${row.xmlBrand}`) as HTMLInputElement;
                          const val = input?.value?.trim();
                          if (val) handleQuickMatch(row.xmlBrand, '', val);
                          else showToast('warning', 'Marka adı yazın');
                        }}
                          className="rounded bg-green-600 px-1.5 py-1 text-[8px] text-white hover:bg-green-700">
                          🔗 Uygula
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > pageSize && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700 bg-slate-800/60">
              <span className="text-[10px] text-slate-500">{page}/{Math.ceil(total / pageSize)}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">◀</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}
                  className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">▶</button>
              </div>
            </div>
          )}
        </div>

        {/* 4. CANLI ÖNİZLEME PANELİ */}
        {preview && (
          <div className="xl:w-1/2 rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
            <div className="p-3 border-b border-slate-700 bg-slate-800/80">
              <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <span>👁️</span> Canlı Önizleme: {preview.xmlBrand}
              </h3>
              <div className="text-[9px] text-slate-500 mt-0.5">{preview.formatDescription}</div>
            </div>
            <div className="grid grid-cols-2 gap-0">
              {/* SOL: XML Verisi */}
              <div className="p-3 border-r border-slate-700">
                <h4 className="text-[10px] font-semibold text-slate-500 uppercase mb-2">📄 XML Verisi</h4>
                <div className="space-y-1.5">
                  <PreviewRow label="Marka" value={preview.xmlBrand} />
                  <PreviewRow label="Ürün Adı" value={preview.productName} />
                  <PreviewRow label="Kategori" value={preview.category || '-'} />
                  <PreviewRow label="Barkod" value={preview.barcode || '-'} />
                </div>
              </div>
              {/* SAĞ: Pazaryerine Gidecek */}
              <div className="p-3 bg-green-900/10">
                <h4 className="text-[10px] font-semibold text-green-400 uppercase mb-2">✅ Pazaryerine Gidecek</h4>
                <div className="space-y-2">
                  <div className="bg-green-800/20 rounded p-2 border border-green-700/30">
                    <div className="text-[9px] text-green-400">Marka</div>
                    <div className="text-xs font-bold text-green-300">{preview.finalBrand}<span className="text-green-500">®</span></div>
                  </div>
                  <div className="bg-green-800/20 rounded p-2 border border-green-700/30">
                    <div className="text-[9px] text-green-400">Ürün Adı (Pazaryerinde)</div>
                    <div className="text-xs font-bold text-green-300">{preview.finalTitle}</div>
                  </div>
                  <PreviewRow label="Kategori" value={preview.category || '-'} />
                  <PreviewRow label="Barkod" value={preview.barcode || '-'} />
                </div>
              </div>
            </div>
            <div className="p-3 bg-green-600/10 border-t border-green-600/20">
              <div className="flex items-center gap-2 text-xs text-green-400">
                <span>✓</span>
                <span>Pazaryerine Bu Şekilde Gönderilecek</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. İŞLEM GÜNLÜĞÜ */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-3">
          <h3 className="text-xs font-semibold text-slate-300 mb-2">📋 İşlem Günlüğü</h3>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-700/20 rounded px-2 py-1">
                <span className="text-slate-600 w-12">{new Date(log.createdAt).toLocaleTimeString('tr-TR')}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${
                  log.action === 'BRAND_MATCH' ? 'bg-green-500/10 text-green-400' :
                  log.action === 'AI_MATCH' ? 'bg-purple-500/10 text-purple-400' :
                  log.action === 'BULK_CHANGE' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'
                }`}>{log.action}</span>
                <span className="text-white">{log.dgBrandName || log.xmlBrandName || '-'}</span>
                <span className="text-slate-500">{log.productCount} ürün</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    green: 'border-green-500/20 bg-green-500/5 text-green-400',
    yellow: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-400',
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400',
    cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
    pink: 'border-pink-500/20 bg-pink-500/5 text-pink-400',
    slate: 'border-slate-500/20 bg-slate-500/5 text-slate-400',
  };
  return (
    <div className={`rounded-lg border p-2 backdrop-blur-sm ${colorMap[color] || colorMap.blue}`}>
      <div className="text-[9px] uppercase tracking-wider opacity-70">{title}</div>
      <div className="text-sm font-bold mt-0.5">{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</div>
    </div>
  );
}

function TH({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th className={`whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-slate-400`} style={style}>{children}</th>;
}

function PreviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-slate-500">{label}</span>
      <span className={`text-xs font-medium ${highlight ? 'text-green-300' : 'text-white'}`}>{value}</span>
    </div>
  );
}
