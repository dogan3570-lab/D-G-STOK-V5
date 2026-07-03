import React, { useEffect, useState } from 'react';

interface MarketplaceItem {
  id: string;
  key: string;
  name: string;
  apiStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function Marketplace() {
  const [marketplaces, setMarketplaces] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState<MarketplaceItem | null>(null);
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    apiStatus: 'unknown',
  });
  const [message, setMessage] = useState('');
  const [syncingKeys, setSyncingKeys] = useState<Record<string, boolean>>({});

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('İşleniyor...');

    try {
      const url = editingMarketplace ? `/marketplaces/${editingMarketplace.id}` : '/marketplaces';
      const method = editingMarketplace ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage('✅ Başarılı');
        setShowModal(false);
        setEditingMarketplace(null);
        setFormData({ key: '', name: '', apiStatus: 'unknown' });
        fetchMarketplaces();
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
    setFormData({
      key: marketplace.key,
      name: marketplace.name,
      apiStatus: marketplace.apiStatus,
    });
    setShowModal(true);
  }

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; color: string }> = {
      unknown: { label: 'Bilinmiyor', color: 'bg-slate-500/10 text-slate-400' },
      ok: { label: 'Çalışıyor', color: 'bg-green-500/10 text-green-400' },
      error: { label: 'Hata', color: 'bg-red-500/10 text-red-400' },
      unauthorized: { label: 'Yetkisiz', color: 'bg-yellow-500/10 text-yellow-400' },
    };
    const s = statusMap[status] || { label: status, color: 'bg-slate-500/10 text-slate-400' };
    return <span className={`rounded-full px-2 py-1 text-xs font-medium ${s.color}`}>{s.label}</span>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Pazaryeri Paneli</h2>
          <p className="text-sm text-slate-400">Pazaryeri entegrasyonlarını yönetin ve senkronizasyon başlatın</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
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
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {marketplaces.map((marketplace) => (
            <div key={marketplace.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{marketplace.name}</h3>
                  <p className="text-sm text-slate-400">{marketplace.key}</p>
                </div>
                {getStatusBadge(marketplace.apiStatus)}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">API Durumu</span>
                  <span className="text-slate-300">{marketplace.apiStatus}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Eklenme Tarihi</span>
                  <span className="text-slate-300">{new Date(marketplace.createdAt).toLocaleDateString('tr-TR')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Son Güncelleme</span>
                  <span className="text-slate-300">{new Date(marketplace.updatedAt).toLocaleDateString('tr-TR')}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSync(marketplace.key)}
                  disabled={syncingKeys[marketplace.key]}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {syncingKeys[marketplace.key] ? 'Gönderiliyor...' : 'Sync Başlat'}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingMarketplace ? 'Pazaryerini Düzenle' : 'Yeni Pazaryeri Ekle'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Anahtar (Key)</label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Örn: trendyol"
                  required
                  disabled={!!editingMarketplace}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">İsim</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Örn: Trendyol"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">API Durumu</label>
                <select
                  value={formData.apiStatus}
                  onChange={(e) => setFormData({ ...formData, apiStatus: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="unknown">Bilinmiyor</option>
                  <option value="ok">Çalışıyor</option>
                  <option value="error">Hata</option>
                  <option value="unauthorized">Yetkisiz</option>
                </select>
              </div>
              {message && (
                <div className={`rounded-lg px-3 py-2 text-sm ${message.startsWith('✅') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {message}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingMarketplace(null);
                    setFormData({ key: '', name: '', apiStatus: 'unknown' });
                    setMessage('');
                  }}
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
