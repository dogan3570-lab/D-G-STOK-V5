'use client';
import { useState } from 'react';

export default function AdminXmlPage() {
  const [activeTab, setActiveTab] = useState('ayarlar');

  const syncLogs = [
    { date: '2026-07-05 10:00:00', status: 'başarılı', total: 45, yeni: 3 },
    { date: '2026-07-04 10:00:00', status: 'başarılı', total: 42, yeni: 5 },
    { date: '2026-07-03 10:00:00', status: 'başarılı', total: 38, yeni: 2 },
    { date: '2026-07-02 10:00:30', status: 'hata', total: 0, yeni: 0 },
  ];

  const xmlProducts = [
    { name: 'Seramik Kase Seti', sku: 'XML-001', price: 149.99, stock: 45, category: 'Mutfak', status: 'Yeni' },
    { name: 'Cam Saklama Kabı', sku: 'XML-002', price: 89.99, stock: 120, category: 'Saklama', status: 'Güncel' },
    { name: 'Porselen Tabak Seti', sku: 'XML-003', price: 199.99, stock: 0, category: 'Mutfak', status: 'Stok Bitti' },
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="border-b border-gray-100 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-light text-gray-900">XML Yönetimi</h1>
          <p className="text-sm text-gray-400 mt-1">Otomatik ürün senkronizasyonu</p>
        </div>
      </div>
      <div className="border-b border-gray-100 px-8 py-4">
        <div className="max-w-7xl mx-auto flex gap-4">
          {['ayarlar', 'logs', 'urunler'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm ${activeTab === tab ? 'bg-black text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              {tab === 'ayarlar' ? 'XML Ayarları' : tab === 'logs' ? 'Senkron Logları' : 'XML Ürünleri'}
            </button>
          ))}
        </div>
      </div>
      <div className="px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'ayarlar' && (
            <div className="max-w-lg space-y-6">
              <div>
                <label className="text-xs text-gray-500 mb-2 block">XML Feed URL</label>
                <input defaultValue="https://example.com/feed.xml" className="w-full border-b border-gray-300 py-3 text-sm focus:outline-none focus:border-black bg-transparent" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Pazaryeri</label>
                <select className="w-full border-b border-gray-300 py-3 text-sm focus:outline-none focus:border-black bg-transparent">
                  <option>Trendyol</option>
                  <option>Hepsiburada</option>
                  <option>Amazon</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Senkronizasyon Aralığı</label>
                <select className="w-full border-b border-gray-300 py-3 text-sm focus:outline-none focus:border-black bg-transparent">
                  <option>Her saat</option>
                  <option>Her 6 saat</option>
                  <option>Günde 1 kez</option>
                  <option>Manuel</option>
                </select>
              </div>
              <button className="px-6 py-3 bg-black text-white text-sm tracking-widest uppercase hover:bg-gray-900 transition-all">XML'i Şimdi Senkronize Et</button>
            </div>
          )}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              {syncLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-50 text-sm">
                  <span className={log.status === 'başarılı' ? 'text-green-600' : 'text-red-600'}>{log.status === 'başarılı' ? '✓' : '✗'}</span>
                  <span className="text-gray-500 font-mono text-xs">{log.date}</span>
                  <span className="text-gray-700">{log.status === 'başarılı' ? `${log.total} ürün (${log.yeni} yeni)` : 'Senkronizasyon hatası'}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'urunler' && (
            <div>
              {xmlProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-50 text-sm">
                  <span className="font-medium text-gray-900 w-48">{p.name}</span>
                  <span className="text-gray-500 font-mono text-xs w-20">{p.sku}</span>
                  <span className="text-gray-500 w-24">{p.category}</span>
                  <span className="font-medium w-20">₺{p.price.toFixed(2)}</span>
                  <span className={p.stock === 0 ? 'text-red-500 w-16' : 'w-16'}>{p.stock}</span>
                  <span className={`px-2 py-1 text-xs ${p.status === 'Yeni' ? 'bg-blue-50 text-blue-700' : p.status === 'Güncel' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}