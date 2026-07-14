'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Truck, Package, MapPin } from 'lucide-react';

interface Shipment {
  id: string;
  trackingNumber: string;
  orderId: string;
  status: string;
  provider: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  city: string;
  shippingCost: number;
  createdAt: string;
  deliveredAt?: string;
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchShipments();
  }, [statusFilter]);

  const fetchShipments = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/shipments?${params}`);
      const data = await res.json();
      setShipments(data.data || []);
    } catch (error) {
      console.error('Kargolar yuklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-700';
      case 'processing': return 'bg-blue-50 text-blue-700';
      case 'shipped': return 'bg-purple-50 text-purple-700';
      case 'in_transit': return 'bg-indigo-50 text-indigo-700';
      case 'delivered': return 'bg-green-50 text-green-700';
      case 'returned': return 'bg-red-50 text-red-700';
      case 'cancelled': return 'bg-gray-50 text-gray-400';
      default: return 'bg-gray-50 text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      pending: 'Bekliyor', processing: 'Hazirlaniyor', shipped: 'Kargoya Verildi',
      in_transit: 'Yolda', delivered: 'Teslim Edildi', returned: 'Iade', cancelled: 'Iptal'
    };
    return texts[status] || status;
  };

  const filteredShipments = shipments.filter(s =>
    s.trackingNumber.toLowerCase().includes(search.toLowerCase()) ||
    s.recipientName.toLowerCase().includes(search.toLowerCase()) ||
    s.orderId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light text-gray-900">Kargolar</h1>
          <p className="text-sm text-gray-500 mt-1">Kargo takip ve yonetimi</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Kargo ara (takip no, siparis no, alici)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        <div className="flex gap-2">
          {['', 'pending', 'shipped', 'in_transit', 'delivered'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs rounded-lg border ${
                statusFilter === status ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {status === '' ? 'Tumu' : getStatusText(status)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Yukleniyor...</div>
      ) : (
        <div className="space-y-3">
          {filteredShipments.map((shipment) => (
            <div key={shipment.id} className="bg-white rounded-lg border border-gray-100 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                    <Truck className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{shipment.trackingNumber}</h3>
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${getStatusColor(shipment.status)}`}>
                        {getStatusText(shipment.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Siparis: {shipment.orderId} | {shipment.provider}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-gray-400">
                  {new Date(shipment.createdAt).toLocaleDateString('tr-TR')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Alici</p>
                  <p className="text-gray-900">{shipment.recipientName}</p>
                  <p className="text-gray-500">{shipment.recipientPhone}</p>
                </div>
                <div className="md:col-span-1">
                  <p className="text-xs text-gray-400 mb-1">Adres</p>
                  <p className="text-gray-600 flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {shipment.address}
                  </p>
                  {shipment.city && <p className="text-gray-500 mt-1">{shipment.city}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 mb-1">Kargo Ucreti</p>
                  <p className="text-gray-900">{shipment.shippingCost.toFixed(2)} TL</p>
                  {shipment.deliveredAt && (
                    <p className="text-xs text-green-600 mt-1">
                      Teslim: {new Date(shipment.deliveredAt).toLocaleDateString('tr-TR')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredShipments.length === 0 && (
            <div className="text-center py-12 text-gray-400">Kargo kaydi bulunamadi</div>
          )}
        </div>
      )}
    </div>
  );
}
