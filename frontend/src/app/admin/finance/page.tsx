'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface FinanceRecord {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  paymentMethod?: string;
  transactionDate: string;
  createdAt: string;
}

interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  totalTransactions: number;
  byCategory: Record<string, { income: number; expense: number }>;
}

export default function FinancePage() {
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'expense', category: 'other', amount: 0,
    description: '', paymentMethod: '', transactionDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, [typeFilter]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      const [recordsRes, summaryRes] = await Promise.all([
        fetch(`/api/admin/finance?${params}`),
        fetch('/api/admin/finance/summary')
      ]);
      const recordsData = await recordsRes.json();
      const summaryData = await summaryRes.json();
      setRecords(recordsData.data || []);
      setSummary(summaryData);
    } catch (error) {
      console.error('Finans verileri yuklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ type: 'expense', category: 'other', amount: 0, description: '', paymentMethod: '', transactionDate: new Date().toISOString().split('T')[0] });
        fetchData();
      }
    } catch (error) {
      console.error('Finans kaydi eklenirken hata:', error);
    }
  };

  const filteredRecords = records.filter(r =>
    r.description.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light text-gray-900">Finans</h1>
          <p className="text-sm text-gray-500 mt-1">Finansal takip ve yonetim</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Yeni Kayit
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Toplam Gelir</p>
                <p className="text-lg font-medium text-green-600">{summary.totalIncome.toFixed(2)} TL</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Toplam Gider</p>
                <p className="text-lg font-medium text-red-600">{summary.totalExpense.toFixed(2)} TL</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Net Bakiye</p>
                <p className={`text-lg font-medium ${summary.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.netBalance.toFixed(2)} TL
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Toplam Islem</p>
                <p className="text-lg font-medium text-gray-900">{summary.totalTransactions}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Finans kaydi ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        <div className="flex gap-2">
          {['', 'income', 'expense'].map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 text-xs rounded-lg border ${
                typeFilter === type ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {type === '' ? 'Tumu' : type === 'income' ? 'Gelir' : 'Gider'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Yukleniyor...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Aciklama</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Kategori</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase">Tutar</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Odeme</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {record.type === 'income' ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm text-gray-900">{record.description}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{record.category}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    record.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {record.type === 'income' ? '+' : '-'}{record.amount.toFixed(2)} TL
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{record.paymentMethod || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(record.transactionDate || record.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecords.length === 0 && (
            <div className="text-center py-12 text-gray-400">Finans kaydi bulunamadi</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-medium mb-4">Yeni Finans Kaydi</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tur</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="income">Gelir</option>
                    <option value="expense">Gider</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="sales">Satis</option>
                    <option value="purchase">Alis</option>
                    <option value="shipping">Kargo</option>
                    <option value="commission">Komisyon</option>
                    <option value="tax">Vergi</option>
                    <option value="salary">Maas</option>
                    <option value="rent">Kira</option>
                    <option value="utility">Fatura</option>
                    <option value="other">Diger</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tutar</label>
                <input type="number" step="0.01" required value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aciklama</label>
                <input type="text" required value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Odeme Yontemi</label>
                  <select value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Seciniz</option>
                    <option value="credit_card">Kredi Karti</option>
                    <option value="transfer">Havale/EFT</option>
                    <option value="cash">Nakit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                  <input type="date" value={formData.transactionDate}
                    onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Iptal</button>
                <button type="submit" className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
