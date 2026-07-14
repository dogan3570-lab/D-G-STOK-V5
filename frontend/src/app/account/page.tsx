'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function AccountPage() {
  const [tab, setTab] = useState('siparisler');

  const tabs = [
    { id: 'siparisler', label: 'Siparişlerim' },
    { id: 'favoriler', label: 'Favorilerim' },
    { id: 'adresler', label: 'Adreslerim' },
    { id: 'profil', label: 'Profil' },
  ];

  return (
    <main className="min-h-screen bg-white pt-32 pb-24">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-4xl font-light tracking-tight text-gray-900 mb-2">Hesabım</h1>
        <p className="text-gray-600 text-sm mb-12">Hesabınızı yönetin.</p>

        {/* Tabs */}
        <div className="flex gap-8 border-b border-gray-200 mb-12">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`pb-4 text-sm font-medium transition-all ${tab === t.id ? 'text-black border-b-2 border-black' : 'text-gray-500 hover:text-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Siparişler */}
        {tab === 'siparisler' && (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">Henüz siparişiniz bulunmuyor.</p>
            <Link href="/products" className="inline-block px-6 py-3 bg-black text-white text-sm tracking-widest uppercase hover:bg-gray-900 transition-all">
              Alışverişe Başla
            </Link>
          </div>
        )}

        {/* Favoriler */}
        {tab === 'favoriler' && (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">Henüz favori ürününüz bulunmuyor.</p>
            <Link href="/products" className="inline-block px-6 py-3 bg-black text-white text-sm tracking-widest uppercase hover:bg-gray-900 transition-all">
              Ürünleri Keşfet
            </Link>
          </div>
        )}

        {/* Adresler */}
        {tab === 'adresler' && (
          <div className="space-y-6">
            <p className="text-gray-600 text-sm">Kayıtlı adresiniz bulunmuyor.</p>
            <button className="px-8 py-4 bg-black text-white text-sm tracking-widest uppercase hover:bg-gray-900 transition-all">
              Yeni Adres Ekle
            </button>
          </div>
        )}

        {/* Profil */}
        {tab === 'profil' && (
          <div className="max-w-md space-y-6">
            <div>
              <label className="text-xs text-gray-600 mb-2 block font-medium">Ad Soyad</label>
              <input defaultValue="Kullanıcı Adı"
                className="w-full border-b border-gray-400 py-3 text-sm text-gray-900 focus:outline-none focus:border-black bg-transparent placeholder:text-gray-400" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-2 block font-medium">E-posta</label>
              <input defaultValue="ornek@email.com"
                className="w-full border-b border-gray-400 py-3 text-sm text-gray-900 focus:outline-none focus:border-black bg-transparent" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-2 block font-medium">Telefon</label>
              <input defaultValue="+90 555 123 45 67"
                className="w-full border-b border-gray-400 py-3 text-sm text-gray-900 focus:outline-none focus:border-black bg-transparent" />
            </div>
            <button className="w-full bg-black text-white py-4 text-sm tracking-widest uppercase hover:bg-gray-900 transition-all">
              Bilgileri Kaydet
            </button>
          </div>
        )}
      </div>
    </main>
  );
}