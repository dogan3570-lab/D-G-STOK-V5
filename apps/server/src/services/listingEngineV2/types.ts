export interface PriceRule {
  id?: string;
  marketplaceId: string;
  productId?: string | null;
  categoryId?: string | null;
  minPrice: number;
  maxPrice: number;
  applyVat: boolean;
  profitMargin: number;
  rounding: string;
  active: boolean;
  priority: number; // 1=urun, 2=kategori, 3=genel
}

export interface PriceCalculation {
  purchasePrice: number;
  vatRate: number;
  vatIncludedPrice: number;
  profitMargin: number;
  calculatedPrice: number;
  roundedPrice: number;
  rounding: string;
  rule: PriceRule | null;
  ruleType: string;
}

export interface ListingResult {
  productId: string;
  productTitle: string | null;
  marketplaceId: string;
  calculation: PriceCalculation;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
}
