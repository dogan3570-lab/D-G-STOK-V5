import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}
  async findAll(page = 1, limit = 10) {
    const [data, total] = await this.productsRepository.findAndCount({ skip: (page-1)*limit, take: limit, order: { createdAt: 'DESC' } });
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total/limit) } };
  }
  async findById(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Urun bulunamadi');
    return product;
  }
}
