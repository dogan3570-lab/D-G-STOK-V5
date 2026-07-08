import React, { useEffect, useState } from 'react';

interface CategoryItem {
  id: string;
  name: string;
  externalId: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductItem {
  id: string;
  xmlKey: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  price: number | null;
  salePrice: number | null;
  images: string | null;
  status: string;
  categoryMatch: boolean;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function Categories() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [parentId, setParentId] = useState('');

  // Product matching state
  const [unmatchedProducts, setUnmatchedProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [matchCategoryId, setMatchCategoryId] = useState('');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });

  // Auto match state
  const [autoMatching, setAutoMatching] = useState(false);
  const [autoMatchResult, setAutoMatchResult] = useState<{ matchedCount: number; totalProducts: number; message: string; results: Array<{ productId: string; productName: string; categoryName: string | null }> } | null>(null);

  // Her ürün için ayrı kategori seçimi
  const [productCategorySelections, setProductCategorySelections] = useState<Record<string, string>>({});
  const [matchingProductIds, setMatchingProductIds] = useState<Set<string>>(new Set());

  useEffect(() => { 
    fetchCategories(); 
    fetchUnmatchedProducts();
  }, [pagination.page, search]);

  async function fetchCategories() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await fetch(`/categories?${params}`, { credentials: 'include' });
      const data = await response.json();
      setCategories(data.items || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUnmatchedProducts() {
    setProductsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      if (search) params.append('search', search);

      const response = await fetch(`/categories/unmatched-products?${params}`, { credentials: 'include' });
      const data = await response.json();
      setUnmatchedProducts(data.items || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setProductsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingCategory ? `/categories/${editingCategory.id}` : '/categories';
      const method = editingCategory ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          externalId: externalId || undefined,
          parentId: parentId || undefined,
        }),
      });
      if (response.ok) {
        setShowModal(false);
        setEditingCategory(null);
        setName('');
        setExternalId('');
        setParentId('');
        fetchCategories();
      }
    } catch (error) {
      console.error('Error saving category:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return;
    try {
      const response = await fetch(`/categories/${id}`, { method: 'DELETE', credentials: 'include' });
      if (response.ok) {
        fetchCategories();
      } else {
        const data = await response.json();
        alert(data.error?.message || 'Silme başarısız');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  }

  async function handleMatchProducts() {
    if (!matchCategoryId || selectedProductIds.size === 0) {
      alert('Lütfen bir kategori ve en az bir ürün seçin');
      return;
    }

    try {
      const response = await fetch('/categories/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryId: matchCategoryId,
          productIds: Array.from(selectedProductIds),
        }),
      });
      if (response.ok) {
        const data = await response.json();
        alert(`✅ ${data.message}`);
        setShowMatchModal(false);
        setSelectedProductIds(new Set());
        fetchCategories();
        fetchUnmatchedProducts();
      } else {
        const data = await response.json();
        alert(data.error?.message || 'Eşleştirme başarısız');
      }
    } catch (error) {
      console.error('Error matching products:', error);
    }
  }

  async function handleSingleMatch(productId: string) {
    const categoryId = productCategorySelections[productId];
    if (!categoryId) {
      alert('Lütfen bir kategori seçin');
      return;
    }

    setMatchingProductIds(prev => new Set(prev).add(productId));
    try {
      const response = await fetch('/categories/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryId,
          productIds: [productId],
        }),
      });
      if (response.ok) {
        const data = await response.json();
        // Başarılı - ürünü listeden kaldır
        setUnmatchedProducts(prev => prev.filter(p => p.id !== productId));
        setProductCategorySelections(prev => {
          const next = { ...prev };
          delete next[productId];
          return next;
        });
        fetchCategories();
      } else {
        const data = await response.json();
        alert(data.error?.message || 'Eşleştirme başarısız');
      }
    } catch (error) {
      console.error('Error matching product:', error);
    } finally {
      setMatchingProductIds(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  }

  async function handleAutoMatch() {
    if (!confirm('Tüm eşleşmemiş ürünleri otomatik eşleştirmek istediğinize emin misiniz?')) return;
    
    setAutoMatching(true);
    setAutoMatchResult(null);
    try {
      const response = await fetch('/categories/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (response.ok) {
        const data = await response.json();
        setAutoMatchResult(data);
        fetchUnmatchedProducts();
      } else {
        alert('Otomatik eşleştirme başarısız');
      }
    } catch (error) {
      console.error('Error auto-matching:', error);
    } finally {
      setAutoMatching(false);
    }
  }

  function openMatchModal() {
    setMatchCategoryId('');
    setSelectedProductIds(new Set());
    setShowMatchModal(true);
  }

  function toggleProductSelect(id: string) {
    const newSelected = new Set(selectedProductIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProductIds(newSelected);
  }

  function getParentName(parentId: string | null): string {
    if (!parentId) return '-';
    const parent = categories.find(c => c.id === parentId);
    return parent?.name || '-';
  }

  function getImageList(product: ProductItem): string[] {
    if (!product.images) return [];
    return product.images.split(',').filter(img => img.trim().length > 0);
  }

  function formatPrice(value: number | null | undefined): string {
    if (value == null) return '-';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Kategori Eşleştirme</h2>
          <p className="text-sm text-slate-400">Ürünleri kategorilere eşleştirin</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoMatch}
            disabled={autoMatching}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {autoMatching ? '⏳ Otomatik Eşleştiriliyor...' : '🤖 Otomatik Eşleştir'}
          </button>
          <button
            onClick={openMatchModal}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            🔗 Toplu Eşleştir
          </button>
          <button
            onClick={() => { setEditingCategory(null); setName(''); setExternalId(''); setParentId(''); setShowModal(true); }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Yeni Kategori
          </button>
        </div>
      </div>

      {/* Auto Match Result */}
      {autoMatchResult && (
        <div className="rounded-xl border border-green-700 bg-green-900/20 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-green-400 font-medium">
              ✅ {autoMatchResult.message}
            </div>
            <button onClick={() => setAutoMatchResult(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          {autoMatchResult.results.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {autoMatchResult.results.slice(0, 20).map((r, i) => (
                <div key={i} className="text-xs text-slate-400">
                  <span className="text-green-400">✓</span> {r.productName} → <span className="text-blue-400">{r.categoryName}</span>
                </div>
              ))}
              {autoMatchResult.results.length > 20 && (
                <div className="text-xs text-slate-500">...ve {autoMatchResult.results.length - 20} ürün daha</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagination({ ...pagination, page: 1 }); }}
            placeholder="Ürün veya kategori ara..."
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => { fetchCategories(); fetchUnmatchedProducts(); }}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
        >
          🔄 Ara
        </button>
      </div>

      {/* ==================== EŞLEŞMEMİŞ ÜRÜNLER ==================== */}
      {/* Her ürün için: önce ürün bilgileri, altında kategori seçimi */}
      <div className="space-y-6">
        {productsLoading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Ürünler yükleniyor...</div>
        ) : unmatchedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400 rounded-xl border border-slate-700 bg-slate-800/50">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-lg font-medium text-green-400">Tüm ürünler eşleştirilmiş!</div>
            <p className="text-sm text-slate-500 mt-1">Eşleştirilecek ürün kalmadı.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-slate-400 px-2">
              <span>Toplam {pagination.total} eşleşmemiş ürün</span>
              <div className="flex gap-2">
                <span className="text-xs text-slate-500">Sayfa {pagination.page}/{pagination.totalPages}</span>
              </div>
            </div>

            {/* Her ürün için kart - ürün bilgileri üstte, kategori seçimi altta */}
            {unmatchedProducts.map((product) => {
              const images = getImageList(product);
              const isMatching = matchingProductIds.has(product.id);
              return (
                <div key={product.id} className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden backdrop-blur-sm hover:border-slate-600 transition-colors">
                  {/* ÜST KISIM: Ürün Bilgileri */}
                  <div className="p-4 flex gap-4">
                    {/* Ürün Görseli */}
                    <div className="flex-shrink-0">
                      {images.length > 0 ? (
                        <img src={images[0]} alt="" className="h-16 w-16 rounded-lg object-cover bg-slate-700" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-slate-700 flex items-center justify-center text-slate-500 text-2xl">📦</div>
                      )}
                    </div>

                    {/* Ürün Detayları - Grid */}
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                      <div>
                        <div className="text-xs text-slate-400">Ürün Adı</div>
                        <div className="text-sm text-white font-medium truncate max-w-[250px]" title={product.title || product.xmlKey}>
                          {product.title || product.xmlKey}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">XML Key</div>
                        <div className="text-sm text-slate-300 font-mono truncate">{product.xmlKey}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">SKU</div>
                        <div className="text-sm text-slate-300">{product.sku || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Barkod</div>
                        <div className="text-sm text-slate-300">{product.barcode || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Stok</div>
                        <div className={`text-sm font-medium ${product.stock === 0 ? 'text-red-400' : product.stock < 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {product.stock}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Fiyat</div>
                        <div className="text-sm text-white">{formatPrice(product.salePrice || product.price)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Durum</div>
                        <div className="text-sm">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            product.status === 'XML' ? 'bg-blue-500/10 text-blue-400' :
                            product.status === 'READY' ? 'bg-green-500/10 text-green-400' :
                            'bg-slate-500/10 text-slate-400'
                          }`}>
                            {product.status}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Mevcut Kategori</div>
                        <div className="text-sm text-slate-300">{product.category?.name || '-'}</div>
                      </div>
                    </div>
                  </div>

                  {/* ALT KISIM: Kategori Seçimi ve Eşleştir Butonu */}
                  <div className="border-t border-slate-700 bg-slate-800/80 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 max-w-md">
                        <select
                          value={productCategorySelections[product.id] || ''}
                          onChange={(e) => setProductCategorySelections(prev => ({ ...prev, [product.id]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">-- Kategori Seçin --</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => handleSingleMatch(product.id)}
                        disabled={!productCategorySelections[product.id] || isMatching}
                        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {isMatching ? '⏳ Eşleştiriliyor...' : '🔗 Eşleştir'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
                <div className="text-sm text-slate-400">
                  Toplam {pagination.total} ürün
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page <= 1}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    ◀ Önceki
                  </button>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page >= pagination.totalPages}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    Sonraki ▶
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ==================== KATEGORİ LİSTESİ ==================== */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-white">Kategoriler</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">🗂️</div>
            <div>Henüz kategori yok</div>
            <button onClick={() => { setEditingCategory(null); setName(''); setExternalId(''); setParentId(''); setShowModal(true); }}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              + İlk Kategoriyi Ekle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Kategori Adı</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Dış ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Üst Kategori</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Oluşturulma</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-300">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {categories.map((category) => (
                  <tr key={category.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{category.name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{category.externalId || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{getParentName(category.parentId)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(category.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingCategory(category); setName(category.name); setExternalId(category.externalId || ''); setParentId(category.parentId || ''); setShowModal(true); }}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                          title="Düzenle"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          title="Sil"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Category Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Kategori Adı</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Dış ID (Opsiyonel)</label>
                <input
                  type="text"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Üst Kategori (Opsiyonel)</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Üst Kategori Yok --</option>
                  {categories
                    .filter(c => c.id !== editingCategory?.id)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  {editingCategory ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toplu Eşleştirme Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowMatchModal(false)}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Toplu Kategori Eşleştirme</h3>
                <p className="text-sm text-slate-400">Seçili ürünleri bir kategoriye eşleştirin</p>
              </div>
              <button
                onClick={() => setShowMatchModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Category Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Hedef Kategori</label>
              <select
                value={matchCategoryId}
                onChange={(e) => setMatchCategoryId(e.target.value)}
                className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- Kategori Seçin --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Unmatched Products */}
            <div className="rounded-lg border border-slate-700 bg-slate-800/50">
              {productsLoading ? (
                <div className="flex items-center justify-center p-8 text-slate-400">Ürünler yükleniyor...</div>
              ) : unmatchedProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                  <div className="text-4xl mb-2">✅</div>
                  <div>Tüm ürünler eşleştirilmiş</div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                    <span className="text-sm text-slate-400">
                      {unmatchedProducts.length} eşleşmemiş ürün bulundu
                    </span>
                    <button
                      onClick={() => {
                        if (selectedProductIds.size === unmatchedProducts.length) {
                          setSelectedProductIds(new Set());
                        } else {
                          setSelectedProductIds(new Set(unmatchedProducts.map(p => p.id)));
                        }
                      }}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      {selectedProductIds.size === unmatchedProducts.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-700/50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 w-12"></th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Ürün</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">SKU</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Stok</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Fiyat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {unmatchedProducts.map((product) => (
                          <tr key={product.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={selectedProductIds.has(product.id)}
                                onChange={() => toggleProductSelect(product.id)}
                                className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="font-medium text-white text-sm">{product.title || product.xmlKey}</div>
                            </td>
                            <td className="px-4 py-2 text-sm text-slate-400">{product.sku || '-'}</td>
                            <td className="px-4 py-2 text-sm text-slate-400">{product.stock}</td>
                            <td className="px-4 py-2 text-sm text-slate-400">{formatPrice(product.salePrice || product.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowMatchModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleMatchProducts}
                disabled={!matchCategoryId || selectedProductIds.size === 0}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {selectedProductIds.size} Ürünü Eşleştir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
