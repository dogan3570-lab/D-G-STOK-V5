import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './pages/Dashboard';
import XmlSources from './pages/XmlSources';
import Products from './pages/Products';
import Marketplace from './pages/Marketplace';
import Login from './pages/Login';
import Orders from './pages/Orders';
import Brands from './pages/Brands';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Finance from './pages/Finance';
import Messages from './pages/Messages';
import Shipments from './pages/Shipments';
import Templates from './pages/Templates';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import { useTheme } from './hooks/useTheme';
import './styles/theme.css';
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
  const { theme, toggleTheme } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activePage, setActivePage] = useState('kontrol');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const handlePageChange = (key: string) => {
    if (key === 'toggle-collapse') {
      setSidebarCollapsed((prev) => !prev);
    } else {
      setActivePage(key);
    }
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      kontrol: 'Kontrol Paneli',
      xml: 'XML Kaynakları',
      urunler: 'Ürünler',
      kategori: 'Kategori Eşleştirme',
      varyant: 'Varyant Eşleştirme',
      marka: 'Marka Eşleştirme',
      sablon: 'Listeleme Şablonları',
      pazaryeri: 'Pazaryerleri',
      gonderim: 'Gönderim Merkezi',
      siparis: 'Siparişler',
      rapor: 'Raporlar',
      ayar: 'Ayarlar',
      loglar: 'Loglar',
    };
    return titles[activePage] || 'Kontrol Paneli';
  };

  const renderPage = () => {
    switch (activePage) {
      case 'kontrol':
        return <Dashboard />;
      case 'xml':
        return <XmlSources />;
      case 'urunler':
        return <Products />;
      case 'kategori':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4">🗂</div>
              <div className="text-lg font-semibold text-white">Kategori Eşleştirme</div>
              <div className="text-sm text-slate-400 mt-2">Kategori eşleştirme sayfası yakında eklenecek.</div>
            </div>
          </div>
        );
      case 'varyant':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4">🎨</div>
              <div className="text-lg font-semibold text-white">Varyant Eşleştirme</div>
              <div className="text-sm text-slate-400 mt-2">Varyant eşleştirme sayfası yakında eklenecek.</div>
            </div>
          </div>
        );
      case 'marka':
        return <Brands />;
      case 'sablon':
        return <Templates />;
      case 'pazaryeri':
        return <Marketplace />;
      case 'gonderim':
        return <Shipments />;
      case 'siparis':
        return <Orders />;
      case 'rapor':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <div className="text-lg font-semibold text-white">Raporlar</div>
              <div className="text-sm text-slate-400 mt-2">Raporlar sayfası yakında eklenecek.</div>
            </div>
          </div>
        );
      case 'ayar':
        return <Settings />;
      case 'loglar':
        return <AuditLogs />;
      default:
        return <Dashboard />;
    }
  };

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="flex h-screen bg-slate-900 dark">
      <Sidebar activePage={activePage} onPageChange={handlePageChange} collapsed={sidebarCollapsed} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={getPageTitle()}
          subtitle="DG STOK V5.0 ERP Entegrasyon Sistemi"
          onRefresh={() => window.location.reload()}
          notifications={2}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
