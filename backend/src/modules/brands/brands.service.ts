import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Brand } from './brand.entity';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(
    @InjectRepository(Brand)
    private brandsRepository: Repository<Brand>,
  ) {}

  async create(data: Partial<Brand>): Promise<Brand> {
    if (!data.slug && data.name) {
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    const brand = this.brandsRepository.create(data);
    return this.brandsRepository.save(brand);
  }

  async findAll(page = 1, limit = 10, search?: string) {
    const where: any = {};
    if (search) {
      where.name = Like(`%${search}%`);
    }
    const [data, total] = await this.brandsRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAllActive(): Promise<Brand[]> {
    return this.brandsRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Brand> {
    const brand = await this.brandsRepository.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Marka bulunamadi');
    return brand;
  }

  async update(id: string, data: Partial<Brand>): Promise<Brand> {
    const brand = await this.findById(id);
    if (data.name && data.name !== brand.name) {
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    Object.assign(brand, data);
    return this.brandsRepository.save(brand);
  }

  async remove(id: string): Promise<void> {
    const result = await this.brandsRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Marka bulunamadi');
  }
}
