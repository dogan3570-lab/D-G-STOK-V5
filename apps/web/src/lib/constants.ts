// ==================== STATUS OPTIONS ====================
export const STATUS_OPTIONS = [
  { value: '', label: 'Tümü', color: '' },
  { value: 'XML', label: 'Yeni Ürün', color: 'bg-blue-500/10 text-blue-400' },
  { value: 'READY', label: 'Hazır', color: 'bg-green-500/10 text-green-400' },
  { value: 'DRAFT', label: 'Taslak', color: 'bg-yellow-500/10 text-yellow-400' },
  { value: 'SENT', label: 'Gönderildi', color: 'bg-purple-500/10 text-purple-400' },
  { value: 'PASSIVE', label: 'Pasif', color: 'bg-gray-500/10 text-gray-400' },
  { value: 'ERROR', label: 'Hatalı', color: 'bg-red-500/10 text-red-400' },
] as const;

// ==================== SEARCH FIELDS ====================
export const SEARCH_FIELDS = [
  { value: '', label: 'Tüm Alanlar' },
  { value: 'title', label: 'Ürün Adı' },
  { value: 'sku', label: 'SKU' },
  { value: 'barcode', label: 'Barkod' },
  { value: 'xmlKey', label: 'XML Key' },
  { value: 'description', label: 'Açıklama' },
] as const;

// ==================== SORT OPTIONS ====================
export const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Oluşturma Tarihi' },
  { value: 'updatedAt', label: 'Güncelleme Tarihi' },
  { value: 'title', label: 'Ürün Adı' },
  { value: 'stock', label: 'Stok' },
  { value: 'salePrice', label: 'Satış Fiyatı' },
  { value: 'profitMargin', label: 'Kar Marjı' },
  { value: 'status', label: 'Durum' },
] as const;

// ==================== MARKETPLACE LOGOS ====================
export const MARKETPLACE_LOGOS: Record<string, string> = {
  trendyol: '🛒',
  tt: '🛒',
  hepsiburada: '📦',
  he: '📦',
  n11: '🏪',
  amazon: '📦',
  amazon_tr: '📦',
  pazarama: '🛍️',
  idefix: '📚',
  ciceksepeti: '🌸',
  çiçeksepeti: '🌸',
  pt: '📱',
  pttavm: '📱',
  woocommerce: '🛒',
  shopify: '🛍️',
};

// ==================== MARKETPLACE NAMES ====================
export const MARKETPLACES = [
  { key: 'tt', name: 'Trendyol' },
  { key: 'he', name: 'Hepsiburada' },
  { key: 'n11', name: 'N11' },
  { key: 'amazon', name: 'Amazon' },
  { key: 'pazarama', name: 'Pazarama' },
  { key: 'idefix', name: 'İdefix' },
  { key: 'ciceksepeti', name: 'ÇiçekSepeti' },
  { key: 'pttavm', name: 'PTT AVM' },
  { key: 'woocommerce', name: 'WooCommerce' },
  { key: 'shopify', name: 'Shopify' },
] as const;

// ==================== VARIANT TYPES ====================
export const VARIANT_TYPES = [
  { value: 'Renk', label: 'Renk', icon: '🎨' },
  { value: 'Beden', label: 'Beden', icon: '👕' },
  { value: 'Numara', label: 'Numara', icon: '🔢' },
  { value: 'Yaş', label: 'Yaş', icon: '👶' },
  { value: 'Cinsiyet', label: 'Cinsiyet', icon: '⚤' },
  { value: 'Materyal', label: 'Materyal', icon: '🧵' },
  { value: 'Kumaş', label: 'Kumaş', icon: '🧶' },
  { value: 'Desen', label: 'Desen', icon: '🎨' },
  { value: 'Kalıp', label: 'Kalıp', icon: '📐' },
  { value: 'Uzunluk', label: 'Uzunluk', icon: '📏' },
  { value: 'Genişlik', label: 'Genişlik', icon: '↔️' },
  { value: 'Hacim', label: 'Hacim', icon: '🧊' },
  { value: 'Ağırlık', label: 'Ağırlık', icon: '⚖️' },
  { value: 'Boyut', label: 'Boyut', icon: '📦' },
  { value: 'Model', label: 'Model', icon: '🏷️' },
  { value: 'Sezon', label: 'Sezon', icon: '🌤️' },
  { value: 'Koleksiyon', label: 'Koleksiyon', icon: '📚' },
  { value: 'Enerji Sınıfı', label: 'Enerji Sınıfı', icon: '🔋' },
  { value: 'Kapasite', label: 'Kapasite', icon: '📊' },
  { value: 'Ölçü', label: 'Ölçü', icon: '📐' },
  { value: 'Garanti Süresi', label: 'Garanti Süresi', icon: '🛡️' },
  { value: 'Paket İçeriği', label: 'Paket İçeriği', icon: '📦' },
] as const;

// ==================== STATUS BADGE ====================
export const STATUS_BADGE_COLORS: Record<string, string> = {
  XML: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  READY: 'bg-green-500/10 text-green-400 border border-green-500/30',
  DRAFT: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
  SENT: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
  PASSIVE: 'bg-gray-500/10 text-gray-400 border border-gray-500/30',
  ERROR: 'bg-red-500/10 text-red-400 border border-red-500/30',
};

export const STATUS_BADGE_LABELS: Record<string, string> = {
  XML: '🆕 Yeni',
  READY: '✅ Hazır',
  DRAFT: '⚠️ Eksik Bilgi',
  SENT: '📤 Gönderildi',
  PASSIVE: '⏸️ Pasif',
  ERROR: '❌ Hatalı',
};

// ==================== VARIANT TYPES (Marketplace Panels) ====================
export const MP_VARIANT_PANELS = [
  'Trendyol', 'Hepsiburada', 'Amazon', 'N11', 'Pazarama',
  'ÇiçekSepeti', 'İdefix', 'PTTAVM', 'WooCommerce', 'Shopify',
];

// ==================== PAGE SIZES ====================
export const PAGE_SIZES = [10, 25, 50, 100, 200, 500] as const;
