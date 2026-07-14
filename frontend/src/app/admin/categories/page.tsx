'use client';

import { useState, useEffect } from 'react';
import { FolderTree, Plus, Edit3, Trash2, Move, ChevronRight, ChevronDown, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  parent?: Category | null;
  children?: Category[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newCategory, setNewCategory] = useState({ name: '', parentId: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await api.request('/categories');
      const list = data?.data || data || [];
      setCategories(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Kategoriler yuklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newCategory.name.trim()) {
      toast.error('Kategori adı gerekli');
      return;
    }

    try {
      const slug = newCategory.name.toLowerCase()
        .replace(/[çÇğĞıİöÖşŞüÜ]/g, m => ({'ç':'c','Ç':'c','ğ':'g','Ğ':'g','ı':'i','İ':'i','ö':'o','Ö':'o','ş':'s','Ş':'s','ü':'u','Ü':'u'})[m] || m)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const body: any = { name: newCategory.name, slug, isActive: true };
      if (newCategory.parentId) {
        body.parent = { id: newCategory.parentId };
      }

      await api.request('/categories', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      toast.success('Kategori oluşturuldu');
      setNewCategory({ name: '', parentId: '' });
      setShowAddForm(false);
      loadCategories();
    } catch (err: any) {
      toast.error(err.message || 'Kategori oluşturulamadı');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;

    try {
      await api.request(`/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName }),
      });
      toast.success('Kategori güncellendi');
      setEditingId(null);
      loadCategories();
    } catch (err: any) {
      toast.error(err.message || 'Güncellenemedi');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" kategorisini silmek istediğinize emin misiniz?`)) return;

    try {
      await api.request(`/categories/${id}`, { method: 'DELETE' });
      toast.success('Kategori silindi');
      loadCategories();
    } catch (err: any) {
      toast.error(err.message || 'Silinemedi');
    }
  };

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const renderCategoryTree = (items: Category[], level: number = 0) => {
    return items.map((cat) => {
      const hasChildren = cat.children && cat.children.length > 0;
      const isExpanded = expandedIds.has(cat.id);
      const isEditing = editingId === cat.id;

      return (
        <div key={cat.id}>
          <div
            className={`flex items-center gap-2 py-2.5 px-3 hover:bg-gray-50 group ${
              level > 0 ? 'ml-8 border-l-2 border-gray-100' : ''
            }`}
            style={{ paddingLeft: `${level * 24 + 12}px` }}
          >
            {hasChildren ? (
              <button onClick={() => toggleExpand(cat.id)} className="text-gray-400 hover:text-black">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {isEditing ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 focus:outline-none focus:border-black"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat.id)}
                />
                <button onClick={() => handleUpdate(cat.id)} className="p-1 text-green-600 hover:bg-green-50">
                  <Save className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <FolderTree className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-900">{cat.name}</span>
                <span className="text-[10px] text-gray-400 mr-2">{cat.slug}</span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id, cat.name)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>

          {hasChildren && isExpanded && cat.children && (
            <div className="ml-4">
              {renderCategoryTree(cat.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderFlatList = (items: Category[], prefix: string = '') => {
    let result: any[] = [];
    for (const item of items) {
      result.push(
        <option key={item.id} value={item.id}>
          {prefix}{item.name}
        </option>
      );
      if (item.children) {
        result = result.concat(renderFlatList(item.children, prefix + '— '));
      }
    }
    return result;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-gray-900">Kategori Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">Kategorileri düzenleyin, taşıyın ve yönetin</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yeni Kategori
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white border border-gray-100 p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Yeni Kategori Ekle</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kategori Adı</label>
              <input
                value={newCategory.name}
                onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Örn: Spor Ayakkabı"
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Üst Kategori (Opsiyonel)</label>
              <select
                value={newCategory.parentId}
                onChange={(e) => setNewCategory(prev => ({ ...prev, parentId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black"
              >
                <option value="">Ana Kategori</option>
                {renderFlatList(categories)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-black text-white text-sm hover:bg-gray-800 transition-colors"
            >
              Kaydet
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Category Tree */}
      <div className="bg-white border border-gray-100">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto" />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center">
            <FolderTree className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Henüz kategori eklenmemiş</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {renderCategoryTree(categories)}
          </div>
        )}
      </div>
    </div>
  );
}
