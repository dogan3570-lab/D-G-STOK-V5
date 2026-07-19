import React from 'react';

type MenuItem = {
  key: string;
  label: string;
  icon: string;
  badge?: number;
};

interface SidebarProps {
  activePage: string;
  onPageChange: (key: string) => void;
  collapsed?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'kontrol', label: 'Kontrol Paneli', icon: '📊' },
  { key: 'xml', label: 'XML Kaynakları', icon: '🔗' },
  { key: 'urunhavuzu', label: 'Ürün Havuzu', icon: '📦' },
  { key: 'urunhazirlama', label: 'Ürün Hazırlama', icon: '⚙️' },
  { key: 'gonderimehazir', label: 'Gönderime Hazır', icon: '✅' },
  { key: 'ai-image', label: 'AI Görsel Merkezi', icon: '🖼️' },
  { key: 'ai-sales', label: 'AI Satış Asistanı', icon: '💰' },
  { key: 'copilot', label: 'AI Copilot', icon: '🤖' },
  { key: 'pazaryeri', label: 'Pazaryeri Yönetimi', icon: '🛒' },
  { key: 'siparis', label: 'Siparişler', icon: '📑' },
  { key: 'rapor', label: 'Raporlar', icon: '📊' },
  { key: 'ayar', label: 'Ayarlar', icon: '⚙️' },
];

export default function Sidebar({ activePage, onPageChange, collapsed = false }: SidebarProps) {
  return (
    <aside className={`flex h-screen flex-col bg-slate-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo Section */}
      <div className="flex items-center justify-between border-b border-slate-700 p-4">
        {!collapsed && (
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-blue-400">DG STOK V5.0</div>
            <div className="text-xs text-slate-400">PROFESYONEL ENTEGRATÖR</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => onPageChange('toggle-collapse')}
          className="rounded-lg p-2 hover:bg-slate-800 transition-colors"
          aria-label={collapsed ? 'Genişlet' : 'Daralt'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1" aria-label="Ana menü">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onPageChange(item.key)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              activePage === item.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            aria-current={activePage === item.key ? 'page' : undefined}
          >
            <span className="text-lg shrink-0">{item.icon}</span>
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      {/* User Section */}
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold shrink-0">
            Y
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Yönetici</div>
              <div className="text-xs text-slate-400 truncate">admin@dgstok.com</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
