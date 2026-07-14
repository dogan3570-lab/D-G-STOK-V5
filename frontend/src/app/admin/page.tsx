'use client';
import { useState } from 'react';
import Link from 'next/link';
export default function AdminPage() {
  const [tab, setTab] = useState('dashboard');
  const menu = [
    { id: 'dashboard', label: 'Gösteri Paneli', icon: '📊' },
    { id: 'urunler', label: 'Ürünler', icon: '📦', path: '/admin/urunler' },
    { id: 'kategoriler', label: 'Kategoriler', icon: '📁', path: '/admin/kategoriler' },
    { id: 'siparisler', label: 'Siparişler', icon: '📋', path: '/admin/siparisler' },
    { id: 'musteriler', label: 'Müşteriler', icon: '👥', path: '/admin/musteriler' },
    { id: 'kampanyalar', label: 'Kampanyalar', icon: '🏷️', path: '/admin/kampanyalar' },
    { id: 'xml', label: 'XML Yönetimi', icon: '🔗', path: '/admin/xml' },
    { id: 'ayarlar', label: 'Site Ayarları', icon: '⚙️', path: '/admin/ayarlar' },
  ];
  return (
    <main className="min-h-screen bg-gray-50 pt-16">
      <div className="flex">
        <aside className="w-64 bg-black text-white min-h-screen p-6 fixed left-0 top-16">
          <h2 className="text-lg font-light tracking-widest mb-8">D&G STORE</h2>
          <nav className="space-y-1">
            {menu.map((m) => (m.path ? (<Link key={m.id} href={m.path} className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded flex items-center"><span className="mr-3">{m.icon}</span>{m.label}</Link>) : (<button key={m.id} onClick={() => setTab(m.id)} className={`w-full text-left px-4 py-3 text-sm transition-all rounded flex items-center ${tab === m.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}><span className="mr-3">{m.icon}</span>{m.label}</button>)))}
          </nav>
          <div className="absolute bottom-8 left-6 right-6"><Link href="/" className="text-sm text-gray-500 hover:text-white">← Siteye Dön</Link></div>
        </aside>
        <div className="ml-64 flex-1 p-8">
          {tab === 'dashboard' && (
            <div>
              <h1 className="text-3xl font-light text-gray-900 mb-8">Gösteri Paneli</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[{label:'Toplam Ürün',value:'156',change:'+12'},{label:'Toplam Sipariş',value:'48',change:'+8'},{label:'Bugünkü Satış',value:'₺12.450',change:'+₺2.300'},{label:'Aktif Müşteri',value:'89',change:'+15'}].map(item => (
                  <div key={item.label} className="bg-white p-6 border border-gray-100"><p className="text-sm text-gray-500 mb-2">{item.label}</p><p className="text-2xl font-light text-gray-900">{item.value}</p><p className="text-xs text-green-600 mt-2">{item.change} son 7 gün</p></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}