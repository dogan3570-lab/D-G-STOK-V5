import React from 'react';
import KpiCard from '../components/ui/KpiCard';

export default function Dashboard() {
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
            <p className="text-xs text-slate-500">Trendyol, Amazon, Hepsiburada ve N11 anlık API ve XML besleme senkronizasyonu devrede.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Son güncelleme:</span>
            <span className="text-sm font-medium text-white">{new Date().toLocaleTimeString('tr-TR')}</span>
          </div>
        </div>
      </div>

      {/* Marketplace API Connections */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-300">PAZARYERİ API BAĞLANTILARI</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2">
            <span className="text-2xl">🛒</span>
            <span className="text-sm font-medium text-white">Trendyol</span>
            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2">
            <span className="text-2xl">📦</span>
            <span className="text-sm font-medium text-white">Amazon</span>
            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2">
            <span className="text-2xl">🛍️</span>
            <span className="text-sm font-medium text-white">Hepsiburada</span>
            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2">
            <span className="text-2xl">🏪</span>
            <span className="text-sm font-medium text-white">N11</span>
            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-dashed border-slate-600 bg-slate-700/30 px-4 py-2 text-sm text-slate-400 hover:border-blue-500 hover:text-white transition-colors"
          >
            <span>+</span>
            <span>Yeni Pazaryeri Ekle</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard
          title="TOPLAM ÜRÜN"
          value="26.260"
          subtitle="Havuzdaki toplam ürün"
          icon="📦"
          color="blue"
        />
        <KpiCard
          title="EŞLEŞENLER"
          value="26.260"
          subtitle="Eşleşen kategoriler"
          icon="✅"
          color="green"
        />
        <KpiCard
          title="EKSİK EŞLEŞME"
          value="0"
          subtitle="Eşleşmeyen marka/kategori"
          icon="⚠️"
          color="yellow"
        />
        <KpiCard
          title="GÖNDERİLMEYE HAZIR"
          value="0"
          subtitle="Kuyrukta bekleyenler"
          icon="📤"
          color="purple"
        />
        <KpiCard
          title="PAZARYERİNDE AKTİF"
          value="26.260"
          subtitle="Canlı satışta olanlar"
          icon="📊"
          color="green"
          trend="up"
          trendValue="+12%"
        />
        <KpiCard
          title="STOKTA YOK"
          value="0"
          subtitle="Miktarı sıfır olanlar"
          icon="📉"
          color="red"
        />
        <KpiCard
          title="HATALI ÜRÜNLER"
          value="4"
          subtitle="Kritik barkod hatası"
          icon="🐛"
          color="red"
        />
        <KpiCard
          title="AKTİF XML KAYNAK"
          value="3"
          subtitle="Senkronizasyon aktif"
          icon="🔗"
          color="blue"
        />
      </div>

      {/* Detailed Stats */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-300">DETAYLI İSTATİSTİKLER</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">TOPLAM ÜRÜN</div>
            <div className="mt-2 text-xl font-semibold text-white">26.260</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">AKTİF ÜRÜNLER</div>
            <div className="mt-2 text-xl font-semibold text-white">26.260</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">STOKTA OLMAYAN</div>
            <div className="mt-2 text-xl font-semibold text-white">0</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">HATALI ÜRÜNLER</div>
            <div className="mt-2 text-xl font-semibold text-white">4</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">TOPLAM MARKA</div>
            <div className="mt-2 text-xl font-semibold text-white">1</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">TOPLAM KATEGORİ</div>
            <div className="mt-2 text-xl font-semibold text-white">644</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">TOPLAM VARYANT</div>
            <div className="mt-2 text-xl font-semibold text-white">42.016</div>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-4">
            <div className="text-xs text-slate-400">TOPLAM GÖRSEL</div>
            <div className="mt-2 text-xl font-semibold text-white">26.260</div>
          </div>
        </div>
      </div>

      {/* XML Integration Hub */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">XML ENTEGRASYON HUB</h3>
            <p className="text-sm text-slate-400">XML Ürün Bilgileri ve Kaynak Yönetimi</p>
            <p className="text-xs text-slate-500">XML kaynaklı ürün havuzu, güncellenme durumları ve veri bütünlüğü metrikleri</p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Yeni XML Kaynağı Ekle
          </button>
        </div>

        {/* XML Sources Table */}
        <div className="overflow-hidden rounded-lg border border-slate-600">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Kaynak Adı
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                  URL
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Ürün Sayısı
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Son Güncelleme
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Durum
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-300">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              <tr className="bg-slate-800/30">
                <td className="px-4 py-3 text-sm font-medium text-white">AKILLI BAYİ1</td>
                <td className="px-4 py-3 text-sm text-slate-400">https://api.example.com/feed1.xml</td>
                <td className="px-4 py-3 text-sm text-slate-300">12.450</td>
                <td className="px-4 py-3 text-sm text-slate-400">2 saat önce</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
                    Aktif
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="text-sm text-blue-400 hover:text-blue-300">
                    Ürün Listesini Aç
                  </button>
                </td>
              </tr>
              <tr className="bg-slate-800/30">
                <td className="px-4 py-3 text-sm font-medium text-white">AKILLI BAYİ2</td>
                <td className="px-4 py-3 text-sm text-slate-400">https://api.example.com/feed2.xml</td>
                <td className="px-4 py-3 text-sm text-slate-300">8.320</td>
                <td className="px-4 py-3 text-sm text-slate-400">1 gün önce</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
                    Aktif
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="text-sm text-blue-400 hover:text-blue-300">
                    Ürün Listesini Aç
                  </button>
                </td>
              </tr>
              <tr className="bg-slate-800/30">
                <td className="px-4 py-3 text-sm font-medium text-white">BEBEK MODA XML</td>
                <td className="px-4 py-3 text-sm text-slate-400">https://api.example.com/feed3.xml</td>
                <td className="px-4 py-3 text-sm text-slate-300">5.490</td>
                <td className="px-4 py-3 text-sm text-slate-400">3 gün önce</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">
                    Hata
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="text-sm text-blue-400 hover:text-blue-300">
                    Ürün Listesini Aç
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
