'use client';

import { useState, useEffect } from 'react';
import { History, AlertTriangle, Info, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface LogEntry {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  module: string;
  timestamp: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    // Load logs from localStorage (demo)
    const stored = localStorage.getItem('systemLogs');
    if (stored) {
      setLogs(JSON.parse(stored));
    } else {
      // Demo logs
      const demoLogs: LogEntry[] = [
        { id: '1', type: 'info', message: 'Sistem başlatıldı', module: 'System', timestamp: new Date().toISOString() },
        { id: '2', type: 'info', message: 'Veritabanı bağlantısı kuruldu', module: 'Database', timestamp: new Date().toISOString() },
        { id: '3', type: 'warning', message: 'Kritik stok uyarısı: 5 ürün', module: 'Inventory', timestamp: new Date().toISOString() },
      ];
      setLogs(demoLogs);
    }
  }, []);

  const clearLogs = () => {
    setLogs([]);
    localStorage.removeItem('systemLogs');
    toast.success('Loglar temizlendi');
  };

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-orange-50 border-orange-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light text-gray-900">Sistem Logları</h1>
          <p className="text-sm text-gray-500 mt-1">Sistem olayları ve hata kayıtları</p>
        </div>
        <button onClick={clearLogs} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
          <Trash2 className="w-4 h-4" /> Temizle
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6">
        {['all', 'info', 'warning', 'error'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm border transition-colors ${filter === f ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-black'}`}>
            {f === 'all' ? 'Tümü' : f === 'info' ? 'Bilgi' : f === 'warning' ? 'Uyarı' : 'Hata'}
          </button>
        ))}
      </div>

      {/* Log List */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="bg-white border border-gray-100 p-12 text-center">
            <History className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Kayıt bulunamadı</p>
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className={`p-4 border ${getBgColor(log.type)} flex items-start gap-3`}>
              <div className="mt-0.5">{getIcon(log.type)}</div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{log.message}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-400">{log.module}</span>
                  <span className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString('tr-TR')}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
