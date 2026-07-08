import React, { useEffect, useState } from 'react';

interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  actorUser: { email: string; name: string | null } | null;
  createdAt: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { fetchLogs(); }, [page]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const response = await fetch(`/audit-logs?page=${page}&limit=20`, { credentials: 'include' });
      const data = await response.json();
      setLogs(data.items || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  const actionColors: Record<string, string> = {
    CREATE: 'text-green-400',
    UPDATE: 'text-blue-400',
    DELETE: 'text-red-400',
    LOGIN: 'text-purple-400',
    SYNC: 'text-yellow-400',
    IMPORT: 'text-cyan-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Denetim Kayıtları</h2>
          <p className="text-sm text-slate-400">Sistem hareketleri ve kullanıcı aktiviteleri</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-slate-400">Yükleniyor...</div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="text-4xl mb-2">📝</div>
            <div>Denetim kaydı bulunamadı</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${actionColors[log.action] || 'text-slate-300'}`}>
                        {log.action}
                      </span>
                      <span className="text-sm text-slate-300">{log.entity}</span>
                      {log.entityId && (
                        <span className="text-xs text-slate-500">#{log.entityId.substring(0, 8)}</span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-sm text-slate-400 mt-1">{log.details}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {log.actorUser && (
                        <span className="text-xs text-slate-500">{log.actorUser.email}</span>
                      )}
                      <span className="text-xs text-slate-500">
                        {new Date(log.createdAt).toLocaleString('tr-TR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            ← Önceki
          </button>
          <span className="text-sm text-slate-400">
            Sayfa {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Sonraki →
          </button>
        </div>
      )}
    </div>
  );
}
