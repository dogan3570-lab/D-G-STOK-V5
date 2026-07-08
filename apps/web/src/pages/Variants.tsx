import React, { useEffect, useState } from 'react';

interface VariantItem {
  id: string;
  name: string;
  value: string;
  productId: string;
  product?: {
    id: string;
    title: string | null;
    xmlKey: string;
    sku: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface ProductItem {
  id: string;
  xmlKey: string;
  title: string | null;
  sku: string | null;
  variantMatch: boolean;
}

const VARIANT_TYPES = [
  { value: 'Renk', label: 'Renk', icon: '🎨' },
  { value: 'Beden', label: 'Beden', icon: '👕' },
  { value: 'Numara', label: 'Numara', icon: '🔢' },
  { value: 'Yaş', label: 'Yaş', icon: '👶' },
  { value: 'Desen', label: 'Desen', icon: '🎭' },
  { value: 'Materyal', label: 'Materyal / Kumaş', icon: '🧵' },
  { value: 'Kalıp', label: 'Kalıp', icon: '📐' },
  { value: 'Cinsiyet', label: 'Cinsiyet', icon: '👤' },
  { value: 'Mevsim', label: 'Mevsim', icon: '🌤️' },
  { value: 'Boy', label: 'Boy', icon: '📏' },
  { value: 'Ebat', label: 'Ebat', icon: '📐' },
  { value: 'Kapasite', label: 'Kapasite', icon: '📦' },
];

export default function Variants() {
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VariantItem | null>(null);
  const [variantName, setVariantName] = useState('');
  const [variantValue, setVariantValue] = useState('');
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  // Products without variant match
  const [unmatchedProducts, setUnmatchedProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchVariantName, setBatchVariantName] = useState('');
  const [batchVariantValue, setBatchVariantValue] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  useEffect(() => { fetchVariants(); }, []);

  async function fetchVariants() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterType) params.append('name', filterType);

      const response = await fetch(`/variants?${params}`, { credentials: 'include' });
      const data = await response.json();
      setVariants(data.items || []);
    } catch (error) {
      console.error('Error fetching variants:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUnmatchedProducts() {
    setProductsLoading(true);
    try {
      const response = await fetch('/products?limit=100', { credentials: 'include' });
      const data = await response.json();
      const unmatched = (data.items || []).filter((p: ProductItem) => !p.variantMatch);
      setUnmatchedProducts(unmatched);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setProductsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingVariant ? `/variants/${editingVariant.id}` : '/variants';
      const method = editingVariant ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: variantName,
          value: variantValue,
          productId: productId || undefined,
        }),
      });
      if (response.ok) {
        setShowModal(false);
        setEditingVariant(null);
        setVariantName('');
        setVariantValue('');
        setProductId('');
        fetchVariants();
      }
    } catch (error) {
      console.error('Error saving variant:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu varyantı silmek istediğinizden emin misiniz?')) return;
    try {
      const response = await fetch(`/variants/${id}`, { method: 'DELETE', credentials: 'include' });
      if (response.ok) {
        fetchVariants();
      }
    } catch (error) {
      console.error('Error deleting variant:', error);
    }
  }

  async function handleBatchAdd() {
    if (!batchVariantName || !batchVariantValue || selectedProductIds.size === 0) {
      alert('Lütfen varyant adı, değeri ve en az bir ürün seçin');
      return;
    }

    try {
      const response = await fetch('/variants/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: batchVariantName,
          value: batchVariantValue,
          productIds: Array.from(selectedProductIds),
        }),
      });
      if (response.ok) {
        alert('Varyantlar başarıyla eklendi');
        setShowBatchModal(false);
        setBatchVariantName('');
        setBatchVariantValue('');
        setSelectedProductIds(new Set());
        fetchVariants();
      } else {
        const data = await response.json();
        alert(data.error?.message || 'Ekleme başarısız');
      }
    } catch (error) {
      console.error('Error adding batch variants:', error);
    }
  }

  function openBatchModal() {
    setBatchVariantName('');
    setBatchVariantValue('');
    setSelectedProductIds(new Set());
    fetchUnmatchedProducts();
    setShowBatchModal(true);
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

  function getVariantTypeIcon(name: string): string {
    const found = VARIANT_TYPES.find(vt => vt.value === name);
    return found?.icon || '🏷️';
  }

  // Group variants by name
  const groupedVariants = variants.reduce((acc, v) => {
    if (!acc[v.name]) acc[v.name] = [];
    acc[v.name].push(v);
    return acc;
  }, {} as Record<string, VariantItem[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Varyant Eşleştirme</h2>
          <p className="text-sm text-slate-400">Ürün varyantlarını yönetin ve toplu eşleştirme yapın</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openBatchModal}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            📦 Toplu Varyant Ekle
          </button>
          <button
            onClick={() => { setEditingVariant(null); setVariantName(''); setVariantValue(''); setProductId(''); setShowModal(true); }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Yeni Varyant
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Varyant ara (değer)..."
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="min-w-[150px]">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">Tüm Varyant Tipleri</option>
            {VARIANT_TYPES.map((vt) => (
              <option key={vt.value} value={vt.value}>{vt.icon} {vt.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchVariants}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
        >
          🔄 Ara
        </button>
      </div>

      {/* Variant Type Cards */}
      {!loading && Object.keys(groupedVariants).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Object.entries(groupedVariants).map(([name, items]) => (
            <div key={name} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{getVariantTypeIcon(name)}</span>
                <div>
                  <div className="font-semibold text-white">{name}</div>
                  <div className="text-xs text-slate-400">{items.length} varyant</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from(new Set(items.map(i => i.value))).slice(0, 8).map((value) => (
                  <span key={value} className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                    {value}
                  </span>
                ))}
                {Array.from(new Set(items.map(i => i.value))).length > 8 && (
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                    +{Array.from(new Set(items.map(i => i.value))).length - 8}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Variants Table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : variants.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">🎨</div>
            <div>Henüz varyant yok</div>
            <button onClick={() => { setEditingVariant(null); setVariantName(''); setVariantValue(''); setProductId(''); setShowModal(true); }}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              + İlk Varyantı Ekle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Tip</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Varyant Adı</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Değer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Ürün</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Oluşturulma</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-300">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {variants.map((variant) => (
                  <tr key={variant.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-xl">{getVariantTypeIcon(variant.name)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{variant.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-500/10 px-2 py-1 text-sm font-medium text-blue-400">
                        {variant.value}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {variant.product?.title || variant.product?.xmlKey || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(variant.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingVariant(variant); setVariantName(variant.name); setVariantValue(variant.value); setProductId(variant.productId); setShowModal(true); }}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                          title="Düzenle"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(variant.id)}
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

      {/* Add/Edit Variant Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingVariant ? 'Varyant Düzenle' : 'Yeni Varyant'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Varyant Tipi</label>
                <select
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="">-- Seçiniz --</option>
                  {VARIANT_TYPES.map((vt) => (
                    <option key={vt.value} value={vt.value}>{vt.icon} {vt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Varyant Değeri</label>
                <input
                  type="text"
                  value={variantValue}
                  onChange={(e) => setVariantValue(e.target.value)}
                  placeholder="Örn: Kırmızı, XL, 38..."
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  required
                />
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
                  {editingVariant ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Add Variant Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowBatchModal(false)}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Toplu Varyant Ekleme</h3>
                <p className="text-sm text-slate-400">Seçili ürünlere toplu varyant ekleyin</p>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Variant Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Varyant Tipi</label>
                <select
                  value={batchVariantName}
                  onChange={(e) => setBatchVariantName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Seçiniz --</option>
                  {VARIANT_TYPES.map((vt) => (
                    <option key={vt.value} value={vt.value}>{vt.icon} {vt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Varyant Değeri</label>
                <input
                  type="text"
                  value={batchVariantValue}
                  onChange={(e) => setBatchVariantValue(e.target.value)}
                  placeholder="Örn: Kırmızı, XL, 38..."
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
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
                      {unmatchedProducts.length} varyantsız ürün bulundu
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
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-slate-700/50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 w-12"></th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Ürün</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">SKU</th>
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
                onClick={() => setShowBatchModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleBatchAdd}
                disabled={!batchVariantName || !batchVariantValue || selectedProductIds.size === 0}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {selectedProductIds.size} Ürüne Varyant Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
