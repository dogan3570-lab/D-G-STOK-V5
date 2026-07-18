import * as XLSX from 'xlsx';
import type { IDataProvider, ProviderConfig, ProviderResult, ProviderInfo } from './IDataProvider.ts';
import type { XmlV2Product } from '../xmlv2/types.ts';

export class ExcelProvider implements IDataProvider {
  readonly info: ProviderInfo = {
    type: 'excel',
    name: 'Excel Provider',
    description: 'Excel (.xlsx/.xls) dosyalarini streaming ile okur',
    version: '1.0.0',
    supportsStreaming: true,
    supportsSchedule: true,
  };

  async fetch(config: ProviderConfig): Promise<ProviderResult> {
    const start = Date.now();
    try {
      if (!config.url && !config.filePath) {
        return { ok: false, products: [], totalCount: 0, error: 'URL veya dosya yolu gerekli', durationMs: 0 };
      }

      let workbook: XLSX.WorkBook;
      if (config.filePath) {
        workbook = XLSX.readFile(config.filePath);
      } else {
        const response = await fetch(config.url!);
        const buffer = await response.arrayBuffer();
        workbook = XLSX.read(buffer, { type: 'buffer' });
      }

      // Sayfa seçimi
      const sheetName = config.sheetName || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return { ok: false, products: [], totalCount: 0, error: `Sayfa bulunamadi: ${sheetName}`, durationMs: Date.now() - start };
      }

      // JSON'a çevir
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const products: XmlV2Product[] = rows.map((row: any, i: number) => ({
        xmlKey: String(row.id || row.xmlKey || row.sku || row.URUN_KODU || `EXCEL-${i}`),
        title: row.title || row.name || row.URUN_ADI || row.NAME || null,
        sku: String(row.sku || row.code || row.SKU || row.STOK_KODU || `EXCEL-SKU-${i}`),
        barcode: row.barcode || row.upc || row.ean || row.BARKOD || null,
        stock: Number(row.stock || row.quantity || row.STOK || row.MIKTAR || 0),
        minStock: Number(row.minStock || row.minStockLevel || row.MIN_STOK || 0),
        price: row.price || row.salePrice || row.FIYAT || row.SATIS_FIYAT ? Number(row.price || row.salePrice || row.FIYAT || row.SATIS_FIYAT) : null,
        listPrice: row.listPrice || row.purchasePrice || row.ALIS_FIYAT ? Number(row.listPrice || row.purchasePrice || row.ALIS_FIYAT) : null,
        tax: row.tax || row.vat || row.KDV ? Number(row.tax || row.vat || row.KDV) : null,
        currency: row.currency || row.PARA_BIRIMI || null,
        brand: row.brand || row.marka || row.BRAND || row.MARKA || null,
        category: row.category || row.kategori || row.CATEGORY || row.KATEGORI || null,
        mainCategory: row.mainCategory || row.anaKategori || null,
        topCategory: row.topCategory || row.ustKategori || null,
        subCategory: row.subCategory || row.altKategori || null,
        description: row.description || row.desc || row.ACIKLAMA || null,
        detail: row.detail || row.DETAY || null,
        images: row.images || row.image || row.RESIM || row.GORSEL || null,
        link: row.link || row.url || null,
        unit: row.unit || row.BIRIM || null,
        active: row.active !== false && row.active !== '0' && row.AKTIF !== '0',
      }));

      return { ok: true, products, totalCount: products.length, durationMs: Date.now() - start };
    } catch (error: any) {
      return { ok: false, products: [], totalCount: 0, error: error.message, durationMs: Date.now() - start };
    }
  }

  async testConnection(config: ProviderConfig): Promise<{ ok: boolean; message: string }> {
    try {
      if (config.filePath) {
        XLSX.readFile(config.filePath);
        return { ok: true, message: 'Dosya basariyla okundu' };
      }
      const res = await fetch(config.url || '', { method: 'HEAD' });
      return { ok: res.ok, message: `HTTP ${res.status}` };
    } catch (error: any) {
      return { ok: false, message: error.message };
    }
  }

  validateConfig(config: ProviderConfig): string[] {
    const errors: string[] = [];
    if (!config.url && !config.filePath) errors.push('Excel kaynagi icin URL veya dosya yolu zorunludur');
    return errors;
  }
}
