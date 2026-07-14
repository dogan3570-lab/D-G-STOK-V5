'use client';

import { Gift, Megaphone, Plus, Calendar } from 'lucide-react';

export default function CampaignsPage() {
  const campaigns = [
    { name: 'Yaz İndirimi', status: 'active', discount: '%20', products: 150, start: '01.06.2026', end: '31.08.2026' },
    { name: 'Sezon Sonu', status: 'scheduled', discount: '%40', products: 80, start: '01.09.2026', end: '30.09.2026' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-gray-900">Kampanyalar</h1>
          <p className="text-sm text-gray-500 mt-1">Kampanya ve promosyon yönetimi</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm hover:bg-gray-800">
          <Plus className="w-4 h-4" /> Yeni Kampanya
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {campaigns.map((c, i) => (
          <div key={i} className="bg-white border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-pink-50"><Gift className="w-5 h-5 text-pink-600" /></div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{c.name}</h3>
                  <span className={`text-xs px-2 py-0.5 ${c.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    {c.status === 'active' ? 'Aktif' : 'Planlandı'}
                  </span>
                </div>
              </div>
              <span className="text-2xl font-light text-red-500">{c.discount}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {c.start} - {c.end}</span>
              <span>{c.products} ürün</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
