import React, { useEffect, useState } from 'react';

interface NotificationItem {
  id: string; type: string; title: string; message: string;
  read: boolean; priority?: string; module?: string;
  createdAt: string;
}

const PRIORITY_LABELS: Record<string, string> = { P1: '🔴 Kritik', P2: '🟠 Yüksek', P3: '🟡 Orta', P4: '🔵 Düşük' };
const PRIORITY_COLORS: Record<string, string> = { P1: 'bg-red-500/10 text-red-400 border-red-500/30', P2: 'bg-orange-500/10 text-orange-400 border-orange-500/30', P3: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', P4: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
const TYPE_ICONS: Record<string, string> = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', critical: '🚨', ai: '🤖', system: '⚙️', security: '🔒', operation: '🔧' };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);

  useEffect(() => { fetchNotifications(); }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch('/notifications', { credentials: 'include' });
      const data = await res.json();
      setNotifications(data.items || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleMarkRead(id: string) {
    try {
      await fetch(`/notifications/${id}/read`, { method: 'POST', credentials: 'include' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) { console.error(err); }
  }

  async function handleMarkAllRead() {
    for (const n of notifications.filter(n => !n.read)) {
      await fetch(`/notifications/${n.id}/read`, { method: 'POST', credentials: 'include' });
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  const totalCount = notifications.length;
  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => n.priority === 'P1' || n.type === 'critical').length;
  const warningCount = notifications.filter(n => n.priority === 'P2' || n.type === 'warning').length;

  const filtered = notifications.filter(n => {
    if (filter === 'unread' && n.read) return false;
    if (filter === 'read' && !n.read) return false;
    if (filter === 'critical' && n.priority !== 'P1' && n.type !== 'critical') return false;
    if (typeFilter && n.type !== typeFilter) return false;
    if (priorityFilter && n.priority !== priorityFilter) return false;
    return true;
  });

  function getTypeIcon(type: string) { return TYPE_ICONS[type] || '🔔'; }
  function getTimeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    return new Date(date).toLocaleDateString('tr-TR');
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Bildirim Merkezi</h2>
          <p className="text-sm text-slate-400">Tüm sistem olayları ve uyarılar</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">✅ Tümünü Okundu İşaretle</button>
          )}
          <button onClick={fetchNotifications} className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600">🔄</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Toplam</div>
          <div className="text-lg font-semibold text-white">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Okunmamış</div>
          <div className="text-lg font-semibold text-yellow-400">{unreadCount}</div>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">Okunmuş</div>
          <div className="text-lg font-semibold text-green-400">{totalCount - unreadCount}</div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">🔴 Kritik</div>
          <div className="text-lg font-semibold text-red-400">{criticalCount}</div>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-3 backdrop-blur-sm">
          <div className="text-xs text-slate-400">🟠 Uyarı</div>
          <div className="text-lg font-semibold text-orange-400">{warningCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-3 backdrop-blur-sm">
        {[
          { key: 'all', label: 'Tümü' }, { key: 'unread', label: 'Okunmamış' },
          { key: 'read', label: 'Okunmuş' }, { key: 'critical', label: 'Kritik' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{f.label}</button>
        ))}
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white">
          <option value="">Tüm Tipler</option>
          {Object.entries(TYPE_ICONS).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-white">
          <option value="">Tüm Öncelik</option>
          {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Notifications List */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <div className="text-4xl mb-2">🔔</div>
            <div>Bildirim bulunamadı</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filtered.map(n => (
              <div key={n.id} onClick={() => setSelectedNotif(n)}
                className={`flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-slate-700/30 ${!n.read ? 'bg-blue-900/10' : ''}`}>
                <div className="text-xl mt-0.5">{getTypeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{n.title}</span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></span>}
                    {n.priority && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${PRIORITY_COLORS[n.priority] || ''}`}>
                        {PRIORITY_LABELS[n.priority] || n.priority}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span>{getTimeAgo(n.createdAt)}</span>
                    {n.module && <span>· {n.module}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!n.read && (
                    <button onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white" title="Okundu">✅</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedNotif(null)}>
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getTypeIcon(selectedNotif.type)}</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedNotif.title}</h3>
                  {selectedNotif.priority && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border mt-1 inline-block ${PRIORITY_COLORS[selectedNotif.priority] || ''}`}>
                      {PRIORITY_LABELS[selectedNotif.priority]}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedNotif(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700">✕</button>
            </div>
            <div className="text-sm text-slate-300 mb-4">{selectedNotif.message}</div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>📅 {new Date(selectedNotif.createdAt).toLocaleString('tr-TR')}</span>
              <span>📁 {selectedNotif.module || 'Genel'}</span>
            </div>
            <div className="flex gap-2 mt-4">
              {!selectedNotif.read && (
                <button onClick={() => { handleMarkRead(selectedNotif.id); setSelectedNotif({ ...selectedNotif, read: true }); }}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">✅ Okundu İşaretle</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
