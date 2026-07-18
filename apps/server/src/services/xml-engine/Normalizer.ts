// ==================== ÜRÜN NORMALİZASYON V5 ====================
// XML/JSON/CSV'den gelen ham veriyi standart ürün modeline dönüştürür
// ============================================================

export interface NormalizeOptions {
  defaultCurrency?: string;
  defaultVat?: number;
}

export interface NormalizedProduct {
  xmlKey: string;
  title: string | null;
  description: string | null;
  detail: string | null;
  sku: string | null;
  barcode: string | null;
  stockCode: string | null;
  stock: number;
  minStock: number;
  salePrice: number | null;
  purchasePrice: number | null;
  vatRate: number | null;
  currency: string | null;
  brand: string | null;
  category: string | null;
  images: string | null;
  link: string | null;
  unit: string | null;
  errors: string[];
}

export class Normalizer {
  /**
   * Ham veriyi normalize edilmiş ürün modeline dönüştürür
   */
  normalize(raw: Record<string, any>, options?: NormalizeOptions): NormalizedProduct {
    const errors: string[] = [];
    const defaultCurrency = options?.defaultCurrency ?? 'TRY';
    const defaultVat = options?.defaultVat ?? 20;

    // xmlKey
    const xmlKey = String(raw.xmlKey || raw.barcode || raw.productCode || raw.sku || '').trim();
    if (!xmlKey) errors.push('Missing identifier (barcode/productCode/sku)');

    // Title
    const title = this.cleanText(raw.title || raw.name || raw.productName || raw.urunAdi || null);
    if (!title) errors.push('Missing title');

    // Stock - çoklu format desteği
    const stock = this.toInt(raw.stock ?? raw.stok ?? raw.adet ?? raw.miktar ?? raw.quantity, 0);

    // Prices - çoklu format desteği
    const salePrice = this.toFloat(raw.salePrice ?? raw.price ?? raw.fiyat ?? raw.satis_fiyat ?? raw.satisFiyat, null);
    const purchasePrice = this.toFloat(raw.purchasePrice ?? raw.alisFiyat ?? raw.alis_fiyat ?? raw.cost, null);

    // Vat
    const vatRate = this.toFloat(raw.vatRate || raw.kdv || raw.tax || raw.vergi, defaultVat);

    // Images - virgül/pipe ile ayrılmış URL'leri birleştir
    const images = this.normalizeImages(raw.images || raw.image || raw.img || raw.resim || raw.gorsel || raw.urun_resim || null);

    // Barcode temizlik
    const barcode = this.cleanBarcode(raw.barcode || raw.barkod || null);

    return {
      xmlKey,
      title,
      description: this.cleanText(raw.description || raw.desc || raw.aciklama || null),
      detail: this.cleanText(raw.detail || raw.detay || null),
      sku: this.cleanText(raw.sku || null),
      barcode,
      stockCode: this.cleanText(raw.stockCode || raw.stokKodu || raw.stok_kodu || null),
      stock,
      minStock: this.toInt(raw.minStock || raw.min_stok, 0),
      salePrice,
      purchasePrice,
      vatRate,
      currency: String(raw.currency || raw.paraBirimi || defaultCurrency).trim(),
      brand: this.cleanText(raw.brand || raw.marka || null),
      category: this.cleanText(raw.category || raw.kategori || raw.kat || null),
      images,
      link: this.cleanText(raw.link || raw.url || null),
      unit: this.cleanText(raw.unit || raw.birim || null),
      errors,
    };
  }

  private cleanText(value: any): string | null {
    if (!value) return null;
    const str = String(value).trim();
    return str.length > 0 ? str : null;
  }

  private toInt(value: any, defaultVal: number): number {
    if (value === null || value === undefined || value === '') return defaultVal;
    const num = parseInt(String(value).replace(/[^\d-]/g, ''), 10);
    return isNaN(num) ? defaultVal : num;
  }

  private toFloat(value: any, defaultVal: number | null): number | null {
    if (value === null || value === undefined || value === '') return defaultVal;
    const num = parseFloat(String(value).replace(',', '.').replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? defaultVal : num;
  }

  private normalizeImages(value: any): string | null {
    if (!value) return null;
    const str = String(value);
    // Virgül, pipe, noktalı virgül ile ayrılmış URL'leri birleştir
    const urls = str.split(/[,|;]/).map(u => u.trim()).filter(u => u.startsWith('http'));
    return urls.length > 0 ? urls.join(',') : str;
  }

  private cleanBarcode(value: any): string | null {
    if (!value) return null;
    return String(value).replace(/[^0-9A-Za-z]/g, '').trim() || null;
  }
}
