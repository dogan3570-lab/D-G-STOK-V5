'use client';

import { useState, useEffect } from 'react';
import { Percent, Calculator, CheckCircle2, RefreshCw, Truck, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  purchasePrice: number;
  profitRate: number;
  fixedExtra: number;
  vatRate: number;
  vatIncluded: boolean;
  freeShipping: boolean;
  shippingCost: number;
  stock: number;
  isActive: boolean;
}

export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [profitRate, setProfitRate] = useState(20);
  const [fixedExtra, setFixedExtra] = useState(0);
  const [applyToAll, setApplyToAll] = useState(true);
  const [vatRate, setVatRate] = useState(20);
  const [vatIncluded, setVatIncluded] = useState(true);
  const [freeShipping, setFreeShipping] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      const data = await api.request('/products?limit=100');
      setProducts(data?.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedIds(newSet);
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll) { setSelectedIds(new Set()); setSelectAll(false); }
    else { setSelectedIds(new Set(products.filter(p => p.isActive).map(p => p.id))); setSelectAll(true); }
  };

  const bulkAction = async (endpoint: string, body: any, action: string) => {
    setProcessing(action);
    try {
      const res = await api.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
      const result = res?.data || res;
      toast.success(`${action} uygulandi: ${result.updated || 0} urun`);
      loadProducts();
    } catch (err: any) { toast.error(err.message || 'Hata'); }
    finally { setProcessing(null); }
  };

  const getTargetIds = () => applyToAll ? [] : Array.from(selectedIds);
  const presetProfits = [10, 20, 25, 35, 50, 75, 100];
  const presetFixed = [0, 10, 25, 40, 50, 100];
  const presetVat = [1, 8, 10, 18, 20];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-light text-gray-900">Fiyatlandırma</h1>
        <p className="text-sm text-gray-500 mt-1">Toplu fiyat, KDV ve kargo yönetimi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Kar Orani */}
        <div className="bg-white border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50"><Percent className="w-5 h-5 text-blue-600" /></div>
            <h2 className="text-sm font-medium text-gray-900">Kar Oranı</h2>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {presetProfits.map(r => (
              <button key={r} onClick={() => setProfitRate(r)}
                className={`px-3 py-1.5 text-xs border transition-colors ${profitRate === r ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-black'}`}>%{r}</button>
            ))}
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Kar %</label>
            <input type="number" value={profitRate} onChange={e => setProfitRate(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Sabit Ekleme (TL)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {presetFixed.map(r => (
                <button key={r} onClick={() => setFixedExtra(r)}
                  className={`px-3 py-1.5 text-xs border transition-colors ${fixedExtra === r ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-black'}`}>+{r} TL</button>
              ))}
            </div>
            <input type="number" value={fixedExtra} onChange={e => setFixedExtra(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" id="applyAllProfit" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="w-4 h-4" />
            <label htmlFor="applyAllProfit" className="text-xs text-gray-600">Tüm ürünlere uygula</label>
          </div>
          <button onClick={() => bulkAction('/products/bulk/profit', { ids: getTargetIds(), profitRate, fixedExtra }, 'Kar')}
            disabled={processing === 'Kar'}
            className="w-full py-2.5 bg-black text-white text-sm hover:bg-gray-800 disabled:bg-gray-400 flex items-center justify-center gap-2">
            {processing === 'Kar' ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uygulanıyor...</> : <><Calculator className="w-4 h-4" /> Kar Uygula</>}
          </button>
        </div>

        {/* KDV */}
        <div className="bg-white border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50"><Tag className="w-5 h-5 text-green-600" /></div>
            <h2 className="text-sm font-medium text-gray-900">KDV Yönetimi</h2>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {presetVat.map(r => (
              <button key={r} onClick={() => setVatRate(r)}
                className={`px-3 py-1.5 text-xs border transition-colors ${vatRate === r ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-black'}`}>%{r}</button>
            ))}
          </div>
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">KDV Oranı %</label>
            <input type="number" value={vatRate} onChange={e => setVatRate(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
          </div>
          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="vatStatus" checked={vatIncluded} onChange={() => setVatIncluded(true)} className="w-4 h-4" />
              <span className="text-sm text-gray-700">KDV Dahil</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="vatStatus" checked={!vatIncluded} onChange={() => setVatIncluded(false)} className="w-4 h-4" />
              <span className="text-sm text-gray-700">KDV Hariç</span>
            </label>
          </div>
          <button onClick={() => bulkAction('/products/bulk/vat', { ids: getTargetIds(), vatRate, vatIncluded }, 'KDV')}
            disabled={processing === 'KDV'}
            className="w-full py-2.5 bg-black text-white text-sm hover:bg-gray-800 disabled:bg-gray-400 flex items-center justify-center gap-2">
            {processing === 'KDV' ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uygulanıyor...</> : <><CheckCircle2 className="w-4 h-4" /> KDV Uygula</>}
          </button>
        </div>

        {/* Kargo */}
        <div className="bg-white border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-50"><Truck className="w-5 h-5 text-orange-600" /></div>
            <h2 className="text-sm font-medium text-gray-900">Kargo Yönetimi</h2>
          </div>
          <div className="space-y-3 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="shippingStatus" checked={freeShipping} onChange={() => { setFreeShipping(true); setShippingCost(0); }} className="w-4 h-4" />
              <span className="text-sm text-gray-700">Kargo Dahil (Ücretsiz)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="shippingStatus" checked={!freeShipping} onChange={() => setFreeShipping(false)} className="w-4 h-4" />
              <span className="text-sm text-gray-700">Kargo Hariç</span>
            </label>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Sabit Kargo Ücreti (TL)</label>
            <input type="number" value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black" />
          </div>
          <button onClick={() => bulkAction('/products/bulk/shipping', { ids: getTargetIds(), freeShipping, shippingCost }, 'Kargo')}
            disabled={processing === 'Kargo'}
            className="w-full py-2.5 bg-black text-white text-sm hover:bg-gray-800 disabled:bg-gray-400 flex items-center justify-center gap-2">
            {processing === 'Kargo' ? <><RefreshCw className="w-4 h-4 animate-spin" /> Uygulanıyor...</> : <><Truck className="w-4 h-4" /> Kargo Uygula</>}
          </button>
        </div>
      </div>

      {/* Product List */}
      <div className="bg-white border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Ürünler ({products.length})</h3>
          <div className="flex items-center gap-3">
            <button onClick={toggleSelectAll} className="text-xs text-gray-500 hover:text-black">
              {selectAll ? 'Seçimi Kaldır' : 'Tümünü Seç'}
            </button>
            <span className="text-xs text-gray-400">{selectedIds.size} seçili</span>
          </div>
        </div>
        {loading ? (
          <div className="p-12 text-center"><div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto" /></div>
        ) : (
          <div className="overflow-auto max-h-96">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-3 text-left"><span className="text-xs text-gray-500">#</span></th>
                  <th className="p-3 text-left"><span className="text-xs text-gray-500">Ürün</span></th>
                  <th className="p-3 text-right"><span className="text-xs text-gray-500">Alış</span></th>
                  <th className="p-3 text-right"><span className="text-xs text-gray-500">Satış</span></th>
                  <th className="p-3 text-right"><span className="text-xs text-gray-500">Kar %</span></th>
                  <th className="p-3 text-center"><span className="text-xs text-gray-500">KDV</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${selectedIds.has(p.id) ? 'bg-blue-50' : ''}`}>
                    <td className="p-3"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="w-4 h-4" /></td>
                    <td className="p-3"><p className="text-sm text-gray-900">{p.name}</p><p className="text-xs text-gray-400">{p.sku}</p></td>
                    <td className="p-3 text-right text-sm text-gray-600">₺{Number(p.purchasePrice).toFixed(2)}</td>
                    <td className="p-3 text-right text-sm text-gray-900">₺{Number(p.price).toFixed(2)}</td>
                    <td className="p-3 text-right"><span className="text-sm text-green-600">%{Number(p.profitRate).toFixed(0)}</span></td>
                    <td className="p-3 text-center text-sm text-gray-600">%{Number(p.vatRate).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
