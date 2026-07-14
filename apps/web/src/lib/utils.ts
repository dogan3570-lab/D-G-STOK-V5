// ==================== FORMAT PRICE ====================
export function formatPrice(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
}

// ==================== FORMAT DATE ====================
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('tr-TR');
  } catch {
    return '-';
  }
}

// ==================== PARSE IMAGES ====================
export function getImageList(images: string | null | undefined): string[] {
  if (!images) return [];
  return images.split(',').filter(img => img.trim().length > 0);
}

// ==================== GET STATUS BADGE ====================
import { STATUS_BADGE_COLORS, STATUS_BADGE_LABELS } from './constants';

export function getStatusBadge(status: string) {
  const cls = STATUS_BADGE_COLORS[status] || 'bg-slate-500/10 text-slate-400 border border-slate-500/30';
  const lbl = STATUS_BADGE_LABELS[status] || status;
  return { className: `rounded-full px-2.5 py-1 text-xs font-medium ${cls}`, label: lbl };
}

// ==================== STOCK STATUS ====================
export function getStockStatus(stock: number, minStock: number): { label: string; color: string } {
  if (stock === 0) return { label: 'Stok Yok', color: 'bg-red-500/10 text-red-400' };
  if (stock <= minStock) return { label: 'Düşük Stok', color: 'bg-yellow-500/10 text-yellow-400' };
  return { label: 'Normal', color: 'bg-green-500/10 text-green-400' };
}

// ==================== QUALITY LEVEL ====================
export function getQualityLevel(score: number | null): { label: string; color: string; width: number } {
  if (score == null) return { label: 'Hesaplanmadı', color: 'bg-slate-500', width: 0 };
  if (score >= 70) return { label: `${score}/100`, color: 'bg-green-500', width: score };
  if (score >= 40) return { label: `${score}/100`, color: 'bg-yellow-500', width: score };
  return { label: `${score}/100`, color: 'bg-red-500', width: score };
}

// ==================== PROFIT MARGIN ====================
export function calculateProfitMargin(
  salePrice: number | null | undefined,
  purchasePrice: number | null | undefined,
  profitMargin: number | null | undefined,
): number | null {
  if (profitMargin != null) return profitMargin;
  if (salePrice && purchasePrice) {
    return ((salePrice - purchasePrice) / purchasePrice) * 100;
  }
  return null;
}

// ==================== MARKETPLACE LOGO ====================
import { MARKETPLACE_LOGOS } from './constants';

export function getMarketplaceLogo(key: string): string {
  const k = key.toLowerCase();
  return MARKETPLACE_LOGOS[k] || '🛍️';
}

// ==================== GENERATE KEY ====================
export function generateKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20) || 'pazaryeri';
}

// ==================== VARIANT ICON ====================
import { VARIANT_TYPES } from './constants';

export function getVariantIcon(name: string): string {
  return VARIANT_TYPES.find(t => t.value === name)?.icon || '🏷️';
}

// ==================== CLSX HELPER ====================
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
