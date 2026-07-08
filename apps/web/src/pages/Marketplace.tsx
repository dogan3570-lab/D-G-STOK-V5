import React, { useEffect, useState } from 'react';

interface MarketplaceItem {
  id: string;
  key: string;
  name: string;
  apiKey: string | null;
  apiSecret: string | null;
  apiUrl: string | null;
  apiStatus: string;
  active: boolean;
  settings: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function Marketplace() {
  const [marketplaces, setMarketplaces] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState<MarketplaceItem | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({
    key: '',
    name: '',
    apiKey: '',
    apiSecret: '',
    apiUrl: '',
    sellerId: '',
    apiStatus: 'unknown',
  });
  const [message, setMessage] = useState('');
  const [syncingKeys, setSyncingKeys] = useState<Record<string, boolean>>({});
  const [testingIds, setTestingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchMarketplaces();
  }, []);

  async function fetchMarketplaces() {
    try {
      const response = await fetch('/marketplaces', { credentials: 'include' });
      const data = await response.json();
      setMarketplaces(data.items || []);
    } catch (error) {
      console.error('Error fetching marketplaces:', error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      key: '',
      name: '',
      apiKey: '',
      apiSecret: '',
      apiUrl: '',
      sellerId: '',
      apiStatus: 'unknown',
    });
    setMessage('');
  }

  // Name'den otomatik key oluştur
  function generateKey(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20) || 'pazaryeri';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('İşleniyor...');

    try {
      const url = editingMarketplace ? `/marketplaces/${editingMarketplace.id}` : '/marketplaces';
      const method = editingMarketplace ? 'PUT' : 'POST';
      
      const key = editingMarketplace ? editingMarketplace.key : generateKey(formData.name);

      const body: Record<string, string> = {
        key,
        name: formData.name.trim(),
        apiStatus: 'unknown', // Sistem otomatik belirleyecek
      };

      if (formData.apiKey?.trim()) body.apiKey = formData.apiKey.trim();
      if (formData.apiSecret?.trim()) body.apiSecret = formData.apiSecret.trim();
      if (formData.sellerId?.trim()) body.sellerId = formData.sellerId.trim();

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setMessage('✅ Başarılı');
        setTimeout(() => {
          setShowModal(false);
          setEditingMarketplace(null);
          resetForm();
          fetchMarketplaces();
        }, 500);
      } else {
        const data = await response.json();
        setMessage(`❌ ${data.error?.message || 'Hata oluştu'}`);
      }
    } catch (error) {
      setMessage('❌ Ağ hatası');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu pazaryerini silmek istediğinizden emin misiniz?')) return;
    try {
      const response = await fetch(`/marketplaces/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        fetchMarketplaces();
      } else {
        alert('Silme başarısız');
      }
    } catch (error) {
      alert('Ağ hatası');
    }
  }

  async function handleTestConnection(id: string) {
    setTestingIds((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`/marketplaces/${id}/test`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      alert(data.message || (data.ok ? '✅ Bağlantı başarılı' : '❌ Bağlantı hatası'));
      fetchMarketplaces();
    } catch (error) {
      alert('Ağ hatası');
    } finally {
      setTestingIds((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleSync(key: string) {
    setSyncingKeys((prev) => ({ ...prev, [key]: true }));
    try {
      const response = await fetch('/actions/marketplace/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ marketplaceKey: key, totalSteps: 5 }),
      });
      if (response.ok) {
        alert('Sync kuyruğa eklendi');
      } else {
        const data = await response.json();
        alert(`Sync başarısız: ${data.error?.message || 'Bilinmeyen hata'}`);
      }
    } catch (error) {
      alert('Ağ hatası');
    } finally {
      setSyncingKeys((prev) => ({ ...prev, [key]: false }));
    }
  }

  function openEditModal(marketplace: MarketplaceItem) {
    setEditingMarketplace(marketplace);
    
    const newForm: Record<string, string> = {
      key: marketplace.key,
      name: marketplace.name,
      apiKey: marketplace.apiKey || '',
      apiSecret: '',
      apiUrl: marketplace.apiUrl || '',
      sellerId: '',
      apiStatus: marketplace.apiStatus,
    };

    if (marketplace.settings) {
      try {
        const settings = JSON.parse(marketplace.settings);
        if (settings.sellerId) newForm.sellerId = settings.sellerId;
        if (settings.apiKey) newForm.apiKey = settings.apiKey;
        if (settings.apiSecret) newForm.apiSecret = settings.apiSecret;
      } catch {}
    }

    setFormData(newForm);
    setMessage('');
    setShowModal(true);
  }

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; color: string }> = {
      unknown: { label: 'Bilinmiyor', color: 'bg-slate-500/10 text-slate-400' },
      ok: { label: 'Çalışıyor', color: 'bg-green-500/10 text-green-400' },
      connected: { label: 'Bağlı', color: 'bg-green-500/10 text-green-400' },
      error: { label: 'Hata', color: 'bg-red-500/10 text-red-400' },
      unauthorized: { label: 'Yetkisiz', color: 'bg-yellow-500/10 text-yellow-400' },
    };
    const s = statusMap[status] || { label: status, color: 'bg-slate-500/10 text-slate-400' };
    return <span className={`rounded-full px-2 py-1 text-xs font-medium ${s.color}`}>{s.label}</span>;
  }

  function getStatusDot(status: string) {
    if (status === 'ok' || status === 'connected') return <span className="flex h-2 w-2 rounded-full bg-green-500" title="Aktif"></span>;
    if (status === 'error') return <span className="flex h-2 w-2 rounded-full bg-red-500" title="Hata"></span>;
    return <span className="flex h-2 w-2 rounded-full bg-slate-500" title="Bilinmiyor"></span>;
  }

  function getMarketplaceIcon(key: string): string {
    const icons: Record<string, string> = {
      tt: '🛒',
      trendyol: '🛒',
      he: '📦',
      hepsiburada: '📦',
      n11: '🏪',
      amazon: '📦',
    };
    return icons[key.toLowerCase()] || '🛍️';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Pazaryeri Paneli</h2>
          <p className="text-sm text-slate-400">Pazaryeri entegrasyonlarını yönetin, API bilgilerini girin ve bağlantı testi yapın</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingMarketplace(null); resetForm(); setShowModal(true); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Yeni Pazaryeri Ekle
        </button>
      </div>

      {/* Marketplace Cards */}
      {loading ? (
        <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
      ) : marketplaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-slate-400">
          <div className="text-4xl mb-2">🛒</div>
          <div>Henüz pazaryeri eklenmedi</div>
          <button
            type="button"
            onClick={() => { setEditingMarketplace(null); resetForm(); setShowModal(true); }}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + İlk Pazaryerini Ekle
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {marketplaces.map((marketplace) => (
            <div key={marketplace.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getMarketplaceIcon(marketplace.key)}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{marketplace.name}</h3>
                    <p className="text-sm text-slate-400">{marketplace.key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusDot(marketplace.apiStatus)}
                  {getStatusBadge(marketplace.apiStatus)}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {marketplace.apiKey && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">API Key</span>
                    <span className="text-slate-300" title={marketplace.apiKey}>
                      {marketplace.apiKey.substring(0, 3)}.......
                    </span>
                  </div>
                )}
                {marketplace.apiUrl && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">API URL</span>
                    <span className="text-slate-300 max-w-[200px] truncate">{marketplace.apiUrl}</span>
                  </div>
                )}
                {marketplace.settings && (() => {
                  try {
                    const settings = JSON.parse(marketplace.settings);
                    return settings.sellerId ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Satıcı ID</span>
                        <span className="text-slate-300">{settings.sellerId}</span>
                      </div>
                    ) : null;
                  } catch { return null; }
                })()}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Durum</span>
                  <span className="text-slate-300">{marketplace.active ? 'Aktif' : 'Pasif'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Eklenme</span>
                  <span className="text-slate-300">{new Date(marketplace.createdAt).toLocaleDateString('tr-TR')}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTestConnection(marketplace.id)}
                  disabled={testingIds[marketplace.id]}
                  className="flex-1 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {testingIds[marketplace.id] ? '⏳ Test...' : '🔌 Test'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSync(marketplace.key)}
                  disabled={syncingKeys[marketplace.key]}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {syncingKeys[marketplace.key] ? '⏳...' : '🔄 Sync'}
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(marketplace)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                  title="Düzenle"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(marketplace.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  title="Sil"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Sade ve scrollable */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-10">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 shadow-xl max-h-[85vh] flex flex-col">
            {/* Sabit Başlık */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">
                {editingMarketplace ? 'Pazaryerini Düzenle' : 'Yeni Pazaryeri Ekle'}
              </h3>
              <button
                type="button"
                onClick={() => { setShowModal(false); setEditingMarketplace(null); resetForm(); }}
                className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable İçerik */}
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 pt-4 space-y-4 flex-1">
              {/* Pazaryeri Adı */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Pazaryeri Adı <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Örn: Trendyol, Hepsiburada"
                  required
                />
              </div>

              {/* API Bilgileri Bölümü */}
              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-sm font-medium text-slate-300 mb-3">API Bilgileri</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Satıcı ID</label>
                    <input
                      type="text"
                      value={formData.sellerId}
                      onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                      className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Satıcı ID / Cari ID / Merchant Token"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">API Key</label>
                    <input
                      type="text"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="API Key / App Key / Access Key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">API Secret</label>
                    <input
                      type="password"
                      value={formData.apiSecret}
                      onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                      className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="API Secret / App Secret"
                    />
                  </div>
                </div>
              </div>

              {message && (
                <div className={`rounded-lg px-3 py-2 text-sm ${message.startsWith('✅') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {message}
                </div>
              )}

              {/* Sabit Butonlar */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingMarketplace(null); resetForm(); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  {editingMarketplace ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
