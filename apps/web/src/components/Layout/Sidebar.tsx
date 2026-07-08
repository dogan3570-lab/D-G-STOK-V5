import React from 'react';

type MenuItem = {
  key: string;
  label: string;
  icon: string;
  badge?: number;
  active?: boolean;
  group?: string;
};

interface SidebarProps {
  activePage: string;
  onPageChange: (key: string) => void;
  collapsed?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'kontrol', label: 'Kontrol Paneli', icon: '🏠', badge: 2, group: 'YÖNETİCİ' },
  { key: 'siparis', label: 'Siparişler', icon: '📦', group: 'SİPARİŞLER' },
  { key: 'messages', label: 'Mesajlar', icon: '💬', group: 'SİPARİŞLER' },
  { key: 'finance', label: 'Finans', icon: '💰', group: 'SİPARİŞLER' },
  { key: 'xml', label: 'Ürün Kaynakları', icon: '🔗', active: true, group: 'ENTEGRASYONLAR' },
  { key: 'kategori', label: 'Kategori Eşleştir', icon: '🗂', group: 'ENTEGRASYONLAR' },
  { key: 'marka', label: 'Marka Eşleştir', icon: '🏷', group: 'ENTEGRASYONLAR' },

  { key: 'pazaryeri', label: 'Pazaryeri Paneli', icon: '🛒', group: 'PAZARYERİ' },
  { key: 'urunler', label: 'Ürün Havuzu', icon: '📦', group: 'ÜRÜNLER' },
  { key: 'gonderim', label: 'Gönderim Merkezi', icon: '🚀', group: 'EK KANALLAR & ARAÇLAR' },
  { key: 'otomasyon', label: 'Otomasyon', icon: '⚡', group: 'EK KANALLAR & ARAÇLAR' },
  { key: 'rapor', label: 'Raporlar', icon: '📊', group: 'RAPORLAR' },
  { key: 'users', label: 'Kullanıcılar', icon: '👥', group: 'YÖNETİM' },
  { key: 'ayar', label: 'Ayarlar', icon: '⚙', group: 'YÖNETİM' },
  { key: 'loglar', label: 'Loglar', icon: '📝', group: 'YÖNETİM' },
];

export default function Sidebar({ activePage, onPageChange, collapsed = false }: SidebarProps) {
  const groupedItems = MENU_ITEMS.reduce((acc, item) => {
    if (!acc[item.group || 'GENEL']) {
      acc[item.group || 'GENEL'] = [];
    }
    acc[item.group || 'GENEL'].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <aside className={`flex h-screen flex-col bg-slate-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo Section */}
      <div className="flex items-center justify-between border-b border-slate-700 p-4">
        {!collapsed && (
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-blue-400">DG STOK V5.0</div>
            <div className="text-xs text-slate-400">XML ENTEGRATÖR + ERP</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => onPageChange('toggle-collapse')}
          className="rounded-lg p-2 hover:bg-slate-800 transition-colors"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {Object.entries(groupedItems).map(([group, items]) => (
          <div key={group}>
            {!collapsed && (
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {group}
              </div>
            )}
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onPageChange(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activePage === item.key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
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
            </div>
          </div>
        ))}
      </nav>

      {/* User Section */}
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold">
            Y
          </div>
          {!collapsed && (
            <div className="flex-1">
              <div className="text-sm font-medium">Yönetici Admin</div>
              <div className="text-xs text-slate-400">admin@dgstok.com</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
