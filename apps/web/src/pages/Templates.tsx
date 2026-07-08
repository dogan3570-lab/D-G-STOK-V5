import React, { useEffect, useState } from 'react';

interface TemplateItem {
  id: string;
  name: string;
  marketplaceId: string | null;
  titleFormat: string | null;
  description: string | null;
  priceFormula: string | null;
  commissionRate: number | null;
  vatRate: number | null;
  active: boolean;
  createdAt: string;
}

export default function Templates() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TemplateItem | null>(null);
  const [form, setForm] = useState({ name: '', titleFormat: '', description: '', priceFormula: '', commissionRate: '', vatRate: '' });

  useEffect(() => { fetchTemplates(); }, []);

  async function fetchTemplates() {
    try {
      const response = await fetch('/templates', { credentials: 'include' });
      const data = await response.json();
      setTemplates(data.items || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editing ? `/templates/${editing.id}` : '/templates';
      const method = editing ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name,
          titleFormat: form.titleFormat || undefined,
          description: form.description || undefined,
          priceFormula: form.priceFormula || undefined,
          commissionRate: form.commissionRate ? Number(form.commissionRate) : undefined,
          vatRate: form.vatRate ? Number(form.vatRate) : undefined,
        }),
      });
      if (response.ok) {
        setShowModal(false);
        setEditing(null);
        setForm({ name: '', titleFormat: '', description: '', priceFormula: '', commissionRate: '', vatRate: '' });
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error saving template:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu şablonu silmek istediğinizden emin misiniz?')) return;
    try {
      await fetch(`/templates/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Listeleme Şablonları</h2>
          <p className="text-sm text-slate-400">Ürün listeleme şablonlarını yönetin</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', titleFormat: '', description: '', priceFormula: '', commissionRate: '', vatRate: '' }); setShowModal(true); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
          + Yeni Şablon
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : templates.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">📋</div>
            <div>Henüz şablon yok</div>
          </div>
        ) : templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white">{t.name}</h3>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${t.active ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                {t.active ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            {t.titleFormat && <div className="text-xs text-slate-400 mb-1">Başlık: {t.titleFormat}</div>}
            {t.priceFormula && <div className="text-xs text-slate-400 mb-1">Fiyat: {t.priceFormula}</div>}
            {t.commissionRate && <div className="text-xs text-slate-400 mb-1">Komisyon: %{t.commissionRate}</div>}
            {t.vatRate && <div className="text-xs text-slate-400 mb-3">KDV: %{t.vatRate}</div>}
            <div className="flex gap-2 mt-2">
              <button onClick={() => { setEditing(t); setForm({ name: t.name, titleFormat: t.titleFormat || '', description: t.description || '', priceFormula: t.priceFormula || '', commissionRate: String(t.commissionRate || ''), vatRate: String(t.vatRate || '') }); setShowModal(true); }}
                className="rounded-lg px-3 py-1 text-xs text-blue-400 hover:bg-blue-500/10 transition-colors">Düzenle</button>
              <button onClick={() => handleDelete(t.id)}
                className="rounded-lg px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors">Sil</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">{editing ? 'Şablon Düzenle' : 'Yeni Şablon'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Şablon Adı</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Başlık Formatı</label>
                <input type="text" value={form.titleFormat} onChange={(e) => setForm({ ...form, titleFormat: e.target.value })}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" placeholder="{brand} {title}" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Açıklama</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Fiyat Formülü</label>
                  <input type="text" value={form.priceFormula} onChange={(e) => setForm({ ...form, priceFormula: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" placeholder="{price}*1.2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Komisyon (%)</label>
                  <input type="number" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">KDV (%)</label>
                  <input type="number" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors">İptal</button>
                <button type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                  {editing ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
