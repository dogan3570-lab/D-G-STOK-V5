'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, ArrowLeft, Send, Trash2, Check, X, AlertTriangle, Info, ShoppingCart, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const typeIcons: Record<string, any> = {
  info: Info,
  warning: AlertTriangle,
  error: X,
  order: ShoppingCart,
  stock: Package,
};

const typeColors: Record<string, string> = {
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-orange-50 text-orange-700 border-orange-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  order: 'bg-green-50 text-green-700 border-green-200',
  stock: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function AdminNotificationsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendForm, setSendForm] = useState({ type: 'info', title: '', message: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/auth/login');
      return;
    }
    loadNotifications();
  }, [isAuthenticated, user, page]);

  const loadNotifications = async () => {
    try {
      const data = await api.request(`/notifications?page=${page}&limit=20`);
      const list = data?.data || [];
      setNotifications(list);
      setTotalPages(Math.ceil((data?.total || 0) / 20));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendForm.title.trim() || !sendForm.message.trim()) {
      toast.error('Başlık ve mesaj zorunludur');
      return;
    }

    try {
      await api.request('/notifications', {
        method: 'POST',
        body: JSON.stringify(sendForm),
      });
      toast.success('Bildirim gönderildi');
      setShowSendForm(false);
      setSendForm({ type: 'info', title: '', message: '' });
      loadNotifications();
    } catch (error: any) {
      toast.error('Bildirim gönderilemedi', { description: error.message });
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.request(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      // silent
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.request(`/notifications/${id}`, { method: 'DELETE' });
      toast.success('Bildirim silindi');
      loadNotifications();
    } catch (error: any) {
      toast.error('Silinemedi', { description: error.message });
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (!isAuthenticated || user?.role !== 'admin') return null;

  return (
    <main className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-400 hover:text-black transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-light text-gray-900">Bildirimler</h1>
              <p className="text-sm text-gray-500 mt-1">
                Sistem bildirimleri
                {unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-black text-white text-xs">
                    {unreadCount} okunmamış
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSendForm(!showSendForm)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm hover:bg-gray-800 transition-colors"
          >
            <Send className="w-4 h-4" />
            Bildirim Gönder
          </button>
        </div>

        {/* Send Form */}
        {showSendForm && (
          <form onSubmit={handleSend} className="bg-white border border-gray-100 p-6 mb-8">
            <h2 className="text-lg font-light text-gray-900 mb-4">Yeni Bildirim Gönder</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bildirim Türü</label>
                <select
                  value={sendForm.type}
                  onChange={(e) => setSendForm({ ...sendForm, type: e.target.value })}
                  className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-black transition-colors bg-white"
                >
                  <option value="info">Bilgi</option>
                  <option value="warning">Uyarı</option>
                  <option value="error">Hata</option>
                  <option value="order">Sipariş</option>
                  <option value="stock">Stok</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Başlık</label>
                <input
                  type="text"
                  value={sendForm.title}
                  onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                  className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-black transition-colors"
                  placeholder="Bildirim başlığı"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mesaj</label>
                <textarea
                  value={sendForm.message}
                  onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-black transition-colors resize-none"
                  placeholder="Bildirim mesajı"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-8 py-3 bg-black text-white text-sm hover:bg-gray-800 transition-colors"
              >
                Gönder
              </button>
            </div>
          </form>
        )}

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-white border border-gray-100" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white border border-gray-100 p-12 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-light text-gray-900 mb-2">Bildirim Bulunamadı</h2>
            <p className="text-gray-500">Henüz hiçbir bildirim bulunmuyor.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {notifications.map((notification) => {
                const Icon = typeIcons[notification.type] || Info;
                const colorClass = typeColors[notification.type] || typeColors.info;

                return (
                  <div
                    key={notification.id}
                    className={`bg-white border p-5 transition-colors hover:border-gray-300 ${
                      !notification.isRead ? 'border-l-4 border-l-black' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`p-2 rounded ${colorClass.split(' ')[0]}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-sm ${!notification.isRead ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                              {notification.title}
                            </h3>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-black rounded-full" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(notification.createdAt).toLocaleString('tr-TR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notification.isRead && (
                          <button
                            onClick={() => handleMarkRead(notification.id)}
                            className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                            title="Okundu işaretle"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-10 h-10 text-sm border transition-colors ${
                      page === p
                        ? 'bg-black text-white border-black'
                        : 'border-gray-300 text-gray-600 hover:border-black'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
