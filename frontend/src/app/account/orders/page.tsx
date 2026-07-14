'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, ArrowLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: { productName: string; quantity: number }[];
}

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    loadOrders();
  }, [isAuthenticated, page]);

  const loadOrders = async () => {
    try {
      const data = await api.request(`/orders?page=${page}&limit=10`);
      setOrders(data?.data || []);
      setTotalPages(Math.ceil((data?.total || 0) / 10));
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      processing: 'text-blue-600 bg-blue-50 border-blue-200',
      shipped: 'text-purple-600 bg-purple-50 border-purple-200',
      delivered: 'text-green-600 bg-green-50 border-green-200',
      cancelled: 'text-red-600 bg-red-50 border-red-200',
      returned: 'text-gray-600 bg-gray-50 border-gray-200',
    };
    return colors[status] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      pending: 'Beklemede',
      processing: 'İşleniyor',
      shipped: 'Kargoda',
      delivered: 'Teslim Edildi',
      cancelled: 'İptal Edildi',
      returned: 'İade Edildi',
    };
    return texts[status] || status;
  };

  return (
    <main className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/account"
            className="text-gray-400 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-light text-gray-900">Siparişlerim</h1>
            <p className="text-sm text-gray-500 mt-1">Tüm siparişlerinizi görüntüleyin</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-white border border-gray-100" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white border border-gray-100 p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-light text-gray-900 mb-2">Henüz Sipariş Yok</h2>
            <p className="text-gray-500 mb-6">İlk siparişinizi vermek için alışverişe başlayın.</p>
            <Link
              href="/products"
              className="inline-block px-8 py-3 bg-black text-white text-sm tracking-widest uppercase hover:bg-gray-800 transition-colors"
            >
              Alışverişe Başla
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="block bg-white border border-gray-100 hover:border-gray-300 transition-colors p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {order.orderNumber}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 text-xs border ${getStatusColor(order.status)}`}
                        >
                          {getStatusText(order.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {order.items && (
                        <p className="text-xs text-gray-400 mt-1">
                          {order.items.map((i) => i.productName).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          ₺{Number(order.totalAmount).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {order.items?.reduce((sum, i) => sum + i.quantity, 0) || 0} ürün
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
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
