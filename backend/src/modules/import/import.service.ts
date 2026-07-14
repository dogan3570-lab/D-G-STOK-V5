import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { Product } from '../products/product.entity';
import { Category } from '../categories/categories/category.entity';
import { CategoriesService } from '../categories/categories/categories.service';
import * as xml2js from 'xml2js';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

export interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  categories: string[];
}

export interface ImportHistory {
  id: string;
  fileName: string;
  fileType: string;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: string[];
  createdAt: Date;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private importHistory: ImportHistory[] = [];
  private historyCounter = 0;

  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private categoriesService: CategoriesService,
  ) {}

  async importXml(file: Express.Multer.File): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException('XML dosyasi gerekli');
    }

    const result: ImportResult = {
      success: true,
      totalRows: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      categories: [],
    };

    try {
      const xmlContent = file.buffer.toString('utf-8');
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
      const parsed = await parser.parseStringPromise(xmlContent);

      // Find products array - support multiple XML structures
      let products: any[] = [];
      const root = parsed;
      
      // Try common XML structures
      if (root.products?.product) {
        products = Array.isArray(root.products.product) ? root.products.product : [root.products.product];
      } else if (root.urunler?.urun) {
        products = Array.isArray(root.urunler.urun) ? root.urunler.urun : [root.urunler.urun];
      } else if (root.items?.item) {
        products = Array.isArray(root.items.item) ? root.items.item : [root.items.item];
      } else if (root.Urunler?.Urun) {
        products = Array.isArray(root.Urunler.Urun) ? root.Urunler.Urun : [root.Urunler.Urun];
      } else {
        // Try to find any array in the root
        for (const key of Object.keys(root)) {
          const val = root[key];
          if (typeof val === 'object' && val !== null) {
            for (const subKey of Object.keys(val)) {
              if (Array.isArray(val[subKey])) {
                products = val[subKey];
                break;
              }
            }
          }
          if (products.length > 0) break;
        }
      }

      if (products.length === 0) {
        throw new BadRequestException('XML icinde urun bulunamadi. Desteklenen yapilar: products.product, urunler.urun, items.item');
      }

      result.totalRows = products.length;
      this.logger.log(`XML dosyasinda ${products.length} urun bulundu`);

      for (let i = 0; i < products.length; i++) {
        try {
          const item = products[i];
          await this.processProductItem(item, result, i + 1, file.originalname);
          result.imported++;
        } catch (err: any) {
          result.skipped++;
          result.errors.push(`Satir ${i + 1}: ${err.message}`);
        }
      }

      result.success = result.errors.length === 0;
      this.addToHistory(file.originalname, 'xml', result);
      this.logger.log(`XML import tamamlandi: ${result.imported} basarili, ${result.skipped} atlandi`);
    } catch (err: any) {
      result.success = false;
      result.errors.push(err.message);
      this.logger.error(`XML import hatasi: ${err.message}`);
    }

    return result;
  }

  async importExcel(file: Express.Multer.File): Promise<ImportResult> {
    if (!file) {
      throw new BadRequestException('Excel dosyasi gerekli');
    }

    const result: ImportResult = {
      success: true,
      totalRows: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      categories: [],
    };

    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        throw new BadRequestException('Excel dosyasinda veri bulunamadi');
      }

      result.totalRows = rows.length;
      this.logger.log(`Excel dosyasinda ${rows.length} satir bulundu`);

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          await this.processExcelRow(row, result, i + 1, file.originalname);
          result.imported++;
        } catch (err: any) {
          result.skipped++;
          result.errors.push(`Satir ${i + 1}: ${err.message}`);
        }
      }

      result.success = result.errors.length === 0;
      this.addToHistory(file.originalname, 'excel', result);
      this.logger.log(`Excel import tamamlandi: ${result.imported} basarili, ${result.skipped} atlandi`);
    } catch (err: any) {
      result.success = false;
      result.errors.push(err.message);
      this.logger.error(`Excel import hatasi: ${err.message}`);
    }

    return result;
  }

  private async processProductItem(item: any, result: ImportResult, rowIndex: number, sourceFile: string) {
    // Map XML fields - support multiple naming conventions
    const mapField = (keys: string[]): string | undefined => {
      for (const key of keys) {
        if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
          return String(item[key]).trim();
        }
      }
      return undefined;
    };

    const sku = mapField(['sku', 'SKU', 'StokKodu', 'stock_code', 'kod', 'Kod', 'UrunKodu', 'product_code', 'Barcode', 'barcode', 'Barkod']);
    if (!sku) {
      throw new Error('SKU (Stok Kodu) alani zorunludur');
    }

    const name = mapField(['name', 'Name', 'urunAdi', 'UrunAdi', 'title', 'Title', 'product_name', 'isim', 'adi', 'Adi', 'productName']);
    if (!name) {
      throw new Error(`SKU:${sku} - Urun adi zorunludur`);
    }

    // Kategori
    const categoryName = mapField(['category', 'Category', 'kategori', 'Kategori', 'category_name', 'KategoriAdi', 'kategoriAdi', 'categoryName']);
    
    // Alt kategori
    const subCategory = mapField(['subCategory', 'SubCategory', 'altKategori', 'AltKategori', 'sub_category', 'alt_kategori']);

    let fullCategoryPath = '';
    if (categoryName) {
      fullCategoryPath = subCategory ? `${categoryName} > ${subCategory}` : categoryName;
    }

    // Kategori olustur veya bul
    if (categoryName) {
      try {
        const cat = await this.findOrCreateCategory(categoryName, subCategory);
        if (cat && !result.categories.includes(cat.name)) {
          result.categories.push(cat.name);
        }
      } catch (e) {
        result.warnings.push(`Satir ${rowIndex}: Kategori olusturulamadi: ${categoryName}`);
      }
    }

    // Fiyatlar
    const purchasePriceStr = mapField(['purchasePrice', 'alisFiyati', 'AlisFiyati', 'purchase_price', 'maliyet', 'Maliyet', 'alis', 'buying_price']);
    const priceStr = mapField(['price', 'Price', 'fiyat', 'Fiyat', 'satisFiyati', 'SatisFiyati', 'sales_price', 'selling_price', 'urunFiyati']);

    const purchasePrice = parseFloat(purchasePriceStr || '0') || 0;
    const price = parseFloat(priceStr || '0') || 0;

    // Stok
    const stockStr = mapField(['stock', 'Stock', 'stok', 'Stok', 'quantity', 'miktar', 'adet', 'stock_qty', 'stockQuantity']);
    const stock = parseInt(stockStr || '0') || 0;

    // Barkod
    const barcode = mapField(['barcode', 'Barcode', 'barkod', 'Barkod', 'barCode', 'BarCode']);

    // Marka
    const brand = mapField(['brand', 'Brand', 'marka', 'Marka', 'urunMarka']);

    // Aciklama
    const description = mapField(['description', 'Description', 'aciklama', 'Aciklama', 'desc', 'detail', 'Detay', 'urunAciklama']);
    const shortDescription = mapField(['shortDescription', 'kisaAciklama', 'KisaAciklama', 'short_description']);

    // Gorseller
    let images: string[] = [];
    const imageField = mapField(['image', 'Image', 'resim', 'Resim', 'gorsel', 'image_url', 'img', 'images', 'resimler']);
    if (imageField) {
      images = imageField.split(',').map(i => i.trim()).filter(Boolean);
    }

    // Varyant
    const variantGroup = mapField(['variantGroup', 'variant_group', 'varyantGrup', 'variant']);
    const variantType = mapField(['variantType', 'variant_type', 'varyantTip']);
    const variantValue = mapField(['variantValue', 'variant_value', 'varyantDeger']);

    // KDV
    const vatRateStr = mapField(['vatRate', 'kdv', 'KDV', 'vat', 'VAT', 'kdv_oran']);
    const vatRate = parseFloat(vatRateStr || '20') || 20;

    // Mevcut urunu kontrol et
    let product = await this.productsRepository.findOne({ where: { sku } });
    
    if (product) {
      // Mevcut urunu guncelle
      Object.assign(product, {
        name,
        description: description || product.description,
        shortDescription: shortDescription || product.shortDescription,
        price: price || product.price,
        purchasePrice: purchasePrice || product.purchasePrice,
        stock: stock || product.stock,
        barcode: barcode || product.barcode,
        brand: brand || product.brand,
        images: images.length > 0 ? images : product.images,
        image: images[0] || product.image,
        categoryPath: fullCategoryPath || product.categoryPath,
        variantGroup: variantGroup || product.variantGroup,
        variantType: variantType || product.variantType,
        variantValue: variantValue || product.variantValue,
        vatRate: vatRate || product.vatRate,
        source: 'xml',
        sourceFile,
      });
      await this.productsRepository.save(product);
    } else {
      // Yeni urun olustur
      product = this.productsRepository.create({
        sku,
        name,
        barcode: barcode || '',
        description: description || '',
        shortDescription: shortDescription || '',
        purchasePrice,
        price: price || purchasePrice,
        stock,
        brand: brand || '',
        images,
        image: images[0] || '',
        categoryPath: fullCategoryPath,
        variantGroup: variantGroup || '',
        variantType: variantType || '',
        variantValue: variantValue || '',
        vatRate,
        vatIncluded: true,
        source: 'xml',
        sourceFile,
        isActive: true,
      });
      await this.productsRepository.save(product);
    }
  }

  private async processExcelRow(row: any, result: ImportResult, rowIndex: number, sourceFile: string) {
    // Excel kolonlarini normalize et
    const normalizeKey = (key: string): string => {
      return key.toLowerCase().replace(/[^a-z0-9]/g, '_').trim();
    };

    const normalizedRow: any = {};
    for (const key of Object.keys(row)) {
      normalizedRow[normalizeKey(key)] = row[key];
    }

    const getValue = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const normKey = normalizeKey(key);
        if (normalizedRow[normKey] !== undefined && normalizedRow[normKey] !== null && normalizedRow[normKey] !== '') {
          return String(normalizedRow[normKey]).trim();
        }
      }
      return undefined;
    };

    const sku = getValue('sku', 'SKU', 'StokKodu', 'stok_kodu', 'Kod', 'kod', 'urun_kodu', 'barcode', 'Barkod', 'barkod');
    if (!sku) {
      throw new Error('SKU (Stok Kodu) alani zorunludur');
    }

    const name = getValue('name', 'urun_adi', 'UrunAdi', 'ürün adı', 'title', 'baslik', 'başlık', 'product_name', 'isim', 'adi');
    if (!name) {
      throw new Error(`SKU:${sku} - Urun adi zorunludur`);
    }

    // Kategori
    const categoryName = getValue('category', 'kategori', 'Kategori', 'category_name', 'kategori_adi');
    const subCategory = getValue('sub_category', 'alt_kategori', 'AltKategori', 'altkategori', 'subcategory');

    let fullCategoryPath = '';
    if (categoryName) {
      fullCategoryPath = subCategory ? `${categoryName} > ${subCategory}` : categoryName;
    }

    if (categoryName) {
      try {
        const cat = await this.findOrCreateCategory(categoryName, subCategory);
        if (cat && !result.categories.includes(cat.name)) {
          result.categories.push(cat.name);
        }
      } catch (e) {
        result.warnings.push(`Satir ${rowIndex}: Kategori olusturulamadi: ${categoryName}`);
      }
    }

    // Fiyatlar
    const purchasePrice = parseFloat(getValue('purchasePrice', 'alis_fiyati', 'AlisFiyati', 'maliyet', 'alis', 'purchase_price', 'buying_price') || '0') || 0;
    const price = parseFloat(getValue('price', 'fiyat', 'Fiyat', 'satis_fiyati', 'satisFiyati', 'sales_price', 'urun_fiyati') || '0') || 0;
    const stock = parseInt(getValue('stock', 'stok', 'Stok', 'quantity', 'miktar', 'adet', 'stock_qty') || '0') || 0;
    const barcode = getValue('barcode', 'barkod', 'Barkod', 'Barcode', 'bar_code');
    const brand = getValue('brand', 'marka', 'Marka', 'urun_marka');

    // Aciklama
    const description = getValue('description', 'aciklama', 'Aciklama', 'desc', 'detail', 'detay', 'urun_aciklama');
    const shortDescription = getValue('shortDescription', 'kisa_aciklama', 'KisaAciklama', 'short_description');

    // Gorseller
    let images: string[] = [];
    const imageField = getValue('image', 'resim', 'Resim', 'gorsel', 'image_url', 'img', 'images', 'resimler');
    if (imageField) {
      images = imageField.split(',').map(i => i.trim()).filter(Boolean);
    }

    // Varyant
    const variantGroup = getValue('variantGroup', 'variant_group', 'varyant', 'varyant_grup');
    const variantValue = getValue('variantValue', 'variant_value', 'varyant_deger', 'varyantDeger');

    // KDV
    const vatRate = parseFloat(getValue('vatRate', 'kdv', 'KDV', 'kdv_orani', 'vat') || '20') || 20;

    // Mevcut urunu kontrol et
    let product = await this.productsRepository.findOne({ where: { sku } });

    if (product) {
      Object.assign(product, {
        name,
        description: description || product.description,
        shortDescription: shortDescription || product.shortDescription,
        price: price || product.price,
        purchasePrice: purchasePrice || product.purchasePrice,
        stock: stock || product.stock,
        barcode: barcode || product.barcode,
        brand: brand || product.brand,
        images: images.length > 0 ? images : product.images,
        image: images[0] || product.image,
        categoryPath: fullCategoryPath || product.categoryPath,
        variantGroup: variantGroup || product.variantGroup,
        variantValue: variantValue || product.variantValue,
        vatRate: vatRate || product.vatRate,
        source: 'excel',
        sourceFile,
      });
      await this.productsRepository.save(product);
    } else {
      product = this.productsRepository.create({
        sku,
        name,
        barcode: barcode || '',
        description: description || '',
        shortDescription: shortDescription || '',
        purchasePrice,
        price: price || purchasePrice,
        stock,
        brand: brand || '',
        images,
        image: images[0] || '',
        categoryPath: fullCategoryPath,
        variantGroup: variantGroup || '',
        variantValue: variantValue || '',
        vatRate,
        vatIncluded: true,
        source: 'excel',
        sourceFile,
        isActive: true,
      });
      await this.productsRepository.save(product);
    }
  }

  private async findOrCreateCategory(categoryName: string, subCategoryName?: string): Promise<Category | null> {
    try {
      // Ana kategori
      const slug = this.slugify(categoryName);
      let category = await this.categoriesService.findBySlug(slug).catch(() => null);
      
      if (!category) {
        category = await this.categoriesService.create({
          name: categoryName,
          slug,
          isActive: true,
          sortOrder: 0,
        });
      }

      // Alt kategori
      if (subCategoryName) {
        const subSlug = this.slugify(subCategoryName);
        let subCategory = await this.categoriesService.findBySlug(subSlug).catch(() => null);
        
        if (!subCategory) {
          subCategory = await this.categoriesService.create({
            name: subCategoryName,
            slug: subSlug,
            parent: category,
            isActive: true,
            sortOrder: 0,
          });
        }
        return subCategory;
      }

      return category;
    } catch (error) {
      this.logger.warn(`Kategori olusturulamadi: ${categoryName}`);
      return null;
    }
  }

  private slugify(text: string): string {
    const trMap: Record<string, string> = {
      'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i',
      'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
    };
    return text.toLowerCase()
      .replace(/[çÇğĞıİöÖşŞüÜ]/g, match => trMap[match] || match)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 200);
  }

  private addToHistory(fileName: string, fileType: string, result: ImportResult) {
    this.historyCounter++;
    this.importHistory.unshift({
      id: String(this.historyCounter),
      fileName,
      fileType,
      totalRows: result.totalRows,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors.slice(0, 50),
      createdAt: new Date(),
    });
  }

  async getHistory(): Promise<ImportHistory[]> {
    return this.importHistory;
  }

  async deleteHistory(id: string): Promise<void> {
    this.importHistory = this.importHistory.filter(h => h.id !== id);
  }
}
