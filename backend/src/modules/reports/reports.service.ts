import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Product } from '../products/product.entity';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { InventoryMovement } from '../inventory/inventory/inventory-movement.entity';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(InventoryMovement)
    private inventoryRepository: Repository<InventoryMovement>,
  ) {}

  async getDashboardStats() {
    const totalProducts = await this.productsRepository.count();
    const activeProducts = await this.productsRepository.count({ where: { isActive: true } });
    const lowStockProducts = await this.productsRepository.count({ where: { stock: 0 } });
    const criticalStockProducts = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.stock <= product.criticalStock AND product.criticalStock > 0')
      .getCount();

    const totalOrders = await this.ordersRepository.count();
    const pendingOrders = await this.ordersRepository.count({ where: { status: 'pending' as any } });
    
    const revenueResult = await this.ordersRepository
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('order.status NOT IN (:...statuses)', { statuses: ['cancelled', 'returned'] })
      .getRawOne();
    const totalRevenue = Number(revenueResult?.total || 0);

    return {
      totalProducts,
      activeProducts,
      lowStockProducts,
      criticalStockProducts,
      totalOrders,
      pendingOrders,
      totalRevenue,
    };
  }

  async getSalesReport(startDate: string, endDate: string) {
    const orders = await this.ordersRepository.find({
      where: {
        createdAt: Between(new Date(startDate), new Date(endDate)),
        status: 'delivered' as any,
      },
      relations: { items: true },
    });

    const totalSales = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Gunluk satislar
    const dailySales: Record<string, number> = {};
    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      dailySales[date] = (dailySales[date] || 0) + Number(order.totalAmount);
    });

    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      dailySales,
      period: { startDate, endDate },
    };
  }

  async getProductReport() {
    const products = await this.productsRepository.find({
      where: { isActive: true },
      order: { stock: 'ASC' },
    });

    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const averagePrice = totalProducts > 0 
      ? products.reduce((sum, p) => sum + Number(p.price), 0) / totalProducts 
      : 0;
    const lowStockItems = products.filter(p => p.stock <= p.criticalStock && p.criticalStock > 0);
    const outOfStockItems = products.filter(p => p.stock === 0);

    return {
      totalProducts,
      totalStock,
      averagePrice,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      lowStockItems: lowStockItems.slice(0, 20),
      outOfStockItems: outOfStockItems.slice(0, 20),
    };
  }

  async getInventoryReport(startDate: string, endDate: string) {
    const movements = await this.inventoryRepository.find({
      where: {
        createdAt: Between(new Date(startDate), new Date(endDate)),
      },
      order: { createdAt: 'DESC' },
      take: 1000,
    });

    const totalIn = movements
      .filter(m => (m as any).type === 'in')
      .reduce((sum, m) => sum + m.quantity, 0);
    const totalOut = movements
      .filter(m => (m as any).type === 'out')
      .reduce((sum, m) => sum + m.quantity, 0);

    return {
      totalMovements: movements.length,
      totalIn,
      totalOut,
      netChange: totalIn - totalOut,
      recentMovements: movements.slice(0, 50),
    };
  }

  async getCategoryReport() {
    const products = await this.productsRepository.find({
      where: { isActive: true },
    });

    const byCategory: Record<string, { count: number; stock: number; revenue: number }> = {};
    
    products.forEach(product => {
      const cat = product.categoryPath || 'Kategorisiz';
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, stock: 0, revenue: 0 };
      }
      byCategory[cat].count++;
      byCategory[cat].stock += product.stock;
      byCategory[cat].revenue += Number(product.price) * product.stock;
    });

    return {
      categories: Object.entries(byCategory).map(([name, data]) => ({
        name,
        ...data,
      })),
      totalCategories: Object.keys(byCategory).length,
    };
  }
}
