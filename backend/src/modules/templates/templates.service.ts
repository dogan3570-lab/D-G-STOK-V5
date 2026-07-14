import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListingTemplate } from './template.entity';
import { Product } from '../products/product.entity';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectRepository(ListingTemplate)
    private templatesRepository: Repository<ListingTemplate>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<ListingTemplate[]> {
    return this.templatesRepository.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<ListingTemplate> {
    const template = await this.templatesRepository.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Sablon bulunamadi');
    return template;
  }

  async findByCategory(categoryId: string): Promise<ListingTemplate | null> {
    return this.templatesRepository.findOne({ where: { categoryId, isActive: true } });
  }

  async create(data: Partial<ListingTemplate>): Promise<ListingTemplate> {
    const template = this.templatesRepository.create(data);
    return this.templatesRepository.save(template);
  }

  async update(id: string, data: Partial<ListingTemplate>): Promise<ListingTemplate> {
    const template = await this.findById(id);
    Object.assign(template, data);
    return this.templatesRepository.save(template);
  }

  async remove(id: string): Promise<void> {
    const template = await this.findById(id);
    await this.templatesRepository.remove(template);
  }

  async applyTemplate(templateId: string, productIds: string[]): Promise<{ applied: number; errors: string[] }> {
    const template = await this.findById(templateId);
    const errors: string[] = [];
    let applied = 0;

    for (const productId of productIds) {
      try {
        const product = await this.productsRepository.findOne({ where: { id: productId } });
        if (!product) {
          errors.push(`Urun bulunamadi: ${productId}`);
          continue;
        }

        // Apply template variables
        const vars = this.getTemplateVariables(product);
        
        if (template.titleTemplate) {
          product.name = this.replaceVariables(template.titleTemplate, vars);
        }
        if (template.descriptionTemplate) {
          product.description = this.replaceVariables(template.descriptionTemplate, vars);
        }
        if (template.shortDescriptionTemplate) {
          product.shortDescription = this.replaceVariables(template.shortDescriptionTemplate, vars);
        }
        if (template.metaTitleTemplate) {
          product.metaTitle = this.replaceVariables(template.metaTitleTemplate, vars);
        }
        if (template.metaDescriptionTemplate) {
          product.metaDescription = this.replaceVariables(template.metaDescriptionTemplate, vars);
        }

        await this.productsRepository.save(product);
        applied++;
      } catch (err: any) {
        errors.push(`Urun ${productId}: ${err.message}`);
      }
    }

    return { applied, errors };
  }

  private getTemplateVariables(product: Product): Record<string, string> {
    return {
      '{URUN_ADI}': product.name || '',
      '{URUN_SKU}': product.sku || '',
      '{URUN_BARKOD}': product.barcode || '',
      '{URUN_FIYAT}': String(product.price || ''),
      '{URUN_INDIRIMLI_FIYAT}': String(product.comparedPrice || product.price || ''),
      '{URUN_MARKA}': product.brand || '',
      '{URUN_KATEGORI}': product.categoryPath || '',
      '{URUN_ACIKLAMA}': product.description || '',
      '{URUN_STOK}': String(product.stock || ''),
      '{SITE_ADI}': 'D&G STORE',
    };
  }

  private replaceVariables(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\{$&\\}'), 'g'), value);
    }
    return result;
  }
}
