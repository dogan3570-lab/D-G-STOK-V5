'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Grid3X3 } from 'lucide-react';

interface Variant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
  attributes: Record<string, string>;
  productId?: string;
  productName?: string;
  createdAt: string;
}

export default function VariantsPage() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [formData, setFormData] = useState({
    name: '', sku: '', price: 0, stock: 0,
    attributes: '', productId: ''
  });

  useEffect(() => {
    fetchVariants();
  }, []);

  const fetchVariants = async () => {
    try {
      const res = await fetch('/api/admin/variants');
      const data = await res.json();
      setVariants(data.data || []);
    } catch (error) {
      console.error('Varyantlar yuklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        attributes: formData.attributes ? JSON.parse(formData.attributes) : {},
      };
      const url = editingVariant
        ? `/api/admin/variants/${editingVariant.id}`
        : '/api/admin/variants';
      const method = editingVariant ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingVariant(null);
        setFormData({ name: '', sku: '', price: 0, stock: 0, attributes: '', productId: '' });
        fetchVariants();
      }
    } catch (error) {
      console.error('Varyant kaydedilirken hata:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu varyanti silmek istediginize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/admin/variants/${id}`, { method: 'DELETE' });
      if (res.ok) fetchVariants();
    } catch (error) {
      console.error('Varyant silinirken hata:', error);
    }
  };

  const filteredVariants = variants.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light text-gray-900">Varyantlar</h1>
          <p className="text-sm text-gray-500 mt-1">Urun varyantlari yonetimi</p>
        </div>
        <button
          onClick={() => { setEditingVariant(null); setFormData({ name: '', sku: '', price: 0, stock: 0, attributes: '', productId: '' }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yeni Varyant
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Varyant ara (isim veya SKU)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Yukleniyor...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Varyant</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">SKU</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase">Fiyat</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase">Stok</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase">Durum</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase">Islem</th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.map((variant) => (
                <tr key={variant.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center">
                        <Grid3X3 className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{variant.name}</p>
                        {variant.productName && (
                          <p className="text-xs text-gray-400">{variant.productName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{variant.sku}</td>
                  <td className="px-4 py-3 text-sm text-right">{variant.price.toFixed(2)} TL</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={variant.stock > 0 ? 'text-green-600' : 'text-red-600'}>
                      {variant.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      variant.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {variant.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditingVariant(variant); setFormData({ name: variant.name, sku: variant.sku, price: variant.price, stock: variant.stock, attributes: JSON.stringify(variant.attributes), productId: variant.productId || '' }); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(variant.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredVariants.length === 0 && (
            <div className="text-center py-12 text-gray-400">Henuz varyant eklenmemis</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-medium mb-4">
              {editingVariant ? 'Varyant Duzenle' : 'Yeni Varyant'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Varyant Adi</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input type="text" required value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fiyat</label>
                  <input type="number" step="0.01" required value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stok</label>
                  <input type="number" required value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ozellikler (JSON)</label>
                <textarea value={formData.attributes} onChange={(e) => setFormData({ ...formData, attributes: e.target.value })} rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 font-mono"
                  placeholder='{"renk": "Siyah", "beden": "M"}' />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Iptal</button>
                <button type="submit" className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800">
                  {editingVariant ? 'Guncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
