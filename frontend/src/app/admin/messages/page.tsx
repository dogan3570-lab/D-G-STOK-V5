'use client';

import { useState, useEffect } from 'react';
import { Search, Mail, MailOpen, Reply, Trash2, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  subject: string;
  content: string;
  senderName: string;
  senderEmail: string;
  status: string;
  reply?: string;
  createdAt: string;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchMessages();
  }, [statusFilter]);

  const fetchMessages = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/messages?${params}`);
      const data = await res.json();
      setMessages(data.data || []);
    } catch (error) {
      console.error('Mesajlar yuklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/messages/${id}/reply`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText }),
      });
      if (res.ok) {
        setReplyText('');
        setSelectedMessage(null);
        fetchMessages();
      }
    } catch (error) {
      console.error('Yanit gonderilirken hata:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu mesaji silmek istediginize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedMessage(null);
        fetchMessages();
      }
    } catch (error) {
      console.error('Mesaj silinirken hata:', error);
    }
  };

  const filteredMessages = messages.filter(m =>
    m.subject.toLowerCase().includes(search.toLowerCase()) ||
    m.senderName.toLowerCase().includes(search.toLowerCase()) ||
    m.senderEmail.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread': return 'bg-blue-50 text-blue-700';
      case 'read': return 'bg-gray-50 text-gray-600';
      case 'replied': return 'bg-green-50 text-green-700';
      case 'archived': return 'bg-yellow-50 text-yellow-700';
      default: return 'bg-gray-50 text-gray-400';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light text-gray-900">Mesajlar</h1>
          <p className="text-sm text-gray-500 mt-1">Musteri mesajlari</p>
        </div>
        <div className="flex gap-2">
          {['', 'unread', 'read', 'replied'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs rounded-lg border ${
                statusFilter === status ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {status === '' ? 'Tumu' : status === 'unread' ? 'Okunmamis' : status === 'read' ? 'Okundu' : 'Yanitlanmis'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Mesaj ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-lg border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Yukleniyor...</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredMessages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    selectedMessage?.id === msg.id ? 'bg-gray-50' : ''
                  } ${msg.status === 'unread' ? 'border-l-2 border-black' : ''}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{msg.senderName}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.createdAt).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1 truncate">{msg.subject}</p>
                  <p className="text-xs text-gray-400 truncate">{msg.content}</p>
                  <span className={`inline-flex px-2 py-0.5 text-xs rounded-full mt-2 ${getStatusColor(msg.status)}`}>
                    {msg.status}
                  </span>
                </button>
              ))}
              {filteredMessages.length === 0 && (
                <div className="text-center py-12 text-gray-400">Mesaj bulunamadi</div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-100 p-6">
          {selectedMessage ? (
            <div>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">{selectedMessage.subject}</h2>
                  <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                    <span>{selectedMessage.senderName}</span>
                    <span>{selectedMessage.senderEmail}</span>
                    <span>{new Date(selectedMessage.createdAt).toLocaleString('tr-TR')}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(selectedMessage.id)} className="p-2 text-gray-400 hover:text-red-600 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMessage.content}</p>
              </div>

              {selectedMessage.reply && (
                <div className="bg-green-50 rounded-lg p-4 mb-6">
                  <p className="text-xs text-green-600 font-medium mb-2">Yanitiniz:</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMessage.reply}</p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Yanit Yaz</label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="Mesajiniza yanit yazin..."
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => handleReply(selectedMessage.id)}
                    disabled={!replyText.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Reply className="w-4 h-4" />
                    Yanit Gonder
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Detayini gormek icin bir mesaj secin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
