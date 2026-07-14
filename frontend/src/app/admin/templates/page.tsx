'use client';

import { useState, useEffect } from 'react';
import { FileText, Plus, Save, X, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  titleTemplate: string;
  descriptionTemplate: string;
  shortDescriptionTemplate: string;
  metaTitleTemplate: string;
  metaDescriptionTemplate: string;
  isActive: boolean;
  isDefault: boolean;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    categoryId: '',
    titleTemplate: '{URUN_ADI} | D&G STORE',
    descriptionTemplate: '{URUN_ACIKLAMA}\n\nKategori: {URUN_KATEGORI}\nMarka: {URUN_MARKA}\nStok: {URUN_STOK}',
    shortDescriptionTemplate: '{URUN_ADI} - {URUN_MARKA}',
    metaTitleTemplate: '{URUN_ADI} | {URUN_KATEGORI} | D&G STORE',
    metaDescriptionTemplate: '{URUN_ADI} {URUN_ACIKLAMA}',
  });

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const data = await api.request('/templates');
      setTemplates(Array.isArray(data?.data || data) ? (data?.data || data) : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      await api.request('/templates', { method: 'POST', body: JSON.stringify(newTemplate) });
      toast.success('Şablon oluşturuldu');
      setShowNew(false);
      setNewTemplate({
        name: '', categoryId: '', titleTemplate: '{URUN_ADI} | D&G STORE',
        descriptionTemplate: '', shortDescriptionTemplate: '',
        metaTitleTemplate: '', metaDescriptionTemplate: '',
      });
      loadTemplates();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    try {
      await api.request(`/templates/${editing.id}`, { method: 'PATCH', body: JSON.stringify(editing) });
      toast.success('Şablon güncellendi');
      setEditing(null);
      loadTemplates();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Şablonu silmek istediğinize emin misiniz?')) return;
    try {
      await api.request(`/templates/${id}`, { method: 'DELETE' });
      toast.success('Şablon silindi');
      loadTemplates();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleApply = async (templateId: string) => {
    const productIds = prompt('Ürün ID\'lerini virgülle ayırarak girin (boş bırakırsanız tüm ürünlere uygulanır):');
    if (productIds === null) return;
    
    try {
      const ids = productIds.trim() ? productIds.split(',').map(id => id.trim()) : [];
      const res = await api.request(`/templates/apply/${templateId}`, {
        method: 'POST',
        body: JSON.stringify({ productIds: ids }),
      });
      toast.success(`Şablon ${res.applied || 0} ürüne uygulandı`);
    } catch (err: any) { toast.error(err.message); }
  };

  const variables = [
    '{URUN_ADI}', '{URUN_SKU}', '{URUN_BARKOD}', '{URUN_FIYAT}',
    '{URUN_INDIRIMLI_FIYAT}', '{URUN_MARKA}', '{URUN_KATEGORI}',
    '{URUN_ACIKLAMA}', '{URUN_STOK}', '{SITE_ADI}'
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-gray-900">Listeleme Şablonları</h1>
          <p className="text-sm text-gray-500 mt-1">Kategori bazlı listeleme şablonları oluşturun ve yönetin</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm hover:bg-gray-800">
          <Plus className="w-4 h-4" /> Yeni Şablon
        </button>
      </div>

      {/* Variables Info */}
      <div className="bg-gray-50 border border-gray-100 p-4 mb-6">
        <p className="text-xs text-gray-500 mb-2">Kullanılabilir Değişkenler:</p>
        <div className="flex flex-wrap gap-2">
          {variables.map(v => (
            <code key={v} className="px-2 py-1 bg-white text-xs text-gray-700 border border-gray-200">{v}</code>
          ))}
        </div>
      </div>

      {/* New Template Form */}
      {showNew && (
        <div className="bg-white border border-gray-100 p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Yeni Şablon</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Şablon Adı</label>
                <input value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Kategori ID (opsiyonel)</label>
                <input value={newTemplate.categoryId} onChange={e => setNewTemplate(p => ({ ...p, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Başlık Şablonu</label>
              <input value={newTemplate.titleTemplate} onChange={e => setNewTemplate(p => ({ ...p, titleTemplate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Açıklama Şablonu</label>
              <textarea value={newTemplate.descriptionTemplate} onChange={e => setNewTemplate(p => ({ ...p, descriptionTemplate: e.target.value }))} rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Kısa Açıklama Şablonu</label>
                <input value={newTemplate.shortDescriptionTemplate} onChange={e => setNewTemplate(p => ({ ...p, shortDescriptionTemplate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Meta Başlık Şablonu</label>
                <input value={newTemplate.metaTitleTemplate} onChange={e => setNewTemplate(p => ({ ...p, metaTitleTemplate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-black text-white text-sm">Kaydet</button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-gray-300 text-sm text-gray-600">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Template List */}
      {loading ? (
        <div className="text-center py-12"><div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto" /></div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-gray-100 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Henüz şablon oluşturulmamış</p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white border border-gray-100 p-6">
              {editing?.id === t.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Şablon Adı</label>
                      <input value={editing.name} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Başlık Şablonu</label>
                    <input value={editing.titleTemplate} onChange={e => setEditing(p => ({ ...p!, titleTemplate: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Açıklama Şablonu</label>
                    <textarea value={editing.descriptionTemplate} onChange={e => setEditing(p => ({ ...p!, descriptionTemplate: e.target.value }))} rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleUpdate} className="px-4 py-2 bg-black text-white text-sm">Güncelle</button>
                    <button onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 text-sm text-gray-600">İptal</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <h3 className="text-sm font-medium text-gray-900">{t.name}</h3>
                      {t.isDefault && <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600">Varsayılan</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleApply(t.id)} className="p-1.5 text-gray-400 hover:text-green-600" title="Şablonu uygula">
                        <Play className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditing(t)} className="p-1.5 text-gray-400 hover:text-blue-600">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {t.titleTemplate && (
                    <div className="text-xs text-gray-500 space-y-1">
                      <p><span className="text-gray-400">Başlık:</span> {t.titleTemplate}</p>
                      {t.descriptionTemplate && <p><span className="text-gray-400">Açıklama:</span> {t.descriptionTemplate.substring(0, 100)}...</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
