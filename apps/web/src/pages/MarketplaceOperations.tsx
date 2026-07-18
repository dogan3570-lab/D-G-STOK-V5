import React from 'react';

const API_BASE = '';

const MARKETPLACES = [
  { key: 'tt', name: 'Trendyol', icon: '🛍️', color: 'bg-purple-900/30 border-purple-500/30' },
  { key: 'he', name: 'Hepsiburada', icon: '📦', color: 'bg-orange-900/30 border-orange-500/30' },
  { key: 'n11', name: 'N11', icon: '🛒', color: 'bg-green-900/30 border-green-500/30' },
  { key: 'amazon', name: 'Amazon', icon: '📋', color: 'bg-yellow-900/30 border-yellow-500/30' },
  { key: 'pazarama', name: 'Pazarama', icon: '🏪', color: 'bg-blue-900/30 border-blue-500/30' },
  { key: 'ciceksepeti', name: 'ÇiçekSepeti', icon: '🌸', color: 'bg-pink-900/30 border-pink-500/30' },
];

const TAB_KEYS = ['hazir', 'gonderiliyor', 'basarili', 'hatali', 'bekleyen', 'arsiv'];
const TAB_LABELS: Record<string, string> = {
  hazir: 'Gönderime Hazır', gonderiliyor: 'Gönderiliyor', basarili: 'Başarılı',
  hatali: 'Hatalı', bekleyen: 'Bekleyen', arsiv: 'Arşiv',
};

const STATUS_COLORS: Record<string, string> = {
  READY: 'bg-green-500/20 text-green-400 border-green-500/30',
  SENT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
  PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  PASSIVE: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  PROCESSING: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

const MOCK_PRODUCTS = Array.from({ length: 100 }, (_, i) => ({
  id: `PROD-${String(i).padStart(6, '0')}`,
  sku: `SKU-${String(i).padStart(6, '0')}`,
  title: `Test Ürün ${i}`,
  barcode: i % 3 === 0 ? null : `869${String(999000000 + i)}`,
  brand: ['Nike', 'Adidas', 'Samsung', 'LC Waikiki'][i % 4],
  category: ['Elektronik', 'Giyim', 'Ayakkabı', 'Saat'][i % 4],
  marketplace: MARKETPLACES[i % MARKETPLACES.length].name,
  status: ['READY', 'SENT', 'ERROR', 'PENDING', 'PROCESSING'][i % 5],
  lastAction: new Date(Date.now() - Math.random() * 86400000).toLocaleString('tr-TR'),
  readinessScore: Math.floor(Math.random() * 40) + 60,
}));

function KpiCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className={`p-3 rounded-lg border ${color} min-w-[120px]`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-2xl font-bold text-white">{value.toLocaleString('tr-TR')}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function ProductRow({ product, selected, onSelect }: { product: any; selected: boolean; onSelect: () => void }) {
  return (
    <tr className={`border-b border-slate-700/50 text-sm transition ${selected ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'}`}>
      <td className="p-2"><input type="checkbox" checked={selected} onChange={onSelect} className="accent-blue-500" /></td>
      <td className="p-2 font-mono text-xs text-gray-300">{product.sku}</td>
      <td className="p-2 text-white max-w-[200px] truncate">{product.title}</td>
      <td className="p-2 font-mono text-xs text-gray-400">{product.barcode || '❌'}</td>
      <td className="p-2 text-gray-300">{product.brand}</td>
      <td className="p-2 text-gray-300">{product.category}</td>
      <td className="p-2 text-gray-300">{product.marketplace}</td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <div className="w-16 bg-slate-600 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${product.readinessScore >= 90 ? 'bg-green-500' : product.readinessScore >= 70 ? 'bg-blue-500' : 'bg-yellow-500'}`}
              style={{ width: `${product.readinessScore}%` }} />
          </div>
          <span className="text-xs text-gray-400">{product.readinessScore}%</span>
        </div>
      </td>
      <td className="p-2">
        <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[product.status] || STATUS_COLORS.PENDING}`}>
          {product.status}
        </span>
      </td>
      <td className="p-2 text-xs text-gray-400">{product.lastAction}</td>
    </tr>
  );
}

export default function MarketplaceOperations() {
  const [selectedMP, setSelectedMP] = React.useState<string[]>([]);
  const [activeTab, setActiveTab] = React.useState('hazir');
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 42;
  const VISIBLE_ROWS = 20;
  const filteredProducts = MOCK_PRODUCTS.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)
  );

  const handleScroll = React.useCallback(() => {
    if (containerRef.current) {
      setPage(Math.floor(containerRef.current.scrollTop / ROW_HEIGHT));
    }
  }, []);

  const toggleMP = (key: string) => {
    setSelectedMP(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedRows.size === filteredProducts.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredProducts.map(p => p.id)));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pazaryeri Operasyon Merkezi</h1>
          <p className="text-gray-400 text-sm mt-0.5">Toplu gonderim, takip ve yonetim</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition">📤 Gonder</button>
          <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition">🔍 Filtrele</button>
        </div>
      </div>

      {/* KPI Panel */}
      <div className="flex flex-wrap gap-3">
        <KpiCard label="Gonderime Hazir" value={1284} color="bg-green-900/20 border-green-500/20" icon="✅" />
        <KpiCard label="Gonderiliyor" value={347} color="bg-blue-900/20 border-blue-500/20" icon="📤" />
        <KpiCard label="Basarili" value={8921} color="bg-emerald-900/20 border-emerald-500/20" icon="👍" />
        <KpiCard label="Hatali" value={156} color="bg-red-900/20 border-red-500/20" icon="❌" />
        <KpiCard label="API Hatasi" value={23} color="bg-orange-900/20 border-orange-500/20" icon="⚠️" />
        <KpiCard label="AI Duzeltti" value={89} color="bg-purple-900/20 border-purple-500/20" icon="🤖" />
        <KpiCard label="Bekleyen" value={412} color="bg-yellow-900/20 border-yellow-500/20" icon="⏳" />
        <KpiCard label="Bugunku Gonderim" value={1567} color="bg-cyan-900/20 border-cyan-500/20" icon="📊" />
      </div>

      {/* Pazaryeri Secimi */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {MARKETPLACES.map(mp => (
          <button key={mp.key} onClick={() => toggleMP(mp.key)}
            className={`p-3 rounded-lg border text-center transition ${
              selectedMP.includes(mp.key) ? 'ring-2 ring-blue-500 bg-slate-700' : mp.color
            } hover:scale-[1.02]`}
          >
            <div className="text-xl">{mp.icon}</div>
            <div className="text-xs text-white mt-1">{mp.name}</div>
            {selectedMP.includes(mp.key) && <div className="text-[10px] text-blue-400 mt-0.5">Secili</div>}
          </button>
        ))}
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 border-b border-slate-700">
        {TAB_KEYS.map(key => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm transition border-b-2 ${
              activeTab === key ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >{TAB_LABELS[key]}</button>
        ))}
      </div>

      {/* Ana Icerik: Tablo + Sag Panel */}
      <div className="flex gap-4">
        {/* Tablo */}
        <div className="flex-1 bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 p-2 border-b border-slate-700 bg-slate-800/50">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Urun veya SKU ara..."
              className="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm" />
            <button onClick={selectAll} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs">
              {selectedRows.size === filteredProducts.length ? 'Tumunu Kaldir' : 'Tumunu Sec'}
            </button>
            <span className="text-xs text-gray-500">{selectedRows.size} secili</span>
          </div>

          {/* Virtual Scroll Tablo */}
          <div ref={containerRef} onScroll={handleScroll} className="overflow-auto" style={{ maxHeight: `${VISIBLE_ROWS * ROW_HEIGHT}px` }}>
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-800 z-10">
                <tr className="text-xs text-gray-400 border-b border-slate-700">
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-left">SKU</th>
                  <th className="p-2 text-left">Urun</th>
                  <th className="p-2 text-left">Barkod</th>
                  <th className="p-2 text-left">Marka</th>
                  <th className="p-2 text-left">Kategori</th>
                  <th className="p-2 text-left">Pazaryeri</th>
                  <th className="p-2 text-left">Hazirlik</th>
                  <th className="p-2 text-left">Durum</th>
                  <th className="p-2 text-left">Son Islem</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.slice(page, page + VISIBLE_ROWS + 5).map((p: any) => (
                  <ProductRow key={p.id} product={p}
                    selected={selectedRows.has(p.id)}
                    onSelect={() => toggleRow(p.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sag Panel */}
        {selectedProduct && (
          <div className="w-72 bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Urun Detayi</h3>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">SKU</span><span className="text-white font-mono text-xs">{selectedProduct.sku}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Kategori</span><span className="text-white">{selectedProduct.category}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Marka</span><span className="text-white">{selectedProduct.brand}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Barkod</span><span className="text-white font-mono text-xs">{selectedProduct.barcode || 'Yok'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Pazaryeri</span><span className="text-white">{selectedProduct.marketplace}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Kalite Puani</span><span className={`font-bold ${selectedProduct.readinessScore >= 90 ? 'text-green-400' : selectedProduct.readinessScore >= 70 ? 'text-blue-400' : 'text-yellow-400'}`}>{selectedProduct.readinessScore}/100</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Durum</span><span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[selectedProduct.status]}`}>{selectedProduct.status}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
