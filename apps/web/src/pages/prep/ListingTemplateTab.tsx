// ==================== LISTELEME SABLONU V5.0 ====================
// Urun veya Kategori secimi + Pazaryeri + Fiyat kurallari + Kaydet
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { showToast } from '../../components/ui/Toast';
import { formatPrice } from '../../lib/utils';

interface Marketplace { id: string; key: string; name: string; }
interface SystemCategory { id: string; name: string; parentId: string | null; children: SystemCategory[]; }

interface PriceRule {
  id: string;
  minPrice: string;  // string olarak sakla (virgul/nokta icin)
  maxPrice: string;
  profitMargin: string;
  fixedAmount: string;
  rounding: string;
}

// Sayisal degerleri string'den cevir
function toNum(s: string): number {
  const n = Number(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

const ROUNDING_OPTIONS = [
  { value: '', label: 'Yok' },
  { value: '0.90', label: '0,90' },
  { value: '9.90', label: '9,90' },
  { value: '49.90', label: '49,90' },
  { value: '99.90', label: '99,90' },
  { value: 'nearest', label: 'En Yakın Tam Sayı' },
];

let ruleIdCounter = 0;
function newRuleId() { return `rule_${++ruleIdCounter}_${Date.now()}`; }
function createEmptyRule(): PriceRule {
  return { id: newRuleId(), minPrice: '', maxPrice: '', profitMargin: '', fixedAmount: '', rounding: '' };
}

export default function ListingTemplateTab() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [selectedMpId, setSelectedMpId] = useState('');
  
  // Urun secimi
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Array<{ id: string; title: string; xmlKey: string; barcode: string | null; sku: string | null; purchasePrice: number | null }>>([]);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; title: string; xmlKey: string; purchasePrice: number | null } | null>(null);
  const [searchingProduct, setSearchingProduct] = useState(false);

  // Kategori secimi
  const [systemTree, setSystemTree] = useState<SystemCategory[]>([]);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [catSearch, setCatSearch] = useState('');

  // Hedef tipi: 'urun' veya 'kategori'
  const [targetType, setTargetType] = useState<'urun' | 'kategori'>('kategori');

  // Kalici kayit mesaji
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fiyat kurallari
  const [rules, setRules] = useState<PriceRule[]>([createEmptyRule()]);
  const [previewPurchasePrice, setPreviewPurchasePrice] = useState(100);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Kayitli sablonlar
  const [savedTemplates, setSavedTemplates] = useState<Array<{ id: string; name: string; marketplaceId: string | null; productId: string | null; categoryId: string | null; active: boolean; priceRangeRules: string | null; createdAt: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Token helper
  const getToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('dgstok_token');
  };
  const authHeaders = (): Record<string, string> => {
    const t = getToken();
    const h: Record<string, string> = {};
    if (t) h['x-auth-token'] = t;
    return h;
  };

  // Sablonlari yukle
  const loadTemplates = useCallback(async () => {
    const ah = authHeaders();
    try {
      const r = await fetch('/listings', { headers: ah });
      const d = await r.json();
      if (d?.items) setSavedTemplates(d.items);
    } catch {}
  }, []);

  // Veri cekme
  useEffect(() => {
    const ah = authHeaders();
    fetch('/marketplaces', { headers: ah }).then(r => r.json()).then(d => { if (d?.items) setMarketplaces(d.items); }).catch(() => {});
    fetch('/categories/tree', { headers: ah }).then(r => r.json()).then(d => { if (d?.items) setSystemTree(d.items); }).catch(() => {});
    loadTemplates();
  }, []);

  // Pazaryeri degisince o pazaryerine ait sablonu otomatik yukle
  useEffect(() => {
    if (!selectedMpId) return;
    loadTemplates().then(() => {
      // O pazaryerine ait ilk sablonu bul ve yukle
      const mpTpl = savedTemplates.find(t => t.marketplaceId === selectedMpId);
      if (mpTpl && selectedTemplateId !== mpTpl.id) {
        loadTemplate(mpTpl);
      }
    });
  }, [selectedMpId]);

  // Urun ara (debounce)
  useEffect(() => {
    if (!productSearch || productSearch.length < 2) { setProductResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchingProduct(true);
      try {
        const params = new URLSearchParams({ search: productSearch, limit: '20' });
        const res = await fetch(`/categories/products?${params}`, { headers: authHeaders() });
        const data = await res.json();
        if (data?.items) {
          setProductResults(data.items.map((p: any) => ({
            id: p.id, title: p.title || p.xmlKey, xmlKey: p.xmlKey,
            barcode: p.barcode, sku: p.sku, purchasePrice: p.purchasePrice,
          })));
        }
      } catch {}
      setSearchingProduct(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const filteredTree = useMemo(() => {
    if (!catSearch) return systemTree;
    const filter = (nodes: SystemCategory[]): SystemCategory[] =>
      nodes.filter(c => {
        const match = c.name.toLowerCase().includes(catSearch.toLowerCase());
        const children = filter(c.children || []);
        return match || children.length > 0;
      }).map(c => ({ ...c, children: filter(c.children || []) }));
    return filter(systemTree);
  }, [systemTree, catSearch]);

  const toggleCatExpand = (id: string) => {
    setExpandedCats(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const renderTree = (nodes: SystemCategory[], depth = 0): React.ReactNode =>
    nodes.map(cat => {
      const hasChildren = cat.children?.length > 0;
      const expanded = expandedCats.has(cat.id);
      return (
        <div key={cat.id}>
          <button type="button" onClick={() => setSelectedCatId(cat.id)}
            className={`w-full flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors text-left ${
              selectedCatId === cat.id ? 'bg-blue-600/30 text-blue-200 font-medium' : 'hover:bg-slate-600/50 text-slate-300'
            }`} style={{ paddingLeft: `${6 + depth * 14}px` }}>
            {hasChildren ? (
              <span role="button" tabIndex={-1} onClick={e => { e.stopPropagation(); toggleCatExpand(cat.id); }}
                className="w-3.5 text-center text-slate-500 hover:text-white shrink-0">{expanded ? '▼' : '▶'}</span>
            ) : <span className="w-3.5 text-slate-600 shrink-0">•</span>}
            <span className="truncate flex-1">{cat.name}</span>
          </button>
          {hasChildren && expanded && renderTree(cat.children, depth + 1)}
        </div>
      );
    });

  // Kural dogrulama (string -> number donusumu ile)
  const validateRules = useCallback((): string[] => {
    const errs: string[] = [];
    const sorted = [...rules].sort((a, b) => toNum(a.minPrice) - toNum(b.minPrice));
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const minP = toNum(r.minPrice), maxP = toNum(r.maxPrice), kar = toNum(r.profitMargin), ek = toNum(r.fixedAmount);
      if (minP >= maxP && maxP !== 0) errs.push(`Kural ${i + 1}: Minimum fiyat, maksimum fiyattan büyük olamaz`);
      if (minP < 0 || maxP < 0 || kar < 0 || ek < 0) errs.push(`Kural ${i + 1}: Negatif değer girilemez`);
      if (i > 0) { const prev = sorted[i - 1]; if (toNum(prev.maxPrice) > minP && toNum(prev.maxPrice) !== 0) errs.push(`Kural ${i + 1}: Barem çakışması var`); }
    }
    return errs;
  }, [rules]);

  const calculatePrice = useCallback((purchasePrice: number): { price: number; rule: PriceRule | null } => {
    const sorted = [...rules].sort((a, b) => toNum(a.minPrice) - toNum(b.minPrice));
    for (const rule of sorted) {
      const minP = toNum(rule.minPrice), maxP = toNum(rule.maxPrice), kar = toNum(rule.profitMargin), ek = toNum(rule.fixedAmount);
      if (maxP === 0 || (purchasePrice >= minP && purchasePrice <= maxP)) {
        let price = purchasePrice * (1 + kar / 100) + ek;
        switch (rule.rounding) {
          case '0.90': price = Math.floor(price) + 0.90; break;
          case '9.90': price = Math.floor(price / 10) * 10 + 9.90; break;
          case '49.90': price = Math.floor(price / 50) * 50 + 49.90; break;
          case '99.90': price = Math.floor(price / 100) * 100 + 99.90; break;
          case 'nearest': price = Math.round(price); break;
        }
        return { price: Math.round(price * 100) / 100, rule };
      }
    }
    return { price: purchasePrice, rule: null };
  }, [rules]);

  const handlePreview = () => {
    const errs = validateRules();
    setErrors(errs);
    if (errs.length > 0) { setPreviewResult(null); return; }
    const result = calculatePrice(previewPurchasePrice);
    setPreviewResult(`${formatPrice(result.price)} (Kar: %${toNum(result.rule?.profitMargin || '0')} + ${formatPrice(toNum(result.rule?.fixedAmount || '0'))})`);
  };

  useEffect(() => { setErrors(validateRules()); }, [rules, validateRules]);

  // Kaydet
  const handleSave = async () => {
    setSaveMessage(null);
    if (!selectedMpId) { setSaveMessage({ type: 'error', text: 'Lütfen bir pazaryeri seçin' }); return; }
    const errs = validateRules();
    if (errs.length > 0) { setSaveMessage({ type: 'error', text: 'Kuralları düzeltin' }); return; }

    setSaving(true);
    try {
      const priceRangeRules = JSON.stringify(rules.map(r => ({
        minPrice: toNum(r.minPrice), maxPrice: toNum(r.maxPrice),
        profitMargin: toNum(r.profitMargin), fixedAmount: toNum(r.fixedAmount), rounding: r.rounding,
      })));

      // name: kategori veya urun secildiyse ona gore, secilmediyse sadece sablon
      let name = 'Fiyat Şablonu';
      if (targetType === 'urun' && selectedProduct) name = `Ürün: ${selectedProduct.title}`;
      else if (targetType === 'kategori' && selectedCatId) name = `Kategori: ${getCatName(selectedCatId)}`;

      const body = {
        name,
        marketplaceId: selectedMpId,
        productId: targetType === 'urun' && selectedProduct ? selectedProduct!.id : null,
        categoryId: targetType === 'kategori' && selectedCatId ? selectedCatId : null,
        priceRangeRules,
        priceSource: 'XML_PURCHASE',
        vatMode: 'INCLUDED',
        active: true,
      };

      const token = getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['x-auth-token'] = token;

      const url = selectedTemplateId ? `/listings/${selectedTemplateId}` : '/listings';
      const method = selectedTemplateId ? 'PUT' : 'POST';

      const response = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await response.json();

      if (response.ok) {
        const savedId = data?.item?.id || selectedTemplateId;
        setSelectedTemplateId(savedId);
        setLastSavedAt(new Date().toLocaleString('tr-TR'));
        setSaveMessage(null);
        showToast('success', '✅ Şablon başarıyla kaydedildi!');
        const listRes = await fetch('/listings', { headers });
        const listData = await listRes.json();
        if (listRes.ok && listData?.items) setSavedTemplates(listData.items);
      } else {
        const errMsg = data?.error?.message || 'Kaydetme başarısız';
        setSaveMessage({ type: 'error', text: `❌ ${errMsg}` });
        showToast('error', `❌ ${errMsg}`);
      }
    } catch (e: any) {
      setSaveMessage({ type: 'error', text: `❌ Hata: ${e?.message || 'Bilinmeyen hata'}` });
      showToast('error', '❌ Kaydetme sırasında hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const getCatName = (id: string): string => {
    const find = (nodes: SystemCategory[]): string => {
      for (const n of nodes) {
        if (n.id === id) return n.name;
        if (n.children) { const r = find(n.children); if (r) return r; }
      }
      return '';
    };
    return find(systemTree) || id;
  };

  const loadTemplate = (tpl: any) => {
    setSelectedTemplateId(tpl.id);
    setSelectedMpId(tpl.marketplaceId || '');
    if (tpl.productId) { setTargetType('urun'); setSelectedProduct({ id: tpl.productId, title: '', xmlKey: '', purchasePrice: null }); }
    else if (tpl.categoryId) { setTargetType('kategori'); setSelectedCatId(tpl.categoryId); }
    if (tpl.priceRangeRules) {
      try {
        const parsedRules = JSON.parse(tpl.priceRangeRules);
        // Sayisal degerleri string'e cevir (input'larda goruntulemek icin)
        setRules(parsedRules.map((r: any) => ({
          id: newRuleId(),
          minPrice: String(r.minPrice ?? ''),
          maxPrice: String(r.maxPrice ?? ''),
          profitMargin: String(r.profitMargin ?? ''),
          fixedAmount: String(r.fixedAmount ?? ''),
          rounding: r.rounding || '',
        })));
      } catch { setRules([createEmptyRule()]); }
    }
    setShowTemplates(false);
  };

  const newTemplate = () => {
    setSelectedTemplateId('');
    setSelectedProduct(null);
    setSelectedCatId('');
    setSelectedMpId('');
    setRules([createEmptyRule()]);
    setLastSavedAt(null);
    setSaveMessage(null);
  };

  const addRule = () => setRules(prev => [...prev, createEmptyRule()]);
  const removeRule = (id: string) => { if (rules.length <= 1) return; setRules(prev => prev.filter(r => r.id !== id)); };
  const updateRule = (id: string, field: keyof PriceRule, value: string) => {
    // String degeri oldugu gibi sakla (virgul dahil)
    // Sayisal alanlarda (minPrice, maxPrice, profitMargin, fixedAmount) sadece gecerli karakterleri filtrele
    let newValue = value;
    if (field !== 'rounding') {
      // Sadece rakam, virgul, nokta ve eksi karakterine izin ver
      newValue = value.replace(/[^0-9,\-.]/g, '');
      // Birden fazla nokta/virgul varsa temizle
      const parts = newValue.split(/[,.]/);
      if (parts.length > 2) newValue = parts[0] + '.' + parts.slice(1).join('');
    }
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: newValue } : r));
  };

  return (
    <div className="space-y-4">
      {/* Hedef secimi + Pazaryeri + Kaydet */}
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3">
        {/* Sol: Hedef ve Pazaryeri */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Hedef Tipi */}
          <div className="flex gap-2">
            <button onClick={() => setTargetType('kategori')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${targetType === 'kategori' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
              🗂️ Kategori Seç
            </button>
            <button onClick={() => setTargetType('urun')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${targetType === 'urun' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
              📦 Ürün Seç
            </button>
          </div>

          {/* Kategori Secimi */}
          {targetType === 'kategori' && (
            <div className="rounded-lg border border-slate-600 bg-slate-700/30 overflow-hidden">
              <div className="p-2 border-b border-slate-600">
                <input type="text" value={catSearch} onChange={e => setCatSearch(e.target.value)}
                  placeholder="Kategori ara..." className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white placeholder-slate-500" />
              </div>
              <div className="max-h-40 overflow-y-auto p-1 space-y-0.5">
                {renderTree(filteredTree)}
                {filteredTree.length === 0 && <div className="text-[10px] text-slate-500 text-center py-2">Kategori bulunamadı</div>}
              </div>
              {selectedCatId && (
                <div className="p-2 border-t border-slate-600 bg-slate-800/50">
                  <span className="text-[10px] text-green-400">✅ Seçili: {getCatName(selectedCatId)}</span>
                </div>
              )}
            </div>
          )}

          {/* Urun Secimi */}
          {targetType === 'urun' && (
            <div>
              <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
                placeholder="Ürün adı, barkod veya SKU ile ara..."
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs text-white placeholder-slate-500" />
              {searchingProduct && <div className="text-[10px] text-slate-500 mt-1">Aranıyor...</div>}
              {productResults.length > 0 && (
                <div className="mt-1 rounded-lg border border-slate-600 bg-slate-800 max-h-32 overflow-y-auto">
                  {productResults.map(p => (
                    <button key={p.id} onClick={() => { setSelectedProduct(p); setProductResults([]); setProductSearch(p.title); }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 border-b border-slate-700/50">
                      <span className="font-medium">{p.title}</span>
                      <span className="text-[10px] text-slate-500 ml-2">SKU: {p.sku || '-'}</span>
                      {p.barcode && <span className="text-[10px] text-slate-500 ml-2">Barkod: {p.barcode}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct && (
                <div className="mt-1 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5">
                  <span className="text-[10px] text-green-400">✅ {selectedProduct.title}</span>
                  {selectedProduct.purchasePrice && (
                    <span className="text-[10px] text-slate-400 ml-2">Alış: {formatPrice(selectedProduct.purchasePrice)}</span>
                  )}
                  <button onClick={() => { setSelectedProduct(null); setProductSearch(''); }}
                    className="text-[10px] text-red-400 ml-2 hover:text-red-300">✕</button>
                </div>
              )}
            </div>
          )}

          {/* Pazaryeri */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Pazaryeri:</span>
            <select value={selectedMpId} onChange={e => { setSelectedMpId(e.target.value); setSelectedTemplateId(''); setSaveMessage(null); }}
              className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs text-white min-w-[140px]">
              <option value="">Seç...</option>
              {marketplaces.map(mp => <option key={mp.id} value={mp.id}>{mp.name}</option>)}
            </select>
          </div>

          {/* Secili pazaryerine ait sablonlar */}
          {selectedMpId && (
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">{marketplaces.find(m=>m.id===selectedMpId)?.name} Şablonları</label>
              <div className="max-h-24 overflow-y-auto space-y-0.5">
                {savedTemplates.filter(t => t.marketplaceId === selectedMpId).length === 0 ? (
                  <div className="text-[10px] text-slate-500 italic">Bu pazaryeri için şablon yok</div>
                ) : savedTemplates.filter(t => t.marketplaceId === selectedMpId).map(t => (
                  <button key={t.id} onClick={() => loadTemplate(t)}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors ${
                      selectedTemplateId === t.id ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-700/50'
                    }`}>
                    {t.productId ? '📦 ' : t.categoryId ? '🗂️ ' : '📋 '}
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sag: Butonlar - Yeni ve Kayitli Sablonlar */}
        <div className="flex flex-col gap-2">
          <button onClick={newTemplate} className="rounded-lg bg-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-600 whitespace-nowrap">🆕 Yeni</button>
          <div className="relative">
            <button onClick={() => setShowTemplates(!showTemplates)}
              className="rounded-lg bg-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-600 whitespace-nowrap w-full">
              📂 Kayıtlı ({savedTemplates.length})
            </button>
            {showTemplates && (
              <div className="absolute top-full right-0 mt-1 w-56 rounded-xl border border-slate-600 bg-slate-800 shadow-xl z-50 max-h-48 overflow-y-auto">
                {savedTemplates.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500">Henüz şablon yok</div>
                ) : savedTemplates.map(t => (
                  <button key={t.id} onClick={() => loadTemplate(t)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 border-b border-slate-700/50">
                    {t.productId ? '📦 ' : '🗂️ '}{t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KAYIT MESAJI - Kullaniciya kayit sonucu gosterilir */}
      {saveMessage && (
        <div className={`rounded-xl border p-4 ${
          saveMessage.type === 'success'
            ? 'border-green-500/30 bg-green-500/10'
            : 'border-red-500/30 bg-red-500/10'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-lg ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {saveMessage.type === 'success' ? '✅' : '❌'}
              </span>
              <span className={`text-sm font-medium ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {saveMessage.text}
              </span>
            </div>
            <button onClick={() => setSaveMessage(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
          </div>
        </div>
      )}

      {/* Hata mesajlari */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-1">
          {errors.map((err, i) => <div key={i} className="text-xs text-red-400">⚠️ {err}</div>)}
        </div>
      )}

      {/* Kaydedildi bilgisi */}
      {lastSavedAt && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-lg">✅</span>
            <div>
              <span className="text-xs text-green-400 font-medium">Şablon kaydedildi</span>
              <span className="text-[10px] text-green-500/70 ml-2">• {lastSavedAt}</span>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
            {saving ? '⏳' : '💾'} Tekrar Kaydet
          </button>
        </div>
      )}

      {/* Kural tablosu */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-700 bg-slate-800/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-white">💰 Fiyat Kuralları</h3>
              <span className="text-[10px] text-slate-500">KDV'li alış fiyatına uygulanır · {rules.length} kural</span>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-600/20 flex items-center gap-1.5">
              {saving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
            </button>
          </div>
        </div>
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <TH>Min Alış</TH><TH>Max Alış</TH><TH>Kar %</TH><TH>Ek Tutar</TH><TH>Yuvarlama</TH><TH style={{ width: 60 }}>İşlem</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {rules.map((rule, index) => (
              <tr key={rule.id} className="hover:bg-slate-700/20">
                <td className="px-3 py-2"><input type="text" inputMode="decimal" value={rule.minPrice} onChange={e => updateRule(rule.id, 'minPrice', e.target.value)} onFocus={e => e.target.select()} className="w-20 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-white text-right tabular-nums" placeholder="₺0" /></td>
                <td className="px-3 py-2"><input type="text" inputMode="decimal" value={rule.maxPrice} onChange={e => updateRule(rule.id, 'maxPrice', e.target.value)} onFocus={e => e.target.select()} className="w-20 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-white text-right tabular-nums" placeholder="₺0 = sınırsız" /></td>
                <td className="px-3 py-2"><div className="flex items-center gap-1"><input type="text" inputMode="decimal" value={rule.profitMargin} onChange={e => updateRule(rule.id, 'profitMargin', e.target.value)} onFocus={e => e.target.select()} className="w-16 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-white text-right tabular-nums" placeholder="%" /><span className="text-slate-400 text-xs w-4">%</span></div></td>
                <td className="px-3 py-2"><div className="flex items-center gap-1"><input type="text" inputMode="decimal" value={rule.fixedAmount} onChange={e => updateRule(rule.id, 'fixedAmount', e.target.value)} onFocus={e => e.target.select()} className="w-20 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-white text-right tabular-nums" placeholder="₺0" /><span className="text-slate-400 text-xs">TL</span></div></td>
                <td className="px-3 py-2"><select value={rule.rounding} onChange={e => updateRule(rule.id, 'rounding', e.target.value)} className="rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-white">{ROUNDING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                <td className="px-3 py-2"><button onClick={() => removeRule(rule.id)} disabled={rules.length <= 1} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20 disabled:opacity-30">🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addRule} className="w-full rounded-lg border-2 border-dashed border-slate-600 py-3 text-sm text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors">➕ Kural Ekle</button>

      {/* ALT TARAFTA BÜYÜK KAYDET BUTONU */}
      <button onClick={handleSave} disabled={saving}
        className="w-full rounded-xl bg-blue-600 py-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
        {saving ? (
          <><div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Kaydediliyor...</>
        ) : (
          <><span className="text-lg">💾</span> Şablonu Kaydet</>
        )}
      </button>

      {/* Onizleme */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">💰 Canlı Fiyat Önizleme</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">KDV'li Alış:</span>
            <input type="number" value={previewPurchasePrice} onChange={e => setPreviewPurchasePrice(Number(e.target.value))}
              className="w-28 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-white" />
            <span className="text-xs text-slate-400">TL</span>
          </div>
          <button onClick={handlePreview} className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700">Hesapla</button>
          {previewResult && <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm text-green-400 font-medium">{previewResult}</div>}
        </div>
      </div>
    </div>
  );
}

function TH({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap" style={style}>{children}</th>;
}
