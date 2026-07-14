'use client';

import { useState } from 'react';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    siteName: 'D&G STORE',
    siteUrl: 'https://dgstore.com',
    defaultVat: '20',
    defaultCurrency: 'TRY',
    defaultProfitRate: '20',
    lowStockThreshold: '10',
    itemsPerPage: '20',
    enableAutoDiscount: true,
    enableNotifications: true,
  });

  const handleSave = () => {
    localStorage.setItem('adminSettings', JSON.stringify(settings));
    toast.success('Ayarlar kaydedildi');
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-gray-900">Ayarlar</h1>
          <p className="text-sm text-gray-500 mt-1">Sistem ayarları ve yapılandırma</p>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm hover:bg-gray-800">
          <Save className="w-4 h-4" /> Kaydet
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Genel Ayarlar</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Site Adı</label>
              <input value={settings.siteName} onChange={e => setSettings(p => ({ ...p, siteName: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Site URL</label>
              <input value={settings.siteUrl} onChange={e => setSettings(p => ({ ...p, siteUrl: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Varsayılan KDV %</label>
              <input value={settings.defaultVat} onChange={e => setSettings(p => ({ ...p, defaultVat: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Varsayılan Kar %</label>
              <input value={settings.defaultProfitRate} onChange={e => setSettings(p => ({ ...p, defaultProfitRate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kritik Stok Eşiği</label>
              <input value={settings.lowStockThreshold} onChange={e => setSettings(p => ({ ...p, lowStockThreshold: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sayfa Başına Ürün</label>
              <input value={settings.itemsPerPage} onChange={e => setSettings(p => ({ ...p, itemsPerPage: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Sistem Tercihleri</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.enableAutoDiscount} onChange={e => setSettings(p => ({ ...p, enableAutoDiscount: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm text-gray-700">Otomatik indirim uygulaması aktif</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.enableNotifications} onChange={e => setSettings(p => ({ ...p, enableNotifications: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm text-gray-700">Bildirimler aktif</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
