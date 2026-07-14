'use client';

import { useState, useEffect } from 'react';
import { Percent, Plus, Save, X, Trash2, Play, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Discount {
  id: string;
  name: string;
  type: string; // 'category' | 'product'
  categoryId?: string;
  categoryName?: string;
  rate: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  isAutomatic: boolean;
  createdAt: string;
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newDiscount, setNewDiscount] = useState({
    name: '',
    type: 'product',
    categoryId: '',
    categoryName: '',
    rate: 10,
    isAutomatic: true,
    isActive: true,
  });

  useEffect(() => { loadDiscounts(); }, []);

  const loadDiscounts = async () => {
    try {
      const data = await api.request('/discounts');
      setDiscounts(Array.isArray(data?.data || data) ? (data?.data || data) : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newDiscount.name || !newDiscount.rate) {
      toast.error('İndirim adı ve oranı gerekli');
      return;
    }
    try {
      await api.request('/discounts', { method: 'POST', body: JSON.stringify(newDiscount) });
      toast.success('İndirim oluşturuldu');
      setShowNew(false);
      setNewDiscount({ name: '', type: 'product', categoryId: '', categoryName: '', rate: 10, isAutomatic: true, isActive: true });
      loadDiscounts();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('İndirimi silmek istediğinize emin misiniz?')) return;
    try {
      await api.request(`/discounts/${id}`, { method: 'DELETE' });
      toast.success('İndirim silindi');
      loadDiscounts();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleApply = async (discountId: string) => {
    try {
      const res = await api.request(`/discounts/${discountId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ productIds: [] }),
      });
      toast.success(`İndirim ${res.applied || 0} ürüne uygulandı`);
      loadDiscounts();
    } catch (err: any) { toast.error(err.message); }
  };

  const presetRates = [5, 10, 15, 20, 25, 30, 40, 50];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-gray-900">İndirimler</h1>
          <p className="text-sm text-gray-500 mt-1">Kategori ve ürün bazlı indirim yönetimi</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm hover:bg-gray-800">
          <Plus className="w-4 h-4" /> Yeni İndirim
        </button>
      </div>

      {/* New Discount Form */}
      {showNew && (
        <div className="bg-white border border-gray-100 p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Yeni İndirim Oluştur</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">İndirim Adı</label>
                <input value={newDiscount.name} onChange={e => setNewDiscount(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" placeholder="Örn: Yaz İndirimi" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">İndirim Tipi</label>
                <select value={newDiscount.type} onChange={e => setNewDiscount(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black">
                  <option value="product">Ürün Bazlı (Tüm Ürünler)</option>
                  <option value="category">Kategori Bazlı</option>
                </select>
              </div>
            </div>

            {newDiscount.type === 'category' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Kategori Adı</label>
                  <input value={newDiscount.categoryName} onChange={e => setNewDiscount(p => ({ ...p, categoryName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" placeholder="Örn: Ayakkabı" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-2">İndirim Oranı %</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {presetRates.map(r => (
                  <button key={r} onClick={() => setNewDiscount(p => ({ ...p, rate: r }))}
                    className={`px-4 py-2 text-sm border transition-colors ${newDiscount.rate === r ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-black'}`}>
                    %{r}
                  </button>
                ))}
              </div>
              <input type="number" value={newDiscount.rate} onChange={e => setNewDiscount(p => ({ ...p, rate: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newDiscount.isAutomatic} onChange={e => setNewDiscount(p => ({ ...p, isAutomatic: e.target.checked }))}
                className="w-4 h-4" />
              <span className="text-sm text-gray-700">Otomatik uygula (oluşturulunca hemen uygulansın)</span>
            </label>

            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-black text-white text-sm">Oluştur</button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-gray-300 text-sm text-gray-600">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Discount List */}
      {loading ? (
        <div className="text-center py-12"><div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto" /></div>
      ) : discounts.length === 0 ? (
        <div className="bg-white border border-gray-100 p-12 text-center">
          <Percent className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Henüz indirim oluşturulmamış</p>
        </div>
      ) : (
        <div className="space-y-4">
          {discounts.map(d => (
            <div key={d.id} className="bg-white border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 ${d.type === 'category' ? 'bg-purple-50' : 'bg-blue-50'}`}>
                    <Tag className={`w-5 h-5 ${d.type === 'category' ? 'text-purple-600' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">{d.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500">{d.type === 'category' ? 'Kategori' : 'Ürün'}</span>
                      {d.isAutomatic && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600">Otomatik</span>}
                      <span className={`text-xs px-2 py-0.5 ${d.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {d.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-2xl font-light text-red-500">%{Number(d.rate).toFixed(0)}</span>
                      {d.categoryName && <span className="text-xs text-gray-400">Kategori: {d.categoryName}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleApply(d.id)} className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                    <Play className="w-3 h-3" /> Uygula
                  </button>
                  <button onClick={() => handleDelete(d.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
