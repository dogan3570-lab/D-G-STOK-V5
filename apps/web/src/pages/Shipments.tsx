import React, { useEffect, useState } from 'react';

interface ShipmentItem {
  id: string;
  orderNo: string;
  cargoCompany: string;
  trackingNo: string;
  status: string;
  createdAt: string;
}

export default function Shipments() {
  const [shipments, setShipments] = useState<ShipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { fetchShipments(); }, [statusFilter]);

  async function fetchShipments() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const response = await fetch(`/shipments?${params}`, { credentials: 'include' });
      const data = await response.json();
      setShipments(data.items || []);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400',
    picked_up: 'bg-blue-500/10 text-blue-400',
    in_transit: 'bg-purple-500/10 text-purple-400',
    delivered: 'bg-green-500/10 text-green-400',
    failed: 'bg-red-500/10 text-red-400',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Beklemede',
    picked_up: 'Teslim Alındı',
    in_transit: 'Yolda',
    delivered: 'Teslim Edildi',
    failed: 'Başarısız',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Gönderim Merkezi</h2>
          <p className="text-sm text-slate-400">Kargo takibi ve gönderim yönetimi</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'pending', 'picked_up', 'in_transit', 'delivered', 'failed'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}>
            {s ? statusLabels[s] || s : 'Tümü'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">🚚</div>
            <div>Gönderim bulunamadı</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Sipariş No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Kargo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Takip No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {shipments.map((s) => (
                  <tr key={s.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{s.orderNo}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{s.cargoCompany}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{s.trackingNo}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColors[s.status] || 'bg-slate-500/10 text-slate-400'}`}>
                        {statusLabels[s.status] || s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{new Date(s.createdAt).toLocaleDateString('tr-TR')}</td>
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
