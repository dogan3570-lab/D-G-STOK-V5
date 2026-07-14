'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, ArrowLeft, Search, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  createdAt: string;
}

interface LowStockProduct {
  id: string;
  sku: string;
  name: string;
  stock: number;
  criticalStock: number;
}

export default function AdminInventoryPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'movements' | 'lowstock'>('lowstock');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/auth/login');
      return;
    }
    loadData();
  }, [isAuthenticated, user, page]);

  const loadData = async () => {
    try {
      const [movementsData, lowStockData] = await Promise.all([
        api.request(`/inventory/movements?page=${page}&limit=20`).catch(() => ({ data: [], total: 0 })),
        api.request('/inventory/low-stock').catch(() => ({ data: [] })),
      ]);

      setMovements(movementsData?.data || []);
      setTotalPages(Math.ceil((movementsData?.total || 0) / 20));
      setLowStock(lowStockData?.data || []);
    } catch (error) {
      console.error('Stok verileri yuklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || user?.role !== 'admin') return null;

  return (
    <main className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-gray-400 hover:text-black transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-light text-gray-900">Stok Yönetimi</h1>
            <p className="text-sm text-gray-500 mt-1">Stok hareketleri ve kritik stok takibi</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setTab('lowstock')}
            className={`px-6 py-3 text-sm transition-colors ${
              tab === 'lowstock'
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-black'
            }`}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Kritik Stoklar
              {lowStock.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {lowStock.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setTab('movements')}
            className={`px-6 py-3 text-sm transition-colors ${
              tab === 'movements'
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-black'
            }`}
          >
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Stok Hareketleri
            </span>
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-white border border-gray-100" />
            ))}
          </div>
        ) : tab === 'lowstock' ? (
          /* Low Stock View */
          lowStock.length === 0 ? (
            <div className="bg-white border border-gray-100 p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-light text-gray-900 mb-2">Kritik Stok Bulunmuyor</h2>
              <p className="text-gray-500">Tüm ürünlerin stok seviyesi yeterli.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Ürün</th>
                    <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden sm:table-cell">SKU</th>
                    <th className="text-center p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Mevcut Stok</th>
                    <th className="text-center p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Kritik Seviye</th>
                    <th className="text-center p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lowStock.map((product) => {
                    const ratio = product.stock / product.criticalStock;
                    const statusColor = ratio <= 0.5 ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700';
                    const statusText = ratio <= 0.5 ? 'Kritik' : 'Düşük';

                    return (
                      <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={`w-4 h-4 ${ratio <= 0.5 ? 'text-red-500' : 'text-orange-500'}`} />
                            <span className="text-sm font-medium text-gray-900">{product.name}</span>
                          </div>
                        </td>
                        <td className="p-4 hidden sm:table-cell">
                          <code className="text-xs text-gray-500">{product.sku}</code>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-sm font-medium ${product.stock <= 0 ? 'text-red-500' : 'text-orange-500'}`}>
                            {product.stock}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-sm text-gray-500">{product.criticalStock}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Movements View */
          movements.length === 0 ? (
            <div className="bg-white border border-gray-100 p-12 text-center">
              <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-light text-gray-900 mb-2">Hareket Bulunamadı</h2>
              <p className="text-gray-500">Henüz hiçbir stok hareketi kaydedilmemiş.</p>
            </div>
          ) : (
            <>
              <div className="bg-white border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Ürün</th>
                      <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden sm:table-cell">SKU</th>
                      <th className="text-center p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Tür</th>
                      <th className="text-right p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Miktar</th>
                      <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden md:table-cell">Sebep</th>
                      <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden lg:table-cell">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {movements.map((movement) => (
                      <tr key={movement.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <span className="text-sm text-gray-900">{movement.productName}</span>
                        </td>
                        <td className="p-4 hidden sm:table-cell">
                          <code className="text-xs text-gray-500">{movement.productSku}</code>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium ${
                            movement.type === 'in' ? 'bg-green-50 text-green-700' :
                            movement.type === 'out' ? 'bg-red-50 text-red-700' :
                            'bg-blue-50 text-blue-700'
                          }`}>
                            {movement.type === 'in' ? 'Giriş' : movement.type === 'out' ? 'Çıkış' : 'Düzeltme'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`text-sm font-medium ${
                            movement.type === 'in' ? 'text-green-600' :
                            movement.type === 'out' ? 'text-red-600' :
                            'text-blue-600'
                          }`}>
                            {movement.type === 'in' ? '+' : movement.type === 'out' ? '-' : '±'}
                            {Math.abs(movement.quantity)}
                          </span>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <span className="text-sm text-gray-500">{movement.reason || '-'}</span>
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          <span className="text-sm text-gray-500">
                            {new Date(movement.createdAt).toLocaleDateString('tr-TR')}
                          </span>
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
          )
        )}
      </div>
    </main>
  );
}
