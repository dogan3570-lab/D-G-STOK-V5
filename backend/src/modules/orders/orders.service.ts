import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}
  async findAll(page = 1, limit = 10) {
    const [data, total] = await this.ordersRepository.findAndCount({ relations: { items: true }, skip: (page-1)*limit, take: limit, order: { createdAt: 'DESC' } });
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total/limit) } };
  }
  async findById(id: string): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id }, relations: { items: true } });
    if (!order) throw new Error('Siparis bulunamadi');
    return order;
  }
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.findById(id);
    order.status = status;
    return this.ordersRepository.save(order);
  }
}


