'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Download, Calendar, Filter } from 'lucide-react';

interface ReportData {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  topProducts: { name: string; sales: number; revenue: number }[];
  ordersByStatus: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [reportType, setReportType] = useState('overview');

  useEffect(() => {
    fetchReportData();
  }, [dateRange, reportType]);

  const fetchReportData = async () => {
    try {
      const params = new URLSearchParams({ days: dateRange, type: reportType });
      const res = await fetch(`/api/admin/reports?${params}`);
      const result = await res.json();
      setData(result.data);
    } catch (error) {
      console.error('Rapor verileri yuklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: string) => {
    try {
      const res = await fetch(`/api/admin/reports/export?format=${format}&days=${dateRange}&type=${reportType}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapor-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
      }
    } catch (error) {
      console.error('Rapor export edilirken hata:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light text-gray-900">Raporlar</h1>
          <p className="text-sm text-gray-500 mt-1">Detayli rapor ve analizler</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="7">Son 7 Gun</option>
            <option value="30">Son 30 Gun</option>
            <option value="90">Son 3 Ay</option>
            <option value="365">Son 1 Yil</option>
          </select>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="overview">Genel Bakis</option>
            <option value="sales">Satis Raporu</option>
            <option value="inventory">Stok Raporu</option>
            <option value="finance">Finans Raporu</option>
          </select>
          <div className="flex gap-2">
            <button onClick={() => handleExport('csv')} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={() => handleExport('xlsx')} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <Download className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Yukleniyor...</div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-100 p-5">
              <p className="text-xs text-gray-400 mb-1">Toplam Urun</p>
              <p className="text-2xl font-light text-gray-900">{data.totalProducts}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-5">
              <p className="text-xs text-gray-400 mb-1">Toplam Siparis</p>
              <p className="text-2xl font-light text-gray-900">{data.totalOrders}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-5">
              <p className="text-xs text-gray-400 mb-1">Toplam Gelir</p>
              <p className="text-2xl font-light text-green-600">{data.totalRevenue.toFixed(2)} TL</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-5">
              <p className="text-xs text-gray-400 mb-1">Toplam Kar</p>
              <p className="text-2xl font-light text-blue-600">{data.totalProfit.toFixed(2)} TL</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white rounded-lg border border-gray-100 p-5">
              <h3 className="text-sm font-medium text-gray-900 mb-4">En Cok Satan Urunler</h3>
              <div className="space-y-3">
                {data.topProducts?.map((product, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                      <span className="text-sm text-gray-700">{product.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{product.sales} adet</span>
                      <span className="text-xs text-gray-400 ml-2">{product.revenue.toFixed(2)} TL</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Orders by Status */}
            <div className="bg-white rounded-lg border border-gray-100 p-5">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Siparis Durum Dagilimi</h3>
              <div className="space-y-3">
                {data.ordersByStatus && Object.entries(data.ordersByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{status}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-black rounded-full"
                          style={{ width: `${(count / Math.max(...Object.values(data.ordersByStatus))) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-10 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue by Month */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-100 p-5">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Aylik Gelir</h3>
              <div className="flex items-end gap-2 h-40">
                {data.revenueByMonth?.map((item, i) => {
                  const maxRevenue = Math.max(...data.revenueByMonth.map(r => r.revenue));
                  const height = (item.revenue / maxRevenue) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{item.revenue.toFixed(0)}</span>
                      <div
                        className="w-full bg-black rounded-t"
                        style={{ height: `${height}%`, minHeight: '4px' }}
                      />
                      <span className="text-xs text-gray-400">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">Rapor verisi bulunamadi</div>
      )}
    </div>
  );
}
