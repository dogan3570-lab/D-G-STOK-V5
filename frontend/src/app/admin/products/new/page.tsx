'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

interface ProductForm {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  criticalStock: string;
  isActive: boolean;
}

export default function NewProductPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProductForm, string>>>({});
  const [form, setForm] = useState<ProductForm>({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    price: '',
    stock: '0',
    criticalStock: '5',
    isActive: true,
  });

  if (!isAuthenticated || user?.role !== 'admin') {
    router.push('/auth/login');
    return null;
  }

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ProductForm, string>> = {};

    if (!form.sku.trim()) newErrors.sku = 'SKU alanı zorunludur';
    if (!form.name.trim()) newErrors.name = 'Ürün adı zorunludur';
    if (!form.price.trim()) newErrors.price = 'Fiyat zorunludur';
    else if (isNaN(Number(form.price)) || Number(form.price) <= 0)
      newErrors.price = 'Geçerli bir fiyat giriniz';
    if (!form.stock.trim()) newErrors.stock = 'Stok zorunludur';
    else if (isNaN(Number(form.stock)) || Number(form.stock) < 0)
      newErrors.stock = 'Geçerli bir stok miktarı giriniz';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await api.request('/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: form.sku.trim(),
          barcode: form.barcode.trim() || undefined,
          name: form.name.trim(),
          description: form.description.trim(),
          price: Number(form.price),
          stock: Number(form.stock),
          criticalStock: Number(form.criticalStock),
          isActive: form.isActive,
        }),
      });

      toast.success('Ürün başarıyla oluşturuldu');
      router.push('/admin/products');
      router.refresh();
    } catch (error: any) {
      toast.error('Ürün oluşturulamadı', {
        description: error.message || 'Lütfen bilgileri kontrol edin',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/products"
            className="text-gray-400 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-light text-gray-900">Yeni Ürün</h1>
            <p className="text-sm text-gray-500 mt-1">Ürün bilgilerini doldurun</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-100 p-8">
          <div className="space-y-6">
            {/* SKU */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className={`w-full px-4 py-3 border text-sm focus:outline-none focus:border-black transition-colors ${
                  errors.sku ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="STK-001"
              />
              {errors.sku && (
                <p className="text-xs text-red-500 mt-1">{errors.sku}</p>
              )}
            </div>

            {/* Barcode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Barkod
              </label>
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 text-sm focus:outline-none focus:border-black transition-colors"
                placeholder="8691234567890"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ürün Adı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`w-full px-4 py-3 border text-sm focus:outline-none focus:border-black transition-colors ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Ürün adı"
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 text-sm focus:outline-none focus:border-black transition-colors resize-none"
                placeholder="Ürün açıklaması..."
              />
            </div>

            {/* Price & Stock Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fiyat (₺) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className={`w-full px-4 py-3 border text-sm focus:outline-none focus:border-black transition-colors ${
                    errors.price ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {errors.price && (
                  <p className="text-xs text-red-500 mt-1">{errors.price}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stok <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className={`w-full px-4 py-3 border text-sm focus:outline-none focus:border-black transition-colors ${
                    errors.stock ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
                {errors.stock && (
                  <p className="text-xs text-red-500 mt-1">{errors.stock}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kritik Stok
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.criticalStock}
                  onChange={(e) => setForm({ ...form, criticalStock: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 text-sm focus:outline-none focus:border-black transition-colors"
                  placeholder="5"
                />
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 accent-black"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Ürün aktif
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-gray-100">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-3 text-sm tracking-widest uppercase hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Kaydediliyor...' : 'Ürünü Kaydet'}
            </button>
            <Link
              href="/admin/products"
              className="px-8 py-3 border border-gray-300 text-sm hover:border-black transition-colors"
            >
              İptal
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
