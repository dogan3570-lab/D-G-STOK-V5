import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { FinanceRecord, FinanceType, FinanceCategory } from './finance.entity';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @InjectRepository(FinanceRecord)
    private financeRepository: Repository<FinanceRecord>,
  ) {}

  async create(data: Partial<FinanceRecord>): Promise<FinanceRecord> {
    const record = this.financeRepository.create(data);
    return this.financeRepository.save(record);
  }

  async findAll(page = 1, limit = 10, filters?: {
    type?: FinanceType;
    category?: FinanceCategory;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};
    if (filters?.type) where.type = filters.type;
    if (filters?.category) where.category = filters.category;
    if (filters?.startDate && filters?.endDate) {
      where.transactionDate = Between(new Date(filters.startDate), new Date(filters.endDate));
    }

    const [data, total] = await this.financeRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { transactionDate: 'DESC', createdAt: 'DESC' },
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSummary(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate && endDate) {
      where.transactionDate = Between(new Date(startDate), new Date(endDate));
    }

    const records = await this.financeRepository.find({ where });

    const totalIncome = records
      .filter(r => r.type === FinanceType.INCOME)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const totalExpense = records
      .filter(r => r.type === FinanceType.EXPENSE)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const byCategory = records.reduce((acc: any, r) => {
      if (!acc[r.category]) acc[r.category] = { income: 0, expense: 0 };
      if (r.type === FinanceType.INCOME) acc[r.category].income += Number(r.amount);
      else acc[r.category].expense += Number(r.amount);
      return acc;
    }, {});

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      totalTransactions: records.length,
      byCategory,
    };
  }

  async findById(id: string): Promise<FinanceRecord> {
    const record = await this.financeRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Finans kaydi bulunamadi');
    return record;
  }

  async update(id: string, data: Partial<FinanceRecord>): Promise<FinanceRecord> {
    const record = await this.findById(id);
    Object.assign(record, data);
    return this.financeRepository.save(record);
  }

  async remove(id: string): Promise<void> {
    const result = await this.financeRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Finans kaydi bulunamadi');
  }
}
