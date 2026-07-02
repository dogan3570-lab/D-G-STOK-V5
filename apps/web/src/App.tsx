import React, { useEffect, useMemo, useState } from 'react';
import type {
  DashboardSummaryItem,
  HealthPayload,
  MarketplaceItem,
  OrderItem,
  ProductItem,
  ReportKpi,
  SettingsGroup,
  ShipmentItem,
  SseEventName,
  SseLogItem,
  SyncActionResponse,
  TemplateItem,
  XmlSourceItem,
} from './types';

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; errorMessage: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, errorMessage: error instanceof Error ? error.message : 'Unknown runtime error' };
  }
  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary]', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 p-6">
          <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
            <h2 className="text-lg font-bold">Uygulama render hatası yakalandı</h2>
            <pre className="mt-3 overflow-auto rounded bg-rose-100 p-3 text-xs">{this.state.errorMessage}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '"[unserializable payload]"';
  }
}
async function safeFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { credentials: 'include' });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, ok: response.ok, status: response.status };
  }
}

type PageKey = 'kontrol' | 'xml' | 'urunler' | 'kategori' | 'varyant' | 'marka' | 'sablon' | 'pazaryeri' | 'gonderim' | 'siparis' | 'rapor' | 'ayar' | 'loglar';
const MENU_ITEMS: Array<{ key: PageKey; label: string; icon: string }> = [
  { key: 'kontrol', label: 'Kontrol Paneli', icon: '🏠' },
  { key: 'xml', label: 'XML Kaynakları', icon: '🔗' },
  { key: 'urunler', label: 'Ürünler', icon: '📦' },
  { key: 'kategori', label: 'Kategori Eşleştir', icon: '🗂' },
  { key: 'varyant', label: 'Varyant Eşleştir', icon: '🎨' },
  { key: 'marka', label: 'Marka Eşleştir', icon: '🏷' },
  { key: 'sablon', label: 'Listeleme Şablonları', icon: '📋' },
  { key: 'pazaryeri', label: 'Pazaryerleri', icon: '🛒' },
  { key: 'gonderim', label: 'Gönderim Merkezi', icon: '🚀' },
  { key: 'siparis', label: 'Siparişler', icon: '📑' },
  { key: 'rapor', label: 'Raporlar', icon: '📊' },
  { key: 'ayar', label: 'Ayarlar', icon: '⚙' },
  { key: 'loglar', label: 'Loglar', icon: '📝' },
];

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}

function AppContent() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [marketplaces, setMarketplaces] = useState<MarketplaceItem[]>([]);
  const [marketplacesLoading, setMarketplacesLoading] = useState(true);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productQuery, setProductQuery] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummaryItem[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [sseLog, setSseLog] = useState<SseLogItem[]>([]);
  const [syncingKeys, setSyncingKeys] = useState<Record<string, boolean>>({});
  const [syncMessage, setSyncMessage] = useState('');
  const [activePage, setActivePage] = useState<PageKey>('kontrol');
  const [sseFilter, setSseFilter] = useState<string>('all');

  const [xmlSources, setXmlSources] = useState<XmlSourceItem[]>([
    { id: 'x1', name: 'Ana XML Feed', type: 'xml', url: 'https://example.com/feed.xml', status: 'active', lastCheckAt: new Date().toISOString() },
    { id: 'x2', name: 'Kampanya CSV', type: 'csv', url: 'https://example.com/campaign.csv', status: 'paused', lastCheckAt: new Date().toISOString() },
  ]);
  const [xmlForm, setXmlForm] = useState({ name: '', type: 'xml' as XmlSourceItem['type'], url: '' });
  const [xmlMessage, setXmlMessage] = useState('');
  const [xmlFileName, setXmlFileName] = useState('');
  const [xmlImporting, setXmlImporting] = useState(false);
  const [xmlHistory, setXmlHistory] = useState<Array<{ id: string; name: string; fileName: string; importedCount: number; updatedCount: number; status: 'success' | 'error'; at: string }>>([]);

  const [templates, setTemplates] = useState<TemplateItem[]>([
    { id: 't1', name: 'Trendyol Ayakkabı', marketplaceKey: 'trendyol', categoryPath: 'Ayakkabı>Spor', active: true, updatedAt: new Date().toISOString() },
    { id: 't2', name: 'N11 Genel Tekstil', marketplaceKey: 'n11', categoryPath: 'Tekstil>Tişört', active: false, updatedAt: new Date().toISOString() },
  ]);
  const [templateForm, setTemplateForm] = useState({ name: '', marketplaceKey: '', categoryPath: '' });
  const [templateMessage, setTemplateMessage] = useState('');

  const [shipments] = useState<ShipmentItem[]>([
    { id: 's1', channel: 'Trendyol', cargoCompany: 'Yurtiçi', trackingNo: 'YT123456', status: 'queued', createdAt: new Date().toISOString() },
    { id: 's2', channel: 'Hepsiburada', cargoCompany: 'MNG', trackingNo: 'MNG987654', status: 'processing', createdAt: new Date().toISOString() },
    { id: 's3', channel: 'N11', cargoCompany: 'Sürat', trackingNo: 'SR445566', status: 'delivered', createdAt: new Date().toISOString() },
  ]);
  const [orders] = useState<OrderItem[]>([
    { id: 'o1', orderNo: 'DG-1001', channel: 'Trendyol', customerName: 'Ahmet Y.', status: 'new', total: 1499, createdAt: new Date().toISOString() },
    { id: 'o2', orderNo: 'DG-1002', channel: 'Hepsiburada', customerName: 'Zeynep K.', status: 'preparing', total: 899, createdAt: new Date().toISOString() },
    { id: 'o3', orderNo: 'DG-1003', channel: 'N11', customerName: 'Mehmet T.', status: 'shipped', total: 1999, createdAt: new Date().toISOString() },
  ]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderItem['status']>('all');
  const [reportKpis] = useState<ReportKpi[]>([
    { label: 'Toplam Satış (30g)', value: '₺ 1.245.000', trend: 'up' },
    { label: 'Sipariş Adedi', value: 1380, trend: 'up' },
    { label: 'İade Oranı', value: '%2.1', trend: 'down' },
    { label: 'Ortalama Sepet', value: '₺ 902', trend: 'flat' },
  ]);
  const [settings] = useState<SettingsGroup[]>([
    { id: 'sg1', title: 'Sistem', description: 'Temel uygulama konfigürasyonu', items: [{ key: 'APP_ENV', value: 'production' }, { key: 'TIMEZONE', value: 'Europe/Istanbul' }] },
    { id: 'sg2', title: 'Entegrasyon', description: 'Pazaryeri entegrasyon parametreleri', items: [{ key: 'TRENDYOL_API_KEY', value: '********', sensitive: true }, { key: 'HB_API_KEY', value: '********', sensitive: true }] },
    { id: 'sg3', title: 'Yönetici İşlemleri', description: 'Sadece yetkili kullanıcılar için kritik işlemler', items: [{ key: 'Admin Password Rotation', value: 'Aktif' }, { key: 'Session Revoke', value: 'Hazır' }] },
  ]);

  useEffect(() => {
    let mounted = true;
    setHealthLoading(true);
    safeFetchJson('/health').then((json) => mounted && setHealth(isObject(json) ? json : { ok: false, raw: json })).catch(() => mounted && setHealth({ ok: false, error: 'health fetch failed' })).finally(() => mounted && setHealthLoading(false));
    setMarketplacesLoading(true);
    safeFetchJson('/marketplaces').then((json) => {
      if (!mounted) return;
      const items = isObject(json) && Array.isArray(json.items) ? json.items : [];
      setMarketplaces(items.filter((i): i is Record<string, unknown> => isObject(i)).map((i) => ({ id: String(i.id ?? ''), name: String(i.name ?? 'Unknown'), key: String(i.key ?? ''), apiStatus: typeof i.apiStatus === 'string' || i.apiStatus === null ? i.apiStatus : null })).filter((i) => i.id && i.key));
    }).catch(() => mounted && setMarketplaces([])).finally(() => mounted && setMarketplacesLoading(false));
    setProductsLoading(true);
    safeFetchJson('/products').then((json) => {
      if (!mounted) return;
      const items = isObject(json) && Array.isArray(json.items) ? json.items : [];
      setProducts(items.filter((i): i is Record<string, unknown> => isObject(i)).map((i) => ({ id: String(i.id ?? ''), xmlKey: String(i.xmlKey ?? ''), title: i.title == null ? null : String(i.title), sku: i.sku == null ? null : String(i.sku), barcode: i.barcode == null ? null : String(i.barcode), stock: Number(i.stock ?? 0), minStock: Number(i.minStock ?? 0), createdAt: i.createdAt == null ? undefined : String(i.createdAt) })).filter((i) => i.id && i.xmlKey));
    }).catch(() => mounted && setProducts([])).finally(() => mounted && setProductsLoading(false));
    setSummaryLoading(true);
    safeFetchJson('/dashboard/summary').then((json) => {
      if (!mounted) return;
      const items = isObject(json) && Array.isArray(json.items) ? json.items : [];
      setDashboardSummary(items.filter((i): i is Record<string, unknown> => isObject(i)).map((i) => ({ marketplaceId: String(i.marketplaceId ?? ''), marketplaceName: String(i.marketplaceName ?? 'Unknown'), ready: Number(i.ready ?? 0), sent: Number(i.sent ?? 0), passive: Number(i.passive ?? 0), error: Number(i.error ?? 0), total: Number(i.total ?? 0) })).filter((i) => i.marketplaceId));
    }).catch(() => mounted && setDashboardSummary([])).finally(() => mounted && setSummaryLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/sse');
      ['ping', 'marketplace.sync.start', 'marketplace.sync.progress', 'marketplace.sync.done', 'marketplace.sync.duplicate', 'queue.failed'].forEach((eventName) => {
        es?.addEventListener(eventName, (ev: MessageEvent) => {
          let parsed: unknown = ev.data;
          try { parsed = JSON.parse(ev.data); } catch {}
          setSseLog((prev) => [{ event: eventName as SseEventName, data: parsed, ts: Date.now() }, ...prev].slice(0, 200));
        });
      });
    } catch {}
    return () => es?.close();
  }, []);

  const totals = useMemo(() => dashboardSummary.reduce((acc, row) => ({ ...acc, total: acc.total + row.total, ready: acc.ready + row.ready, sent: acc.sent + row.sent, passive: acc.passive + row.passive, error: acc.error + row.error }), { total: 0, ready: 0, sent: 0, passive: 0, error: 0 }), [dashboardSummary]);
  const filteredProducts = useMemo(() => products.filter((p) => (!onlyLowStock || p.stock <= p.minStock) && [p.title ?? '', p.xmlKey, p.sku ?? '', p.barcode ?? ''].join(' ').toLowerCase().includes(productQuery.trim().toLowerCase())), [products, productQuery, onlyLowStock]);
  const filteredSseLog = useMemo(() => (sseFilter === 'all' ? sseLog : sseLog.filter((l) => l.event === sseFilter)), [sseLog, sseFilter]);
  const filteredOrders = useMemo(() => (orderStatusFilter === 'all' ? orders : orders.filter((o) => o.status === orderStatusFilter)), [orders, orderStatusFilter]);
  const shipmentSummary = useMemo(() => ({ queued: shipments.filter((s) => s.status === 'queued').length, processing: shipments.filter((s) => s.status === 'processing').length, shipped: shipments.filter((s) => s.status === 'shipped').length, delivered: shipments.filter((s) => s.status === 'delivered').length, failed: shipments.filter((s) => s.status === 'failed').length }), [shipments]);

  async function runSync(marketplaceKey: string) {
    setSyncingKeys((p) => ({ ...p, [marketplaceKey]: true }));
    try {
      const response = await fetch('/actions/marketplace/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketplaceKey, totalSteps: 5 }), credentials: 'include' });
      const text = await response.text();
      let result: SyncActionResponse | null = null;
      try { result = JSON.parse(text) as SyncActionResponse; } catch {}
      if (!response.ok) setSyncMessage(`❌ ${marketplaceKey}: ${result && 'error' in result ? `${result.error.code}: ${result.error.message}` : `HTTP_${response.status}`}`);
      else setSyncMessage(`✅ ${marketplaceKey}: Sync kuyruğa eklendi.`);
    } catch { setSyncMessage(`❌ ${marketplaceKey}: Ağ hatası.`); } finally { setSyncingKeys((p) => ({ ...p, [marketplaceKey]: false })); }
  }

  const submitXmlSource = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!xmlForm.name.trim()) return setXmlMessage('❌ Kaynak adı zorunludur.');
    if (!xmlForm.url.trim() && !xmlFileName) return setXmlMessage('❌ XML URL si veya dosya yüklemeniz zorunludur.');
    if (xmlForm.url.trim()) {
      try { new URL(xmlForm.url.trim()); } catch { return setXmlMessage('❌ URL formatı geçersiz.'); }
    }

    setXmlImporting(true);
    setXmlMessage('⏳ XML işleniyor...');

    try {
      let xmlPayload = '';
      const fileInput = document.getElementById('xml-file-input') as HTMLInputElement | null;
      const selectedFile = fileInput?.files?.[0];

      if (selectedFile) {
        xmlPayload = await selectedFile.text();
      } else if (xmlForm.url.trim()) {
        xmlPayload = '';
      }

      const response = await fetch('/xml/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ xml: xmlPayload, xmlUrl: xmlForm.url.trim(), sourceName: xmlForm.name.trim() }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error?.message ?? 'XML import failed');
      }

      const historyEntry = {
        id: `xml-${Date.now()}`,
        name: xmlForm.name.trim(),
        fileName: xmlFileName || (xmlForm.url.trim() ? 'url-import' : 'inline-import'),
        importedCount: Number(result.importedCount ?? 0),
        updatedCount: Number(result.updatedCount ?? 0),
        status: 'success' as const,
        at: new Date().toISOString(),
      };

      setXmlHistory((prev) => [historyEntry, ...prev].slice(0, 8));
      setXmlSources((prev) => [{ id: `x-${Date.now()}`, name: xmlForm.name.trim(), type: xmlForm.type, url: xmlForm.url.trim(), status: 'active', lastCheckAt: new Date().toISOString() }, ...prev]);
      setXmlForm({ name: '', type: 'xml', url: '' });
      setXmlFileName('');
      if (fileInput) fileInput.value = '';
      setXmlMessage(`✅ XML import tamamlandı. ${result.importedCount ?? 0} yeni, ${result.updatedCount ?? 0} güncellendi.`);
      safeFetchJson('/products').then((json) => {
        const items = isObject(json) && Array.isArray(json.items) ? json.items : [];
        setProducts(items.filter((i): i is Record<string, unknown> => isObject(i)).map((i) => ({ id: String(i.id ?? ''), xmlKey: String(i.xmlKey ?? ''), title: i.title == null ? null : String(i.title), sku: i.sku == null ? null : String(i.sku), barcode: i.barcode == null ? null : String(i.barcode), stock: Number(i.stock ?? 0), minStock: Number(i.minStock ?? 0), createdAt: i.createdAt == null ? undefined : String(i.createdAt) })).filter((i) => i.id && i.xmlKey));
      }).catch(() => undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      setXmlHistory((prev) => [{ id: `xml-${Date.now()}`, name: xmlForm.name.trim() || 'Bilinmeyen kaynak', fileName: xmlFileName || 'upload', importedCount: 0, updatedCount: 0, status: 'error', at: new Date().toISOString() }, ...prev].slice(0, 8));
      setXmlMessage(`❌ XML import başarısız: ${errorMessage}`);
    } finally {
      setXmlImporting(false);
    }
  };

  const submitTemplate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!templateForm.name.trim() || !templateForm.marketplaceKey.trim() || !templateForm.categoryPath.trim()) return setTemplateMessage('❌ Alanlar zorunludur.');
    setTemplates((prev) => [{ id: `t-${Date.now()}`, name: templateForm.name.trim(), marketplaceKey: templateForm.marketplaceKey.trim().toLowerCase(), categoryPath: templateForm.categoryPath.trim(), active: true, updatedAt: new Date().toISOString() }, ...prev]);
    setTemplateForm({ name: '', marketplaceKey: '', categoryPath: '' }); setTemplateMessage('✅ Yeni şablon oluşturuldu.');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 lg:p-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">D&G STOK V5.0</p>
              <h1 className="text-2xl font-bold text-slate-900">Operasyon Kontrol Merkezi</h1>
              <p className="mt-2 text-sm text-slate-600">XML import, ürün takibi, pazaryeri senkronizasyonu ve canlı olay akışı.</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <div className="font-semibold">API Durumu</div>
              <div>{healthLoading ? 'Yükleniyor...' : health?.ok ? 'Çalışıyor' : 'Bağlantı yok'}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivePage(item.key)}
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${activePage === item.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Toplam Ürün</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{products.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Pazaryeri</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{marketplaces.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Düşük Stok</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{products.filter((item) => item.stock <= item.minStock).length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Canlı Olay</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{sseLog.length}</div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">XML Import</h2>
                  <p className="text-sm text-slate-500">XML içeriğini sisteme yükleyip ürünleri güncelleyin.</p>
                </div>
              </div>

              <form onSubmit={submitXmlSource} className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={xmlForm.name}
                    onChange={(event) => setXmlForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Kaynak adı"
                  />
                  <input
                    value={xmlForm.url}
                    onChange={(event) => setXmlForm((prev) => ({ ...prev, url: event.target.value }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="https://example.com/feed.xml"
                  />
                </div>
                <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">XML dosyası seçin</span>
                  <input
                    id="xml-file-input"
                    type="file"
                    accept=".xml,text/xml"
                    className="hidden"
                    onChange={(event) => setXmlFileName(event.target.files?.[0]?.name ?? '')}
                  />
                  <span>{xmlFileName ? xmlFileName : 'Dosya seçmek için tıklayın'}</span>
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <select
                    value={xmlForm.type}
                    onChange={(event) => setXmlForm((prev) => ({ ...prev, type: event.target.value as XmlSourceItem['type'] }))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="xml">XML</option>
                    <option value="csv">CSV</option>
                    <option value="yml">YML</option>
                    <option value="excel">Excel</option>
                  </select>
                  <button type="submit" disabled={xmlImporting} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {xmlImporting ? 'İşleniyor...' : 'Import Gönder'}
                  </button>
                </div>
                {xmlMessage ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{xmlMessage}</div> : null}
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">İşlem Geçmişi</h2>
              </div>

              <div className="space-y-2">
                {xmlHistory.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">Henüz import geçmişi yok.</div>
                ) : (
                  xmlHistory.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-slate-900">{entry.name}</div>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {entry.status === 'success' ? 'Başarılı' : 'Hata'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{entry.fileName} • {new Date(entry.at).toLocaleString('tr-TR')}</div>
                      <div className="mt-1 text-xs text-slate-600">Yeni: {entry.importedCount} • Güncellendi: {entry.updatedCount}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Ürünler</h2>
                <div className="flex items-center gap-2">
                  <input
                    value={productQuery}
                    onChange={(event) => setProductQuery(event.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Ürün ara"
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={onlyLowStock} onChange={() => setOnlyLowStock((prev) => !prev)} />
                    Düşük stok
                  </label>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr] bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <div>Ürün</div>
                  <div>SKU</div>
                  <div>Stok</div>
                  <div>Durum</div>
                </div>
                {filteredProducts.length === 0 ? (
                  <div className="bg-white px-3 py-4 text-sm text-slate-500">Gösterilecek ürün yok.</div>
                ) : (
                  filteredProducts.map((item) => (
                    <div key={item.id} className="grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr] border-t border-slate-200 bg-white px-3 py-3 text-sm">
                      <div>
                        <div className="font-medium text-slate-900">{item.title ?? item.xmlKey}</div>
                        <div className="text-xs text-slate-500">{item.xmlKey}</div>
                      </div>
                      <div className="text-slate-700">{item.sku ?? '-'}</div>
                      <div className="text-slate-700">{item.stock}</div>
                      <div>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.stock <= item.minStock ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.stock <= item.minStock ? 'Düşük Stok' : 'Normal'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Pazaryerleri</h2>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{marketplaces.length} kayıt</span>
              </div>

              <div className="mt-4 space-y-3">
                {marketplacesLoading ? (
                  <div className="text-sm text-slate-500">Yükleniyor...</div>
                ) : marketplaces.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">Pazaryeri bulunamadı.</div>
                ) : (
                  marketplaces.map((marketplace) => (
                    <div key={marketplace.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-slate-900">{marketplace.name}</div>
                          <div className="text-xs text-slate-500">{marketplace.key}</div>
                        </div>
                        <button type="button" onClick={() => runSync(marketplace.key)} disabled={Boolean(syncingKeys[marketplace.key])} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                          {syncingKeys[marketplace.key] ? 'Gönderiliyor…' : 'Sync'}
                        </button>
                      </div>
                      {syncMessage && marketplace.key === marketplaces[0]?.key ? <div className="mt-2 text-sm text-slate-600">{syncMessage}</div> : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Canlı Loglar</h2>
                <select value={sseFilter} onChange={(event) => setSseFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  <option value="all">Tümü</option>
                  <option value="marketplace.sync.done">Sync tamamlandı</option>
                  <option value="queue.failed">Queue hatası</option>
                </select>
              </div>

              <div className="mt-4 space-y-2">
                {filteredSseLog.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">Henüz olay yok.</div>
                ) : (
                  filteredSseLog.slice(0, 8).map((entry) => (
                    <div key={`${entry.ts}-${entry.event}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                      <div className="font-medium text-slate-800">{entry.event}</div>
                      <div className="mt-1 break-all text-xs text-slate-500">{safeStringify(entry.data)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
