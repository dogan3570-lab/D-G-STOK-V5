'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Store, ArrowLeft, Plus, Trash2, Edit, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

interface MarketplaceConfig {
  id: string;
  name: string;
  marketplaceType: string;
  apiKey: string;
  apiSecret: string;
  sellerId: string;
  isActive: boolean;
  lastSyncAt: string | null;
}

const marketplaceIcons: Record<string, string> = {
  trendyol: '🛒',
  hepsiburada: '📦',
  amazon: '📋',
};

const marketplaceNames: Record<string, string> = {
  trendyol: 'Trendyol',
  hepsiburada: 'Hepsiburada',
  amazon: 'Amazon TR',
};

export default function AdminMarketplacesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [configs, setConfigs] = useState<MarketplaceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    marketplaceType: 'trendyol',
    apiKey: '',
    apiSecret: '',
    sellerId: '',
    isActive: true,
  });

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/auth/login');
      return;
    }
    loadConfigs();
  }, [isAuthenticated, user]);

  const loadConfigs = async () => {
    try {
      const data = await api.request('/marketplaces');
      setConfigs(data?.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        name: form.name,
        marketplaceType: form.marketplaceType,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret,
        sellerId: form.sellerId,
        isActive: form.isActive,
      };

      if (editingId) {
        await api.request(`/marketplaces/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Pazaryeri yapılandırması güncellendi');
      } else {
        await api.request('/marketplaces', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Pazaryeri yapılandırması eklendi');
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadConfigs();
    } catch (error: any) {
      toast.error('Kaydedilemedi', { description: error.message });
    }
  };

  const handleEdit = (config: MarketplaceConfig) => {
    setForm({
      name: config.name,
      marketplaceType: config.marketplaceType,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      sellerId: config.sellerId,
      isActive: config.isActive,
    });
    setEditingId(config.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" pazaryeri yapılandırmasını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.request(`/marketplaces/${id}`, { method: 'DELETE' });
      toast.success('Pazaryeri yapılandırması silindi');
      loadConfigs();
    } catch (error: any) {
      toast.error('Silinemedi', { description: error.message });
    }
  };

  const handleSync = async (id: string) => {
    try {
      await api.request(`/marketplaces/${id}/sync`, { method: 'POST' });
      toast.success('Senkronizasyon başlatıldı');
      loadConfigs();
    } catch (error: any) {
      toast.error('Senkronizasyon başlatılamadı', { description: error.message });
    }
  };

  const resetForm = () => {
    setForm({ name: '', marketplaceType: 'trendyol', apiKey: '', apiSecret: '', sellerId: '', isActive: true });
  };

  if (!isAuthenticated || user?.role !== 'admin') return null;

  return (
    <main className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-black transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-light text-gray-900">Pazaryerleri</h1>
              <p className="text-sm text-gray-500 mt-1">Pazaryeri entegrasyon yapılandırmaları</p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); resetForm(); }}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm hover:bg-gray-800 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'İptal' : 'Yeni Entegrasyon'}
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <form onSubmit={handleSave} className="bg-white border border-gray-100 p-6 mb-8">
            <h2 className="text-lg font-light text-gray-900 mb-6">
              {editingId ? 'Entegrasyonu Düzenle' : 'Yeni Entegrasyon'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pazaryeri</label>
                <select
                  value={form.marketplaceType}
                  onChange={(e) => setForm({ ...form, marketplaceType: e.target.value })}
                  className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-black transition-colors bg-white"
                >
                  <option value="trendyol">Trendyol</option>
                  <option value="hepsiburada">Hepsiburada</option>
                  <option value="amazon">Amazon TR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entegrasyon Adı</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-black transition-colors"
                  placeholder="Ana Mağaza"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">API Key</label>
                <input
                  type="text"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-black transition-colors font-mono"
                  placeholder="api_key_..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">API Secret</label>
                <input
                  type="password"
                  value={form.apiSecret}
                  onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
                  className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-black transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Satıcı ID</label>
                <input
                  type="text"
                  value={form.sellerId}
                  onChange={(e) => setForm({ ...form, sellerId: e.target.value })}
                  className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-black transition-colors"
                  placeholder="123456"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="marketplaceActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 accent-black"
                />
                <label htmlFor="marketplaceActive" className="text-sm text-gray-700">Aktif</label>
              </div>
            </div>
            <button
              type="submit"
              className="mt-6 px-8 py-3 bg-black text-white text-sm hover:bg-gray-800 transition-colors"
            >
              {editingId ? 'Güncelle' : 'Kaydet'}
            </button>
          </form>
        )}

        {/* Marketplace List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white border border-gray-100" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <div className="bg-white border border-gray-100 p-12 text-center">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-light text-gray-900 mb-2">Entegrasyon Bulunamadı</h2>
            <p className="text-gray-500 mb-6">Henüz hiçbir pazaryeri entegrasyonu eklenmemiş.</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              İlk Entegrasyonu Ekle
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {configs.map((config) => (
              <div key={config.id} className="bg-white border border-gray-100 p-6 hover:border-gray-200 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{marketplaceIcons[config.marketplaceType] || '🛍️'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900">{config.name}</h3>
                        <span className="text-xs text-gray-400">({marketplaceNames[config.marketplaceType] || config.marketplaceType})</span>
                        {config.isActive ? (
                          <span className="flex items-center gap-1 text-xs text-green-600"><Check className="w-3 h-3" />Aktif</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-500"><X className="w-3 h-3" />Pasif</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Satıcı ID: {config.sellerId || '-'}</p>
                      {config.lastSyncAt && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Son senkronizasyon: {new Date(config.lastSyncAt).toLocaleString('tr-TR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSync(config.id)}
                      className="px-3 py-1.5 text-xs bg-black text-white hover:bg-gray-800 transition-colors"
                    >
                      Senkronize Et
                    </button>
                    <button
                      onClick={() => handleEdit(config)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(config.id, config.name)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
