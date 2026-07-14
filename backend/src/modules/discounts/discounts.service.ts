import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discount } from './discount.entity';
import { Product } from '../products/product.entity';

@Injectable()
export class DiscountsService {
  private readonly logger = new Logger(DiscountsService.name);

  constructor(
    @InjectRepository(Discount)
    private discountsRepository: Repository<Discount>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Discount[]> {
    return this.discountsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Discount> {
    const discount = await this.discountsRepository.findOne({ where: { id } });
    if (!discount) throw new NotFoundException('Indirim bulunamadi');
    return discount;
  }

  async create(data: Partial<Discount>): Promise<Discount> {
    const discount = this.discountsRepository.create(data);
    const saved = await this.discountsRepository.save(discount);
    
    // Otomatik uygula
    if (saved.isAutomatic && saved.isActive) {
      await this.applyDiscount(saved);
    }
    
    return saved;
  }

  async update(id: string, data: Partial<Discount>): Promise<Discount> {
    const discount = await this.findById(id);
    Object.assign(discount, data);
    const saved = await this.discountsRepository.save(discount);
    
    // Otomatik uygula
    if (saved.isAutomatic && saved.isActive) {
      await this.applyDiscount(saved);
    }
    
    return saved;
  }

  async remove(id: string): Promise<void> {
    const discount = await this.findById(id);
    
    // Indirimi geri al
    await this.removeDiscountFromProducts(discount);
    
    await this.discountsRepository.remove(discount);
  }

  async applyDiscount(discount: Discount): Promise<{ applied: number }> {
    let products: Product[] = [];

    if (discount.type === 'category' && discount.categoryId) {
      // Kategori bazli - categoryPath icinde gecen urunleri bul
      products = await this.productsRepository.find({ where: { isActive: true } });
      products = products.filter(p => p.categoryPath?.includes(discount.categoryName || ''));
    } else if (discount.type === 'product') {
      // Butun aktif urunlere uygula
      products = await this.productsRepository.find({ where: { isActive: true } });
    }

    for (const product of products) {
      const discountedPrice = product.price * (1 - discount.rate / 100);
      product.comparedPrice = discountedPrice;
      product.discountRate = discount.rate;
      await this.productsRepository.save(product);
    }

    this.logger.log(`Indirim uygulandi: ${discount.name} - ${products.length} urun`);
    return { applied: products.length };
  }

  async applyDiscountToProducts(discountId: string, productIds: string[]): Promise<{ applied: number }> {
    const discount = await this.findById(discountId);
    let applied = 0;

    for (const productId of productIds) {
      try {
        const product = await this.productsRepository.findOne({ where: { id: productId } });
        if (product) {
          const discountedPrice = product.price * (1 - discount.rate / 100);
          product.comparedPrice = discountedPrice;
          product.discountRate = discount.rate;
          await this.productsRepository.save(product);
          applied++;
        }
      } catch (err) {
        this.logger.warn(`Indirim uygulanamadi: ${productId}`);
      }
    }

    return { applied };
  }

  private async removeDiscountFromProducts(discount: Discount): Promise<void> {
    let products: Product[] = [];

    if (discount.type === 'category' && discount.categoryName) {
      products = await this.productsRepository.find({ where: { isActive: true } });
      products = products.filter(p => p.categoryPath?.includes(discount.categoryName || ''));
    } else {
      products = await this.productsRepository.find({ where: { discountRate: discount.rate } });
    }

    for (const product of products) {
      if (product.discountRate === discount.rate) {
        product.comparedPrice = 0;
        product.discountRate = 0;
        await this.productsRepository.save(product);
      }
    }

    this.logger.log(`Indirim kaldirildi: ${discount.name}`);
  }
}
