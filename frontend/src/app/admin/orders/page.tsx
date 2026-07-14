'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Search, ArrowLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items?: { productName: string; quantity: number }[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  processing: 'bg-blue-50 text-blue-700',
  shipped: 'bg-purple-50 text-purple-700',
  delivered: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  returned: 'bg-gray-50 text-gray-700',
};

const statusText: Record<string, string> = {
  pending: 'Beklemede',
  processing: 'İşleniyor',
  shipped: 'Kargoda',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
  returned: 'İade Edildi',
};

const statusOptions = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

export default function AdminOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/auth/login');
      return;
    }
    loadOrders();
  }, [isAuthenticated, user, page, statusFilter]);

  const loadOrders = async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);

      const data = await api.request(`/orders?${params}`);
      const orderList = data?.data || [];
      setOrders(orderList);
      setTotalPages(Math.ceil((data?.total || 0) / 20));
    } catch (error) {
      console.error('Siparisler yuklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setLoading(true);
    loadOrders();
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await api.request(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success('Sipariş durumu güncellendi');
      loadOrders();
    } catch (error: any) {
      toast.error('Durum güncellenemedi', {
        description: error.message,
      });
    } finally {
      setUpdatingId(null);
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
            <h1 className="text-3xl font-light text-gray-900">Siparişler</h1>
            <p className="text-sm text-gray-500 mt-1">Sipariş yönetimi ve takip</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sipariş no veya müşteri adı ile ara..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </form>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:border-black transition-colors bg-white"
          >
            <option value="">Tüm Durumlar</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{statusText[s]}</option>
            ))}
          </select>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-white border border-gray-100" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white border border-gray-100 p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-light text-gray-900 mb-2">Sipariş Bulunamadı</h2>
            <p className="text-gray-500">Henüz hiçbir sipariş bulunmuyor.</p>
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Sipariş No</th>
                    <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden md:table-cell">Müşteri</th>
                    <th className="text-left p-4 text-xs text-gray-500 font-medium uppercase tracking-wider hidden sm:table-cell">Tarih</th>
                    <th className="text-right p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Tutar</th>
                    <th className="text-center p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Durum</th>
                    <th className="text-right p-4 text-xs text-gray-500 font-medium uppercase tracking-wider">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <span className="text-sm font-medium text-gray-900">{order.orderNumber || `#${order.id.slice(0, 8).toUpperCase()}`}</span>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className="text-sm text-gray-600">{order.customerName || '-'}</span>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className="text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString('tr-TR')}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          ₺{Number(order.totalAmount).toFixed(2)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                          disabled={updatingId === order.id}
                          className={`px-2 py-1 text-xs font-medium rounded border-0 cursor-pointer ${statusColors[order.status] || 'bg-gray-50 text-gray-700'}`}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>{statusText[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-black transition-colors"
                        >
                          Detay <ChevronRight className="w-3 h-3" />
                        </Link>
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
