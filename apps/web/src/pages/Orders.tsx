import React, { useEffect, useState } from 'react';

interface OrderItem {
  id: string;
  orderNo: string;
  channel: string;
  customerName: string;
  status: string;
  total: number;
  cargoCompany: string | null;
  trackingNo: string | null;
  createdAt: string;
}

export default function Orders() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const response = await fetch(`/orders?${params}`, { credentials: 'include' });
      const data = await response.json();
      setOrders(data.items || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400',
    preparing: 'bg-yellow-500/10 text-yellow-400',
    shipped: 'bg-purple-500/10 text-purple-400',
    delivered: 'bg-green-500/10 text-green-400',
    cancelled: 'bg-red-500/10 text-red-400',
    returned: 'bg-orange-500/10 text-orange-400',
  };

  const statusLabels: Record<string, string> = {
    new: 'Yeni',
    preparing: 'Hazırlanıyor',
    shipped: 'Kargoda',
    delivered: 'Teslim Edildi',
    cancelled: 'İptal',
    returned: 'İade',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Siparişler</h2>
          <p className="text-sm text-slate-400">Tüm pazaryerlerinden gelen siparişler</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['', 'new', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {s ? statusLabels[s] || s : 'Tümü'}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">📑</div>
            <div>Sipariş bulunamadı</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Sipariş No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Müşteri</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Kanal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Tutar</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Kargo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {orders.map((order) => (
                  <tr key={order.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{order.orderNo}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{order.customerName}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{order.channel}</td>
                    <td className="px-4 py-3 text-sm text-white">₺{order.total.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColors[order.status] || 'bg-slate-500/10 text-slate-400'}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {order.cargoCompany ? `${order.cargoCompany} - ${order.trackingNo || ''}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
