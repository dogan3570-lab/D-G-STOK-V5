// ==================== URUN SATIRI V6.0 ====================
// Tek urun satiri + inline duzenleme paneli
// Yeni sayfa/popup yok, satir icinde acilir
import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';
import PrepStatusBadge from './PrepStatusBadge';
import type { ProductPrepData, EditAction, StatusType } from './types';

interface PrepProductRowProps {
  product: ProductPrepData;
  onSaved: () => void; // Kayit sonrasi refetch tetikler
}

// ==================== KATEGORI ICIN TIPLER ====================
interface SystemCategory {
  id: string;
  name: string;
  parentId: string | null;
  children: SystemCategory[];
}

export default function PrepProductRow({ product, onSaved }: PrepProductRowProps) {
  const [expanded, setExpanded] = useState<EditAction>(null);
  const [saving, setSaving] = useState(false);

  // Kategori state
  const [categoryTree, setCategoryTree] = useState<SystemCategory[]>([]);
  const [catSearch, setCatSearch] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');

  // Marka state
  const [brandInput, setBrandInput] = useState('');

  // Varyant state
  const [scanning, setScanning] = useState(false);

  // Sablon state
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Kategori agacini yukle
  const loadCategoryTree = useCallback(async () => {
    const res = await apiFetch<{ items: SystemCategory[] }>('/categories/tree');
    if (res.ok && res.data) setCategoryTree(res.data.items || []);
  }, []);

  // Sablonlari yukle
  const loadTemplates = useCallback(async () => {
    const res = await apiFetch<{ items: Array<{ id: string; name: string }> }>('/listings');
    if (res.ok && res.data) setTemplates(res.data.items || []);
  }, []);

  // Panel acilinca verileri yukle
  useEffect(() => {
    if (expanded === 'category') loadCategoryTree();
    if (expanded === 'template') loadTemplates();
    if (expanded === 'brand') setBrandInput(product.brand?.name || '');
  }, [expanded, loadCategoryTree, loadTemplates, product.brand]);

  // === KATEGORI KAYDET ===
  const handleCategorySave = async () => {
    if (!selectedCatId) { showToast('warning', 'Lütfen bir kategori seçin'); return; }
    setSaving(true);
    try {
      const res = await apiFetch<any>('/categories/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCatId, productIds: [product.id] }),
      });
      if (res.ok) { showToast('success', '✅ Kategori eşleştirildi'); setExpanded(null); onSaved(); }
      else showToast('error', res.error?.message || 'Hata');
    } finally { setSaving(false); }
  };

  // === MARKA KAYDET ===
  const handleBrandSave = async () => {
    if (!brandInput.trim()) { showToast('warning', 'Marka adı girin'); return; }
    setSaving(true);
    try {
      const res = await apiFetch<any>('/brands/v3/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xmlBrandName: product.xmlKey, customBrandName: brandInput.trim() }),
      });
      if (res.ok) { showToast('success', `✅ Marka: ${brandInput.trim()}`); setExpanded(null); onSaved(); }
      else showToast('error', res.error?.message || 'Hata');
    } finally { setSaving(false); }
  };

  // === VARYANT TARA ===
  const handleVariantScan = async () => {
    if (!product.xmlSourceId) { showToast('warning', 'XML kaynağı bulunamadı'); return; }
    setScanning(true);
    try {
      const res = await apiFetch<any>(`/variants/v4/scan/${product.xmlSourceId}`, { method: 'POST' });
      if (res.ok) { showToast('success', '✅ Varyant taraması tamam'); setExpanded(null); onSaved(); }
      else showToast('error', res.error?.message || 'Hata');
    } finally { setScanning(false); }
  };

  // === SABLON ATA ===
  const handleTemplateSave = async () => {
    if (!selectedTemplateId) { showToast('warning', 'Şablon seçin'); return; }
    setSaving(true);
    try {
      const res = await apiFetch<any>('/products/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [product.id], updates: { templateMatch: true } }),
      });
      if (res.ok) { showToast('success', '✅ Şablon atandı'); setExpanded(null); onSaved(); }
      else showToast('error', res.error?.message || 'Hata');
    } finally { setSaving(false); }
  };

  // === FILTRELEMELI KATEGORI AGACI ===
  const filteredCategories = React.useMemo(() => {
    if (!catSearch) return categoryTree;
    const filter = (nodes: SystemCategory[]): SystemCategory[] =>
      nodes.filter(c => {
        const match = c.name.toLowerCase().includes(catSearch.toLowerCase());
        const children = filter(c.children || []);
        return match || children.length > 0;
      }).map(c => ({ ...c, children: filter(c.children || []) }));
    return filter(categoryTree);
  }, [categoryTree, catSearch]);

  const renderCategoryTree = (nodes: SystemCategory[], depth = 0): React.ReactNode =>
    nodes.map(cat => (
      <div key={cat.id}>
        <button
          type="button"
          onClick={() => setSelectedCatId(cat.id)}
          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
            selectedCatId === cat.id
              ? 'bg-blue-600/30 text-blue-200 font-medium'
              : 'hover:bg-slate-600/50 text-slate-300'
          }`}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {cat.children?.length > 0 ? '📁 ' : '📄 '}
          {cat.name}
        </button>
        {cat.children?.length > 0 && renderCategoryTree(cat.children, depth + 1)}
      </div>
    ));

  // === DURUM HESAPLA ===
  const catStatus: StatusType = product.categoryMatch ? 'completed' : 'missing';
  const brandStatus: StatusType = product.brandMatch ? 'completed' : 'missing';
  const variantStatus: StatusType = product.variantMatch ? 'ready' : 'review';
  const templateStatus: StatusType = product.templateMatch ? 'completed' : 'no_template';

  // Kategori adini formatla
  const catDetail = product.category?.name || undefined;

  return (
    <div className="border-b border-slate-700/50 last:border-b-0">
      {/* === ANA SATIR === */}
      <div className="flex items-stretch gap-2 p-3 hover:bg-slate-700/10 transition-colors">
        {/* URUN BILGISI */}
        <div className="w-48 shrink-0 flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base">👟</span>
            <span className="text-sm font-medium text-white truncate" title={product.title || product.xmlKey}>
              {product.title || product.xmlKey}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {product.sku && (
              <code className="text-[10px] font-mono text-cyan-300/70 truncate">SKU: {product.sku}</code>
            )}
            <span className="text-[10px] text-slate-600">•</span>
            <code className="text-[10px] font-mono text-slate-500 truncate">{product.xmlKey}</code>
          </div>
        </div>

        {/* 4 DURUM KARTI */}
        <div className="flex-1 grid grid-cols-4 gap-2">
          <PrepStatusBadge
            icon="🗂️"
            status={catStatus}
            label="Kategori"
            detail={catDetail}
            onEdit={() => setExpanded(expanded === 'category' ? null : 'category')}
          />
          <PrepStatusBadge
            icon="🏷️"
            status={brandStatus}
            label="Marka"
            detail={product.brand?.name || undefined}
            onEdit={() => setExpanded(expanded === 'brand' ? null : 'brand')}
          />
          <PrepStatusBadge
            icon="🧬"
            status={variantStatus}
            label="Varyant"
            onEdit={() => setExpanded(expanded === 'variant' ? null : 'variant')}
          />
          <PrepStatusBadge
            icon="📋"
            status={templateStatus}
            label="Listeleme"
            onEdit={() => setExpanded(expanded === 'template' ? null : 'template')}
          />
        </div>
      </div>

      {/* === INLINE PANEL (genisletilmis satir) === */}
      {expanded && (
        <div className="border-t border-slate-700/30 bg-slate-800/40">
          <div className="p-4">
            {/* KATEGORI PANELI */}
            {expanded === 'category' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">🗂️ Kategori Eşleştirme</h4>
                  <span className="text-[10px] text-slate-500">Ürün: {product.title || product.xmlKey}</span>
                </div>
                <input
                  type="text"
                  value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                  placeholder="Kategori ara..."
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-xs text-white placeholder-slate-400"
                />
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/60 p-1.5 space-y-0.5">
                  {filteredCategories.length > 0
                    ? renderCategoryTree(filteredCategories)
                    : <div className="text-xs text-slate-500 text-center py-4">Kategori bulunamadı</div>}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setExpanded(null)}
                    className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleCategorySave}
                    disabled={saving || !selectedCatId}
                    className="rounded-lg px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? '⏳ Kaydediliyor...' : '💾 Kategoriyi Eşleştir'}
                  </button>
                </div>
              </div>
            )}

            {/* MARKA PANELI */}
            {expanded === 'brand' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">🏷️ Marka Eşleştirme</h4>
                  <span className="text-[10px] text-slate-500">Ürün: {product.title || product.xmlKey}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-1">DG Marka Adı</label>
                    <input
                      type="text"
                      value={brandInput}
                      onChange={e => setBrandInput(e.target.value)}
                      placeholder="Marka adı girin (örn: Nike)"
                      className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setExpanded(null)}
                    className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleBrandSave}
                    disabled={saving || !brandInput.trim()}
                    className="rounded-lg px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? '⏳ Kaydediliyor...' : '🔗 Markayı Eşleştir'}
                  </button>
                </div>
              </div>
            )}

            {/* VARYANT PANELI */}
            {expanded === 'variant' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">🧬 Varyant Durumu</h4>
                  <span className="text-[10px] text-slate-500">Ürün: {product.title || product.xmlKey}</span>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-300">
                  {product.variantMatch ? (
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">✅</span>
                      Varyantlar hazır
                      {product.variants && product.variants.length > 0 && (
                        <span className="text-slate-500">
                          ({product.variants.map(v => `${v.name}: ${v.value}`).join(', ')})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400">⚠️</span>
                        <span>Varyant analizi gerekli</span>
                      </div>
                      {product.xmlSourceId ? (
                        <button
                          onClick={handleVariantScan}
                          disabled={scanning}
                          className="rounded-lg px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors"
                        >
                          {scanning ? (
                            <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent mr-1.5" /> Taranıyor...</>
                          ) : '🔍 Varyantları Tara'}
                        </button>
                      ) : (
                        <p className="text-slate-500 text-[10px]">XML kaynağı bulunamadı. Önce kategori ve marka işlemlerini tamamlayın.</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setExpanded(null)}
                    className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 transition-colors"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            )}

            {/* SABLON PANELI */}
            {expanded === 'template' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">📋 Listeleme Şablonu</h4>
                  <span className="text-[10px] text-slate-500">Ürün: {product.title || product.xmlKey}</span>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
                  {templates.length > 0 ? (
                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-400">Mevcut Şablonlar</label>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {templates.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTemplateId(t.id)}
                            className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                              selectedTemplateId === t.id
                                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                                : 'text-slate-300 hover:bg-slate-700/50 border border-transparent'
                            }`}
                          >
                            📋 {t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-4">
                      <span className="block mb-1">📋 Henüz şablon oluşturulmamış</span>
                      <span className="text-[10px] text-slate-600">Önce Listeleme modülünden bir şablon oluşturun</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setExpanded(null)}
                    className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 transition-colors"
                  >
                    İptal
                  </button>
                  {templates.length > 0 && (
                    <button
                      onClick={handleTemplateSave}
                      disabled={saving || !selectedTemplateId}
                      className="rounded-lg px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? '⏳ Kaydediliyor...' : '💾 Şablonu Ata'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
