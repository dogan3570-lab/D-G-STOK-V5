'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import {
  LayoutDashboard,
  Package,
  FileSpreadsheet,
  FolderTree,
  FileText,
  DollarSign,
  Percent,
  ShoppingCart,
  Users,
  Settings,
  History,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Bell,
  Gift,
  Tag,
  Grid3X3,
  TrendingUp,
  MessageSquare,
  Truck,
  Zap,
  ClipboardList,
  Building2,
} from 'lucide-react';

const menuGroups = [
  {
    label: 'ANA MENÜ',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { label: 'Ürün Yönetimi', href: '/admin/products', icon: Package },
      { label: 'XML Yönetimi', href: '/admin/xml', icon: FileText },
      { label: 'Excel Yönetimi', href: '/admin/excel', icon: FileSpreadsheet },
      { label: 'Kategori Yönetimi', href: '/admin/categories', icon: FolderTree },
      { label: 'Listeleme Şablonları', href: '/admin/templates', icon: FileText },
    ],
  },
  {
    label: 'FİYATLANDIRMA',
    items: [
      { label: 'Fiyatlandırma', href: '/admin/pricing', icon: DollarSign },
      { label: 'Kampanyalar', href: '/admin/campaigns', icon: Gift },
      { label: 'İndirimler', href: '/admin/discounts', icon: Percent },
    ],
  },
  {
    label: 'MARKA & VARYANT',
    items: [
      { label: 'Markalar', href: '/admin/brands', icon: Tag },
      { label: 'Varyantlar', href: '/admin/variants', icon: Grid3X3 },
    ],
  },
  {
    label: 'SİPARİŞ & MÜŞTERİ',
    items: [
      { label: 'Siparişler', href: '/admin/orders', icon: ShoppingCart },
      { label: 'Müşteriler', href: '/admin/users', icon: Users },
      { label: 'Mesajlar', href: '/admin/messages', icon: MessageSquare },
      { label: 'Kargolar', href: '/admin/shipments', icon: Truck },
    ],
  },
  {
    label: 'FİNANS & RAPORLAR',
    items: [
      { label: 'Finans', href: '/admin/finance', icon: DollarSign },
      { label: 'Raporlar', href: '/admin/reports', icon: TrendingUp },
    ],
  },
  {
    label: 'SİSTEM',
    items: [
      { label: 'Otomasyon', href: '/admin/automation', icon: Zap },
      { label: 'Denetim Logları', href: '/admin/audit-logs', icon: ClipboardList },
      { label: 'Ayarlar', href: '/admin/settings', icon: Settings },
      { label: 'Loglar', href: '/admin/logs', icon: History },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/auth/login');
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    // Auto-expand current menu group
    for (const group of menuGroups) {
      for (const item of group.items) {
        if (pathname === item.href || pathname.startsWith(item.href + '/')) {
          setExpandedGroups(prev => ({ ...prev, [group.label]: true }));
        }
      }
    }
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-100 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100">
            <Link href="/admin" className="text-lg font-light tracking-widest">
              D&G <span className="font-normal">ADMIN</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {menuGroups.map((group) => (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-widest hover:text-gray-600"
                >
                  {group.label}
                  {expandedGroups[group.label] ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
                {(expandedGroups[group.label] || true) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all ${
                          isActive(item.href)
                            ? 'bg-black text-white font-medium'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                        }`}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* User & Logout */}
          <div className="border-t border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {user?.name?.charAt(0) || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || 'Admin'}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Çıkış Yap
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="flex items-center justify-between h-full px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-600 hover:text-black"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-4">
              <button className="relative text-gray-400 hover:text-black transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <span className="text-sm text-gray-400">
                {new Date().toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main>{children}</main>
      </div>
    </div>
  );
}
