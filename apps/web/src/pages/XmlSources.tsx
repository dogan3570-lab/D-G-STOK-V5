import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api';

// ==================== TYPES ====================
interface XmlSourceItem {
  id: string;
  name: string;
  company: string | null;
  sourceType: string;
  url: string | null;
  username: string | null;
  currency: string;
  vatRate: number;
  active: boolean;
  connectionStatus: string;
  scheduleIntervalMinutes: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  purchasePriceVatStatus: string;
  purchasePriceField: string | null;
  productCount: number;
  lastRunStatus: string | null;
  lastRunDurationMs: number | null;
  lastNewProducts: number;
  lastUpdatedProducts: number;
  lastFailedProducts: number;
  createdAt: string;
  updatedAt: string;
}

interface XmlImportRun {
  id: string;
  sourceId: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: string;
  totalProducts: number;
  newProducts: number;
  updatedProducts: number;
  failedProducts: number;
  skippedProducts: number;
  deletedProducts: number;
  errorDetail: string | null;
}

interface ProductItem {
  id: string;
  xmlKey: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  minStock: number;
  purchasePrice: number | null;
  salePrice: number | null;
  vatRate: number | null;
  images: string | null;
  status: string;
  errorMessage: string | null;
  categoryMatch: boolean;
  brandMatch: boolean;
  variantMatch: boolean;
  templateMatch: boolean;
  categoryId: string | null;
  brandId: string | null;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  variants?: Array<{ id: string; name: string; value: string }>;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PricingRule {
  id: string;
  type: string;
  label: string;
  value: number;
}

interface PricingPreview {
  basePrice: number;
  vatStatus: string;
  vatRate: number;
  calculatedPrice: number;
  steps: Array<{ step: number; rule: string; before: number; after: number }>;
}

// ==================== CONSTANTS ====================
const SYSTEM_FIELDS = [
  { value: 'xmlKey', label: 'XML Key (ID)' },
  { value: 'title', label: 'Ürün Adı' },
  { value: 'sku', label: 'SKU' },
  { value: 'barcode', label: 'Barkod' },
  { value: 'stock', label: 'Stok' },
  { value: 'minStock', label: 'Min. Stok' },
  { value: 'price', label: 'Fiyat' },
  { value: 'listPrice', label: 'Liste Fiyatı' },
  { value: 'tax', label: 'KDV Oranı' },
  { value: 'currency', label: 'Para Birimi' },
  { value: 'brand', label: 'Marka' },
  { value: 'category', label: 'Kategori' },
  { value: 'mainCategory', label: 'Ana Kategori' },
  { value: 'topCategory', label: 'Üst Kategori' },
  { value: 'subCategory', label: 'Alt Kategori' },
  { value: 'description', label: 'Açıklama' },
  { value: 'detail', label: 'Detay' },
  { value: 'images', label: 'Görseller' },
  { value: 'link', label: 'Link' },
  { value: 'unit', label: 'Birim' },
  { value: 'active', label: 'Aktif' },
];

const PRICING_RULE_TYPES = [
  { value: 'fixed_add', label: 'Sabit Tutar Ekle', icon: '➕' },
  { value: 'fixed_subtract', label: 'Sabit Tutar Çıkar', icon: '➖' },
  { value: 'percentage_profit', label: 'Yüzde Kâr Ekle', icon: '📈' },
  { value: 'percentage_discount', label: 'Yüzde İndirim Uygula', icon: '🏷️' },
  { value: 'round_nearest', label: 'En Yakın Sayıya Yuvarla', icon: '🔢' },
  { value: 'round_99', label: 'En Yakın 0.99\'a Yuvarla', icon: '99' },
  { value: 'round_999', label: 'En Yakın 9.90\'a Yuvarla', icon: '9.90' },
  { value: 'psychological', label: 'Psikolojik Fiyatlandırma', icon: '🧠' },
  { value: 'min_price', label: 'Min. Satış Fiyatı Belirle', icon: '⬆️' },
  { value: 'max_price', label: 'Maks. Satış Fiyatı Belirle', icon: '⬇️' },
];

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500, 1000];

// ==================== COMPONENT ====================
export default function XmlSources() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'kaynaklar' | 'urunler'>('kaynaklar');
  
  // Sources state
  const [sources, setSources] = useState<XmlSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<XmlSourceItem | null>(null);
  const [formData, setFormData] = useState({
    name: '', company: '', sourceType: 'MANUAL', url: '', username: '', password: '',
    currency: 'TRY', vatRate: 20, active: true, scheduleIntervalMinutes: 60, cronExpression: '',
    purchasePriceVatStatus: 'dahil', purchasePriceField: '',
    updateStock: true, updatePrice: true, updateImages: true,
  });
  const [message, setMessage] = useState('');
  const [syncingIds, setSyncingIds] = useState<Record<string, boolean>>({});
  const [testingIds, setTestingIds] = useState<Record<string, boolean>>({});
  const [batchSyncing, setBatchSyncing] = useState(false);

  // Products state
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceProducts, setSourceProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productPagination, setProductPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSourceHistory, setSelectedSourceHistory] = useState<XmlImportRun[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Field mapping state
  const [xmlFields, setXmlFields] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [purchasePriceField, setPurchasePriceField] = useState<string>('');
  const [fieldsLoading, setFieldsLoading] = useState(false);

  // Pricing state
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [previewPrice, setPreviewPrice] = useState<number>(100);
  const [pricingPreview, setPricingPreview] = useState<PricingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pricingVatStatus, setPricingVatStatus] = useState('dahil');
  const [pricingVatRate, setPricingVatRate] = useState(20);

  // User preferences
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('xmlPageSize');
    return saved ? Number(saved) : 50;
  });

  // Refs
  const tableRef = useRef<HTMLDivElement>(null);

  // ==================== EFFECTS ====================
  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    if (selectedSourceId && activeTab === 'urunler') {
      fetchSourceProducts();
    }
  }, [selectedSourceId, activeTab, productPagination.page, productSearch, pageSize]);

  useEffect(() => {
    if (selectedSourceId) {
      fetchXmlFields();
    }
  }, [selectedSourceId]);

  useEffect(() => {
    if (selectedSourceId) {
      loadPricingRules();
    }
  }, [selectedSourceId]);

  // ==================== API CALLS ====================
  async function fetchSources() {
    try {
      const response = await apiFetch('/xml-sources');
      const data = await response.json();
      setSources(data.items || []);
      if (data.items?.length > 0 && !selectedSourceId) {
        setSelectedSourceId(data.items[0].id);
      }
    } catch (error) {
      console.error('Error fetching XML sources:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSourceProducts() {
    if (!selectedSourceId) return;
    setProductsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(productPagination.page),
        limit: String(pageSize),
      });
      if (productSearch) params.append('search', productSearch);

      const response = await apiFetch(`/xml-sources/${selectedSourceId}/products?${params}`);
      const data = await response.json();
      setSourceProducts(data.items || []);
      setProductPagination(data.pagination || { ...productPagination, limit: pageSize });
    } catch (error) {
      console.error('Error fetching source products:', error);
    } finally {
      setProductsLoading(false);
    }
  }

  async function fetchHistory(sourceId: string) {
    try {
      const response = await apiFetch(`/xml-sources/${sourceId}/history`);
      const data = await response.json();
      setSelectedSourceHistory(data.items || []);
      setShowHistory(true);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }

  async function fetchXmlFields() {
    if (!selectedSourceId) return;
    setFieldsLoading(true);
    try {
      const response = await apiFetch(`/xml-sources/${selectedSourceId}/fields`);
      const data = await response.json();
      setXmlFields(data.fields || []);
      setFieldMapping(data.mapping || {});
      setPurchasePriceField(data.purchasePriceField || '');
    } catch (error) {
      console.error('Error fetching XML fields:', error);
    } finally {
      setFieldsLoading(false);
    }
  }

  async function loadPricingRules() {
    if (!selectedSourceId) return;
    try {
      const response = await apiFetch(`/xml-sources/${selectedSourceId}`);
      const data = await response.json();
      if (data.pricingRules) {
        try { setPricingRules(JSON.parse(data.pricingRules)); } catch {}
      }
      setPricingVatStatus(data.purchasePriceVatStatus || 'dahil');
      setPricingVatRate(data.vatRate || 20);
    } catch (error) {
      console.error('Error loading pricing rules:', error);
    }
  }

  // ==================== HANDLERS ====================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('İşleniyor...');
    try {
      const url = editingSource ? `/xml-sources/${editingSource.id}` : '/xml-sources';
      const method = editingSource ? 'PUT' : 'POST';
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setMessage('✅ Başarılı');
        setShowModal(false);
        setEditingSource(null);
        setFormData({ name: '', company: '', sourceType: 'MANUAL', url: '', username: '', password: '', currency: 'TRY', vatRate: 20, active: true, scheduleIntervalMinutes: 60, cronExpression: '', purchasePriceVatStatus: 'dahil', purchasePriceField: '', updateStock: true, updatePrice: true, updateImages: true });
        fetchSources();
      } else {
        const data = await response.json();
        setMessage(`❌ ${data.error?.message || 'Hata oluştu'}`);
      }
    } catch (error) {
      setMessage('❌ Ağ hatası');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu XML kaynağını silmek istediğinizden emin misiniz?')) return;
    try {
      const response = await apiFetch(`/xml-sources/${id}`, { method: 'DELETE', });
      if (response.ok) {
        fetchSources();
        if (selectedSourceId === id) { setSelectedSourceId(null); setSourceProducts([]); }
      } else {
        alert('Silme başarısız');
      }
    } catch (error) {
      alert('Ağ hatası');
    }
  }

  async function handleSync(id: string) {
    setSyncingIds((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await apiFetch(`/xml-sources/${id}/sync`, { method: 'POST', });
      if (response.ok) {
        const data = await response.json();
        alert(`Sync tamamlandı! ${data.importedCount} yeni, ${data.updatedCount} güncellendi`);
        fetchSources();
        if (selectedSourceId === id) fetchSourceProducts();
      } else {
        const data = await response.json();
        alert(`Sync başarısız: ${data.error?.message || 'Bilinmeyen hata'}`);
      }
    } catch (error) {
      alert('Ağ hatası');
    } finally {
      setSyncingIds((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleAnalyze(id: string) {
    try {
      const response = await apiFetch(`/xml-sources/${id}/analyze`, { method: 'POST' });
      const data = await response.json();
      if (data.ok && data.analysis) {
        const a = data.analysis;
        alert(
          `📊 XML Analiz Sonucu\n\n` +
          `Dosya: ${a.contentLengthFormatted}\n` +
          `Encoding: ${a.encoding}\n` +
          `Toplam Ürün: ${a.totalProducts}\n` +
          `XML Key'i Olan: ${a.productsWithXmlKey}\n` +
          `Kategori: ${a.uniqueCategories}\n` +
          `Marka: ${a.uniqueBrands}\n` +
          `Resim (HTTPS/HTTP/Geçersiz): ${a.httpsUrls}/${a.httpUrls}/${a.invalidUrls}\n` +
          `CDATA: ${a.hasCDATA ? '✅ Var' : '❌ Yok'}\n` +
          `HTML Entity: ${a.hasHtmlEntities ? '✅ Var' : '❌ Yok'}`
        );
      } else {
        alert(`❌ Analiz başarısız: ${data.message || 'Bilinmeyen hata'}`);
      }
    } catch (error) {
      alert('Ağ hatası');
    }
  }

  async function handleCancelSync(id: string) {
    try {
      const response = await apiFetch(`/xml-sources/${id}/cancel`, { method: 'POST' });
      const data = await response.json();
      alert(data.message || 'İşlem tamamlandı');
      fetchSources();
    } catch (error) {
      alert('Ağ hatası');
    }
  }

  async function handleBatchSync() {
    setBatchSyncing(true);
    try {
      const response = await apiFetch('/xml-sources/sync-all', { method: 'POST' });
      const data = await response.json();
      alert(data.message || 'Sync başlatıldı');
      fetchSources();
    } catch (error) {
      alert('Ağ hatası');
    } finally {
      setBatchSyncing(false);
    }
  }

  async function handleTestConnection(id: string) {
    setTestingIds((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await apiFetch(`/xml-sources/${id}/test`, { method: 'POST', });
      const data = await response.json();
      alert(data.message || (data.ok ? 'Bağlantı başarılı' : 'Bağlantı hatası'));
      fetchSources();
    } catch (error) {
      alert('Ağ hatası');
    } finally {
      setTestingIds((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleSaveMapping() {
    if (!selectedSourceId) return;
    try {
      const response = await apiFetch(`/xml-sources/${selectedSourceId}/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fieldMapping, purchasePriceField }),
      });
      if (response.ok) {
        alert('✅ Alan eşleştirme kaydedildi');
      } else {
        alert('❌ Kaydetme başarısız');
      }
    } catch (error) {
      alert('Ağ hatası');
    }
  }

  async function handleSavePricing() {
    if (!selectedSourceId) return;
    try {
      const response = await apiFetch(`/xml-sources/${selectedSourceId}/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pricingRules, purchasePriceVatStatus: pricingVatStatus, vatRate: pricingVatRate }),
      });
      if (response.ok) {
        alert('✅ Fiyatlandırma kuralları kaydedildi');
      } else {
        alert('❌ Kaydetme başarısız');
      }
    } catch (error) {
      alert('Ağ hatası');
    }
  }

  async function handlePreviewPricing() {
    if (!selectedSourceId) return;
    setPreviewLoading(true);
    try {
      const response = await apiFetch(`/xml-sources/${selectedSourceId}/pricing/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ purchasePrice: previewPrice, pricingRules, purchasePriceVatStatus: pricingVatStatus, vatRate: pricingVatRate }),
      });
      const data = await response.json();
      setPricingPreview(data);
    } catch (error) {
      console.error('Preview error:', error);
    } finally {
      setPreviewLoading(false);
    }
  }

  function openEditModal(source: XmlSourceItem) {
    setEditingSource(source);
    setFormData({
      name: source.name,
      company: source.company || '',
      sourceType: source.sourceType,
      url: source.url || '',
      username: source.username || '',
      password: '',
      currency: source.currency,
      vatRate: source.vatRate,
      active: source.active,
      scheduleIntervalMinutes: source.scheduleIntervalMinutes,
      cronExpression: (source as any).cronExpression || '',
      purchasePriceVatStatus: source.purchasePriceVatStatus,
      purchasePriceField: source.purchasePriceField || '',
      updateStock: true,
      updatePrice: true,
      updateImages: true,
    });
    setShowModal(true);
  }

  function addPricingRule() {
    const newRule: PricingRule = {
      id: Date.now().toString(),
      type: 'percentage_profit',
      label: 'Kâr Ekle',
      value: 35,
    };
    setPricingRules([...pricingRules, newRule]);
  }

  function updatePricingRule(id: string, updates: Partial<PricingRule>) {
    setPricingRules(pricingRules.map(r => r.id === id ? { ...r, ...updates } : r));
  }

  function removePricingRule(id: string) {
    setPricingRules(pricingRules.filter(r => r.id !== id));
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize);
    localStorage.setItem('xmlPageSize', String(newSize));
    setProductPagination({ ...productPagination, page: 1, limit: newSize });
  }

  // ==================== HELPERS ====================
  function getConnectionStatusBadge(status: string) {
    const map: Record<string, { label: string; color: string }> = {
      connected: { label: 'Bağlı', color: 'bg-green-500/10 text-green-400' },
      error: { label: 'Bağlantı Hatası', color: 'bg-red-500/10 text-red-400' },
      auth_error: { label: 'Kimlik Doğrulama Hatası', color: 'bg-yellow-500/10 text-yellow-400' },
      timeout: { label: 'Zaman Aşımı', color: 'bg-orange-500/10 text-orange-400' },
      unknown: { label: 'Bilinmiyor', color: 'bg-slate-500/10 text-slate-400' },
    };
    const s = map[status] || map.unknown;
    return <span className={`rounded-full px-2 py-1 text-xs font-medium ${s.color}`}>{s.label}</span>;
  }

  function getStockStatus(product: ProductItem) {
    if (product.stock === 0) return { label: 'Stok Yok', color: 'bg-red-500/10 text-red-400' };
    if (product.stock <= product.minStock) return { label: 'Düşük Stok', color: 'bg-yellow-500/10 text-yellow-400' };
    return { label: 'Normal', color: 'bg-green-500/10 text-green-400' };
  }

  function getStatusBadge(status: string) {
    const statusMap: Record<string, { label: string; color: string }> = {
      XML: { label: 'XML', color: 'bg-blue-500/10 text-blue-400' },
      READY: { label: 'Hazır', color: 'bg-green-500/10 text-green-400' },
      SENT: { label: 'Gönderildi', color: 'bg-purple-500/10 text-purple-400' },
      PASSIVE: { label: 'Pasif', color: 'bg-slate-500/10 text-slate-400' },
      ERROR: { label: 'Hata', color: 'bg-red-500/10 text-red-400' },
    };
    const s = statusMap[status] || { label: status, color: 'bg-slate-500/10 text-slate-400' };
    return <span className={`rounded-full px-2 py-1 text-xs font-medium ${s.color}`}>{s.label}</span>;
  }

  function formatPrice(value: number | null | undefined): string {
    if (value == null) return '-';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
  }

  function getImageList(product: ProductItem): string[] {
    if (!product.images) return [];
    return product.images.split(',').filter(img => img.trim().length > 0);
  }

  async function openProductDetail(product: ProductItem) {
    try {
      const response = await apiFetch(`/products/${product.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedProduct(data);
      } else {
        setSelectedProduct(product);
      }
    } catch {
      setSelectedProduct(product);
    }
    setShowDetailModal(true);
  }

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Ürün Kaynakları (Tedarikçi XML Entegrasyon Merkezi)</h2>
          <p className="text-sm text-slate-400">Tedarikçi XML yönetimi, alan eşleştirme, fiyatlandırma ve senkronizasyon</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBatchSync}
            disabled={batchSyncing}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {batchSyncing ? '⏳ Senkronize Ediliyor...' : '🔄 Tümünü Senkronize Et'}
          </button>
          <button
            type="button"
            onClick={() => { setEditingSource(null); setFormData({ name: '', company: '', sourceType: 'MANUAL', url: '', username: '', password: '', currency: 'TRY', vatRate: 20, active: true, scheduleIntervalMinutes: 60, cronExpression: '', purchasePriceVatStatus: 'dahil', purchasePriceField: '', updateStock: true, updatePrice: true, updateImages: true }); setShowModal(true); }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Yeni Tedarikçi Ekle
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-700 bg-slate-800/50 p-1 backdrop-blur-sm">
        {[
          { key: 'kaynaklar', label: '🔗 Tedarikçiler', desc: 'XML kaynak yönetimi' },
          { key: 'urunler', label: '📦 Ürünler', desc: 'Ürün listesi ve detay' },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
            title={tab.desc}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== KAYNAKLAR TAB ==================== */}
      {activeTab === 'kaynaklar' && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
          ) : sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400">
              <div className="text-4xl mb-2">📭</div>
              <div>Henüz tedarikçi XML kaynağı yok</div>
              <button type="button" onClick={() => setShowModal(true)} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                + İlk Tedarikçiyi Ekle
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Tedarikçi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Bağlantı</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Durum</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Para Birimi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">KDV</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Son Çalışma</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Ürün</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Yeni</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Günc.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Hata</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Süre</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-300">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {sources.map((source) => (
                    <tr key={source.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{source.name}</div>
                        {source.company && <div className="text-xs text-slate-400">{source.company}</div>}
                        {source.lastError && <div className="text-xs text-red-400 mt-1">{source.lastError}</div>}
                      </td>
                      <td className="px-4 py-3">{getConnectionStatusBadge(source.connectionStatus)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${source.active ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                          {source.active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{source.currency}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">%{source.vatRate}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {source.lastSuccessAt ? new Date(source.lastSuccessAt).toLocaleString('tr-TR') : 'Henüz çalışmadı'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{source.productCount}</td>
                      <td className="px-4 py-3 text-sm text-green-400 font-medium">{source.lastNewProducts ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-blue-400">{source.lastUpdatedProducts ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-red-400">{source.lastFailedProducts ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {source.lastRunDurationMs != null ? `${(source.lastRunDurationMs / 1000).toFixed(1)}sn` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => { setSelectedSourceId(source.id); setActiveTab('urunler'); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" title="Ürünleri Gör">📦</button>
                          <button type="button" onClick={() => fetchHistory(source.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" title="Geçmiş">📜</button>
                          <button type="button" onClick={() => handleAnalyze(source.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" title="XML Analiz">🔍</button>
                          <button type="button" onClick={() => handleTestConnection(source.id)} disabled={testingIds[source.id]} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50" title="Bağlantı Testi">{testingIds[source.id] ? '⏳' : '🔌'}</button>
                          <button type="button" onClick={() => handleSync(source.id)} disabled={syncingIds[source.id]} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50" title="Sync">{syncingIds[source.id] ? '⏳' : '🔄'}</button>
                          {syncingIds[source.id] && (
                            <button type="button" onClick={() => handleCancelSync(source.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors" title="İptal">⏹️</button>
                          )}
                          <button type="button" onClick={() => { setSelectedSourceId(source.id); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" title="Alan Eşleştirme">🔗</button>
                          <button type="button" onClick={() => { setSelectedSourceId(source.id); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" title="Fiyatlandırma">💰</button>
                          <button type="button" onClick={() => openEditModal(source)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" title="Düzenle">✏️</button>
                          <button type="button" onClick={() => handleDelete(source.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Sil">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== ÜRÜNLER TAB ==================== */}
      {activeTab === 'urunler' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-300 mb-1">Tedarikçi Seç</label>
              <select
                value={selectedSourceId || ''}
                onChange={(e) => { setSelectedSourceId(e.target.value || null); setProductPagination({ ...productPagination, page: 1 }); }}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>{source.name} ({source.productCount} ürün)</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-300 mb-1">Ürün Ara</label>
              <input type="text" value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setProductPagination({ ...productPagination, page: 1 }); }}
                placeholder="Başlık, SKU, barkod..." className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="min-w-[120px]">
              <label className="block text-sm font-medium text-slate-300 mb-1">Sayfa Başına</label>
              <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none">
                {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            {selectedSourceId && (
              <div className="pt-5">
                <button type="button" onClick={() => handleSync(selectedSourceId)} disabled={syncingIds[selectedSourceId]}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {syncingIds[selectedSourceId] ? '⏳ Senkronize Ediliyor...' : '🔄 XML Çek'}
                </button>
              </div>
            )}
          </div>

          {/* Products Table */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
            {!selectedSourceId ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                <div className="text-4xl mb-2">📦</div>
                <div>Lütfen bir tedarikçi seçin</div>
              </div>
            ) : productsLoading ? (
              <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
            ) : sourceProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                <div className="text-4xl mb-2">📦</div>
                <div>Henüz ürün bulunamadı. XML çekmek için "XML Çek" butonunu kullanın.</div>
              </div>
            ) : (
              <div className="overflow-x-auto" ref={tableRef}>
                <table className="w-full min-w-[1200px]">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="sticky left-0 z-10 bg-slate-700/50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[200px]">Ürün Adı</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[100px]">XML Key</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[100px]">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[100px]">Barkod</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[80px]">Stok</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[80px]">Min Stok</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[100px]">Alış Fiyatı</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[100px]">Satış Fiyatı</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[60px]">KDV</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[80px]">Durum</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[60px]">Ktg</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[60px]">Marka</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[60px]">Varyant</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[60px]">Şablon</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[100px]">Oluşturma</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-300 min-w-[80px]">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {sourceProducts.map((product) => {
                      const stockStatus = getStockStatus(product);
                      const images = getImageList(product);
                      return (
                        <tr key={product.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => openProductDetail(product)}>
                          <td className="sticky left-0 z-10 bg-slate-800/30 px-4 py-3">
                            <div className="flex items-center gap-3">
                              {images.length > 0 ? (
                                <img src={images[0]} alt="" className="h-10 w-10 rounded-lg object-cover bg-slate-700" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-500 text-xs">📦</div>
                              )}
                              <div className="font-medium text-white truncate max-w-[200px]">{product.title || product.xmlKey}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400 font-mono">{product.xmlKey}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">{product.sku || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">{product.barcode || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${stockStatus.color}`}>{product.stock}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">{product.minStock}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">{formatPrice(product.purchasePrice)}</td>
                          <td className="px-4 py-3 text-sm text-slate-300 font-medium">{formatPrice(product.salePrice)}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">%{product.vatRate ?? '-'}</td>
                          <td className="px-4 py-3">{getStatusBadge(product.status)}</td>
                          <td className="px-4 py-3">
                            {product.categoryMatch ? (
                              <span className="text-green-400 text-xs" title={product.category?.name || ''}>✅</span>
                            ) : (
                              <span className="text-slate-500 text-xs">❌</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {product.brandMatch ? (
                              <span className="text-green-400 text-xs" title={product.brand?.name || ''}>✅</span>
                            ) : (
                              <span className="text-slate-500 text-xs">❌</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {product.variantMatch ? (
                              <span className="text-green-400 text-xs">✅</span>
                            ) : (
                              <span className="text-slate-500 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {product.templateMatch ? (
                              <span className="text-green-400 text-xs">✅</span>
                            ) : (
                              <span className="text-slate-500 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{new Date(product.createdAt).toLocaleDateString('tr-TR')}</td>
                          <td className="px-4 py-3 text-right">
                            <button type="button" onClick={(e) => { e.stopPropagation(); openProductDetail(product); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" title="Detay">🔍</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {productPagination.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
              <div className="text-sm text-slate-400">
                Toplam {productPagination.total} ürün, Sayfa {productPagination.page}/{productPagination.totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProductPagination({ ...productPagination, page: productPagination.page - 1 })}
                  disabled={productPagination.page <= 1}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  ◀ Önceki
                </button>
                <button
                  type="button"
                  onClick={() => setProductPagination({ ...productPagination, page: productPagination.page + 1 })}
                  disabled={productPagination.page >= productPagination.totalPages}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  Sonraki ▶
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== ALAN EŞLEŞTİRME VE FİYATLANDIRMA KALDIRILDI ==================== */}

      {/* ==================== MODALS ==================== */}

      {/* Add/Edit Source Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{editingSource ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi Ekle'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Tedarikçi Adı *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" placeholder="Örn: Tedarikçi A.Ş." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Firma Adı</label>
                  <input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" placeholder="Örn: Tedarikçi A.Ş." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Kaynak Tipi *</label>
                  <select value={formData.sourceType} onChange={(e) => setFormData({ ...formData, sourceType: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none">
                    <option value="MANUAL">Manuel</option>
                    <option value="URL">URL</option>
                    <option value="FTP">FTP</option>
                    <option value="API">API</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">XML URL</label>
                  <input type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Kullanıcı Adı</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Şifre</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" placeholder={editingSource ? '••••••••' : ''} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Para Birimi</label>
                  <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none">
                    <option value="TRY">₺ TRY</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                    <option value="GBP">£ GBP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">KDV Oranı (%)</label>
                  <input type="number" value={formData.vatRate} onChange={(e) => setFormData({ ...formData, vatRate: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" min="0" max="100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">KDV Durumu</label>
                  <select value={formData.purchasePriceVatStatus} onChange={(e) => setFormData({ ...formData, purchasePriceVatStatus: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none">
                    <option value="dahil">KDV Dahil</option>
                    <option value="haric">KDV Hariç</option>
                    <option value="ekleme">KDV Ekleme</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Senkronizasyon Aralığı (dk)</label>
                  <input type="number" value={formData.scheduleIntervalMinutes} onChange={(e) => setFormData({ ...formData, scheduleIntervalMinutes: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" min="5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Cron İfadesi <span className="text-xs text-slate-500">(opsiyonel)</span></label>
                  <input type="text" value={formData.cronExpression} onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none font-mono text-sm"
                    placeholder="0 */6 * * * (her 6 saatte bir)" />
                  <div className="mt-1 text-xs text-slate-500">
                    ⏰ Boş bırakılırsa dakika bazlı zamanlama kullanılır.
                    <a href="https://crontab.guru" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 ml-1">crontab.guru</a>
                  </div>
                </div>
              </div>

              {/* Aktif/Pasif */}
              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} className="peer sr-only" />
                  <div className="h-6 w-11 rounded-full bg-slate-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full"></div>
                </label>
                <span className="text-sm text-slate-300">Aktif</span>
              </div>

              {message && <div className="rounded-lg bg-slate-700/50 p-3 text-sm text-slate-300">{message}</div>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors">İptal</button>
                <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                  {editingSource ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {showDetailModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDetailModal(false)}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{selectedProduct.title || selectedProduct.xmlKey}</h3>
              <button type="button" onClick={() => setShowDetailModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Images */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Görseller</h4>
                <div className="grid grid-cols-2 gap-2">
                  {getImageList(selectedProduct).length > 0 ? (
                    getImageList(selectedProduct).map((img, i) => (
                      <img key={i} src={img} alt={`Görsel ${i + 1}`} className="rounded-lg border border-slate-700 object-cover h-40 w-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ))
                  ) : (
                    <div className="col-span-2 flex items-center justify-center h-40 rounded-lg bg-slate-700 text-slate-500">Görsel Yok</div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-400">XML Key</div>
                    <div className="text-sm text-white font-mono">{selectedProduct.xmlKey}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">SKU</div>
                    <div className="text-sm text-white">{selectedProduct.sku || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Barkod</div>
                    <div className="text-sm text-white">{selectedProduct.barcode || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Durum</div>
                    <div className="text-sm">{getStatusBadge(selectedProduct.status)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Stok</div>
                    <div className="text-sm text-white">{selectedProduct.stock}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Min. Stok</div>
                    <div className="text-sm text-white">{selectedProduct.minStock}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Alış Fiyatı</div>
                    <div className="text-sm text-white">{formatPrice(selectedProduct.purchasePrice)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Satış Fiyatı</div>
                    <div className="text-sm text-white">{formatPrice(selectedProduct.salePrice)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">KDV Oranı</div>
                    <div className="text-sm text-white">%{selectedProduct.vatRate ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Kategori</div>
                    <div className="text-sm text-white">{selectedProduct.category?.name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Marka</div>
                    <div className="text-sm text-white">{selectedProduct.brand?.name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Oluşturma</div>
                    <div className="text-sm text-white">{new Date(selectedProduct.createdAt).toLocaleString('tr-TR')}</div>
                  </div>
                </div>

                {/* Eşleştirme Durumları */}
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${selectedProduct.categoryMatch ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                    {selectedProduct.categoryMatch ? '✅ Kategori Eşleşti' : '❌ Kategori Eşleşmedi'}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${selectedProduct.brandMatch ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                    {selectedProduct.brandMatch ? '✅ Marka Eşleşti' : '❌ Marka Eşleşmedi'}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${selectedProduct.variantMatch ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                    {selectedProduct.variantMatch ? '✅ Varyant Eşleşti' : '❌ Varyant Eşleşmedi'}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${selectedProduct.templateMatch ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                    {selectedProduct.templateMatch ? '✅ Şablon Eşleşti' : '❌ Şablon Eşleşmedi'}
                  </span>
                </div>

                {/* Varyantlar */}
                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Varyantlar</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.variants.map((v) => (
                        <span key={v.id} className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-slate-300">
                          {v.name}: {v.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hata Mesajı */}
                {selectedProduct.errorMessage && (
                  <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                    {selectedProduct.errorMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Senkronizasyon Geçmişi</h3>
              <button type="button" onClick={() => setShowHistory(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">✕</button>
            </div>

            {selectedSourceHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                <div className="text-4xl mb-2">📜</div>
                <div>Henüz senkronizasyon geçmişi yok</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Başlangıç</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Bitiş</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Süre</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Durum</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Toplam</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Yeni</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Güncelle</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Hata</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Atlanan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {selectedSourceHistory.map((run) => (
                      <tr key={run.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-300">{new Date(run.startedAt).toLocaleString('tr-TR')}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{run.finishedAt ? new Date(run.finishedAt).toLocaleString('tr-TR') : '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}sn` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                            run.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                            run.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                            run.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                            'bg-slate-500/10 text-slate-400'
                          }`}>
                            {run.status === 'completed' ? 'Tamamlandı' :
                             run.status === 'running' ? 'Çalışıyor' :
                             run.status === 'failed' ? 'Başarısız' : run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">{run.totalProducts}</td>
                        <td className="px-4 py-3 text-sm text-green-400">{run.newProducts}</td>
                        <td className="px-4 py-3 text-sm text-blue-400">{run.updatedProducts}</td>
                        <td className="px-4 py-3 text-sm text-red-400">{run.failedProducts}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">{run.skippedProducts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


