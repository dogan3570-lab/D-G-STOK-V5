'use client';

import { useState, useEffect } from 'react';
import { Plus, Play, Pause, Edit2, Trash2, Zap, Clock, RefreshCw } from 'lucide-react';

interface Automation {
  id: string;
  name: string;
  description?: string;
  type: string;
  trigger: string;
  action: string;
  config: Record<string, any>;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  createdAt: string;
}

export default function AutomationPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [formData, setFormData] = useState({
    name: '', description: '', type: 'price_update',
    trigger: 'scheduled', action: 'update_prices',
    config: '{}', isActive: true
  });

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    try {
      const res = await fetch('/api/admin/automation');
      const data = await res.json();
      setAutomations(data.data || []);
    } catch (error) {
      console.error('Otomasyonlar yuklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        config: JSON.parse(formData.config),
      };
      const url = editingAutomation
        ? `/api/admin/automation/${editingAutomation.id}`
        : '/api/admin/automation';
      const method = editingAutomation ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingAutomation(null);
        setFormData({ name: '', description: '', type: 'price_update', trigger: 'scheduled', action: 'update_prices', config: '{}', isActive: true });
        fetchAutomations();
      }
    } catch (error) {
      console.error('Otomasyon kaydedilirken hata:', error);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/automation/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) fetchAutomations();
    } catch (error) {
      console.error('Otomasyon durumu degistirilirken hata:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu otomasyonu silmek istediginize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/admin/automation/${id}`, { method: 'DELETE' });
      if (res.ok) fetchAutomations();
    } catch (error) {
      console.error('Otomasyon silinirken hata:', error);
    }
  };

  const runNow = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/automation/${id}/run`, { method: 'POST' });
      if (res.ok) fetchAutomations();
    } catch (error) {
      console.error('Otomasyon calistirilirken hata:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'price_update': return '💰';
      case 'stock_sync': return '📦';
      case 'order_process': return '📋';
      case 'report_generate': return '📊';
      case 'data_import': return '📥';
      default: return '⚡';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light text-gray-900">Otomasyon</h1>
          <p className="text-sm text-gray-500 mt-1">Is akisi otomasyonlari</p>
        </div>
        <button
          onClick={() => { setEditingAutomation(null); setFormData({ name: '', description: '', type: 'price_update', trigger: 'scheduled', action: 'update_prices', config: '{}', isActive: true }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Yeni Otomasyon
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Yukleniyor...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {automations.map((auto) => (
            <div key={auto.id} className={`bg-white rounded-lg border p-5 ${auto.isActive ? 'border-gray-100' : 'border-gray-50 opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-lg">
                    {getTypeIcon(auto.type)}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{auto.name}</h3>
                    <p className="text-xs text-gray-400">{auto.type} | {auto.trigger}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => runNow(auto.id)} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Simdi Calistir">
                    <Play className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleActive(auto.id, auto.isActive)} className={`p-1.5 rounded ${auto.isActive ? 'text-green-600 hover:text-gray-400' : 'text-gray-400 hover:text-green-600'}`}>
                    {auto.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setEditingAutomation(auto); setFormData({ name: auto.name, description: auto.description || '', type: auto.type, trigger: auto.trigger, action: auto.action, config: JSON.stringify(auto.config), isActive: auto.isActive }); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(auto.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {auto.description && (
                <p className="text-sm text-gray-500 mb-3">{auto.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  {auto.runCount} calistirma
                </span>
                {auto.lastRun && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Son: {new Date(auto.lastRun).toLocaleDateString('tr-TR')}
                  </span>
                )}
              </div>
            </div>
          ))}
          {automations.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              Henuz otomasyon eklenmemis
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-medium mb-4">{editingAutomation ? 'Otomasyon Duzenle' : 'Yeni Otomasyon'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Otomasyon Adi</label>
                <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aciklama</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tur</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="price_update">Fiyat Guncelleme</option>
                    <option value="stock_sync">Stok Senkronizasyonu</option>
                    <option value="order_process">Siparis Isleme</option>
                    <option value="report_generate">Rapor Olusturma</option>
                    <option value="data_import">Veri Aktarimi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tetikleyici</label>
                  <select value={formData.trigger} onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="scheduled">Zamanlanmis</option>
                    <option value="manual">Manuel</option>
                    <option value="event">Olay Bazli</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Yapilandirma (JSON)</label>
                <textarea value={formData.config} onChange={(e) => setFormData({ ...formData, config: e.target.value })} rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Iptal</button>
                <button type="submit" className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800">
                  {editingAutomation ? 'Guncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
