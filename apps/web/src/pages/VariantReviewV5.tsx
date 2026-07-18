// ==================== VARYANT İNCELEME V5.0 ====================
// DG STOK V5.0 - Sadece gerçek istisnalar gösterilir
// ================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/ui/Toast';

interface V5Product {
  id: string;
  title: string | null;
  xmlKey: string;
  sku: string | null;
  barcode: string | null;
  variantStatus: string;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string } | null;
}

export default function VariantReviewV5() {
  const [products, setProducts] = useState<V5Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      // Sadece MANUAL_REVIEW statüsündeki ürünleri getir
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        variantStatus: 'MANUAL_REVIEW',
      });
      const r = await apiFetch<any>(`/products?${params}`);
      if (r.ok && r.data) {
        setProducts(r.data.items || []);
        setTotal(r.data.pagination?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchProblems(); }, [fetchProblems]);

  const handleApprove = async (id: string) => {
    const r = await apiFetch<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ variantStatus: 'AUTO_APPROVED' }),
    });
    if (r.ok) {
      showToast('success', '✅ Ürün onaylandı');
      fetchProblems();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Varyant İnceleme V5</h2>
          <p className="text-sm text-slate-400">
            Sadece AI'nın çözemediği gerçek istisnalar gösterilir
          </p>
        </div>
        <span className="text-sm text-slate-400">{total} ürün</span>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Yükleniyor...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-sm font-medium text-slate-400">
              İncelenecek ürün bulunamadı
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Tüm ürünler V5 motoru tarafından otomatik karara bağlandı
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">Ürün</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">XML</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">Kategori</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">Durum</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-slate-700/20">
                  <td className="px-3 py-2.5">
                    <div className="text-sm font-medium text-white">{p.title || p.xmlKey}</div>
                    <div className="text-xs text-slate-500">{p.sku || p.xmlKey}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{p.xmlSource?.name || '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{p.category?.name || '-'}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full bg-yellow-500/10 text-yellow-400 px-2 py-0.5 text-xs font-medium">
                      ⏳ MANUAL_REVIEW
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => handleApprove(p.id)}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      ✅ Onayla
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-slate-500">Sayfa {page}/{Math.ceil(total / pageSize)}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="rounded px-3 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">◀</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}
              className="rounded px-3 py-1 text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30">▶</button>
          </div>
        </div>
      )}
    </div>
  );
}
