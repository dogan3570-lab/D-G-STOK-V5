'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, ClipboardList, User, Globe, Monitor } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [page, entityFilter, actionFilter]);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      if (entityFilter) params.set('entity', entityFilter);
      if (actionFilter) params.set('action', actionFilter);
      
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.data || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Denetim loglari yuklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-50 text-green-700';
      case 'UPDATE': return 'bg-blue-50 text-blue-700';
      case 'DELETE': return 'bg-red-50 text-red-700';
      case 'LOGIN': return 'bg-purple-50 text-purple-700';
      case 'LOGOUT': return 'bg-gray-50 text-gray-600';
      case 'EXPORT': return 'bg-yellow-50 text-yellow-700';
      case 'IMPORT': return 'bg-indigo-50 text-indigo-700';
      default: return 'bg-gray-50 text-gray-400';
    }
  };

  const filteredLogs = logs.filter(log =>
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.entity.toLowerCase().includes(search.toLowerCase()) ||
    (log.userName && log.userName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light text-gray-900">Denetim Loglari</h1>
          <p className="text-sm text-gray-500 mt-1">Sistem hareket kayitlari</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Log ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">Tum Varliklar</option>
          <option value="product">Urun</option>
          <option value="order">Siparis</option>
          <option value="user">Kullanici</option>
          <option value="category">Kategori</option>
          <option value="brand">Marka</option>
          <option value="variant">Varyant</option>
          <option value="marketplace">Pazaryeri</option>
          <option value="setting">Ayar</option>
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">Tum Islemler</option>
          <option value="CREATE">Olusturma</option>
          <option value="UPDATE">Guncelleme</option>
          <option value="DELETE">Silme</option>
          <option value="LOGIN">Giris</option>
          <option value="LOGOUT">Cikis</option>
          <option value="EXPORT">Disari Aktar</option>
          <option value="IMPORT">Iceri Aktar</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Yukleniyor...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ClipboardList className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{log.entity}</span>
                          {log.entityId && (
                            <span className="text-xs text-gray-400">#{log.entityId}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {log.userName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {log.userName}
                            </span>
                          )}
                          {log.ipAddress && (
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {log.ipAddress}
                            </span>
                          )}
                          <span>{new Date(log.createdAt).toLocaleString('tr-TR')}</span>
                        </div>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Detaylar</summary>
                            <pre className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-gray-400">Log kaydi bulunamadi</div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Onceki
              </button>
              <span className="text-sm text-gray-500">
                Sayfa {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Sonraki
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
