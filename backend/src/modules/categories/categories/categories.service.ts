import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, Not, IsNull } from 'typeorm';
import { Category } from './category.entity';
import { Product } from '../../products/product.entity';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async findById(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: { children: true },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadi');
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { slug },
      relations: { children: true },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadi');
    return category;
  }

  async create(data: Partial<Category>): Promise<Category> {
    const category = this.categoriesRepository.create(data);
    return this.categoriesRepository.save(category);
  }

  async update(id: string, data: Partial<Category>): Promise<Category> {
    const category = await this.findById(id);
    Object.assign(category, data);
    return this.categoriesRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findById(id);
    await this.categoriesRepository.remove(category);
  }

  // === KATEGORI ESLESTIRME METODLARI ===

  async getProductsForMatching(page = 1, limit = 50, filters?: { search?: string; categoryId?: string; matched?: string }) {
    const where: any = {};

    if (filters?.search) {
      where.name = Like(`%${filters.search}%`);
    }
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters?.matched === 'yes') {
      where.categoryId = Not(IsNull());
    } else if (filters?.matched === 'no') {
      where.categoryId = IsNull();
    }

    const [data, total] = await this.productsRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { updatedAt: 'DESC' },
    });

    // Kategori isimlerini de ekleyelim
    const categoryIds = data.filter(p => p.categoryId).map(p => p.categoryId);
    const categories = categoryIds.length > 0
      ? await this.categoriesRepository.find({ where: { id: In(categoryIds) } })
      : [];
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    const enrichedData = data.map(product => ({
      ...product,
      categoryName: product.categoryId ? categoryMap.get(product.categoryId) || null : null,
    }));

    return {
      data: enrichedData,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async matchSingle(productId: string, categoryId: string): Promise<{ success: boolean; productId: string; categoryId: string; categoryName: string }> {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Urun bulunamadi');

    const category = await this.findById(categoryId);
    product.categoryId = categoryId;
    product.categoryPath = this.buildCategoryPath(category);

    await this.productsRepository.save(product);
    this.logger.log(`Kategori eslestirildi: ${product.sku} -> ${category.name}`);

    return { success: true, productId, categoryId, categoryName: category.name };
  }

  async matchBulk(productIds: string[], categoryId: string): Promise<{ success: boolean; matched: number; categoryName: string }> {
    const category = await this.findById(categoryId);
    let matched = 0;

    const products = await this.productsRepository.find({ where: { id: In(productIds) } });
    for (const product of products) {
      product.categoryId = categoryId;
      product.categoryPath = this.buildCategoryPath(category);
      await this.productsRepository.save(product);
      matched++;
    }

    this.logger.log(`Toplu kategori eslestirmesi: ${matched} urun -> ${category.name}`);
    return { success: true, matched, categoryName: category.name };
  }

  async matchAuto(productIds?: string[], threshold: number = 60): Promise<{
    success: boolean;
    matched: number;
    total: number;
    results: Array<{ productId: string; productName: string; matchedCategoryId: string; matchedCategoryName: string; score: number }>;
  }> {
    // Kategorileri yukle
    const categories = await this.categoriesRepository.find({ where: { isActive: true } });
    if (categories.length === 0) {
      throw new NotFoundException('Hic kategori bulunamadi, once kategori olusturun');
    }

    // Eslesecek urunleri yukle
    let products: Product[];
    if (productIds && productIds.length > 0) {
      products = await this.productsRepository.find({ where: { id: In(productIds) } });
    } else {
      // Kategorisi olmayan tum urunler
      products = await this.productsRepository.find({ where: { categoryId: IsNull() } });
    }

    if (products.length === 0) {
      return { success: true, matched: 0, total: 0, results: [] };
    }

    const results: Array<{ productId: string; productName: string; matchedCategoryId: string; matchedCategoryName: string; score: number }> = [];
    let matched = 0;

    for (const product of products) {
      const bestMatch = this.findBestCategoryMatch(product, categories, threshold);
      if (bestMatch) {
        product.categoryId = bestMatch.category.id;
        product.categoryPath = this.buildCategoryPath(bestMatch.category);
        await this.productsRepository.save(product);
        matched++;
        results.push({
          productId: product.id,
          productName: product.name,
          matchedCategoryId: bestMatch.category.id,
          matchedCategoryName: bestMatch.category.name,
          score: bestMatch.score,
        });
      }
    }

    this.logger.log(`AI kategori eslestirmesi: ${matched}/${products.length} urun eslestirildi`);
    return { success: true, matched, total: products.length, results };
  }

  // === YARDIMCI METODLAR ===

  private buildCategoryPath(category: Category): string {
    return category.name;
  }

  private findBestCategoryMatch(
    product: Product,
    categories: Category[],
    threshold: number,
  ): { category: Category; score: number } | null {
    let bestScore = 0;
    let bestCategory: Category | null = null;

    const searchText = this.normalizeText(`${product.name} ${product.description || ''} ${product.brand || ''}`);

    for (const category of categories) {
      const score = this.calculateSimilarity(searchText, category);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory ? { category: bestCategory, score: bestScore } : null;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[ç]/g, 'c')
      .replace(/[ğ]/g, 'g')
      .replace(/[ı]/g, 'i')
      .replace(/[ö]/g, 'o')
      .replace(/[ş]/g, 's')
      .replace(/[ü]/g, 'u')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateSimilarity(searchText: string, category: Category): number {
    const categoryTerms = this.normalizeText(category.name).split(' ');
    const productTerms = searchText.split(' ');
    const productTermSet = new Set(productTerms);

    let matchScore = 0;
    let totalTerms = categoryTerms.length;

    // 1. Direkt eslesme
    const categoryNameNorm = this.normalizeText(category.name);
    if (searchText.includes(categoryNameNorm)) {
      matchScore += 50;
    }

    // 2. Kelime bazli eslesme
    for (const term of categoryTerms) {
      if (term.length < 2) continue;
      if (productTermSet.has(term)) {
        matchScore += 20;
      } else {
        for (const pTerm of productTerms) {
          if (pTerm.length >= 3 && (pTerm.includes(term) || term.includes(pTerm))) {
            matchScore += 10;
            break;
          }
        }
      }
    }

    // 3. Alt kategori kontrolu
    if (category.children && category.children.length > 0) {
      for (const child of category.children) {
        const childNorm = this.normalizeText(child.name);
        if (searchText.includes(childNorm)) {
          matchScore += 15;
        }
      }
    }

    // Skoru normalize et
    const maxScore = 50 + (totalTerms * 20) + 15;
    const normalizedScore = Math.round((matchScore / Math.max(maxScore, 1)) * 100);

    return normalizedScore;
  }
}
