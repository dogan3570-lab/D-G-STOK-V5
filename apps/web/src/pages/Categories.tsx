import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/ui/Toast';
import KpiCard from '../components/ui/KpiCard';
import { useDebouncedCallback } from '../hooks/useDebounce';
import { useKeyboardShortcuts } from '../hooks/useKeyboard';
import { MARKETPLACE_LOGOS, STATUS_BADGE_COLORS, STATUS_BADGE_LABELS } from '../lib/constants';

// ==================== TYPES ====================
interface Marketplace { id: string; key: string; name: string; }
interface XmlSource { id: string; name: string; }
interface SystemCategory { id: string; name: string; parentId: string | null; children: SystemCategory[]; productCount: number; }

interface ProductItem {
  id: string; xmlKey: string; title: string | null; sku: string | null;
  barcode: string | null; images: string | null; stock: number; salePrice: number | null;
  categoryId: string | null; categoryMatch: boolean; brandMatch: boolean; variantMatch: boolean;
  templateMatch: boolean; supplierCategory: string | null; aiScore: number | null; status: string;
  xmlSource?: { id: string; name: string; company?: string | null } | null;
  category?: { id: string; name: string } | null; brand?: { id: string; name: string } | null;
}

interface CategoryStats {
  totalXmlCategories: number;
  matchedCategories: number;
  unmatchedProducts: number;
  aiSuggested: number;
  manualMatched: number;
  errorCategories: number;
  totalCategories: number;
}

interface FilterState {
  search: string;
  xmlSourceId: string;
  status: string;
  matchStatus: string;
  page: number;
  limit: number;
}

const INITIAL_FILTERS: FilterState = {
  search: '', xmlSourceId: '', status: '', matchStatus: '',
  page: 1, limit: 50,
};

const PAGE_SIZES = [25, 50, 100, 200];
const STATUS_OPTS = ['', 'XML', 'READY', 'DRAFT', 'SENT', 'PASSIVE', 'ERROR'];
const AI_COLORS = {
  high: 'bg-green-500/10 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  low: 'bg-red-500/10 text-red-400 border-red-500/30',
  none: 'bg-slate-700/50 text-slate-500 border-slate-600/30',
};

// ==================== SUB-COMPONENTS ====================

function AiBadge({ score }: { score: number | null }) {
  if (score == null) return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${AI_COLORS.none}`}>—</span>;
  const pct = Math.round(score * 100);
  const level = score >= 0.85 ? 'high' : score >= 0.70 ? 'medium' : 'low';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${AI_COLORS[level]}`}
      title={`AI güven skoru: %${pct}`}>
      %{pct}
    </span>
  );
}

function MatchBadge({ matched, label }: { matched: boolean; label: string }) {
  return (
    <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
      matched ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
    }`} title={`${label}: ${matched ? 'Eşleşti' : 'Eşleşmedi'}`}>
      {label[0]}
    </span>
  );
}

// ==================== MAIN COMPONENT ====================
export default function CategoryIntelligenceV7() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [activeMpId, setActiveMpId] = useState('');
  const [xmlSources, setXmlSources] = useState<XmlSource[]>([]);
  const [systemTree, setSystemTree] = useState<SystemCategory[]>([]);
  const [stats, setStats] = useState<CategoryStats | null>(null);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCatId, setSelectedCatId] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [catSearch, setCatSearch] = useState('');
  const [recentCats, setRecentCats] = useState<string[]>([]);

  // AI
  const [aiRunning, setAiRunning] = useState(false);

  // Modal
  const [showMpModal, setShowMpModal] = useState(false);
  const [mpName, setMpName] = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // ==================== COMPUTED ====================
  const activeMp = useMemo(
    () => marketplaces.find(m => m.id === activeMpId),
    [marketplaces, activeMpId],
  );
  const mpNameStr = activeMp?.name || 'Pazaryeri';
  const mpIconStr = (activeMp && MARKETPLACE_LOGOS[activeMp.key]) || '🛒';
  const allSelected = products.length > 0 && selectedIds.size === products.length;

  // ==================== DATA FETCHING ====================
  const fetchMarketplaces = useCallback(async () => {
    const res = await apiFetch<any>('/marketplaces');
    if (res.ok && res.data?.items) {
      setMarketplaces(res.data.items);
      if (res.data.items.length > 0 && !activeMpId) {
        setActiveMpId(res.data.items[0].id);
      }
    }
  }, [activeMpId]);

  const fetchXmlSources = useCallback(async () => {
    const res = await apiFetch<any>('/xml-sources');
    if (res.ok && res.data?.items) setXmlSources(res.data.items);
  }, []);

  const fetchTree = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeMpId) params.append('marketplaceId', activeMpId);
    const res = await apiFetch<{ items: SystemCategory[] }>(`/categories/tree?${params}`);
    if (res.ok && res.data) setSystemTree(res.data.items || []);
  }, [activeMpId]);

  const fetchStats = useCallback(async () => {
    const res = await apiFetch<CategoryStats>('/categories/stats');
    if (res.ok && res.data) setStats(res.data);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(filters.page),
        limit: String(filters.limit),
      });
      if (filters.search) params.append('search', filters.search);
      if (filters.xmlSourceId) params.append('xmlSourceId', filters.xmlSourceId);
      if (filters.status) params.append('status', filters.status);
      if (filters.matchStatus === 'matched') params.append('categoryId', 'not_null');
      else if (filters.matchStatus === 'unmatched') params.append('uncategorized', 'true');

      const res = await apiFetch<any>(`/categories/products?${params}`);
      if (res.ok && res.data) {
        setProducts(res.data.items || []);
        setTotal(res.data.pagination?.total || 0);
        setTotalPages(res.data.pagination?.totalPages || 0);
      }
    } catch {
      showToast('error', 'Ürünler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    Promise.all([fetchMarketplaces(), fetchXmlSources(), fetchStats()]);
  }, []);

  useEffect(() => {
    fetchTree();
  }, [activeMpId, fetchTree]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentCats');
      if (saved) setRecentCats(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // ==================== HANDLERS ====================
  const handleSearch = useDebouncedCallback((value: string) => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }));
  }, 300);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value, page: key !== 'page' ? 1 : (value as number) }));
  }, []);

  const handleMatch = useCallback(async (ids: string[], categoryId: string) => {
    try {
      const res = await apiFetch<any>('/categories/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, productIds: ids }),
      });
      if (res.ok) {
        showToast('success', `✅ ${ids.length} ürün eşleştirildi`);
        setRecentCats(prev => {
          const n = [categoryId, ...prev.filter(c => c !== categoryId)].slice(0, 10);
          localStorage.setItem('recentCats', JSON.stringify(n));
          return n;
        });
        setSelectedIds(new Set());
        setSelectedCatId('');
        fetchProducts();
        fetchStats();
      } else {
        showToast('error', res.error?.message || 'Eşleştirme başarısız');
      }
    } catch {
      showToast('error', 'Ağ hatası');
    }
  }, [fetchProducts, fetchStats]);

  const handleBulkMatch = useCallback(() => {
    if (!selectedCatId || selectedIds.size === 0) return;
    handleMatch(Array.from(selectedIds), selectedCatId);
  }, [selectedCatId, selectedIds, handleMatch]);

  const handleAiMatch = useCallback(async () => {
    setAiRunning(true);
    try {
      const res = await apiFetch<any>('/categories/ai-match', { method: 'POST', body: JSON.stringify({}) });
      if (res.ok && res.data) {
        showToast('success', `🤖 ${res.data.matchedCount} ürün eşleştirildi`);
      } else {
        showToast('error', res.error?.message || 'AI eşleştirme başarısız');
      }
      fetchProducts();
      fetchStats();
    } catch {
      showToast('error', 'Ağ hatası');
    } finally {
      setAiRunning(false);
    }
  }, [fetchProducts, fetchStats]);

  const handleAddMarketplace = useCallback(async () => {
    if (!mpName.trim()) return;
    const key = mpName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
    try {
      const res = await apiFetch<any>('/marketplaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, name: mpName.trim() }),
      });
      if (res.ok) {
        showToast('success', '✅ Pazaryeri eklendi');
        setShowMpModal(false);
        setMpName('');
        fetchMarketplaces();
      } else {
        showToast('error', res.error?.message || 'Ekleme başarısız');
      }
    } catch {
      showToast('error', 'Ağ hatası');
    }
  }, [mpName, fetchMarketplaces]);

  const handleDeleteMarketplace = useCallback(async (id: string) => {
    if (!confirm('Bu pazaryerini kaldırmak istediğinizden emin misiniz?')) return;
    try {
      await apiFetch(`/marketplaces/${id}`, { method: 'DELETE' });
      setMarketplaces(prev => prev.filter(m => m.id !== id));
      if (activeMpId === id) setActiveMpId('');
      showToast('success', 'Pazaryeri kaldırıldı');
    } catch {
      showToast('error', 'Silme başarısız');
    }
  }, [activeMpId]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => prev.size === products.length ? new Set() : new Set(products.map(p => p.id)));
  }, [products]);

  const toggleCatExpand = useCallback((id: string) => {
    setExpandedCats(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  // ==================== CATEGORY TREE ====================
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

  const renderTree = useCallback((nodes: SystemCategory[], depth = 0): React.ReactNode => {
    return nodes.map(cat => {
      const hasChildren = cat.children?.length > 0;
      const expanded = expandedCats.has(cat.id);
      return (
        <div key={cat.id}>
          <button
            type="button"
            onClick={() => setSelectedCatId(cat.id)}
            className={`w-full flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors text-left ${
              selectedCatId === cat.id
                ? 'bg-blue-600/30 text-blue-200 font-medium'
                : 'hover:bg-slate-600/50 text-slate-300'
            }`}
            style={{ paddingLeft: `${6 + depth * 14}px` }}
            aria-selected={selectedCatId === cat.id}
            aria-label={`${cat.name} (${cat.productCount} ürün)`}
          >
            {hasChildren ? (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); toggleCatExpand(cat.id); }}
                className="w-3.5 text-center text-slate-500 hover:text-white shrink-0"
                aria-label={expanded ? 'Daralt' : 'Genişlet'}
              >
                {expanded ? '▼' : '▶'}
              </span>
            ) : (
              <span className="w-3.5 text-slate-600 shrink-0">•</span>
            )}
            <span className="truncate flex-1">{cat.name}</span>
            <span className="text-slate-500 ml-auto text-[10px] shrink-0">({cat.productCount})</span>
          </button>
          {hasChildren && expanded && renderTree(cat.children, depth + 1)}
        </div>
      );
    });
  }, [expandedCats, selectedCatId, toggleCatExpand]);

  // ==================== KEYBOARD SHORTCUTS ====================
  useKeyboardShortcuts([
    { key: 'a', ctrl: true, handler: () => toggleSelectAll() },
    { key: 'Escape', handler: () => { setSelectedCatId(''); setSelectedIds(new Set()); } },
    { key: 'Enter', handler: () => { if (selectedCatId && selectedIds.size > 0) handleBulkMatch(); } },
  ]);

  // ==================== RENDER ====================
  return (
    <div className="space-y-4">
      {/* ==================== HEADER ==================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🏷️</span> Kategori Intelligence Engine
            <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-normal">V7.0</span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {total.toLocaleString('tr-TR')} ürün · {stats?.totalCategories || 0} sistem kategorisi
            {activeMp && ` · ${mpIconStr} ${mpNameStr}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedCatId && selectedIds.size > 0 && (
            <button
              onClick={handleBulkMatch}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-lg transition-all"
              aria-label={`${selectedIds.size} ürünü seçili kategoriye eşleştir`}
            >
              🔗 {selectedIds.size} Ürünü Eşleştir
            </button>
          )}
          <button
            onClick={handleAiMatch}
            disabled={aiRunning}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
            aria-label="AI ile toplu eşleştirme başlat"
          >
            {aiRunning ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                Eşleştiriliyor...
              </span>
            ) : '🤖 AI ile Eşleştir'}
          </button>
        </div>
      </div>

      {/* ==================== KPI ==================== */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <KpiCard title="XML Kategori" value={stats.totalXmlCategories} color="blue" />
          <KpiCard title="Eşleşen Ürün" value={stats.matchedCategories} color="green" />
          <KpiCard title="Eşleşmeyen" value={stats.unmatchedProducts} color="yellow" />
          <KpiCard title="AI Önerisi" value={stats.aiSuggested} color="purple" />
          <KpiCard title="Manuel Eşleşen" value={stats.manualMatched} color="teal" />
          <KpiCard title="Sistem Kategori" value={stats.totalCategories} color="cyan" />
          <KpiCard title="Hatalı" value={stats.errorCategories} color="red" />
        </div>
      )}

      {/* ==================== PAZARYERİ SEÇİCİ ==================== */}
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/50 p-2 backdrop-blur-sm overflow-x-auto">
        <button
          onClick={() => setShowMpModal(true)}
          className="shrink-0 rounded-lg bg-green-600/20 px-2.5 py-1.5 text-xs text-green-400 hover:bg-green-600/30 border border-green-600/30 transition-colors"
        >
          + Ekle
        </button>
        {marketplaces.map(mp => (
          <div key={mp.id} className="flex items-center gap-0.5 shrink-0 group">
            <button
              onClick={() => setActiveMpId(mp.id)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeMpId === mp.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              aria-pressed={activeMpId === mp.id}
              aria-label={`${mp.name} pazaryerini seç`}
            >
              <span>{MARKETPLACE_LOGOS[mp.key] || '🛒'}</span>
              <span>{mp.name}</span>
            </button>
            <button
              onClick={() => handleDeleteMarketplace(mp.id)}
              className="rounded-full w-4 h-4 flex items-center justify-center text-[10px] bg-slate-700 text-slate-500 hover:bg-red-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`${mp.name} pazaryerini kaldır`}
            >
              ✕
            </button>
          </div>
        ))}
        {marketplaces.length === 0 && (
          <span className="text-xs text-slate-500 italic">Henüz pazaryeri eklenmemiş</span>
        )}
      </div>

      {/* ==================== FİLTRELER ==================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-2.5 backdrop-blur-sm">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" aria-hidden="true">🔍</span>
          <input
            type="text"
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="SKU, barkod, ürün adı, XML kategorisi..."
            className="w-full rounded-lg border border-slate-600 bg-slate-700 pl-8 pr-3 py-1.5 text-sm text-white placeholder-slate-400"
            aria-label="Ürün ara"
          />
        </div>
        <select
          value={filters.xmlSourceId}
          onChange={(e) => updateFilter('xmlSourceId', e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white"
          aria-label="XML kaynağı filtresi"
        >
          <option value="">Tüm XML</option>
          {xmlSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white"
          aria-label="Durum filtresi"
        >
          <option value="">Tüm Durum</option>
          {STATUS_OPTS.filter(Boolean).map(s => (
            <option key={s} value={s}>
              {STATUS_BADGE_LABELS[s] || s}
            </option>
          ))}
        </select>
        <select
          value={filters.matchStatus}
          onChange={(e) => updateFilter('matchStatus', e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white"
          aria-label="Eşleşme durumu filtresi"
        >
          <option value="">Tüm Eşleşme</option>
          <option value="matched">Eşleşen</option>
          <option value="unmatched">Eşleşmeyen</option>
        </select>
        <select
          value={filters.limit}
          onChange={(e) => updateFilter('limit', Number(e.target.value))}
          className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white"
          aria-label="Sayfa boyutu"
        >
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s} ürün/sayfa</option>)}
        </select>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {total.toLocaleString('tr-TR')} ürün
        </span>
      </div>

      {/* ==================== SEÇİM TOOLBAR ==================== */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-900/20 border border-blue-700/30" role="toolbar" aria-label="Seçim araçları">
          <span className="text-sm text-blue-300 font-medium" aria-live="polite">
            {selectedIds.size} ürün seçili
          </span>
          <div className="flex gap-2">
            {selectedCatId && (
              <button onClick={handleBulkMatch} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
                🔗 Seçilileri Eşleştir
              </button>
            )}
            <button onClick={() => setSelectedIds(new Set())} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 transition-colors">
              ✕ Seçimi Temizle
            </button>
          </div>
        </div>
      )}

      {/* ==================== ANA İÇERİK ==================== */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* ==================== ÜRÜN TABLOSU ==================== */}
        <div className="flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto" role="table" aria-label="Ürün listesi">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12" role="status">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
                <span className="text-sm text-slate-400">Ürünler yükleniyor...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <div className="text-5xl mb-3">📦</div>
                <div className="text-lg font-medium text-slate-300">Ürün bulunamadı</div>
                <p className="text-sm text-slate-500 mt-1">
                  {filters.search || filters.status || filters.matchStatus
                    ? 'Filtrelere uygun ürün yok. Filtreleri değiştirmeyi deneyin.'
                    : 'Henüz XML kaynağından ürün yüklenmemiş. Önce XML kaynağı ekleyin.'}
                </p>
                {filters.search || filters.status || filters.matchStatus ? (
                  <button
                    onClick={() => setFilters(INITIAL_FILTERS)}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    Filtreleri Temizle
                  </button>
                ) : null}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-700/50 sticky top-0 z-10">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-700/50 px-3 py-3 w-10" scope="col">
                      <input
                        type="checkbox"
                        onChange={toggleSelectAll}
                        checked={allSelected}
                        className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                        aria-label="Tümünü seç/kaldır"
                      />
                    </th>
                    <th className="sticky left-10 z-20 bg-slate-700/50 px-2 py-3 w-10" scope="col" aria-label="Görsel" />
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-white whitespace-nowrap min-w-[80px]" scope="col">SKU</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-white whitespace-nowrap min-w-[90px]" scope="col">Barkod</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap min-w-[180px]" scope="col">Ürün Adı</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap min-w-[70px]" scope="col">XML</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap min-w-[160px]" scope="col">XML Kategorisi</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap min-w-[160px]" scope="col">{mpIconStr} {mpNameStr}</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap min-w-[50px]" scope="col">AI</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap min-w-[60px]" scope="col">K.M.V</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap min-w-[70px]" scope="col">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {products.map(p => (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        selectedIds.has(p.id) ? 'bg-blue-900/20' : 'bg-slate-800/30 hover:bg-slate-700/30'
                      }`}
                      tabIndex={0}
                      role="row"
                      aria-selected={selectedIds.has(p.id)}
                    >
                      <td className="sticky left-0 z-10 bg-slate-800/30 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                          aria-label={`${p.title || p.xmlKey} seç`}
                        />
                      </td>
                      <td className="sticky left-10 z-10 bg-slate-800/30 px-2 py-2.5">
                        {p.images ? (
                          <img src={p.images.split(',')[0]} alt=""
                            className="w-8 h-8 rounded object-cover bg-slate-700"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23334155" width="100" height="100"/><text fill="%2394a3b8" font-size="12" x="50" y="55" text-anchor="middle">📦</text></svg>'; }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-xs" aria-hidden="true">📦</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-300 font-mono">{p.sku || '-'}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-300">{p.barcode || '-'}</td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs font-medium text-white truncate max-w-[220px]" title={p.title || p.xmlKey || ''}>{p.title || p.xmlKey}</div>
                        <div className="text-[10px] text-slate-500 truncate">{p.xmlKey}</div>
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500">{p.xmlSource?.name || '-'}</td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-400 max-w-[160px] truncate" title={p.supplierCategory || ''}>{p.supplierCategory || '-'}</td>
                      <td className="px-3 py-2.5">
                        {p.categoryId ? (
                          <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded truncate inline-block max-w-[150px]" title={p.category?.name || ''}>
                            {p.category?.name || '✅ Eşleşmiş'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><AiBadge score={p.aiScore} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-0.5">
                          <MatchBadge matched={p.categoryMatch} label="Kategori" />
                          <MatchBadge matched={p.brandMatch} label="Marka" />
                          <MatchBadge matched={p.variantMatch} label="Varyant" />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[10px]">
                        <span className={`font-medium ${
                          p.status === 'XML' ? 'text-blue-400' :
                          p.status === 'READY' ? 'text-green-400' :
                          p.status === 'ERROR' ? 'text-red-400' :
                          p.status === 'DRAFT' ? 'text-yellow-400' :
                          'text-slate-400'
                        }`}>{STATUS_BADGE_LABELS[p.status] || p.status || 'XML'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ==================== PAGINATION ==================== */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-2.5 border-t border-slate-700 bg-slate-800/30 gap-2">
              <span className="text-xs text-slate-500">
                Sayfa {filters.page}/{totalPages} · {total.toLocaleString('tr-TR')} ürün
              </span>
              <nav className="flex gap-1" aria-label="Sayfalama">
                <button
                  onClick={() => updateFilter('page', Math.max(1, filters.page - 1))}
                  disabled={filters.page <= 1}
                  className="rounded px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  aria-label="Önceki sayfa"
                >
                  ◀
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(filters.page - 2, totalPages - 4));
                  const num = start + i;
                  if (num > totalPages) return null;
                  return (
                    <button
                      key={num}
                      onClick={() => updateFilter('page', num)}
                      className={`rounded px-2.5 py-1 text-xs transition-colors ${
                        filters.page === num
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                      aria-label={`Sayfa ${num}`}
                      aria-current={filters.page === num ? 'page' : undefined}
                    >
                      {num}
                    </button>
                  );
                })}
                <button
                  onClick={() => updateFilter('page', Math.min(totalPages, filters.page + 1))}
                  disabled={filters.page >= totalPages}
                  className="rounded px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  aria-label="Sonraki sayfa"
                >
                  ▶
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* ==================== KATEGORİ PANELİ ==================== */}
        <div className="w-full lg:w-80 shrink-0 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm flex flex-col max-h-[600px] lg:max-h-[calc(100vh-220px)]">
          {/* Panel Header */}
          <div className="p-3 border-b border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <span>{mpIconStr}</span> {mpNameStr} Kategorileri
              </h3>
              {selectedCatId && (
                <button
                  onClick={() => setSelectedCatId('')}
                  className="text-[10px] text-slate-500 hover:text-white transition-colors"
                  aria-label="Kategori seçimini temizle"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]" aria-hidden="true">🔍</span>
              <input
                type="text"
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder="Kategori ara..."
                className="w-full rounded-lg border border-slate-600 bg-slate-700 pl-6 pr-2.5 py-1.5 text-xs text-white placeholder-slate-400"
                aria-label="Kategori ara"
              />
            </div>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {/* Recent Categories */}
            {recentCats.length > 0 && !catSearch && (
              <div className="mb-2">
                <div className="text-[10px] text-slate-500 mb-1 px-1 flex items-center gap-1">
                  <span>🕐</span> Son Kullanılanlar
                </div>
                {recentCats.slice(0, 5).map(id => {
                  const cat = systemTree.find(c => c.id === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedCatId(id)}
                      className={`w-full text-left px-2 py-1 rounded cursor-pointer text-[10px] transition-colors ${
                        selectedCatId === id
                          ? 'bg-blue-600/30 text-blue-200'
                          : 'text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      {cat?.name || id.substring(0, 8) + '...'}
                    </button>
                  );
                })}
                <div className="border-t border-slate-700/50 my-2" />
              </div>
            )}

            {/* Tree */}
            {renderTree(filteredTree)}

            {filteredTree.length === 0 && catSearch && (
              <div className="text-[10px] text-slate-500 text-center py-4">
                "{catSearch}" için kategori bulunamadı
              </div>
            )}
          </div>

          {/* Panel Footer */}
          {selectedCatId && (
            <div className="p-3 border-t border-slate-700 bg-slate-800/80">
              <div className="text-[10px] text-slate-500 mb-2 truncate">
                Seçili: {systemTree.find(c => c.id === selectedCatId)?.name || selectedCatId.substring(0, 8)}
              </div>
              <button
                onClick={() => {
                  if (selectedIds.size > 0) handleBulkMatch();
                  else if (products.length > 0) {
                    handleMatch([products[0].id], selectedCatId);
                  }
                }}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                aria-label={selectedIds.size > 0 ? `${selectedIds.size} ürünü eşleştir` : 'İlk ürünü eşleştir'}
              >
                🔗 {selectedIds.size > 0 ? `${selectedIds.size} Ürünü Eşleştir` : 'İlk Ürünü Eşleştir'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ==================== PAZARYERİ EKLE MODAL ==================== */}
      {showMpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowMpModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Pazaryeri ekle"
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <span>➕</span> Pazaryeri Ekle
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Pazaryeri Adı</label>
                <input
                  type="text"
                  value={mpName}
                  onChange={(e) => setMpName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Örn: Trendyol, Hepsiburada"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter' && mpName.trim()) handleAddMarketplace(); }}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowMpModal(false); setMpName(''); }}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleAddMarketplace}
                  disabled={!mpName.trim()}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Ekle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
