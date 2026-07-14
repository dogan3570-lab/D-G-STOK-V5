import React from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './pages/Dashboard';
import XmlSources from './pages/XmlSources';
import ProductPool from './pages/ProductPool';
import ProductPreparation from './pages/ProductPreparation';
import ReadyToSend from './pages/ReadyToSend';
import MarketplaceManagement from './pages/MarketplaceManagement';
import Login from './pages/Login';
import Orders from './pages/Orders';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import VariantExceptionScreen from './pages/VariantExceptionScreen';
import { useTheme } from './hooks/useTheme';
import './styles/theme.css';

type PageKey = 'kontrol' | 'xml' | 'urunhavuzu' | 'urunhazirlama' | 'gonderimehazir' | 'pazaryeri' | 'siparis' | 'rapor' | 'ayar' | 'varyant';

const MENU_ITEMS: Array<{ key: PageKey; label: string; icon: string }> = [
  { key: 'kontrol', label: 'Kontrol Paneli', icon: '📊' },
  { key: 'xml', label: 'XML Kaynakları', icon: '🔗' },
  { key: 'urunhavuzu', label: 'Ürün Havuzu', icon: '📦' },
  { key: 'urunhazirlama', label: 'Ürün Hazırlama', icon: '⚙️' },
  { key: 'gonderimehazir', label: 'Gönderime Hazır', icon: '✅' },
  { key: 'varyant', label: 'Varyant İstisnaları', icon: '🔀' },
  { key: 'pazaryeri', label: 'Pazaryeri Yönetimi', icon: '🛒' },
  { key: 'siparis', label: 'Siparişler', icon: '📑' },
  { key: 'rapor', label: 'Raporlar', icon: '📊' },
  { key: 'ayar', label: 'Ayarlar', icon: '⚙️' },
];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = React.useState(() => {
    return localStorage.getItem('dgstok_loggedin') === 'true';
  });
  const [activePage, setActivePage] = React.useState('kontrol');
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

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
      urunhavuzu: 'Ürün Havuzu',
      urunhazirlama: 'Ürün Hazırlama',
      gonderimehazir: 'Gönderime Hazır',
      varyant: 'Varyant İstisna Yönetimi',
      pazaryeri: 'Pazaryeri Yönetimi',
      siparis: 'Siparişler',
      rapor: 'Raporlar',
      ayar: 'Ayarlar',
    };
    return titles[activePage] || 'Kontrol Paneli';
  };

  const renderPage = () => {
    switch (activePage) {
      case 'kontrol':
        return <Dashboard />;
      case 'xml':
        return <XmlSources />;
      case 'urunhavuzu':
        return <ProductPool />;
      case 'urunhazirlama':
        return <ProductPreparation />;
      case 'gonderimehazir':
        return <ReadyToSend />;
      case 'varyant':
        return <VariantExceptionScreen />;
      case 'pazaryeri':
        return <MarketplaceManagement />;
      case 'siparis':
        return <Orders />;
      case 'rapor':
        return <Reports />;
      case 'ayar':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar activePage={activePage} onPageChange={handlePageChange} collapsed={sidebarCollapsed} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={getPageTitle()}
          subtitle="DG STOK V5.0 Profesyonel Entegratör"
          onRefresh={() => window.location.reload()}
          notifications={0}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            {renderPage()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
