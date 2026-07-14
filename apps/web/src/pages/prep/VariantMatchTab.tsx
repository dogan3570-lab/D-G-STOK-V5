// ==================== VARYANT DOĞRULAMA MOTORU V2 ====================
// Varyant Motoru V2 analiz sonuçlarını gösteren ana tab
// KPI → Grid → Drawer akışı ile çalışır
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';

// ==================== TYPES ====================

interface V2Stats {
  totalProducts: number;
  xmlVariant: number;      // AUTO_ACCEPTED
  autoCreated: number;     // AUTO_SUGGEST + MANUAL_REVIEW
  autoSuggest: number;     // AUTO_SUGGEST (AI önerisi)
  manualReview: number;    // MANUAL_REVIEW (manuel inceleme)
  errors: number;          // ERROR (kullanıcı düzeltmesi gereken)
}

interface XmlSource {
  id: string;
  name: string;
  active?: boolean;
}

interface VariantAnalysisItem {
  productId: string;
  confidence: number;
  source: 'XML_PARENT' | 'AI_MATCH' | 'AUTO_CREATED' | 'MANUAL';
  status: 'AUTO_ACCEPTED' | 'AUTO_SUGGEST' | 'MANUAL_REVIEW' | 'ERROR';
  reason: string | null;
  parentSku: string | null;
  groupId: string | null;
  xmlHasParent: boolean;
  checks: Record<string, boolean>;
  errors: string[];
  warnings: string[];
}

interface ProductDetail {
  id: string;
  title: string | null;
  xmlKey: string;
  sku: string | null;
  barcode: string | null;
  brand?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string } | null;
  variants: Array<{ id: string; name: string; value: string }>;
  stock: number;
  salePrice: number | null;
  purchasePrice: number | null;
  images: string | null;
}

interface ProblemRow {
  analysis: VariantAnalysisItem;
  product?: ProductDetail;
}

// Kullanıcının müdahale edebileceği hatalı ürünler (sadece ERROR)
const PROBLEM_STATUSES = ['ERROR'] as const;
const PAGE_SIZE = 50;

// ==================== COMPONENT ====================

export default function VariantMatchTab() {
  const [stats, setStats] = useState<V2Stats | null>(null);
  const [rows, setRows] = useState<ProblemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [xmlSources, setXmlSources] = useState<XmlSource[]>([]);
  const [selectedXmlId, setSelectedXmlId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [thresholds, setThresholds] = useState<Record<string, number>>({
    auto_accept: 95,
    needs_review: 80,
    manual: 0,
  });

  // ---- DATA FETCHING ----

  const fetchStats = useCallback(async () => {
    const params = selectedXmlId ? `?xmlSourceId=${selectedXmlId}` : '';
    const res = await apiFetch<{ stats: V2Stats }>(`/variants/v2/stats${params}`);
    if (res.ok && res.data) setStats(res.data.stats);
  }, [selectedXmlId]);

  const fetchXmlSources = useCallback(async () => {
    const res = await apiFetch<{ items: XmlSource[] }>('/xml-sources');
    if (res.ok && res.data) setXmlSources(res.data.items || []);
  }, []);

  const fetchThresholds = useCallback(async () => {
    const res = await apiFetch<{ items: Record<string, number> }>('/variants/v2/thresholds');
    if (res.ok && res.data) setThresholds(res.data.items);
  }, []);

  // Sorunlu ürünleri getir (3 status ayrı ayrı çekilir)
  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      // Her status için ayrı çağrı
      const promises = PROBLEM_STATUSES.map(status => {
        const params = new URLSearchParams({
          status,
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (selectedXmlId) params.append('xmlSourceId', selectedXmlId);
        return apiFetch<{ items: VariantAnalysisItem[]; total: number }>(
          `/variants/v2/problems?${params}`
        );
      });

      const results = await Promise.all(promises);
      const allItems: VariantAnalysisItem[] = [];
      let grandTotal = 0;

      for (const res of results) {
        if (res.ok && res.data) {
          allItems.push(...(res.data.items || []));
          grandTotal += res.data.total || 0;
        }
      }

      // Ürün detaylarını da çek (varsa XML kaynağı seçiliyse)
      let productMap = new Map<string, ProductDetail>();
      if (selectedXmlId && allItems.length > 0) {
        const prodRes = await apiFetch<{ items: ProductDetail[] }>(
          `/xml-sources/${selectedXmlId}/products?limit=200`
        );
        if (prodRes.ok && prodRes.data) {
          for (const p of prodRes.data.items || []) {
            productMap.set(p.id, p);
          }
        }
      }

      // Row'ları oluştur
      const problemRows: ProblemRow[] = allItems.map(item => ({
        analysis: item,
        product: productMap.get(item.productId),
      }));

      setRows(problemRows);
      setTotal(grandTotal);
    } finally {
      setLoading(false);
    }
  }, [selectedXmlId, page]);

  // İlk yükleme
  useEffect(() => {
    fetchXmlSources();
    fetchThresholds();
  }, []);

  // XML kaynağı veya sayfa değişince verileri tazele
  useEffect(() => {
    fetchStats();
    fetchProblems();
  }, [fetchStats, fetchProblems]);

  // ---- ACTIONS ----

  const handleScan = async () => {
    if (!selectedXmlId) {
      showToast('warning', 'Lütfen bir XML kaynağı seçin');
      return;
    }
    setScanning(true);
    try {
      showToast('info', '🔍 Varyantlar taranıyor...');
      const res = await apiFetch<{ stats: V2Stats }>(
        `/variants/v2/scan/${selectedXmlId}`,
        { method: 'POST' }
      );
      if (res.ok) {
        const s = res.data?.stats;
        const accepted = s?.xmlVariant || 0;
        const autoSuggest = s?.autoSuggest || 0;
        const manualReview = s?.manualReview || 0;
        const errors = s?.errors || 0;
        showToast(
          'success',
          `✅ Tarama tamamlandı! ${accepted} kabul, ${autoSuggest} öneri, ${manualReview} inceleme, ${errors} hata`
        );
        fetchStats();
        fetchProblems();
      } else {
        showToast('error', res.error?.message || 'Tarama başarısız');
      }
    } finally {
      setScanning(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      prev.size === rows.length
        ? new Set()
        : new Set(rows.map(r => r.analysis.productId))
    );
  };

  // ---- HELPERS ----

  const getConfidenceColor = (score: number): string => {
    if (score >= (thresholds.auto_accept || 95)) return 'text-green-400';
    if (score >= (thresholds.needs_review || 80)) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceBg = (score: number): string => {
    if (score >= (thresholds.auto_accept || 95)) return 'bg-green-500/10';
    if (score >= (thresholds.needs_review || 80)) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  const getStatusBadge = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'AUTO_ACCEPTED':
        return { label: 'Otomatik Kabul', color: 'text-green-400 bg-green-500/10 border-green-500/30' };
      case 'AUTO_SUGGEST':
        return { label: 'AI Önerisi', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
      case 'MANUAL_REVIEW':
        return { label: 'İnceleme Gerek', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };
      case 'ERROR':
        return { label: 'Hatalı', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
      default:
        return { label: status, color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' };
    }
  };

  const getSourceLabel = (source: string): string => {
    switch (source) {
      case 'XML_PARENT': return 'XML Parent';
      case 'AI_MATCH': return 'AI Eşleştirme';
      case 'AUTO_CREATED': return 'DG Oluşturma';
      case 'MANUAL': return 'Manuel';
      default: return source;
    }
  };

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return rows.find(r => r.analysis.productId === selectedProductId) || null;
  }, [selectedProductId, rows]);

  // ---- RENDER ----

  return (
    <div className="space-y-4">
      {/* ===== KPI KARTLARI ===== */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            title="📦 XML'den Gelen"
            value={(stats.xmlVariant ?? 0).toLocaleString('tr-TR')}
            sub="AUTO_ACCEPTED"
            color="blue"
          />
          <KpiCard
            title="🤖 AI Önerisi"
            value={(stats.autoSuggest ?? 0).toLocaleString('tr-TR')}
            sub="AUTO_SUGGEST"
            color="purple"
          />
          <KpiCard
            title="🔍 Manuel İnceleme"
            value={(stats.manualReview ?? 0).toLocaleString('tr-TR')}
            sub="MANUAL_REVIEW"
            color="yellow"
          />
          <KpiCard
            title="❌ Hatalı (Müdahale Gerek)"
            value={(stats.errors ?? 0).toLocaleString('tr-TR')}
            sub="ERROR"
            color="red"
          />
        </div>
      )}

      {/* ===== ÜST PANEL ===== */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3 flex-wrap">
          {/* XML Kaynağı Seçici */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">XML Kaynağı:</span>
            <select
              value={selectedXmlId}
              onChange={e => {
                setSelectedXmlId(e.target.value);
                setPage(1);
                setSelectedProductId(null);
              }}
              className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs text-white min-w-[180px]"
            >
              <option value="">Tüm XML Kaynakları</option>
              {xmlSources.map(x => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          {/* İstatistik özeti */}
          {stats && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-blue-400">📦 {stats.xmlVariant}</span>
              <span className="text-slate-600">|</span>
              <span className="text-purple-400">🤖 {stats.autoSuggest}</span>
              <span className="text-slate-600">|</span>
              <span className="text-yellow-400">🔍 {stats.manualReview}</span>
              <span className="text-slate-600">|</span>
              <span className="text-red-400">❌ {stats.errors}</span>
            </div>
          )}
        </div>

        {/* Tara Butonu */}
        <button
          onClick={handleScan}
          disabled={scanning || !selectedXmlId}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          {scanning ? (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Taranıyor...
            </>
          ) : (
            <>
              <span>🔄</span>
              Varyantları Tara
            </>
          )}
        </button>
      </div>

      {/* ===== ANA İÇERİK (Grid + Drawer) ===== */}
      <div className="flex gap-4">
        {/* Grid Bölümü */}
        <div
          className={`flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden ${
            selectedProductId ? 'hidden xl:block' : ''
          }`}
        >
          <div className="px-4 py-2.5 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>🔍</span>
              Varyant Doğrulama Sonuçları
              <span className="text-xs font-normal text-slate-400">
                ({total} ürün)
              </span>
            </h3>
            {total > PAGE_SIZE && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40"
                >
                  ◀
                </button>
                <span className="text-slate-400 px-2">
                  {page} / {Math.ceil(total / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / PAGE_SIZE)}
                  className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40"
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-700/80 sticky top-0 z-10">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === rows.length && rows.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-500 bg-slate-700 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <TH>Ürün</TH>
                  <TH>XML Kaynağı</TH>
                  <TH>Marka</TH>
                  <TH>Kategori</TH>
                  <TH>Renk / No / Beden</TH>
                  <TH>Güven Skoru</TH>
                  <TH>Sebep</TH>
                  <TH>Durum</TH>
                  <TH style={{ width: 40 }}></TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                        Yükleniyor...
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-500">
                      <div className="text-4xl mb-2">✅</div>
                      <div className="text-sm font-medium text-slate-400">
                        Sorunlu ürün bulunamadı
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Tüm varyantlar başarıyla analiz edildi
                      </p>
                    </td>
                  </tr>
                ) : (
                  rows.map(row => {
                    const a = row.analysis;
                    const p = row.product;
                    const badge = getStatusBadge(a.status);
                    return (
                      <tr
                        key={a.productId}
                        className={`hover:bg-slate-700/20 border-b border-slate-700/30 cursor-pointer ${
                          selectedProductId === a.productId ? 'bg-slate-700/30' : ''
                        }`}
                        onClick={() => setSelectedProductId(a.productId)}
                      >
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(a.productId)}
                            onChange={() => toggleSelect(a.productId)}
                            className="rounded border-slate-500 bg-slate-700 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-white truncate max-w-[200px]" title={p?.title || a.productId}>
                              {p?.title || a.productId}
                            </span>
                            {p?.sku && (
                              <code className="text-[10px] font-mono text-cyan-300 mt-0.5">
                                SKU: {p.sku}
                              </code>
                            )}
                            <code className="text-[10px] font-mono text-slate-500">
                              {p?.xmlKey || a.productId}
                            </code>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-slate-300">
                            {p?.xmlSource?.name || (
                              <span className="text-slate-500">-</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-slate-300">
                            {p?.brand?.name || (
                              <span className="text-slate-500">-</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-slate-300">
                            {p?.category?.name || (
                              <span className="text-slate-500">-</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            {p?.variants && p.variants.length > 0 ? (
                              p.variants.map(v => (
                                <span key={v.id} className="text-[10px] text-slate-300">
                                  <span className="text-slate-500">{v.name}:</span>{' '}
                                  {v.value}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-500">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                a.confidence >= (thresholds.auto_accept || 95)
                                  ? 'bg-green-400'
                                  : a.confidence >= (thresholds.needs_review || 80)
                                  ? 'bg-yellow-400'
                                  : 'bg-red-400'
                              }`}
                            />
                            <span
                              className={`text-xs font-bold ${getConfidenceColor(a.confidence)}`}
                            >
                              %{a.confidence}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-16 h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                a.confidence >= (thresholds.auto_accept || 95)
                                  ? 'bg-green-400'
                                  : a.confidence >= (thresholds.needs_review || 80)
                                  ? 'bg-yellow-400'
                                  : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.max(2, a.confidence)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[11px] text-slate-400 max-w-[150px] inline-block truncate" title={a.reason || ''}>
                            {a.reason || (
                              <span className="text-slate-600">-</span>
                            )}
                          </span>
                          {a.errors.length > 0 && (
                            <div className="text-[10px] text-red-400 mt-0.5">
                              ⚠️ {a.errors.length} hata
                            </div>
                          )}
                          {a.warnings.length > 0 && a.errors.length === 0 && (
                            <div className="text-[10px] text-yellow-400 mt-0.5">
                              ⚠️ {a.warnings.length} uyarı
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedProductId(
                                selectedProductId === a.productId ? null : a.productId
                              );
                            }}
                            className="text-slate-500 hover:text-white transition-colors"
                          >
                            {selectedProductId === a.productId ? '▶' : '◀'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== SAĞ PANEL (DRAWER) ===== */}
        {selectedProduct && (
          <div className="w-full xl:w-[420px] shrink-0 rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>📋</span>
                Ürün Detayı
              </h3>
              <button
                onClick={() => setSelectedProductId(null)}
                className="text-slate-400 hover:text-white text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Genel Bilgiler */}
              <Section title="📄 Genel Bilgiler">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Info label="Ürün ID" value={selectedProduct.analysis.productId} />
                  <Info
                    label="Ürün Adı"
                    value={selectedProduct.product?.title || '-'}
                  />
                  <Info
                    label="XML Key"
                    value={selectedProduct.product?.xmlKey || '-'}
                    mono
                  />
                  <Info
                    label="SKU"
                    value={selectedProduct.product?.sku || '-'}
                    mono
                  />
                  <Info
                    label="Barkod"
                    value={selectedProduct.product?.barcode || '-'}
                    mono
                  />
                  <Info
                    label="Stok"
                    value={String(selectedProduct.product?.stock ?? '-')}
                  />
                  <Info
                    label="Marka"
                    value={selectedProduct.product?.brand?.name || '-'}
                  />
                  <Info
                    label="Kategori"
                    value={selectedProduct.product?.category?.name || '-'}
                  />
                  <Info
                    label="XML Kaynağı"
                    value={selectedProduct.product?.xmlSource?.name || '-'}
                  />
                  <Info
                    label="Parent SKU"
                    value={selectedProduct.analysis.parentSku || '-'}
                    mono
                  />
                  <Info
                    label="Grup ID"
                    value={selectedProduct.analysis.groupId || '-'}
                    mono
                  />
                </div>
              </Section>

              {/* XML Analiz Sonuçları */}
              <Section title="📡 XML Analiz Sonuçları">
                <div className="space-y-1.5 text-xs">
                  <CheckRow
                    label="XML Parent SKU"
                    checked={selectedProduct.analysis.xmlHasParent}
                  />
                  {Object.entries(selectedProduct.analysis.checks)
                    .filter(([key]) =>
                      ['hasParentSku', 'hasColor', 'hasSize', 'hasNumber', 'hasVariationTheme', 'hasMultipleVariants'].includes(key)
                    )
                    .map(([key, val]) => (
                      <CheckRow key={key} label={checkLabelMap[key] || key} checked={val} />
                    ))}
                </div>
              </Section>

              {/* DG Analizi */}
              <Section title="🤖 DG Analizi">
                {/* Kaynak ve Güven */}
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-slate-400">Kaynak:</span>
                  <span className="text-white font-medium">
                    {getSourceLabel(selectedProduct.analysis.source)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-slate-400">Güven Skoru:</span>
                  <span
                    className={`font-bold text-sm ${getConfidenceColor(
                      selectedProduct.analysis.confidence
                    )}`}
                  >
                    %{selectedProduct.analysis.confidence}
                  </span>
                </div>

                {/* Progress bar büyük */}
                <div className="w-full h-2 bg-slate-700 rounded-full mb-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      selectedProduct.analysis.confidence >= (thresholds.auto_accept || 95)
                        ? 'bg-green-400'
                        : selectedProduct.analysis.confidence >= (thresholds.needs_review || 80)
                        ? 'bg-yellow-400'
                        : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.max(2, selectedProduct.analysis.confidence)}%` }}
                  />
                </div>

                {/* Checks */}
                {Object.entries(selectedProduct.analysis.checks)
                  .filter(
                    ([key]) =>
                      !['hasParentSku', 'hasColor', 'hasSize', 'hasNumber', 'hasVariationTheme', 'hasMultipleVariants'].includes(key)
                  )
                  .map(([key, val]) => (
                    <CheckRow key={key} label={checkLabelMap[key] || key} checked={val} />
                  ))}

                {/* Errors */}
                {selectedProduct.analysis.errors.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] uppercase tracking-wider text-red-400 mb-1.5 font-semibold">
                      ❌ Hatalar ({selectedProduct.analysis.errors.length})
                    </div>
                    <div className="space-y-1">
                      {selectedProduct.analysis.errors.map((err, i) => (
                        <div
                          key={i}
                          className="text-[11px] text-red-300 bg-red-500/10 rounded px-2 py-1"
                        >
                          {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {selectedProduct.analysis.warnings.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] uppercase tracking-wider text-yellow-400 mb-1.5 font-semibold">
                      ⚠️ Uyarılar ({selectedProduct.analysis.warnings.length})
                    </div>
                    <div className="space-y-1">
                      {selectedProduct.analysis.warnings.map((warn, i) => (
                        <div
                          key={i}
                          className="text-[11px] text-yellow-300 bg-yellow-500/10 rounded px-2 py-1"
                        >
                          {warn}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* Otomatik Oluşturulan Parent SKU */}
              <Section title="🏷️ Parent SKU">
                <div className="bg-slate-700/30 rounded-lg px-3 py-2.5 border border-slate-600/30">
                  {selectedProduct.analysis.parentSku ? (
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-cyan-300 font-bold">
                        {selectedProduct.analysis.parentSku}
                      </code>
                      <span className="text-[10px] text-slate-500">
                        {selectedProduct.analysis.xmlHasParent
                          ? '(XML\'den alındı)'
                          : '(DG tarafından oluşturuldu)'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Oluşturulmadı</span>
                  )}
                </div>
              </Section>

              {/* Durum Badge */}
              <Section title="📊 Durum">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded border ${
                      getStatusBadge(selectedProduct.analysis.status).color
                    }`}
                  >
                    {getStatusBadge(selectedProduct.analysis.status).label}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {selectedProduct.analysis.reason || 'Ek sebep yok'}
                  </span>
                </div>
              </Section>

              {/* Varyantlar (varsa) */}
              {selectedProduct.product?.variants &&
                selectedProduct.product.variants.length > 0 && (
                  <Section title="🏷️ Mevcut Varyantlar">
                    <div className="space-y-1">
                      {selectedProduct.product.variants.map(v => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between text-xs bg-slate-700/20 rounded px-2 py-1"
                        >
                          <span className="text-slate-400">{v.name}</span>
                          <span className="text-white font-medium">{v.value}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
            </div>
          </div>
        )}
      </div>

      {/* ===== BİLGİ NOTU ===== */}
      {!selectedProductId && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-3">
          <div className="flex items-start gap-2 text-xs text-slate-400">
            <span className="text-base">💡</span>
            <div>
              <p className="font-medium text-slate-300 mb-1">
                Varyant Doğrulama Motoru V2
              </p>
              <p>
                XML kaynağı seçip <span className="text-blue-400">"Varyantları Tara"</span>{' '}
                butonuna tıklayarak varyant analizini başlatın.
              </p>
              <p>
                Sorunlu ürünler bu tabloda listelenir. Bir ürüne tıklayarak detaylı analiz
                sonuçlarını görebilirsiniz.
              </p>
              <p className="mt-1 text-slate-500">
                Güven skoru ≥{thresholds.auto_accept || 95} olan ürünler otomatik kabul edilir,
                ≥{thresholds.needs_review || 80} olanlar incelemeye gönderilir, altındakiler
                manuel müdahale gerektirir.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== ALT BİLEŞENLER ====================

function KpiCard({
  title,
  value,
  sub,
  color,
}: {
  title: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    green: 'border-green-500/20 bg-green-500/5 text-green-400',
    yellow: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    orange: 'border-orange-500/20 bg-orange-500/5 text-orange-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-400',
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400',
    cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
  };
  return (
    <div
      className={`rounded-xl border p-3 backdrop-blur-sm ${
        colorMap[color] || colorMap.blue
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider opacity-70">{title}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
      <div className="text-[9px] opacity-50 mt-0.5">{sub}</div>
    </div>
  );
}

function TH({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-700/80 border-b border-slate-600/50"
      style={style}
    >
      {children}
    </th>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
        {title}
      </h4>
      <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-3">
        {children}
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-slate-500 block">{label}</span>
      <span className={`text-white block mt-0.5 ${mono ? 'font-mono text-[11px]' : 'text-xs'}`}>
        {value}
      </span>
    </div>
  );
}

function CheckRow({
  label,
  checked,
}: {
  label: string;
  checked: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={checked ? 'text-green-400' : 'text-red-400'}>
        {checked ? '✓' : '✗'}
      </span>
    </div>
  );
}

// ==================== SABİTLER ====================

const checkLabelMap: Record<string, string> = {
  hasParentSku: 'Parent SKU',
  hasColor: 'Renk Attribute',
  hasSize: 'Beden Attribute',
  hasNumber: 'Numara Attribute',
  hasVariationTheme: 'Variation Theme',
  hasMultipleVariants: 'Çoklu Varyant',
  duplicateBarcode: 'Barkod Benzersiz',
  duplicateSku: 'SKU Benzersiz',
  duplicateCombo: 'Renk+No Tekrarı',
  missingColor: 'Renk Var',
  missingSize: 'Beden Var',
  missingNumber: 'Numara Var',
};
