// ==================== URUN HAVUZU V2.0 ====================
// DG STOK V5.0 - Profesyonel Virtual DataGrid
// 100.000+ urun destegi, Server-side pagination, Sticky columns
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/ui/Toast';
import { formatPrice, getImageList, getStockStatus, cn, formatDateTime } from '../lib/utils';
import { STATUS_BADGE_COLORS, STATUS_BADGE_LABELS } from '../lib/constants';

// ==================== TYPES ====================
interface ProductItem {
  id: string; xmlKey: string; title: string | null;
  sku: string | null; barcode: string | null; stock: number; minStock: number;
  purchasePrice: number | null; salePrice: number | null; vatRate: number | null;
  profitMargin: number | null; images: string | null; status: string;
  errorMessage: string | null; aiScore: number | null;
  categoryMatch?: boolean; brandMatch?: boolean; variantMatch?: boolean; templateMatch?: boolean;
  categoryId: string | null; brandId: string | null; xmlSourceId: string | null;
  supplierCategory: string | null;
  prefixEnabled?: boolean;
  computedTitle?: string | null;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string; company?: string | null } | null;
  variants?: Array<{ id: string; name: string; value: string }>;
  createdAt: string; updatedAt: string;
  // WorkflowState verileri
  readiness?: number;
  readinessColor?: string;
  readinessLabel?: string;
  workflowStatus?: string;
  stepCategory?: string;
  stepBrand?: string;
  stepVariant?: string;
  stepTitle?: string;
  // Marketplace durumları
  marketplaceStates?: Array<{ key: string; name: string; status: string }>;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

interface PoolStats {
  totalProducts: number; readyForListing: number; newProducts: number;
  pendingCategory: number; pendingBrand: number; pendingVariant: number;
  variantAnalysisPending: number; // Varyant Motoru V2 (manuel + hatalı)
  errorProducts: number;
}

const PAGE_SIZES = [50, 100, 200, 500, 1000];

// ==================== DRAWER COMPONENT ====================
function ProductDrawer({ product, onClose }: { product: ProductItem | null; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('genel');
  const [fullProduct, setFullProduct] = useState<ProductItem | null>(null);

  useEffect(() => {
    if (product?.id) {
      apiFetch<ProductItem>(`/products/${product.id}`).then(res => {
        if (res.ok && res.data) setFullProduct(res.data);
      });
    }
  }, [product?.id]);

  if (!product) return null;

  const p = fullProduct || product;
  const tabs = [
    { key: 'genel', label: 'Genel', icon: '📋' },
    { key: 'fiyat', label: 'Fiyat', icon: '💰' },
    { key: 'kategori', label: 'Kategori', icon: '🗂️' },
    { key: 'marka', label: 'Marka', icon: '🏷️' },
    { key: 'varyant', label: 'Varyant', icon: '🧬' },
    { key: 'attributes', label: 'Attributes', icon: '🏷️' },
    { key: 'resimler', label: 'Resimler', icon: '🖼️' },
    { key: 'pazaryerleri', label: 'Pazaryerleri', icon: '🛒' },
    { key: 'log', label: 'Log', icon: '📝' },
  ];

  // Readiness score
  const readinessScore = p.aiScore ?? 0;
  const readinessColor = readinessScore >= 100 ? 'bg-green-500' : readinessScore >= 70 ? 'bg-yellow-400' : 'bg-red-500';
  const readinessLabel = readinessScore >= 100 ? 'Hazır' : readinessScore >= 70 ? 'Bekliyor' : 'Eksik';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-slate-800 border-l border-slate-700 h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white truncate">{p.title || p.xmlKey}</h3>
            <p className="text-xs text-slate-400 font-mono truncate">{p.xmlKey} · {p.sku || '-'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white ml-3 shrink-0">
            ✕
          </button>
        </div>

        {/* Readiness Bar */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Hazırlık Skoru</span>
            <span className={`text-xs font-bold ${readinessScore >= 100 ? 'text-green-400' : readinessScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
              {readinessScore}% - {readinessLabel}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${readinessColor}`} style={{ width: `${Math.min(100, readinessScore)}%` }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-slate-700 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {activeTab === 'genel' && (
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="SKU" value={p.sku || '-'} />
              <InfoRow label="Barkod" value={p.barcode || '-'} />
              <InfoRow label="Stok" value={String(p.stock)} />
              <InfoRow label="Min Stok" value={String(p.minStock)} />
              <InfoRow label="XML Kaynak" value={p.xmlSource?.name || '-'} />
              <InfoRow label="Durum" value={p.status} />
              <InfoRow label="Kategori" value={p.category?.name || (p.categoryMatch ? '✅' : '❌')} />
              <InfoRow label="Marka" value={p.brand?.name || (p.brandMatch ? '✅' : '❌')} />
              <InfoRow label="Varyant" value={p.variantMatch ? '✅' : '❌'} />
              <InfoRow label="Şablon" value={p.templateMatch ? '✅' : '❌'} />
              <InfoRow label="Oluşturma" value={formatDateTime(p.createdAt)} />
              <InfoRow label="Güncelleme" value={formatDateTime(p.updatedAt)} />
            </div>
          )}
          {activeTab === 'fiyat' && (
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Alış Fiyatı (KDV Dahil)" value={formatPrice(p.purchasePrice)} />
              <InfoRow label="Satış Fiyatı" value={formatPrice(p.salePrice)} />
              <InfoRow label="KDV Oranı" value={p.vatRate ? `%${p.vatRate}` : '-'} />
              <InfoRow label="Kar Marjı" value={p.profitMargin ? `%${p.profitMargin}` : '-'} />
            </div>
          )}
          {activeTab === 'kategori' && (
            <div>
              <InfoRow label="XML Kategorisi" value={p.supplierCategory || '-'} />
              <InfoRow label="Sistem Kategorisi" value={p.category?.name || '-'} />
              <InfoRow label="AI Skoru" value={p.aiScore != null ? `%${Math.round(p.aiScore * 100)}` : '-'} />
            </div>
          )}
          {activeTab === 'marka' && (
            <div>
              <InfoRow label="XML Markası" value={p.xmlSource?.name || '-'} />
              <InfoRow label="DG Markası" value={p.brand?.name || '-'} />
              <InfoRow label="Ön Ek" value={p.prefixEnabled ? '✅ Aktif' : '❌ Pasif'} />
              <InfoRow label="Başlık" value={p.computedTitle || p.title || '-'} />
            </div>
          )}
          {activeTab === 'varyant' && p.variants && (
            <div className="flex flex-wrap gap-2">
              {p.variants.map(v => (
                <span key={v.id} className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs text-slate-300">
                  {v.name}: <span className="text-white font-medium">{v.value}</span>
                </span>
              ))}
              {(!p.variants || p.variants.length === 0) && (
                <span className="text-sm text-slate-500">Varyant bulunmuyor</span>
              )}
            </div>
          )}
          {activeTab === 'resimler' && (
            <div className="grid grid-cols-3 gap-2">
              {getImageList(p.images).map((img, i) => (
                <img key={i} src={img} alt={`Görsel ${i + 1}`}
                  className="rounded-lg border border-slate-600 object-cover h-32 w-full bg-slate-700"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ))}
              {getImageList(p.images).length === 0 && (
                <span className="text-sm text-slate-500 col-span-3 text-center py-8">Resim bulunmuyor</span>
              )}
            </div>
          )}
          {activeTab === 'attributes' && (
            <div className="text-sm text-slate-400">Teknik özellikler burada görüntülenecek</div>
          )}
          {activeTab === 'pazaryerleri' && (
            <div className="text-sm text-slate-400">Pazaryeri durumları burada görüntülenecek</div>
          )}
          {activeTab === 'log' && (
            <div className="text-sm text-slate-400">Değişiklik geçmişi burada görüntülenecek</div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-700/30 p-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm text-white font-medium mt-0.5 break-all">{value}</div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function ProductPool() {
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Reference data for filters
  const [xmlSources, setXmlSources] = useState<Array<{ id: string; name: string }>>([]);
  const [xmlSourceFilter, setXmlSourceFilter] = useState('');

  const fetchStats = useCallback(async () => {
    const res = await apiFetch<PoolStats>('/products/stats');
    if (res.ok && res.data) setStats(res.data);
  }, []);

  const fetchXmlSources = useCallback(async () => {
    const res = await apiFetch<{ items: Array<{ id: string; name: string }> }>('/xml-sources');
    if (res.ok && res.data) setXmlSources(res.data.items || []);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (xmlSourceFilter) params.append('xmlSourceId', xmlSourceFilter);

      const res = await apiFetch<{ items: ProductItem[]; pagination: Pagination }>(`/products?${params}`);
      if (res.ok && res.data) {
        setProducts(res.data.items || []);
        setPagination(res.data.pagination);
      }
    } catch {
      showToast('error', 'Ürünler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, xmlSourceFilter]);

  useEffect(() => { fetchStats(); fetchXmlSources(); }, []);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
  };

  const handlePageSizeChange = (size: number) => {
    setPagination(prev => ({ ...prev, limit: size, page: 1 }));
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === products.length ? new Set() : new Set(products.map(p => p.id)));
  };

  const openDrawer = (product: ProductItem) => {
    setSelectedProduct(product);
    setShowDrawer(true);
  };

  const allSelected = products.length > 0 && selectedIds.size === products.length;

  return (
    <div className="space-y-4">
      {/* ========== KPI KARTLARI ========== */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
          <KpiCard title="Toplam Ürün" value={stats.totalProducts.toLocaleString('tr-TR')} color="blue" />
          <KpiCard title="Gönderime Hazır" value={stats.readyForListing.toLocaleString('tr-TR')} color="green" />
          <KpiCard title="Kategori Bekleyen" value={stats.pendingCategory.toLocaleString('tr-TR')} color="yellow" />
          <KpiCard title="Marka Bekleyen" value={stats.pendingBrand.toLocaleString('tr-TR')} color="orange" />
          <KpiCard title="Varyant Bekleyen" value={stats.pendingVariant.toLocaleString('tr-TR')} color="purple" />
          <KpiCard title="Varyant V2 ⚠️" value={stats.variantAnalysisPending?.toLocaleString('tr-TR') || '0'} color="pink" />
          <KpiCard title="Hatalı" value={stats.errorProducts.toLocaleString('tr-TR')} color="red" />
        </div>
      )}

      {/* ========== FILTRELER ========== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-3 backdrop-blur-sm">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
          <input type="text" defaultValue={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Ürün adı, SKU, barkod ara..."
            className="w-full rounded-lg border border-slate-600 bg-slate-700 pl-8 pr-3 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white">
          <option value="">Tüm Durum</option>
          <option value="XML">Yeni</option>
          <option value="READY">Hazır</option>
          <option value="DRAFT">Eksik</option>
          <option value="ERROR">Hatalı</option>
          <option value="SENT">Gönderildi</option>
        </select>
        <select value={xmlSourceFilter} onChange={e => { setXmlSourceFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white">
          <option value="">Tüm XML</option>
          {xmlSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex gap-1">
          {PAGE_SIZES.map(size => (
            <button key={size} onClick={() => handlePageSizeChange(size)}
              className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                pagination.limit === size ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}>{size}</button>
          ))}
        </div>
        <span className="text-xs text-slate-500 whitespace-nowrap">{pagination.total.toLocaleString('tr-TR')} ürün</span>
      </div>

      {/* ========== SEÇIM TOOLBAR ========== */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-900/20 border border-blue-700/30">
          <span className="text-sm text-blue-300 font-medium">{selectedIds.size} ürün seçili</span>
          <button onClick={() => setSelectedIds(new Set())}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600">✕ Seçimi Temizle</button>
        </div>
      )}

      {/* ========== DATA GRID ========== */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/30 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
          <table className="w-full min-w-[1400px]">
            {/* HEADER */}
            <thead className="bg-slate-700/80 sticky top-0 z-20">
              <tr>
                <THFixed style={{ width: 40, minWidth: 40 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                    className="rounded border-slate-600 bg-slate-700 text-blue-600" />
                </THFixed>
                <THFixed style={{ width: 44, minWidth: 44 }}>Resim</THFixed>
                <THFixed style={{ width: 200, minWidth: 180 }}>Ürün Adı</THFixed>
                <THFixed style={{ width: 100, minWidth: 90 }}>XML Kaynağı</THFixed>
                <THFixed style={{ width: 100, minWidth: 80 }}>Marka</THFixed>
                <THFixed style={{ width: 60, minWidth: 55 }}>Stok</THFixed>
                <THFixed style={{ width: 110, minWidth: 100 }}>Alış Fiyatı (KDV Dahil)</THFixed>
                <THFixed style={{ width: 70, minWidth: 60 }}>Durum</THFixed>

                {/* Scrollable columns */}
                <TH style={{ width: 100, minWidth: 90 }}>SKU</TH>
                <TH style={{ width: 100, minWidth: 90 }}>Barkod</TH>
                <TH style={{ width: 140, minWidth: 120 }}>Kategori</TH>
                <TH style={{ width: 100, minWidth: 80 }}>Varyant</TH>
                <TH style={{ width: 80, minWidth: 70 }}>Renk</TH>
                <TH style={{ width: 80, minWidth: 70 }}>Beden</TH>
                <TH style={{ width: 80, minWidth: 70 }}>Numara</TH>
                <TH style={{ width: 100, minWidth: 90 }}>Son Güncelleme</TH>
                <TH style={{ width: 100, minWidth: 90 }}>Gönderim Durumu</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={17} className="text-center py-16">
                  <div className="flex items-center justify-center gap-2 text-slate-400">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    <span>Yükleniyor...</span>
                  </div>
                </td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={17} className="text-center py-16 text-slate-500">
                  <div className="text-4xl mb-2">📦</div>
                  <div className="text-lg font-medium text-slate-400">Ürün bulunamadı</div>
                  <p className="text-sm text-slate-600 mt-1">
                    {search || statusFilter ? 'Filtrelere uygun ürün yok' : 'Henüz XML kaynağından ürün yüklenmemiş'}
                  </p>
                </td></tr>
              ) : (
                products.map(p => (
                  <tr key={p.id}
                    className={`transition-colors cursor-pointer ${selectedIds.has(p.id) ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'}`}
                    onClick={() => openDrawer(p)}
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && openDrawer(p)}>
                    {/* Fixed columns */}
                    <TDFixed onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)}
                        className="rounded border-slate-600 bg-slate-700 text-blue-600" />
                    </TDFixed>
                    <TDFixed>
                      {p.images ? (
                        <img src={p.images.split(',')[0]} alt=""
                          className="w-9 h-9 rounded object-cover bg-slate-700"
                          onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23334155" width="100" height="100"/><text fill="%2394a3b8" font-size="12" x="50" y="55" text-anchor="middle">📦</text></svg>'; }} />
                      ) : (
                        <div className="w-9 h-9 rounded bg-slate-700 flex items-center justify-center text-xs">📦</div>
                      )}
                    </TDFixed>
                    <TDFixed>
                      <div className="text-sm font-medium text-white truncate max-w-[180px]" title={p.title || p.xmlKey}>
                        {p.title || p.xmlKey}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{p.xmlKey}</div>
                    </TDFixed>
                    <TDFixed><span className="text-xs text-slate-400">{p.xmlSource?.name || '-'}</span></TDFixed>
                    <TDFixed><span className={`text-xs ${p.brandMatch ? 'text-green-400' : 'text-slate-500'}`}>{p.brand?.name || (p.brandMatch ? '✅' : '❌')}</span></TDFixed>
                    <TDFixed><span className={`text-sm font-medium ${p.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>{p.stock}</span></TDFixed>
                    <TDFixed><span className="text-xs text-slate-300">{formatPrice(p.purchasePrice)}</span></TDFixed>
                    <TDFixed>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_BADGE_COLORS[p.status] || 'bg-slate-500/10 text-slate-400'}`}>
                        {STATUS_BADGE_LABELS[p.status] || p.status}
                      </span>
                    </TDFixed>

                    {/* Scrollable columns */}
                    <TD><span className="text-xs text-slate-400 font-mono">{p.sku || '-'}</span></TD>
                    <TD><span className="text-xs text-slate-400">{p.barcode || '-'}</span></TD>
                    <TD><span className="text-xs text-slate-400 truncate max-w-[120px] inline-block">{p.category?.name || (p.categoryMatch ? '✅' : '❌')}</span></TD>
                    <TD><span className={`text-xs ${p.variantMatch ? 'text-green-400' : 'text-slate-500'}`}>{p.variantMatch ? '✅' : '❌'}</span></TD>
                    <TD><span className="text-xs text-slate-400">{p.variants?.find(v => v.name === 'Renk')?.value || '-'}</span></TD>
                    <TD><span className="text-xs text-slate-400">{p.variants?.find(v => v.name === 'Beden')?.value || '-'}</span></TD>
                    <TD><span className="text-xs text-slate-400">{p.variants?.find(v => v.name === 'Numara')?.value || '-'}</span></TD>
                    <TD><span className="text-xs text-slate-500">{new Date(p.updatedAt).toLocaleDateString('tr-TR')}</span></TD>
                    <TD><span className="text-xs text-slate-500">-</span></TD>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700 bg-slate-800/60">
            <span className="text-xs text-slate-500">
              Sayfa {pagination.page}/{pagination.totalPages} · {pagination.total.toLocaleString('tr-TR')} ürün
            </span>
            <nav className="flex gap-1">
              <button onClick={() => setPagination(prev => ({ ...prev, page: 1 }))} disabled={pagination.page <= 1}
                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">««</button>
              <button onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))} disabled={pagination.page <= 1}
                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">«</button>
              <span className="px-3 py-1 text-xs text-slate-400">{pagination.page}</span>
              <button onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))} disabled={pagination.page >= pagination.totalPages}
                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">»</button>
              <button onClick={() => setPagination(prev => ({ ...prev, page: pagination.totalPages }))} disabled={pagination.page >= pagination.totalPages}
                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">»»</button>
            </nav>
          </div>
        )}
      </div>

      {/* ========== DRAWER ========== */}
      {showDrawer && <ProductDrawer product={selectedProduct} onClose={() => { setShowDrawer(false); setSelectedProduct(null); }} />}
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================
function KpiCard({ title, value, color }: { title: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    green: 'border-green-500/20 bg-green-500/5 text-green-400',
    yellow: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    orange: 'border-orange-500/20 bg-orange-500/5 text-orange-400',
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400',
    pink: 'border-pink-500/20 bg-pink-500/5 text-pink-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-400',
  };
  return (
    <div className={`rounded-xl border p-3 backdrop-blur-sm ${colorMap[color] || colorMap.blue}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{title}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function TH({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <th className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-700/80 border-b border-slate-600/50" style={style}>{children}</th>;
}

function THFixed({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <th className="sticky left-0 z-20 whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-700/80 border-b border-slate-600/50 border-r border-slate-600/30" style={style}>{children}</th>;
}

function TD({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td className="whitespace-nowrap px-3 py-2.5 text-sm" style={style}>{children}</td>;
}

function TDFixed({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: (e: React.MouseEvent) => void }) {
  return <td className={`sticky left-0 z-10 whitespace-nowrap px-3 py-2.5 text-sm bg-slate-800/90 border-r border-slate-700/30`} style={style} onClick={onClick}>{children}</td>;
}
