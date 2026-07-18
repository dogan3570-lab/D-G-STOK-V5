// ==================== ÜRÜN HAZIRLAMA V6.0 TYPES ====================
// Sadece bu ekran için gerekli tipler

export type StatusType = 'completed' | 'missing' | 'review' | 'ready' | 'no_template';

export interface StepStatus {
  status: StatusType;
  label: string;
  detail?: string;
}

export interface ProductPrepData {
  id: string;
  title: string | null;
  sku: string | null;
  xmlKey: string;
  barcode: string | null;
  categoryId: string | null;
  brandId: string | null;
  xmlSourceId: string | null;
  categoryMatch: boolean;
  brandMatch: boolean;
  variantMatch: boolean;
  templateMatch: boolean;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  xmlSource?: { id: string; name: string } | null;
  variants?: Array<{ id: string; name: string; value: string }>;
  imageCount?: number;
}

export interface PrepStats {
  total: number;
  ready: number;
  missing: number;
  review: number;
  dispatchReady: number;
}

export type EditAction = 'category' | 'brand' | 'variant' | 'template' | null;
