import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Variant } from './variant.entity';

@Injectable()
export class VariantsService {
  private readonly logger = new Logger(VariantsService.name);

  constructor(
    @InjectRepository(Variant)
    private variantsRepository: Repository<Variant>,
  ) {}

  async create(data: Partial<Variant>): Promise<Variant> {
    const variant = this.variantsRepository.create(data);
    return this.variantsRepository.save(variant);
  }

  async findByProduct(productId: string): Promise<Variant[]> {
    return this.variantsRepository.find({
      where: { productId, isActive: true },
      order: { type: 'ASC', value: 'ASC' },
    });
  }

  async findAll(page = 1, limit = 10, productId?: string) {
    const where: any = {};
    if (productId) where.productId = productId;

    const [data, total] = await this.variantsRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { product: true },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Variant> {
    const variant = await this.variantsRepository.findOne({
      where: { id },
      relations: { product: true },
    });
    if (!variant) throw new NotFoundException('Varyant bulunamadi');
    return variant;
  }

  async update(id: string, data: Partial<Variant>): Promise<Variant> {
    const variant = await this.findById(id);
    Object.assign(variant, data);
    return this.variantsRepository.save(variant);
  }

  async remove(id: string): Promise<void> {
    const result = await this.variantsRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Varyant bulunamadi');
  }

  async bulkCreate(variants: Partial<Variant>[]): Promise<Variant[]> {
    const created = this.variantsRepository.create(variants);
    return this.variantsRepository.save(created);
  }

  async bulkUpdateStock(items: { id: string; stock: number }[]): Promise<void> {
    for (const item of items) {
      await this.variantsRepository.update(item.id, { stock: item.stock });
    }
  }
}
