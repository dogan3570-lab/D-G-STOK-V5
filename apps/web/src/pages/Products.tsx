import React, { useEffect, useState } from 'react';

interface ProductItem {
  id: string;
  xmlKey: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  minStock: number;
  status: string;
  errorMessage: string | null;
  categoryMatch: boolean;
  brandMatch: boolean;
  variantMatch: boolean;
  templateMatch: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function Products() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [status, setStatus] = useState('');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchProducts();
  }, [pagination.page, search, lowStock, status]);

  async function fetchProducts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });

      if (search) params.append('search', search);
      if (lowStock) params.append('lowStock', 'true');
      if (status) params.append('status', status);

      const response = await fetch(`/products?${params}`, { credentials: 'include' });
      const data = await response.json();
      setProducts(data.items || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProducts(newSelected);
  }

  function toggleSelectAll() {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map((p) => p.id)));
    }
  }

  function getStockStatus(product: ProductItem) {
    if (product.stock === 0) return { label: 'Stok Yok', color: 'bg-red-500/10 text-red-400' };
    if (product.stock <= product.minStock) return { label: 'Düşük Stok', color: 'bg-yellow-500/10 text-yellow-400' };
    return { label: 'Normal', color: 'bg-green-500/10 text-green-400' };
  }

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; color: string }> = {
      XML: { label: 'XML', color: 'bg-blue-500/10 text-blue-400' },
      READY: { label: 'Hazır', color: 'bg-green-500/10 text-green-400' },
      SENT: { label: 'Gönderildi', color: 'bg-purple-500/10 text-purple-400' },
      PASSIVE: { label: 'Pasif', color: 'bg-slate-500/10 text-slate-400' },
      ERROR: { label: 'Hata', color: 'bg-red-500/10 text-red-400' },
    };
    const s = statusMap[status] || { label: status, color: 'bg-slate-500/10 text-slate-400' };
    return <span className={`rounded-full px-2 py-1 text-xs font-medium ${s.color}`}>{s.label}</span>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Ürün Havuzu</h2>
          <p className="text-sm text-slate-400">Toplam {pagination.total} ürün</p>
        </div>
        {selectedProducts.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">{selectedProducts.size} ürün seçildi</span>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Toplu İşlem
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ürün ara (başlık, SKU, barkod...)"
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={lowStock}
              onChange={(e) => setLowStock(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
            />
            Düşük Stok
          </label>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="">Tüm Durumlar</option>
          <option value="XML">XML</option>
          <option value="READY">Hazır</option>
          <option value="SENT">Gönderildi</option>
          <option value="PASSIVE">Pasif</option>
          <option value="ERROR">Hata</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">📦</div>
            <div>Ürün bulunamadı</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Ürün
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Barkod
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Stok
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Durum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Eşleşme
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-300">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {products.map((product) => {
                  const stockStatus = getStockStatus(product);
                  return (
                    <tr key={product.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{product.title || product.xmlKey}</div>
                        <div className="text-xs text-slate-500">{product.xmlKey}</div>
                        {product.errorMessage && (
                          <div className="text-xs text-red-400 mt-1">{product.errorMessage}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{product.sku || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{product.barcode || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{product.stock}</span>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(product.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              product.categoryMatch
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-slate-500/10 text-slate-400'
                            }`}
                          >
                            K
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              product.brandMatch
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-slate-500/10 text-slate-400'
                            }`}
                          >
                            M
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              product.variantMatch
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-slate-500/10 text-slate-400'
                            }`}
                          >
                            V
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              product.templateMatch
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-slate-500/10 text-slate-400'
                            }`}
                          >
                            Ş
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                            title="Düzenle"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                            title="Sil"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
            disabled={pagination.page === 1}
            className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Önceki
          </button>
          <span className="text-sm text-slate-400">
            Sayfa {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPagination({ ...pagination, page: Math.min(pagination.totalPages, pagination.page + 1) })}
            disabled={pagination.page === pagination.totalPages}
            className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sonraki →
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Eşleşme Legend</h3>
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-400 font-medium">K</span>
            <span>Kategori</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-400 font-medium">M</span>
            <span>Marka</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-400 font-medium">V</span>
            <span>Varyant</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-400 font-medium">Ş</span>
            <span>Şablon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
