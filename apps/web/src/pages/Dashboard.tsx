import React, { useEffect, useState } from 'react';
import KpiCard from '../components/ui/KpiCard';

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalMarketplaces: number;
  totalXmlSources: number;
  activeXmlSources: number;
  lowStockProducts: number;
  errorProducts: number;
  todayOrders: number;
}

interface MarketplaceItem {
  id: string;
  key: string;
  name: string;
  apiStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface XmlSourceItem {
  id: string;
  name: string;
  company: string | null;
  sourceType: string;
  url: string | null;
  active: boolean;
  connectionStatus: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [marketplaces, setMarketplaces] = useState<MarketplaceItem[]>([]);
  const [xmlSources, setXmlSources] = useState<XmlSourceItem[]>([]);
  const [brandCount, setBrandCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [variantCount, setVariantCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    try {
      const [statsRes, marketplacesRes, xmlRes, brandsRes, categoriesRes, variantsRes] = await Promise.all([
        fetch('/dashboard/stats', { credentials: 'include' }),
        fetch('/marketplaces', { credentials: 'include' }),
        fetch('/xml-sources', { credentials: 'include' }),
        fetch('/brands', { credentials: 'include' }),
        fetch('/categories', { credentials: 'include' }),
        fetch('/variants', { credentials: 'include' }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (marketplacesRes.ok) {
        const data = await marketplacesRes.json();
        setMarketplaces(data.items || []);
      }
      if (xmlRes.ok) {
        const data = await xmlRes.json();
        setXmlSources(data.items || []);
      }
      if (brandsRes.ok) {
        const data = await brandsRes.json();
        setBrandCount(data.items?.length || 0);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategoryCount(data.items?.length || 0);
      }
      if (variantsRes.ok) {
        const data = await variantsRes.json();
        setVariantCount(data.items?.length || 0);
      }
    } catch (error) {
      console.error('Dashboard veri çekme hatası:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteXmlSource(id: string) {
    if (!confirm('Bu XML kaynağını silmek istediğinizden emin misiniz?')) return;
    try {
      await fetch(`/xml-sources/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchAllData();
    } catch {
      alert('Silme hatası');
    }
  }

  function getMarketplaceIcon(key: string): string {
    const icons: Record<string, string> = {
      tt: '🛒',
      trendyol: '🛒',
      he: '📦',
      hepsiburada: '📦',
      n11: '🏪',
      amazon: '📦',
    };
    return icons[key.toLowerCase()] || '🛍️';
  }

  function getStatusDot(status: string) {
    if (status === 'ok' || status === 'connected') return <span className="flex h-3 w-3 rounded-full bg-green-500" title="Aktif"></span>;
    if (status === 'error') return <span className="flex h-3 w-3 rounded-full bg-red-500" title="Hata"></span>;
    return <span className="flex h-3 w-3 rounded-full bg-slate-500" title="Bilinmiyor"></span>;
  }

  function getXmlStatusBadge(source: XmlSourceItem) {
    if (!source.active) return <span className="rounded-full bg-slate-500/10 px-2 py-1 text-xs font-medium text-slate-400">Pasif</span>;
    if (source.connectionStatus === 'error' || source.lastError) return <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">Hata</span>;
    if (source.lastSuccessAt) return <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">Aktif</span>;
    return <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-400">Bekliyor</span>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-slate-400">Yükleniyor...</div>
      </div>
    );
  }

  const totalProducts = stats?.totalProducts || 0;
  const errorProducts = stats?.errorProducts || 0;
  const lowStockProducts = stats?.lowStockProducts || 0;
  const activeXmlCount = stats?.activeXmlSources || 0;
  const readyCount = totalProducts - errorProducts;

  return (
    <div className="space-y-6">
      {/* Live System Status */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 animate-pulse rounded-full bg-green-500"></span>
              <h2 className="text-lg font-semibold text-white">CANLI SİSTEM</h2>
            </div>
            <p className="mt-1 text-sm text-slate-400">D&G STOK v5.0 Performans Paneli</p>
            <p className="text-xs text-slate-500">
              {activeXmlCount > 0 
                ? `${activeXmlCount} aktif XML kaynağı ile ${totalProducts} ürün senkronize ediliyor.`
                : 'Henüz aktif XML kaynağı bulunmuyor.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Son güncelleme:</span>
            <span className="text-sm font-medium text-white">{new Date().toLocaleTimeString('tr-TR')}</span>
          </div>
        </div>
      </div>

      {/* PAZARYERİ API BAĞLANTILARI - Sadece görüntüleme */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">PAZARYERİ API BAĞLANTILARI</h3>
          <span className="text-xs text-slate-500">{marketplaces.length} pazaryeri</span>
        </div>
        {marketplaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-slate-400">
            <div className="text-3xl mb-2">🛒</div>
            <div className="text-sm">Henüz pazaryeri bağlantısı yok</div>
            <p className="text-xs text-slate-500 mt-1">Pazaryeri eklemek için Pazaryeri Paneli sayfasını kullanın</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {marketplaces.map((mp) => (
              <div key={mp.id} className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2">
                <span className="text-2xl">{getMarketplaceIcon(mp.key)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{mp.name}</span>
                    {getStatusDot(mp.apiStatus)}
                  </div>
                  <div className="text-xs text-slate-500">{mp.key}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard
          title="TOPLAM ÜRÜN"
          value={totalProducts.toLocaleString('tr-TR')}
          subtitle="Havuzdaki toplam ürün"
          icon="📦"
          color="blue"
        />
        <KpiCard
          title="EŞLEŞENLER"
          value={readyCount.toLocaleString('tr-TR')}
          subtitle="Başarılı ürünler"
          icon="✅"
          color="green"
        />
        <KpiCard
          title="EKSİK EŞLEŞME"
          value={errorProducts.toLocaleString('tr-TR')}
          subtitle="Hatalı ürünler"
          icon="⚠️"
          color="yellow"
        />
        <KpiCard
          title="STOKTA YOK"
          value={lowStockProducts.toLocaleString('tr-TR')}
          subtitle="Miktarı sıfır olanlar"
          icon="📉"
          color="red"
        />
        <KpiCard
          title="HATALI ÜRÜNLER"
          value={errorProducts.toLocaleString('tr-TR')}
          subtitle="Kritik hata"
          icon="🐛"
          color="red"
        />
        <KpiCard
          title="AKTİF XML KAYNAK"
          value={activeXmlCount}
          subtitle="Senkronizasyon aktif"
          icon="🔗"
          color="blue"
        />
        <KpiCard
          title="BUGÜNKÜ SİPARİŞ"
          value={stats?.todayOrders || 0}
          subtitle="Bugün gelen sipariş"
          icon="📑"
          color="purple"
        />
        <KpiCard
          title="TOPLAM SİPARİŞ"
          value={stats?.totalOrders || 0}
          subtitle="Tüm zamanlar"
          icon="📊"
          color="green"
        />
      </div>

      {/* Detaylı İstatistikler */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-300">DETAYLI İSTATİSTİKLER</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">TOPLAM ÜRÜN</div>
            <div className="mt-2 text-xl font-semibold text-white">{totalProducts.toLocaleString('tr-TR')}</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">AKTİF ÜRÜNLER</div>
            <div className="mt-2 text-xl font-semibold text-white">{readyCount.toLocaleString('tr-TR')}</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">STOKTA OLMAYAN</div>
            <div className="mt-2 text-xl font-semibold text-white">{lowStockProducts.toLocaleString('tr-TR')}</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">HATALI ÜRÜNLER</div>
            <div className="mt-2 text-xl font-semibold text-white">{errorProducts.toLocaleString('tr-TR')}</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">TOPLAM MARKA</div>
            <div className="mt-2 text-xl font-semibold text-white">{brandCount}</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">TOPLAM KATEGORİ</div>
            <div className="mt-2 text-xl font-semibold text-white">{categoryCount}</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">TOPLAM VARYANT</div>
            <div className="mt-2 text-xl font-semibold text-white">{variantCount.toLocaleString('tr-TR')}</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">PAZARYERİ SAYISI</div>
            <div className="mt-2 text-xl font-semibold text-white">{marketplaces.length}</div>
          </div>
        </div>
      </div>

      {/* XML ENTEGRASYON HUB */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">XML ENTEGRASYON HUB</h3>
            <p className="text-sm text-slate-400">XML Ürün Bilgileri ve Kaynak Yönetimi</p>
            <p className="text-xs text-slate-500">
              {xmlSources.length > 0 
                ? `${xmlSources.length} XML kaynağı, toplam ${totalProducts.toLocaleString('tr-TR')} ürün`
                : 'Henüz XML kaynağı eklenmemiş'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.href = '/xml'}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Yeni XML Kaynağı Ekle
          </button>
        </div>

        {xmlSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <div className="text-4xl mb-2">🔗</div>
            <div className="text-sm">Henüz XML kaynağı eklenmemiş</div>
            <button
              type="button"
              onClick={() => window.location.href = '/xml'}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              + İlk XML Kaynağını Ekle
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-600">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Kaynak Adı</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">URL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Ürün Sayısı</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Son Güncelleme</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">Durum</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-300">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {xmlSources.map((source) => (
                  <tr key={source.id} className="bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-white">{source.name}</div>
                      {source.company && <div className="text-xs text-slate-400">{source.company}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-[200px] truncate">{source.url || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{source.productCount}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {source.lastSuccessAt 
                        ? new Date(source.lastSuccessAt).toLocaleString('tr-TR')
                        : 'Henüz çalışmadı'}
                    </td>
                    <td className="px-4 py-3">{getXmlStatusBadge(source)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => window.location.href = `/xml?source=${source.id}`}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Ürün Listesini Aç
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteXmlSource(source.id)}
                          className="rounded p-1 text-slate-500 hover:text-red-400 transition-colors"
                          title="XML Kaynağını Kaldır"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
