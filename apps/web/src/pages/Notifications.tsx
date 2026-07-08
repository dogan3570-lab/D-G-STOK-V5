import React, { useEffect, useState } from 'react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);

  async function fetchNotifications() {
    try {
      const response = await fetch('/notifications', { credentials: 'include' });
      const data = await response.json();
      setNotifications(data.items || []);
      setUnread(data.unread || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      await fetch(`/notifications/${id}/read`, { method: 'POST', credentials: 'include' });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  const typeIcons: Record<string, string> = {
    order: '🛒',
    xml_error: '🔴',
    api_error: '⚠️',
    stock: '📦',
    price: '💰',
    sync: '🔄',
    info: 'ℹ️',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Bildirim Merkezi</h2>
          <p className="text-sm text-slate-400">{unread > 0 ? `${unread} okunmamış bildirim` : 'Tüm bildirimler okundu'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">🔔</div>
            <div>Bildirim bulunamadı</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {notifications.map((notif) => (
              <div key={notif.id} className={`flex items-start gap-3 p-4 ${notif.read ? 'opacity-60' : ''}`}>
                <div className="text-2xl">{typeIcons[notif.type] || '📌'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-white">{notif.title}</h4>
                    <span className="text-xs text-slate-500">{new Date(notif.createdAt).toLocaleString('tr-TR')}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{notif.message}</p>
                </div>
                {!notif.read && (
                  <button onClick={() => markAsRead(notif.id)}
                    className="rounded-lg px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 transition-colors">
                    Okundu
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
