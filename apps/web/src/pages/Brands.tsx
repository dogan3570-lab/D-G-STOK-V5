import React, { useEffect, useState } from 'react';

interface BrandItem {
  id: string;
  name: string;
  externalId: string | null;
}

export default function Brands() {
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandItem | null>(null);
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');

  useEffect(() => { fetchBrands(); }, []);

  async function fetchBrands() {
    try {
      const response = await fetch('/brands', { credentials: 'include' });
      const data = await response.json();
      setBrands(data.items || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingBrand ? `/brands/${editingBrand.id}` : '/brands';
      const method = editingBrand ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, externalId: externalId || undefined }),
      });
      if (response.ok) {
        setShowModal(false);
        setEditingBrand(null);
        setName('');
        setExternalId('');
        fetchBrands();
      }
    } catch (error) {
      console.error('Error saving brand:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu markayı silmek istediğinizden emin misiniz?')) return;
    try {
      await fetch(`/brands/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchBrands();
    } catch (error) {
      console.error('Error deleting brand:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Marka Eşleştir</h2>
          <p className="text-sm text-slate-400">XML markalarını sistem markalarıyla eşleştirin</p>
        </div>
        <button onClick={() => { setEditingBrand(null); setName(''); setExternalId(''); setShowModal(true); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          + Yeni Marka
        </button>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">🏷️</div>
            <div>Henüz marka yok</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Marka Adı</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Dış ID</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-300">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {brands.map((brand) => (
                  <tr key={brand.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{brand.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{brand.externalId || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setEditingBrand(brand); setName(brand.name); setExternalId(brand.externalId || ''); setShowModal(true); }}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" title="Düzenle">✏️</button>
                      <button onClick={() => handleDelete(brand.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Sil">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">{editingBrand ? 'Marka Düzenle' : 'Yeni Marka'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Marka Adı</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Dış ID (Opsiyonel)</label>
                <input type="text" value={externalId} onChange={(e) => setExternalId(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors">İptal</button>
                <button type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                  {editingBrand ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
