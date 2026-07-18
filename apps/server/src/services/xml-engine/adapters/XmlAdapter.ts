// ==================== XML ADAPTER V5 ====================
// Streaming XML parser - 100K+ ürün için optimize
// =====================================================

import type { IDataSourceAdapter } from '../XmlEngineV5.ts';

export class XmlAdapter implements IDataSourceAdapter {
  readonly type = 'xml' as const;

  /**
   * XML'i stream ederek işler (büyük dosyalar için)
   */
  async parse(content: string, onProduct: (raw: Record<string, any>) => void): Promise<{ total: number; errors: string[] }> {
    const errors: string[] = [];
    let total = 0;

    try {
      // Ürün bloklarını regex ile bul (hafıza dostu)
      const productRegex = /<product>([\s\S]*?)<\/product>/gi;
      let match: RegExpExecArray | null;

      while ((match = productRegex.exec(content)) !== null) {
        try {
          const productXml = match[1];
          const product = this.parseProductBlock(productXml);
          if (product && product.xmlKey) {
            onProduct(product);
            total++;
          }
        } catch (err: any) {
          errors.push(`Product ${total}: ${err.message}`);
        }
      }

      // <urun> etiketi dene (Türkçe XML'ler için)
      if (total === 0) {
        const urunRegex = /<urun>([\s\S]*?)<\/urun>/gi;
        while ((match = urunRegex.exec(content)) !== null) {
          try {
            const productXml = match[1];
            const product = this.parseProductBlock(productXml);
            if (product && product.xmlKey) {
              onProduct(product);
              total++;
            }
          } catch (err: any) {
            errors.push(`Urun ${total}: ${err.message}`);
          }
        }
      }

      // <item> etiketi dene
      if (total === 0) {
        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        while ((match = itemRegex.exec(content)) !== null) {
          try {
            const productXml = match[1];
            const product = this.parseProductBlock(productXml);
            if (product && product.xmlKey) {
              onProduct(product);
              total++;
            }
          } catch (err: any) {
            errors.push(`Item ${total}: ${err.message}`);
          }
        }
      }

    } catch (err: any) {
      errors.push(`Parse error: ${err.message}`);
    }

    return { total, errors };
  }

  /**
   * Tüm ürünleri tek seferde parse et (küçük dosyalar için)
   */
  async parseAll(content: string): Promise<{ products: Record<string, any>[]; errors: string[] }> {
    const products: Record<string, any>[] = [];
    const { total, errors } = await this.parse(content, (p) => products.push(p));
    return { products, errors };
  }

  /**
   * Tek bir ürün bloğunu parse eder
   */
  private parseProductBlock(xml: string): Record<string, any> {
    const product: Record<string, any> = {};
    const fieldRegex = /<([A-Za-z_][\w:]*)>([\s\S]*?)<\/\1>/g;
    let match: RegExpExecArray | null;

    while ((match = fieldRegex.exec(xml)) !== null) {
      const key = this.normalizeKey(match[1]);
      let value = match[2].trim();

      // CDATA temizle
      value = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();

      // Sayısal değerleri dönüştür
      if (['stock', 'price', 'salePrice', 'purchasePrice', 'vatRate', 'minStock', 'tax'].includes(key)) {
        const num = parseFloat(value.replace(',', '.'));
        if (!isNaN(num)) value = num as any;
      }

      product[key] = value;
    }

    // xmlKey oluştur
    product.xmlKey = product.barcode || product.productCode || product.urunKodu || product.sku || product.id || product.kod || '';

    return product;
  }

  /**
   * XML alan ismini normalize eder
   */
  private normalizeKey(key: string): string {
    const map: Record<string, string> = {
      'urun_adi': 'title',
      'urunAdi': 'title',
      'product_name': 'title',
      'productName': 'title',
      'product-name': 'title',
      'isim': 'title',
      'ad': 'title',
      'name': 'title',
      'title': 'title',
      'urun_kodu': 'productCode',
      'urunKodu': 'productCode',
      'product_code': 'productCode',
      'productCode': 'productCode',
      'kod': 'productCode',
      'barkod': 'barcode',
      'barcode': 'barcode',
      'stok': 'stock',
      'stock': 'stock',
      'adet': 'stock',
      'miktar': 'stock',
      'fiyat': 'salePrice',
      'sale_price': 'salePrice',
      'salePrice': 'salePrice',
      'price': 'salePrice',
      'alis_fiyat': 'purchasePrice',
      'alisFiyat': 'purchasePrice',
      'purchase_price': 'purchasePrice',
      'purchasePrice': 'purchasePrice',
      'kdv': 'vatRate',
      'vat_rate': 'vatRate',
      'vatRate': 'vatRate',
      'vergi': 'vatRate',
      'tax': 'vatRate',
      'aciklama': 'description',
      'description': 'description',
      'desc': 'description',
      'detay': 'detail',
      'detail': 'detail',
      'marka': 'brand',
      'brand': 'brand',
      'kategori': 'category',
      'category': 'category',
      'kat': 'category',
      'resim': 'images',
      'image': 'images',
      'images': 'images',
      'img': 'images',
      'gorsel': 'images',
      'urun_resim': 'images',
      'urun_resimleri': 'images',
      'urun_resimleri_1': 'images',
      'link': 'link',
      'url': 'link',
      'birim': 'unit',
      'unit': 'unit',
      'sku': 'sku',
      'stok_kodu': 'sku',
      'stockCode': 'stockCode',
      'min_stok': 'minStock',
      'minStock': 'minStock',
    };

    return map[key] || key;
  }
}
