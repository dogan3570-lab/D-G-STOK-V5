import React, { useEffect, useState } from 'react';

interface MessageItem {
  id: string;
  channel: string;
  customerName: string;
  subject: string;
  message: string;
  status: string;
  aiSuggestion: string | null;
  createdAt: string;
}

export default function Messages() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { fetchMessages(); }, [statusFilter]);

  async function fetchMessages() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const response = await fetch(`/messages?${params}`, { credentials: 'include' });
      const data = await response.json();
      setMessages(data.items || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400',
    replied: 'bg-green-500/10 text-green-400',
    pending: 'bg-yellow-500/10 text-yellow-400',
    closed: 'bg-slate-500/10 text-slate-400',
  };

  const statusLabels: Record<string, string> = {
    new: 'Yeni',
    replied: 'Yanıtlandı',
    pending: 'Beklemede',
    closed: 'Kapalı',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Mesajlar</h2>
          <p className="text-sm text-slate-400">Pazaryeri mesajları ve müşteri iletişimi</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'new', 'replied', 'pending', 'closed'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}>
            {s ? statusLabels[s] || s : 'Tümü'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">💬</div>
            <div>Mesaj bulunamadı</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {messages.map((msg) => (
              <div key={msg.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-white truncate">{msg.subject}</h4>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[msg.status] || 'bg-slate-500/10 text-slate-400'}`}>
                        {statusLabels[msg.status] || msg.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{msg.customerName} - {msg.channel}</p>
                    <p className="text-sm text-slate-300 mt-2 line-clamp-2">{msg.message}</p>
                    {msg.aiSuggestion && (
                      <div className="mt-2 rounded-lg bg-blue-500/10 p-2 text-xs text-blue-400">
                        🤖 AI Önerisi: {msg.aiSuggestion}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 ml-4 whitespace-nowrap">
                    {new Date(msg.createdAt).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
