import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment, ShipmentStatus, ShipmentProvider } from './shipment.entity';

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    @InjectRepository(Shipment)
    private shipmentsRepository: Repository<Shipment>,
  ) {}

  async create(data: Partial<Shipment>): Promise<Shipment> {
    const shipment = this.shipmentsRepository.create(data);
    return this.shipmentsRepository.save(shipment);
  }

  async findAll(page = 1, limit = 10, status?: ShipmentStatus) {
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await this.shipmentsRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByOrder(orderId: string): Promise<Shipment[]> {
    return this.shipmentsRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepository.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Kargo kaydi bulunamadi');
    return shipment;
  }

  async findByTracking(trackingNumber: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepository.findOne({ where: { trackingNumber } });
    if (!shipment) throw new NotFoundException('Kargo takip numarasi bulunamadi');
    return shipment;
  }

  async update(id: string, data: Partial<Shipment>): Promise<Shipment> {
    const shipment = await this.findById(id);
    Object.assign(shipment, data);
    return this.shipmentsRepository.save(shipment);
  }

  async updateStatus(id: string, status: ShipmentStatus): Promise<Shipment> {
    const shipment = await this.findById(id);
    shipment.status = status;
    if (status === ShipmentStatus.DELIVERED) {
      shipment.deliveredAt = new Date();
    }
    return this.shipmentsRepository.save(shipment);
  }

  async remove(id: string): Promise<void> {
    const result = await this.shipmentsRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Kargo kaydi bulunamadi');
  }
}
