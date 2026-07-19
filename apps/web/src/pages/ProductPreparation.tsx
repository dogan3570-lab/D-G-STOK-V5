// ==================== URUN HAZIRLAMA MERKEZI V6.0 ====================
// Tek satir, 4 islem karti, inline duzenleme
// Sadece eksik urunler gosterilir
// DG STOK V5.0 - Profesyonel Entegrator
import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import PrepSummary from './prep/PrepSummary';
import PrepProductRow from './prep/PrepProductRow';
import type { ProductPrepData, PrepStats } from './prep/types';

const PAGE_SIZE = 50;

export default function ProductPreparation() {
  // State
  const [stats, setStats] = useState<PrepStats | null>(null);
  const [allProducts, setAllProducts] = useState<ProductPrepData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'missing' | 'review'>('all');

  // ===== ISTATISTIKLERI CEK =====
  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch<any>('/products/stats');
      if (res.ok && res.data) {
        const d = res.data;
        setStats({
          total: d.totalProducts || 0,
          ready: d.readyForListing || 0,
          missing: (d.pendingCategory || 0) + (d.pendingBrand || 0) + (d.pendingVariant || 0),
          review: d.variantAnalysisPending || 0,
          dispatchReady: d.readyForListing || 0,
        });
      }
    } catch {}
  }, []);

  // ===== URUNLERI CEK =====
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search.trim()) params.append('search', search.trim());

      const res = await apiFetch<{ items: ProductPrepData[]; pagination: { total: number } }>(
        `/products?${params}`
      );
      if (res.ok && res.data) {
        // Sadece eksik urunleri goster (en az 1 adim tamamlanmamis)
        const incomplete = (res.data.items || []).filter(
          p => !p.categoryMatch || !p.brandMatch || !p.variantMatch || !p.templateMatch
        );

        // Filtre moduna gore filtrele
        let filtered = incomplete;
        if (filterMode === 'missing') {
          filtered = incomplete.filter(p => !p.categoryMatch || !p.brandMatch || !p.templateMatch);
        } else if (filterMode === 'review') {
          filtered = incomplete.filter(p => !p.variantMatch);
        }

        setAllProducts(filtered);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, filterMode]);

  // ===== ILK YUKLEME =====
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ===== KAYIT SONRASI =====
  const handleSaved = useCallback(() => {
    // Hem istatistikleri hem urunleri tazele
    fetchStats();
    fetchProducts();
  }, [fetchStats, fetchProducts]);

  // ===== ARAMA =====
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // ===== SAYFALAMA =====
  const totalPages = Math.ceil(allProducts.length / PAGE_SIZE) || 1;

  // ===== FILTRE SAYISI =====
  const missingCount = allProducts.filter(
    p => !p.categoryMatch || !p.brandMatch || !p.templateMatch
  ).length;
  const reviewCount = allProducts.filter(p => !p.variantMatch).length;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🔧</span> Ürün Hazırlama Merkezi
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-normal">
              V6.0
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Sadece eksik ürünler gösterilir · İşlem sonrası otomatik güncellenir
          </p>
        </div>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="🔍 Ürün, SKU veya barkod ara..."
            className="w-64 rounded-lg border border-slate-600 bg-slate-700/50 pl-3 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
      </div>

      {/* UST OZET KARTLARI */}
      <PrepSummary stats={stats} loading={!stats} />

      {/* FILTRELER */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setFilterMode('all'); setPage(1); }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filterMode === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          🗂️ Tümü <span className="opacity-60 ml-1">({allProducts.length})</span>
        </button>
        <button
          onClick={() => { setFilterMode('missing'); setPage(1); }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filterMode === 'missing'
              ? 'bg-red-600/80 text-white'
              : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          ❌ Eksik <span className="opacity-60 ml-1">({missingCount})</span>
        </button>
        <button
          onClick={() => { setFilterMode('review'); setPage(1); }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filterMode === 'review'
              ? 'bg-amber-600/80 text-white'
              : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          ⚠️ İncelenecek <span className="opacity-60 ml-1">({reviewCount})</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={() => { fetchStats(); fetchProducts(); }}
          className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 transition-colors"
          title="Yenile"
        >
          🔄
        </button>
      </div>

      {/* UYARI: Hic eksik urun yoksa */}
      {!loading && allProducts.length === 0 && !search && (
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-900/10 p-8 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h3 className="text-lg font-semibold text-emerald-400 mb-1">Tüm Ürünler Hazır</h3>
          <p className="text-sm text-slate-400">
            Bütün ürünlerin kategorisi, markası, varyantı ve şablonu tamamlanmış.
            <br />
            Eksik ürün çıktığında burada görünecek.
          </p>
        </div>
      )}

      {/* ARAMA SONUCU YOKSA */}
      {!loading && allProducts.length === 0 && search && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center">
          <div className="text-4xl mb-2">🔍</div>
          <p className="text-sm text-slate-400">Aramanızla eşleşen eksik ürün bulunamadı</p>
          <button
            onClick={() => { setSearch(''); setPage(1); }}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            Filtreyi temizle
          </button>
        </div>
      )}

      {/* URUN TABLOSU */}
      {allProducts.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 backdrop-blur-sm overflow-hidden">
          {/* Tablo Header */}
          <div className="hidden sm:grid grid-cols-[12rem_1fr] gap-2 px-3 py-2 bg-slate-800/60 border-b border-slate-700/50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ürün</div>
            <div className="grid grid-cols-4 gap-2">
              {['Kategori', 'Marka', 'Varyant', 'Listeleme'].map(h => (
                <div key={h} className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">
                  {h}
                </div>
              ))}
            </div>
          </div>

          {/* Urun satirlari */}
          <div className="divide-y divide-slate-700/50">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <p className="text-xs text-slate-400 mt-2">Yükleniyor...</p>
              </div>
            ) : (
              allProducts.map(product => (
                <PrepProductRow
                  key={product.id}
                  product={product}
                  onSaved={handleSaved}
                />
              ))
            )}
          </div>

          {/* SAYFALAMA */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700 bg-slate-800/60">
            <span className="text-xs text-slate-500">
              {allProducts.length} eksik ürün gösteriliyor
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                ◀ Önceki
              </button>
              <span className="text-xs text-slate-400 px-1">
                Sayfa {page}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
                className="rounded px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                Sonraki ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
