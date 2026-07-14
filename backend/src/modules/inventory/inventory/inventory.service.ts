import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovement, MovementType } from './inventory-movement.entity';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryMovement)
    private readonly movementsRepository: Repository<InventoryMovement>,
  ) {}

  async getStockByProductId(productId: string): Promise<number> {
    const result = await this.movementsRepository
      .createQueryBuilder('m')
      .select('SUM(m.quantity)', 'total')
      .where('m.productId = :productId', { productId })
      .getRawOne();

    return parseInt(result?.total) || 0;
  }

  async getStockBySku(sku: string): Promise<number> {
    const result = await this.movementsRepository
      .createQueryBuilder('m')
      .select('SUM(m.quantity)', 'total')
      .where('m.sku = :sku', { sku })
      .getRawOne();

    return parseInt(result?.total) || 0;
  }

  async addMovement(data: {
    productId: string;
    sku: string;
    movementType: MovementType;
    quantity: number;
    referenceId?: string;
    referenceType?: string;
    description?: string;
    performedBy?: string;
  }): Promise<InventoryMovement> {
    if (data.quantity <= 0) {
      throw new BadRequestException('Miktar pozitif olmalidir');
    }

    const currentStock = await this.getStockByProductId(data.productId);
    const adjustedQuantity =
      data.movementType === MovementType.OUTBOUND || data.movementType === MovementType.SALE
        ? -data.quantity
        : data.quantity;

    const stockAfter = currentStock + adjustedQuantity;

    if (stockAfter < 0) {
      throw new BadRequestException('Yetersiz stok');
    }

    const movement = this.movementsRepository.create({
      productId: data.productId,
      sku: data.sku,
      movementType: data.movementType,
      quantity: adjustedQuantity,
      stockBefore: currentStock,
      stockAfter,
      referenceId: data.referenceId,
      referenceType: data.referenceType,
      description: data.description,
      performedBy: data.performedBy,
    });

    const saved = await this.movementsRepository.save(movement);
    this.logger.log(`Stock movement: ${data.sku} (${data.movementType}): ${currentStock} -> ${stockAfter}`);
    return saved;
  }

  async getMovements(
    productId?: string,
    sku?: string,
    movementType?: MovementType,
    page = 1,
    limit = 20,
  ): Promise<{ data: InventoryMovement[]; total: number; page: number; limit: number }> {
    const where: any = {};
    if (productId) where.productId = productId;
    if (sku) where.sku = sku;
    if (movementType) where.movementType = movementType;

    const [data, total] = await this.movementsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getLowStockProducts(criticalStockThreshold = 10): Promise<any[]> {
    return this.movementsRepository
      .createQueryBuilder('m')
      .select('m.productId', 'productId')
      .addSelect('m.sku', 'sku')
      .addSelect('SUM(m.quantity)', 'currentStock')
      .groupBy('m.productId')
      .addGroupBy('m.sku')
      .having('SUM(m.quantity) <= :threshold', { threshold: criticalStockThreshold })
      .getRawMany();
  }

  async getStockSummary(): Promise<{
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
  }> {
    const stockData = await this.movementsRepository
      .createQueryBuilder('m')
      .select('m.productId', 'productId')
      .addSelect('SUM(m.quantity)', 'currentStock')
      .groupBy('m.productId')
      .getRawMany();

    const totalProducts = stockData.length;
    const lowStockCount = stockData.filter((s) => parseInt(s.currentStock) > 0 && parseInt(s.currentStock) <= 10).length;
    const outOfStockCount = stockData.filter((s) => parseInt(s.currentStock) <= 0).length;

    return { totalProducts, lowStockCount, outOfStockCount };
  }
}
