import React, { useEffect, useState } from 'react';

interface XmlSourceItem {
  id: string;
  name: string;
  sourceType: string;
  url: string | null;
  active: boolean;
  scheduleIntervalMinutes: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

interface XmlImportRun {
  id: string;
  sourceId: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  totalProducts: number;
  newProducts: number;
  updatedProducts: number;
  failedProducts: number;
}

export default function XmlSources() {
  const [sources, setSources] = useState<XmlSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<XmlSourceItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sourceType: 'MANUAL',
    url: '',
    scheduleIntervalMinutes: 60,
    active: true,
  });
  const [message, setMessage] = useState('');
  const [selectedSourceHistory, setSelectedSourceHistory] = useState<XmlImportRun[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchSources();
  }, []);

  async function fetchSources() {
    try {
      const response = await fetch('/xml-sources', { credentials: 'include' });
      const data = await response.json();
      setSources(data.items || []);
    } catch (error) {
      console.error('Error fetching XML sources:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory(sourceId: string) {
    try {
      const response = await fetch(`/xml-sources/${sourceId}/history`, { credentials: 'include' });
      const data = await response.json();
      setSelectedSourceHistory(data.items || []);
      setShowHistory(true);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('İşleniyor...');

    try {
      const url = editingSource ? `/xml-sources/${editingSource.id}` : '/xml-sources';
      const method = editingSource ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage('✅ Başarılı');
        setShowModal(false);
        setEditingSource(null);
        setFormData({ name: '', sourceType: 'MANUAL', url: '', scheduleIntervalMinutes: 60, active: true });
        fetchSources();
      } else {
        const data = await response.json();
        setMessage(`❌ ${data.error?.message || 'Hata oluştu'}`);
      }
    } catch (error) {
      setMessage('❌ Ağ hatası');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu XML kaynağını silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`/xml-sources/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchSources();
      } else {
        alert('Silme başarısız');
      }
    } catch (error) {
      alert('Ağ hatası');
    }
  }

  async function handleSync(id: string) {
    try {
      const response = await fetch(`/xml-sources/${id}/sync`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        alert('Sync tetiklendi');
      } else {
        alert('Sync başarısız');
      }
    } catch (error) {
      alert('Ağ hatası');
    }
  }

  function openEditModal(source: XmlSourceItem) {
    setEditingSource(source);
    setFormData({
      name: source.name,
      sourceType: source.sourceType,
      url: source.url || '',
      scheduleIntervalMinutes: source.scheduleIntervalMinutes,
      active: source.active,
    });
    setShowModal(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">XML Ürün Kaynakları</h2>
          <p className="text-sm text-slate-400">XML kaynaklarını yönetin ve senkronizasyon ayarlarını yapın</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Yeni XML Kaynağı Ekle
        </button>
      </div>

      {/* Sources Table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">📭</div>
            <div>Henüz XML kaynağı yok</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Kaynak Adı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Tip
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    URL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Durum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Son Çalışma
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Ürün Sayısı
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-300">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sources.map((source) => (
                  <tr key={source.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{source.name}</div>
                      {source.lastError && (
                        <div className="text-xs text-red-400 mt-1">{source.lastError}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{source.sourceType}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">{source.url || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          source.active
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}
                      >
                        {source.active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {source.lastSuccessAt
                        ? new Date(source.lastSuccessAt).toLocaleString('tr-TR')
                        : 'Henüz çalışmadı'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{source.productCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => fetchHistory(source.id)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                          title="Geçmiş"
                        >
                          📜
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSync(source.id)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                          title="Sync"
                        >
                          🔄
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(source)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                          title="Düzenle"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(source.id)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          title="Sil"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingSource ? 'XML Kaynağını Düzenle' : 'Yeni XML Kaynağı Ekle'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Kaynak Adı</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  placeholder="Örn: Ana XML Feed"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Tip</label>
                <select
                  value={formData.sourceType}
                  onChange={(e) => setFormData({ ...formData, sourceType: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="MANUAL">Manuel</option>
                  <option value="SCHEDULED">Zamanlanmış</option>
                  <option value="WEBHOOK">Webhook</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  placeholder="https://example.com/feed.xml"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Aralık (Dakika)</label>
                <input
                  type="number"
                  value={formData.scheduleIntervalMinutes}
                  onChange={(e) => setFormData({ ...formData, scheduleIntervalMinutes: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  min="1"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="active" className="text-sm text-slate-300">Aktif</label>
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
                    setEditingSource(null);
                    setFormData({ name: '', sourceType: 'MANUAL', url: '', scheduleIntervalMinutes: 60, active: true });
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
                  {editingSource ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Sync Geçmişi</h3>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {selectedSourceHistory.length === 0 ? (
                <div className="text-center text-slate-400 py-8">Henüz sync geçmişi yok</div>
              ) : (
                <div className="space-y-2">
                  {selectedSourceHistory.map((run) => (
                    <div key={run.id} className="rounded-lg border border-slate-700 bg-slate-700/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-white">
                          {new Date(run.startedAt).toLocaleString('tr-TR')}
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            run.status === 'completed'
                              ? 'bg-green-500/10 text-green-400'
                              : run.status === 'failed'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-slate-400">
                        <div>Toplam: {run.totalProducts}</div>
                        <div>Yeni: {run.newProducts}</div>
                        <div>Güncelle: {run.updatedProducts}</div>
                        <div>Hata: {run.failedProducts}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
