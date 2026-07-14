'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Plus, Search, Edit, Trash2, ArrowLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/auth/login');
      return;
    }
    loadProducts();
  }, [isAuthenticated, user, page]);

  const loadProducts = async () => {
    try {
      const endpoint = search
        ? `/products/search?q=${encodeURIComponent(search)}&page=${page}&limit=20`
        : `/products?page=${page}&limit=20`;

      const data = await api.request(endpoint);
      const productList = data?.data || [];
      setProducts(productList);
      setTotalPages(Math.ceil((data?.meta?.total || 0) / 20));
    } catch (error) {
      console.error('Urunler yuklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setLoading(true);
    loadProducts();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" ürününü silmek istediğinize emin misiniz?`)) return;

    try {
      await api.request(`/products/${id}`, { method: 'DELETE' });
      toast.success('Ürün silindi');
      loadProducts();
    } catch (error: any) {
      toast.error(error.message || 'Ürün silinemedi');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-black transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-light text-gray-900">Ürünler</h1>
              <p className="text-sm text-gray-500 mt-1">Ürün yönetimi</p>
            </div>
          </div>
          <Link
            href="/admin/products/new"
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Ürün
          </Link>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün adı veya SKU ile ara..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:border-black transition-colors"
            />
          </div>
        </form>

        {/* Products Table */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-white border border-gray-100" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-gray-100 p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-light text-gray-900 mb-2">Ürün Bulunamadı</h2>
            <p className="text-gray-500 mb-6">Henüz hiçbir ürün eklenmemiş.</p>
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              İlk Ürünü Ekle
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Ürün</th>
                    <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden md:table-cell">SKU</th>
                    <th className="text-right p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Fiyat</th>
                    <th className="text-right p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden sm:table-cell">Stok</th>
                    <th className="text-center p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden lg:table-cell">Durum</th>
                    <th className="text-right p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{product.name}</p>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <code className="text-xs text-gray-500">{product.sku}</code>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm text-gray-900">₺{Number(product.price).toFixed(2)}</span>
                      </td>
                      <td className="p-4 text-right hidden sm:table-cell">
                        <span className={`text-sm ${product.stock <= 0 ? 'text-red-500' : product.stock <= 10 ? 'text-orange-500' : 'text-gray-900'}`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="p-4 text-center hidden lg:table-cell">
                        <span className={`inline-block px-2 py-0.5 text-xs ${product.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          {product.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(product.id, product.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-10 h-10 text-sm border transition-colors ${
                      page === p
                        ? 'bg-black text-white border-black'
                        : 'border-gray-300 text-gray-600 hover:border-black'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
