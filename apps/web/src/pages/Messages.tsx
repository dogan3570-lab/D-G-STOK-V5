import React, { useEffect, useState } from 'react';

interface MessageItem {
  id: string; channel: string; customerName: string;
  subject: string; message: string; status: string;
  aiSuggestion: string | null; createdAt: string;
}

export default function Messages() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { fetchMessages(); }, [statusFilter]);

  async function fetchMessages() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const response = await fetch(`/messages?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setMessages(Array.isArray(data.items) ? data.items : []);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      setError(error.message || 'Mesajlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(id: string, status: string) {
    try {
      await fetch(`/messages/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status }),
      });
      fetchMessages();
    } catch (err) { console.error(err); }
  }

  const statusColors: Record<string, string> = {
    unread: 'bg-blue-500/10 text-blue-400', read: 'bg-slate-500/10 text-slate-400',
    replied: 'bg-green-500/10 text-green-400', spam: 'bg-red-500/10 text-red-400',
  };

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Mesajlar</h2>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 backdrop-blur-sm">
          <div className="text-center text-slate-400">
            <div className="text-4xl mb-2">💬</div>
            <div className="text-sm">Mesaj yüklenemedi: {error}</div>
            <button onClick={fetchMessages} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">🔄 Tekrar Dene</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Mesajlar</h2>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white">
          <option value="">Tümü</option>
          <option value="unread">Okunmamış</option>
          <option value="read">Okunmuş</option>
          <option value="replied">Yanıtlanmış</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Yükleniyor...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <div className="text-4xl mb-2">💬</div>
            <div className="text-sm">Mesaj bulunamadı</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {messages.map(m => (
              <div key={m.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${m.status === 'unread' ? 'bg-blue-400' : 'bg-transparent'}`}></span>
                      <span className="text-sm font-medium text-white">{m.subject}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[m.status] || 'bg-slate-500/10 text-slate-400'}`}>{m.status}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{m.customerName} · {m.channel}</div>
                    <div className="text-sm text-slate-300 mt-1 line-clamp-2">{m.message}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => handleUpdateStatus(m.id, 'read')} className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600">📖 Okundu</button>
                      <button onClick={() => handleUpdateStatus(m.id, 'replied')} className="rounded bg-green-700 px-2 py-1 text-xs text-white hover:bg-green-600">✉️ Yanıtla</button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 shrink-0 ml-3">{new Date(m.createdAt).toLocaleDateString('tr-TR')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
