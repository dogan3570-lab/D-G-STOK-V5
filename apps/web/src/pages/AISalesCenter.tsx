import React, { useEffect, useState } from 'react';

interface DashboardStats {
  todayRecommendations: number;
  totalAnalyzed: number;
  profitUp: number;
  profitDown: number;
  riskCount: number;
  opportunityCount: number;
  stockRiskCount: number;
  campaignSuggestions: number;
  byMarketplace: Record<string, number>;
}

interface RecommendationItem {
  id: string;
  productId: string;
  marketplace: string;
  currentPrice: number;
  recommendedPrice: number;
  profit: number;
  profitRate: number;
  recommendation: string;
  confidence: number;
  stockRisk: string;
  createdAt: string;
}

const API_BASE = '/api';

const MARKETPLACE_NAMES: Record<string, string> = {
  trendyol: 'Trendyol',
  hepsiburada: 'Hepsiburada',
  n11: 'N11',
  amazon: 'Amazon',
  pazarama: 'Pazarama',
  ciceksepeti: 'ÇiçekSepeti',
};

export default function AISalesCenter() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'recommendations' | 'analyze'>('dashboard');
  const [bulkCount, setBulkCount] = useState<number>(100);
  const [analyzing, setAnalyzing] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [filterMarketplace, setFilterMarketplace] = useState<string>('');

  useEffect(() => {
    loadDashboard();
    loadRecommendations();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/ai-sales/dashboard`);
      const json = await res.json();
      if (json.ok && json.data) setStats(json.data);
    } catch (err) {
      console.error('Dashboard yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const params = filterMarketplace ? `?marketplace=${filterMarketplace}` : '';
      const res = await fetch(`${API_BASE}/ai-sales/recommendations${params}`);
      const json = await res.json();
      if (json.ok && json.data) setRecommendations(json.data);
    } catch (err) {
      console.error('Öneriler yüklenemedi:', err);
    }
  };

  const handleBulkAnalyze = async () => {
    setAnalyzing(true);
    setBulkResult(null);
    try {
      const res = await fetch(`${API_BASE}/ai-sales/bulk-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: bulkCount }),
      });
      const json = await res.json();
      if (json.ok) {
        setBulkResult(`${json.data.totalProcessed} ürün analiz edildi. ${json.data.successful} başarılı, ${json.data.failed} başarısız.`);
        loadDashboard();
        loadRecommendations();
      } else {
        setBulkResult('Hata: ' + (json.error?.message || 'Bilinmeyen hata'));
      }
    } catch (err: any) {
      setBulkResult('Hata: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApprove = async (reportId: string, approved: boolean) => {
    try {
      await fetch(`${API_BASE}/ai-sales/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, approved }),
      });
      loadRecommendations();
      loadDashboard();
    } catch (err) {
      console.error('Onay hatası:', err);
    }
  };

  const getRecColor = (rec: string): string => {
    switch (rec) {
      case 'PRICE_UP': return 'text-orange-400';
      case 'URGENT_PRICE_UP': return 'text-red-400';
      case 'PRICE_DOWN': return 'text-green-400';
      case 'CAMPAIGN': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  const getRecLabel = (rec: string): string => {
    const labels: Record<string, string> = {
      PRICE_UP: 'Fiyat Artır',
      URGENT_PRICE_UP: 'Acil Artır',
      PRICE_DOWN: 'Fiyat Düşür',
      HOLD: 'Bekle',
      CAMPAIGN: 'Kampanya',
    };
    return labels[rec] || rec;
  };

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'CRITICAL': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 text-lg">Yükleniyor...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Satış ve Karlılık Asistanı</h1>
          <p className="text-slate-400 mt-1">AI ile akıllı fiyat önerileri, kar analizi ve satış tahminleri</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Dashboard</button>
          <button onClick={() => setActiveTab('recommendations')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'recommendations' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Öneriler ({recommendations.length})</button>
          <button onClick={() => setActiveTab('analyze')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'analyze' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Toplu Analiz</button>
        </div>
      </div>

      {activeTab === 'dashboard' && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-sm">Bugün Öneri</div>
              <div className="text-2xl font-bold text-white mt-1">{stats.todayRecommendations}</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-sm">Kar Artışı</div>
              <div className="text-2xl font-bold text-green-400 mt-1">{stats.profitUp}</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-sm">Kar Azalışı</div>
              <div className="text-2xl font-bold text-red-400 mt-1">{stats.profitDown}</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-sm">Riskli Ürün</div>
              <div className="text-2xl font-bold text-orange-400 mt-1">{stats.riskCount}</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-sm">Fırsat</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.opportunityCount}</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="text-slate-400 text-sm">Stok Riski</div>
              <div className="text-2xl font-bold text-red-400 mt-1">{stats.stockRiskCount}</div>
            </div>
          </div>

          {/* Pazaryeri Dağılımı */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">Pazaryeri Dağılımı</h3>
            <div className="space-y-3">
              {Object.entries(stats.byMarketplace).length === 0 ? (
                <p className="text-slate-500 text-sm">Henüz veri yok.</p>
              ) : (
                Object.entries(stats.byMarketplace).map(([key, count]) => (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{MARKETPLACE_NAMES[key] || key}</span>
                      <span className="text-slate-400">{count}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${stats.totalAnalyzed > 0 ? (count / stats.totalAnalyzed) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Örnek AI Önerileri */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h3 className="text-white font-semibold mb-4">AI Öneri Örnekleri</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-emerald-400 text-sm font-medium mb-2">Fiyat Artır</div>
                <p className="text-slate-300 text-sm">"Stok 15 gün içinde bitecek. Fiyat %8 artırılabilir. Kar %24 olur."</p>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-orange-400 text-sm font-medium mb-2">Fiyat Düşür</div>
                <p className="text-slate-300 text-sm">"Rakipler ortalama 1.699 TL'den satıyor. Fiyat rekabetçi hale getirilmeli."</p>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-red-400 text-sm font-medium mb-2">Acil Fiyat Artır</div>
                <p className="text-slate-300 text-sm">"Stok 3 gün içinde bitecek! Fiyat %12 artırılabilir."</p>
              </div>
              <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                <div className="text-blue-400 text-sm font-medium mb-2">Kampanya Önerisi</div>
                <p className="text-slate-300 text-sm">"Satışı düşük ürün için %10-15 indirimli kampanya önerilir."</p>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'recommendations' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center gap-3">
            <h3 className="text-white font-semibold flex-1">Fiyat Önerileri</h3>
            <select
              value={filterMarketplace}
              onChange={(e) => { setFilterMarketplace(e.target.value); setTimeout(loadRecommendations, 100); }}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
            >
              <option value="">Tüm Pazaryerleri</option>
              {Object.entries(MARKETPLACE_NAMES).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                  <th className="p-3">Pazaryeri</th>
                  <th className="p-3">Mevcut</th>
                  <th className="p-3">Öneri</th>
                  <th className="p-3">Kar</th>
                  <th className="p-3">Risk</th>
                  <th className="p-3">Öneri</th>
                  <th className="p-3">Güven</th>
                  <th className="p-3">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-500">Henüz öneri bulunmuyor.</td></tr>
                ) : (
                  recommendations.map((rec) => (
                    <tr key={rec.id} className="border-b border-slate-700/50 text-sm hover:bg-slate-700/30">
                      <td className="p-3 text-slate-300">{MARKETPLACE_NAMES[rec.marketplace] || rec.marketplace}</td>
                      <td className="p-3 text-slate-300">{rec.currentPrice.toFixed(2)} TL</td>
                      <td className={`p-3 font-medium ${getRecColor(rec.recommendation)}`}>
                        {rec.recommendedPrice.toFixed(2)} TL
                        <span className="text-xs ml-1">({getRecLabel(rec.recommendation)})</span>
                      </td>
                      <td className="p-3">
                        <span className={rec.profitRate > 20 ? 'text-green-400' : 'text-red-400'}>
                          %{rec.profitRate.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium text-white ${getRiskColor(rec.stockRisk)}`}>
                          {rec.stockRisk}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={getRecColor(rec.recommendation)}>{getRecLabel(rec.recommendation)}</span>
                      </td>
                      <td className="p-3 text-slate-400">%{rec.confidence}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <button onClick={() => handleApprove(rec.id, true)} className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded">Onayla</button>
                          <button onClick={() => handleApprove(rec.id, false)} className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded">Reddet</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analyze' && (
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">Toplu Fiyat Analizi</h3>
            <p className="text-slate-400 text-sm mb-4">Belirli sayıda ürünü AI ile analiz ederek akıllı fiyat önerileri alın.</p>
            <div className="flex flex-wrap gap-3 mb-4">
              {[100, 500, 1000, 5000].map((count) => (
                <button key={count} onClick={() => setBulkCount(count)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${bulkCount === count ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                  {count.toLocaleString('tr-TR')} Ürün
                </button>
              ))}
            </div>
            <button onClick={handleBulkAnalyze} disabled={analyzing} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
              {analyzing ? 'Analiz Ediliyor...' : 'Analizi Başlat'}
            </button>
            {bulkResult && <div className="mt-4 p-3 bg-slate-700/50 rounded-lg text-sm text-slate-300">{bulkResult}</div>}
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">Tek Ürün Analizi</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const fd = new FormData(form);
              const productId = fd.get('productId') as string;
              if (!productId) return;
              setAnalyzing(true);
              try {
                const res = await fetch(`${API_BASE}/ai-sales/analyze`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ productId }),
                });
                const json = await res.json();
                if (json.ok) {
                  const d = json.data;
                  alert(`Analiz tamamlandı!\nMevcut: ${d.currentPrice} TL\nÖneri: ${d.recommendedPrice} TL\nKar: %${d.profitRate.toFixed(1)}\nÖneri: ${d.recommendation}`);
                  loadDashboard();
                  loadRecommendations();
                } else {
                  alert('Hata: ' + (json.error?.message || ''));
                }
              } catch (err: any) { alert('Hata: ' + err.message); }
              finally { setAnalyzing(false); }
            }} className="flex gap-3">
              <input name="productId" placeholder="Ürün ID'si..." className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
              <button type="submit" disabled={analyzing} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium">Analiz Et</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
