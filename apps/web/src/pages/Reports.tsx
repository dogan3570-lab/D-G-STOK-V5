import React, { useEffect, useState } from 'react';

interface ReportCategory {
  id: string; name: string; icon: string; count: number;
}

interface ReportData {
  labels: string[];
  datasets: Array<{ label: string; value: number; color?: string }>;
}

export default function ReportsPage() {
  const [activeCategory, setActiveCategory] = useState('sales');
  const [activeReport, setActiveReport] = useState('daily');
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 30*86400000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const categories: ReportCategory[] = [
    { id: 'sales', name: 'Satış Raporları', icon: '💰', count: 7 },
    { id: 'products', name: 'Ürün Raporları', icon: '📦', count: 8 },
    { id: 'stock', name: 'Stok Raporları', icon: '📊', count: 5 },
    { id: 'finance', name: 'Finans Raporları', icon: '💳', count: 8 },
    { id: 'xml', name: 'XML Raporları', icon: '🔗', count: 6 },
    { id: 'mp', name: 'Pazaryeri Raporları', icon: '🛒', count: 8 },
  ];

  const reports: Record<string, Array<{ id: string; name: string; icon: string }>> = {
    sales: [
      { id: 'daily', name: 'Günlük Satış', icon: '📅' },
      { id: 'weekly', name: 'Haftalık Satış', icon: '📆' },
      { id: 'monthly', name: 'Aylık Satış', icon: '📊' },
      { id: 'category_sales', name: 'Kategori Bazlı Satış', icon: '🗂' },
      { id: 'brand_sales', name: 'Marka Bazlı Satış', icon: '🏷' },
      { id: 'product_sales', name: 'Ürün Bazlı Satış', icon: '📦' },
      { id: 'mp_sales', name: 'Pazaryeri Bazlı Satış', icon: '🛒' },
    ],
    products: [
      { id: 'top_selling', name: 'En Çok Satan', icon: '🏆' },
      { id: 'least_selling', name: 'En Az Satan', icon: '📉' },
      { id: 'never_sold', name: 'Hiç Satılmayan', icon: '🚫' },
      { id: 'new_products', name: 'Yeni Ürünler', icon: '🆕' },
      { id: 'out_of_stock', name: 'Stokta Olmayan', icon: '📦' },
      { id: 'critical_stock', name: 'Kritik Stok', icon: '⚠️' },
      { id: 'most_profitable', name: 'En Karlı Ürün', icon: '💰' },
      { id: 'least_profitable', name: 'En Az Karlı', icon: '📉' },
    ],
    finance: [
      { id: 'revenue', name: 'Ciro', icon: '💰' },
      { id: 'profit', name: 'Net Kar', icon: '📈' },
      { id: 'commission', name: 'Komisyon', icon: '🏦' },
      { id: 'cargo', name: 'Kargo', icon: '🚚' },
      { id: 'advertising', name: 'Reklam', icon: '📢' },
      { id: 'category_profit', name: 'Kategori Karlılığı', icon: '🗂' },
      { id: 'mp_profit', name: 'Pazaryeri Karlılığı', icon: '🛒' },
    ],
    mp: [
      { id: 'trendyol', name: 'Trendyol', icon: '🛒' },
      { id: 'hepsiburada', name: 'Hepsiburada', icon: '📦' },
      { id: 'n11', name: 'N11', icon: '🏪' },
      { id: 'amazon', name: 'Amazon', icon: '📦' },
      { id: 'pazarama', name: 'Pazarama', icon: '🛍️' },
    ],
  };

  useEffect(() => {
    fetch('/products/stats', { credentials: 'include' }).then(r => r.ok && r.json()).then(d => setStats(d)).catch(() => {});
    fetch('/products?limit=10&sortBy=salePrice&sortOrder=desc', { credentials: 'include' }).then(r => r.ok && r.json()).then(d => setProducts(d?.items || [])).catch(() => {});
    fetch('/orders?limit=10', { credentials: 'include' }).then(r => r.ok && r.json()).then(d => setOrders(d?.items || [])).catch(() => {});
  }, []);

  const currentReports = reports[activeCategory] || [];

  function formatPrice(v: number | null | undefined) {
    return v != null ? v.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) : '₺0';
  }

  function exportReport(format: string) {
    alert(`📥 ${format.toUpperCase()} dışa aktarma başlatıldı.\nRapor: ${activeReport}\nTarih: ${dateFrom} - ${dateTo}`);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Raporlar & Analiz (BI)</h2>
          <p className="text-sm text-slate-400">İş zekası ve karar destek raporları</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportReport('pdf')} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700">📕 PDF</button>
          <button onClick={() => exportReport('excel')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700">📗 Excel</button>
          <button onClick={() => exportReport('csv')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">📘 CSV</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Toplam Rapor</div>
          <div className="text-lg font-semibold text-white">{Object.values(reports).flat().length}</div>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Kategori</div>
          <div className="text-lg font-semibold text-green-400">{Object.keys(reports).length}</div>
        </div>
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Toplam Ürün</div>
          <div className="text-lg font-semibold text-purple-400">{stats?.totalProducts?.toLocaleString() || '-'}</div>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Toplam Sipariş</div>
          <div className="text-lg font-semibold text-cyan-400">{stats?.totalOrders || 0}</div>
        </div>
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">XML Kaynak</div>
          <div className="text-lg font-semibold text-yellow-400">{stats?.totalXmlSources || 0}</div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Hatalı Ürün</div>
          <div className="text-lg font-semibold text-red-400">{stats?.errorProducts || 0}</div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* SOL: Kategori ve Rapor Listesi */}
        <div className="w-64 shrink-0 space-y-3">
          {categories.map(cat => (
            <div key={cat.id}>
              <button onClick={() => { setActiveCategory(cat.id); setActiveReport(reports[cat.id]?.[0]?.id || ''); }}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeCategory === cat.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}>
                <span>{cat.icon}</span>
                <span className="flex-1 text-left">{cat.name}</span>
                <span className="text-xs text-slate-500">{cat.count}</span>
              </button>
              {activeCategory === cat.id && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {currentReports.map(r => (
                    <button key={r.id} onClick={() => setActiveReport(r.id)}
                      className={`w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                        activeReport === r.id ? 'text-blue-400 bg-blue-600/10' : 'text-slate-400 hover:text-slate-300'
                      }`}>
                      <span>{r.icon}</span>
                      <span>{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ORTA: Rapor İçeriği */}
        <div className="flex-1 space-y-4">
          {/* Filtreler */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3 backdrop-blur-sm">
            <div>
              <label className="block text-xs text-slate-400 mb-0.5">Başlangıç</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-xs text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-0.5">Bitiş</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-xs text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-0.5">&nbsp;</label>
              <button onClick={() => exportReport('excel')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700">📥 Raporu Dışa Aktar</button>
            </div>
          </div>

          {/* Satış Raporu */}
          {activeCategory === 'sales' && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-white mb-3">
                {currentReports.find(r => r.id === activeReport)?.icon} {currentReports.find(r => r.id === activeReport)?.name}
              </h3>
              <div className="space-y-2">
                {orders.map((order, i) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                    <div>
                      <div className="text-sm text-white">{order.orderNo}</div>
                      <div className="text-xs text-slate-400">{order.customerName} · {order.channel}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-400">{formatPrice(order.total)}</div>
                      <div className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString('tr-TR')}</div>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && <div className="text-sm text-slate-500 text-center py-4">Veri bulunamadı</div>}
              </div>
            </div>
          )}

          {/* Ürün Raporu */}
          {activeCategory === 'products' && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-white mb-3">
                {currentReports.find(r => r.id === activeReport)?.icon} {currentReports.find(r => r.id === activeReport)?.name}
              </h3>
              <div className="space-y-2">
                {products.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-6">{i + 1}.</span>
                      <div>
                        <div className="text-sm text-white">{p.title || p.xmlKey}</div>
                        <div className="text-xs text-slate-400">{p.sku || p.barcode || '-'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-400">{formatPrice(p.salePrice)}</div>
                      <div className="text-xs text-slate-400">{p.stock} stok</div>
                    </div>
                  </div>
                ))}
                {products.length === 0 && <div className="text-sm text-slate-500 text-center py-4">Veri bulunamadı</div>}
              </div>
            </div>
          )}

          {/* Finans Raporu */}
          {activeCategory === 'finance' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white mb-3">💰 Gelir Dağılımı</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10">
                    <span className="text-sm text-slate-300">Satış Geliri</span>
                    <span className="text-lg font-semibold text-green-400">{formatPrice(products.reduce((a: number, p: any) => a + (p.salePrice || 0), 0))}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-blue-500/10">
                    <span className="text-sm text-slate-300">Ortalama Ürün Fiyatı</span>
                    <span className="text-lg font-semibold text-blue-400">{formatPrice(products.length ? products.reduce((a: number, p: any) => a + (p.salePrice || 0), 0) / products.length : 0)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white mb-3">📊 Dağılım Grafiği</h3>
                <div className="space-y-2">
                  {products.slice(0, 5).map((p: any, i: number) => {
                    const pct = products.length ? ((p.salePrice || 0) / Math.max(...products.map((x: any) => x.salePrice || 0)) * 100) : 0;
                    return (
                      <div key={p.id}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-slate-400 truncate">{p.title || p.xmlKey}</span>
                          <span className="text-green-400">{formatPrice(p.salePrice)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.max(pct, 2)}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* XML Raporu */}
          {activeCategory === 'xml' && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-white mb-3">🔗 XML Raporları</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Toplam XML Kaynak', value: stats?.totalXmlSources || 0, color: 'text-blue-400' },
                  { label: 'Aktif Kaynak', value: stats?.activeXmlSources || 0, color: 'text-green-400' },
                  { label: 'Toplam Ürün', value: stats?.totalProducts?.toLocaleString() || 0, color: 'text-white' },
                  { label: 'Hatalı Ürün', value: stats?.errorProducts || 0, color: 'text-red-400' },
                  { label: 'Düşük Stok', value: stats?.lowStockProducts || 0, color: 'text-yellow-400' },
                  { label: 'Bugünkü Sipariş', value: stats?.todayOrders || 0, color: 'text-purple-400' },
                ].map((item, i) => (
                  <div key={i} className="rounded-lg bg-slate-700/30 p-3">
                    <div className="text-xs text-slate-400">{item.label}</div>
                    <div className={`text-lg font-semibold mt-1 ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pazaryeri Raporu */}
          {activeCategory === 'mp' && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-white mb-3">
                {currentReports.find(r => r.id === activeReport)?.icon} {currentReports.find(r => r.id === activeReport)?.name || 'Pazaryeri'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Ürün Sayısı', value: stats?.totalProducts || 0, color: 'text-blue-400' },
                  { label: 'Sipariş Sayısı', value: stats?.totalOrders || 0, color: 'text-green-400' },
                  { label: 'Gönderime Hazır', value: stats?.readyProducts || 0, color: 'text-cyan-400' },
                ].map((item, i) => (
                  <div key={i} className="rounded-lg bg-slate-700/30 p-3">
                    <div className="text-xs text-slate-400">{item.label}</div>
                    <div className={`text-lg font-semibold mt-1 ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stok Raporu */}
          {activeCategory === 'stock' && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-white mb-3">📊 Stok Raporları</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Düşük Stoklu Ürün', value: stats?.lowStockProducts || 0, color: 'text-yellow-400' },
                  { label: 'Toplam Ürün', value: stats?.totalProducts?.toLocaleString() || 0, color: 'text-white' },
                  { label: 'Kritik Ürün', value: stats?.errorProducts || 0, color: 'text-red-400' },
                ].map((item, i) => (
                  <div key={i} className="rounded-lg bg-slate-700/30 p-3">
                    <div className="text-xs text-slate-400">{item.label}</div>
                    <div className={`text-lg font-semibold mt-1 ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
