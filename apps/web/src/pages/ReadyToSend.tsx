// ==================== GONDERIME HAZIR V1.0 ====================
// Kategori, Marka, Varyant, Attribute tamamlanan urunler buraya gelir
// Eksik urun gelemez
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/ui/Toast';
import { formatPrice, cn } from '../lib/utils';
import { STATUS_BADGE_COLORS, STATUS_BADGE_LABELS } from '../lib/constants';

interface ReadyItem {
  id: string; title: string | null; xmlKey: string;
  sku: string | null; barcode: string | null; stock: number;
  salePrice: number | null; purchasePrice: number | null;
  categoryMatch: boolean; brandMatch: boolean; variantMatch: boolean; templateMatch: boolean;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string } | null;
  images: string | null;
  updatedAt: string; status: string;
}

interface Marketplace { id: string; key: string; name: string; apiStatus?: string | null; }

const PAGE_SIZES = [50, 100, 200, 500];

export default function ReadyToSend() {
  const [products, setProducts] = useState<ReadyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [selectedMpId, setSelectedMpId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: String(pageSize),
        status: 'READY', categoryMatch: 'true', brandMatch: 'true',
      });
      if (search) params.append('search', search);

      const res = await apiFetch<{ items: ReadyItem[]; pagination: { total: number; totalPages: number } }>(`/products?${params}`);
      if (res.ok && res.data) {
        setProducts(res.data.items || []);
        setTotal(res.data.pagination?.total || 0);
      }
    } finally { setLoading(false); }
  }, [page, pageSize, search]);

  const fetchMarketplaces = useCallback(async () => {
    const res = await apiFetch<{ items: Marketplace[] }>('/marketplaces');
    if (res.ok && res.data) setMarketplaces(res.data.items || []);
  }, []);

  useEffect(() => { fetchData(); fetchMarketplaces(); }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === products.length ? new Set() : new Set(products.map(p => p.id)));
  };

  const handleSendToMarketplace = async () => {
    if (selectedIds.size === 0 || !selectedMpId) {
      showToast('warning', 'Lütfen ürün ve pazaryeri seçin');
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch<any>('/products/prepare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), marketplaceId: selectedMpId }),
      });
      if (res.ok) {
        showToast('success', `✅ ${res.data?.readyCount || 0} ürün gönderime hazırlandı`);
        setSelectedIds(new Set());
        fetchData();
      } else showToast('error', res.error?.message || 'Gönderme başarısız');
    } finally { setSending(false); }
  };

  const allSelected = products.length > 0 && selectedIds.size === products.length;
  const totalReady = products.filter(p => p.categoryMatch && p.brandMatch && p.variantMatch).length;

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard title="Gönderime Hazır" value={total.toLocaleString('tr-TR')} color="green" />
        <KpiCard title="Tam Uyumlu" value={totalReady.toLocaleString('tr-TR')} color="blue" />
        <KpiCard title="Seçili" value={String(selectedIds.size)} color="purple" />
        <KpiCard title="Pazaryeri" value={String(marketplaces.length)} color="slate" />
      </div>

      {/* Pazaryeri sec + Gonder */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3">
        <div className="flex gap-1 flex-wrap">
          {marketplaces.map(mp => (
            <button key={mp.id} onClick={() => setSelectedMpId(mp.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedMpId === mp.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}>
              {mp.name} {mp.apiStatus === 'connected' ? '🟢' : mp.apiStatus === 'error' ? '🔴' : '⚪'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={handleSendToMarketplace} disabled={selectedIds.size === 0 || !selectedMpId || sending}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
          {sending ? '⏳ Gönderiliyor...' : `🚀 ${selectedIds.size > 0 ? `${selectedIds.size} Ürünü Gönder` : 'Gönder'}`}
        </button>
      </div>

      {/* Arama */}
      <div className="flex items-center gap-2">
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Ürün ara..." className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400" />
        <div className="flex gap-1">
          {PAGE_SIZES.map(s => (
            <button key={s} onClick={() => { setPageSize(s); setPage(1); }}
              className={`rounded px-2.5 py-1.5 text-xs font-medium ${pageSize === s ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Tablo */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
          <table className="w-full min-w-[1000px]">
            <thead className="bg-slate-700/80 sticky top-0 z-10">
              <tr>
                <THFixed style={{ width: 40 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                    className="rounded border-slate-600 bg-slate-700 text-blue-600" />
                </THFixed>
                <THFixed style={{ width: 200 }}>Ürün</THFixed>
                <TH style={{ width: 120 }}>Kategori</TH>
                <TH style={{ width: 120 }}>Marka</TH>
                <THFixed style={{ width: 60 }}>Stok</THFixed>
                <THFixed style={{ width: 100 }}>Fiyat</THFixed>
                <TH style={{ width: 80 }}>Varyant</TH>
                <THFixed style={{ width: 80 }}>Durum</THFixed>
                <TH style={{ width: 90 }}>Güncelleme</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-16 text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    Yükleniyor...
                  </div>
                </td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-slate-500">
                  <div className="text-4xl mb-2">✅</div>
                  <div className="text-lg font-medium text-slate-400">Gönderime hazır ürün bulunamadı</div>
                  <p className="text-sm text-slate-600 mt-1">Kategori, marka, varyant ve şablon eşleştirmesi tamamlanan ürünler burada görünür</p>
                </td></tr>
              ) : products.map(p => (
                <tr key={p.id} className={`transition-colors ${selectedIds.has(p.id) ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'}`}>
                  <TDFixed onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                      className="rounded border-slate-600 bg-slate-700 text-blue-600" />
                  </TDFixed>
                  <TDFixed>
                    <div className="text-sm font-medium text-white truncate max-w-[180px]" title={p.title || p.xmlKey}>{p.title || p.xmlKey}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{p.sku || p.xmlKey}</div>
                  </TDFixed>
                  <TD>
                    <span className="text-xs text-green-400">{p.category?.name || '✅'}</span>
                  </TD>
                  <TD>
                    <span className="text-xs text-green-400">{p.brand?.name || '✅'}</span>
                  </TD>
                  <TDFixed>
                    <span className={`text-sm font-medium ${p.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>{p.stock}</span>
                  </TDFixed>
                  <TDFixed>
                    <span className="text-xs text-white font-medium">{formatPrice(p.salePrice)}</span>
                  </TDFixed>
                  <TD>
                    <span className={`text-xs ${p.variantMatch ? 'text-green-400' : 'text-slate-500'}`}>{p.variantMatch ? '✅' : '❌'}</span>
                  </TD>
                  <TDFixed>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_BADGE_COLORS[p.status] || 'bg-green-500/10 text-green-400'}`}>
                      {STATUS_BADGE_LABELS[p.status] || p.status}
                    </span>
                  </TDFixed>
                  <TD>
                    <span className="text-xs text-slate-500">{new Date(p.updatedAt).toLocaleDateString('tr-TR')}</span>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'border-green-500/20 bg-green-500/5 text-green-400',
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400',
    slate: 'border-slate-500/20 bg-slate-500/5 text-slate-400',
  };
  return (
    <div className={`rounded-xl border p-3 backdrop-blur-sm ${colors[color] || colors.blue}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{title}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

function TH({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-700/80 border-b border-slate-600/50" style={style}>{children}</th>;
}

function THFixed({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th className="sticky left-0 z-20 whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-700/80 border-b border-slate-600/50 border-r border-slate-600/30" style={style}>{children}</th>;
}

function TD({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <td className="whitespace-nowrap px-3 py-2.5 text-sm" style={style}>{children}</td>;
}

function TDFixed({ children, style, onClick }: { children?: React.ReactNode; style?: React.CSSProperties; onClick?: (e: React.MouseEvent) => void }) {
  return <td className="sticky left-0 z-10 whitespace-nowrap px-3 py-2.5 text-sm bg-slate-800/90 border-r border-slate-700/30" style={style} onClick={onClick}>{children}</td>;
}
