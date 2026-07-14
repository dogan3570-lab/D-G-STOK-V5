import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './supplier.entity';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    @InjectRepository(Supplier)
    private suppliersRepository: Repository<Supplier>,
  ) {}

  async create(data: Partial<Supplier>): Promise<Supplier> {
    const supplier = this.suppliersRepository.create(data);
    return this.suppliersRepository.save(supplier);
  }

  async findAll(page = 1, limit = 10) {
    const [data, total] = await this.suppliersRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { name: 'ASC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Supplier> {
    const supplier = await this.suppliersRepository.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException('Tedarikci bulunamadi');
    return supplier;
  }

  async update(id: string, data: Partial<Supplier>): Promise<Supplier> {
    const supplier = await this.findById(id);
    Object.assign(supplier, data);
    return this.suppliersRepository.save(supplier);
  }

  async remove(id: string): Promise<void> {
    const result = await this.suppliersRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Tedarikci bulunamadi');
  }
}
