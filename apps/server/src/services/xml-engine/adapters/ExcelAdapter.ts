// ==================== EXCEL ADAPTER V5 ====================
// Excel (.xlsx/.xls) dosyalarını okuyup ürünlere dönüştürür
// ==========================================================

import * as XLSX from 'xlsx';
import type { IDataSourceAdapter } from '../XmlEngineV5.ts';

export class ExcelAdapter implements IDataSourceAdapter {
  readonly type = 'excel' as const;

  async parse(content: string, onProduct: (raw: Record<string, any>) => void): Promise<{ total: number; errors: string[] }> {
    const errors: string[] = [];
    let total = 0;

    try {
      // Base64 veya binary data olabilir
      const data = this.decodeContent(content);
      const workbook = XLSX.read(data, { type: 'buffer', codepage: 65001 });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        return { total: 0, errors: ['Excel sayfası bulunamadı'] };
      }

      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      for (const row of rows) {
        try {
          const product = this.normalizeExcelRow(row);
          if (product && product.xmlKey) {
            onProduct(product);
            total++;
          }
        } catch (err: any) {
          errors.push(`Row ${total}: ${err.message}`);
        }
      }
    } catch (err: any) {
      errors.push(`Excel parse error: ${err.message}`);
    }

    return { total, errors };
  }

  async parseAll(content: string): Promise<{ products: Record<string, any>[]; errors: string[] }> {
    const products: Record<string, any>[] = [];
    const { total, errors } = await this.parse(content, (p) => products.push(p));
    return { products, errors };
  }

  private decodeContent(content: string): Buffer | ArrayBuffer {
    // Base64 kontrolü
    try {
      const buf = Buffer.from(content, 'base64');
      // Excel magic bytes kontrolü
      if (buf[0] === 0x50 && buf[1] === 0x4b) return buf; // PK zip (xlsx)
      if (buf[0] === 0xd0 && buf[1] === 0xcf) return buf; // CFB (xls)
    } catch {
      // Base64 değilse direkt string kullan
    }
    return Buffer.from(content, 'utf-8');
  }

  private normalizeExcelRow(row: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    // Tüm key'leri normalize et
    const keyMap: Record<string, string> = {
      'urun_adi': 'title', 'URUN_ADI': 'title', 'ÜRÜN ADI': 'title', 'Urun Adi': 'title',
      'product_name': 'title', 'PRODUCT_NAME': 'title', 'Product Name': 'title',
      'product name': 'title', 'name': 'title', 'NAME': 'title', 'Name': 'title',
      'isim': 'title', 'ISIM': 'title', 'İsim': 'title', 'ad': 'title', 'AD': 'title',
      'title': 'title', 'TITLE': 'title',

      'urun_kodu': 'productCode', 'URUN_KODU': 'productCode', 'ÜRÜN KODU': 'productCode',
      'product_code': 'productCode', 'PRODUCT_CODE': 'productCode', 'product code': 'productCode',
      'kod': 'productCode', 'KOD': 'productCode', 'Kod': 'productCode',
      'productCode': 'productCode',

      'barkod': 'barcode', 'BARKOD': 'barcode', 'Barkod': 'barcode',
      'barcode': 'barcode', 'BARCODE': 'barcode', 'Barcode': 'barcode',
      'upc': 'barcode', 'UPC': 'barcode', 'ean': 'barcode', 'EAN': 'barcode',

      'stok': 'stock', 'STOK': 'stock', 'Stok': 'stock',
      'stock': 'stock', 'STOCK': 'stock',
      'adet': 'stock', 'ADET': 'stock', 'miktar': 'stock', 'MIKTAR': 'stock',
      'quantity': 'stock', 'QUANTITY': 'stock',

      'fiyat': 'salePrice', 'FIYAT': 'salePrice', 'FİYAT': 'salePrice',
      'sale_price': 'salePrice', 'SALE_PRICE': 'salePrice',
      'satis_fiyat': 'salePrice', 'SATIS_FIYAT': 'salePrice',
      'satış fiyatı': 'salePrice',
      'price': 'salePrice', 'PRICE': 'salePrice',

      'alis_fiyat': 'purchasePrice', 'ALIS_FIYAT': 'purchasePrice',
      'alış fiyatı': 'purchasePrice',
      'purchase_price': 'purchasePrice', 'PURCHASE_PRICE': 'purchasePrice',
      'purchasePrice': 'purchasePrice', 'cost': 'purchasePrice',

      'kdv': 'vatRate', 'KDV': 'vatRate',
      'vat': 'vatRate', 'VAT': 'vatRate', 'vat_rate': 'vatRate',
      'vergi': 'vatRate', 'VERGI': 'vatRate', 'tax': 'vatRate', 'TAX': 'vatRate',

      'marka': 'brand', 'MARKA': 'brand', 'Marka': 'brand',
      'brand': 'brand', 'BRAND': 'brand',

      'kategori': 'category', 'KATEGORI': 'category', 'Kategori': 'category',
      'category': 'category', 'CATEGORY': 'category', 'kat': 'category',

      'resim': 'images', 'RESIM': 'images', 'Resim': 'images',
      'gorsel': 'images', 'GORSEL': 'images', 'Görsel': 'images',
      'image': 'images', 'IMAGE': 'images', 'images': 'images',
      'urun_resim': 'images', 'URUN_RESIM': 'images',
      'urun_resimleri': 'images', 'URUN_RESIMLERI': 'images',

      'aciklama': 'description', 'ACIKLAMA': 'description', 'Açıklama': 'description',
      'description': 'description', 'DESCRIPTION': 'description',
      'desc': 'description', 'DESC': 'description',

      'detay': 'detail', 'DETAY': 'detail', 'Detay': 'detail',
      'detail': 'detail', 'DETAIL': 'detail',

      'sku': 'sku', 'SKU': 'Sku',
      'stok_kodu': 'sku', 'STOK_KODU': 'sku',
      'stock_code': 'sku', 'STOCK_CODE': 'sku',

      'link': 'link', 'LINK': 'link',
      'url': 'link', 'URL': 'link',

      'birim': 'unit', 'BIRIM': 'unit',
      'unit': 'unit', 'UNIT': 'unit',

      'min_stok': 'minStock', 'MIN_STOK': 'minStock',
      'minStock': 'minStock', 'MIN_STOCK': 'minStock',

      'para_birimi': 'currency', 'PARA_BIRIMI': 'currency',
      'currency': 'currency', 'CURRENCY': 'currency',
    };

    for (const [key, value] of Object.entries(row)) {
      const trimmedKey = key.trim();
      const normalizedKey = keyMap[trimmedKey] || trimmedKey.toLowerCase().replace(/\s+/g, '_');
      let val: any = value;

      // Sayısal değer dönüşümü
      if (['stock', 'minStock'].includes(normalizedKey)) {
        val = typeof val === 'number' ? val : parseInt(String(val).replace(/[^\d-]/g, ''), 10) || 0;
      } else if (['salePrice', 'purchasePrice', 'vatRate'].includes(normalizedKey)) {
        if (typeof val === 'number') val = val;
        else if (typeof val === 'string') val = parseFloat(val.replace(',', '.').replace(/[^0-9.-]/g, '')) || null;
        else val = null;
      } else if (typeof val === 'string') {
        val = val.trim();
      }

      result[normalizedKey] = val;
    }

    // xmlKey oluştur
    result.xmlKey = result.barcode || result.productCode || result.sku || result.xmlKey || '';
    
    // Resimleri virgülle ayır
    if (result.images && Array.isArray(result.images)) {
      result.images = result.images.filter(Boolean).join(',');
    }

    return result;
  }
}
