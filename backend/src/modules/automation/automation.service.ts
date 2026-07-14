import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Automation, AutomationType, AutomationStatus, AutomationFrequency } from './automation.entity';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectRepository(Automation)
    private automationRepository: Repository<Automation>,
  ) {}

  async create(data: Partial<Automation>): Promise<Automation> {
    const automation = this.automationRepository.create(data);
    return this.automationRepository.save(automation);
  }

  async findAll(page = 1, limit = 10, type?: AutomationType, status?: AutomationStatus) {
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [data, total] = await this.automationRepository.findAndCount({
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

  async findById(id: string): Promise<Automation> {
    const automation = await this.automationRepository.findOne({ where: { id } });
    if (!automation) throw new NotFoundException('Otomasyon bulunamadi');
    return automation;
  }

  async update(id: string, data: Partial<Automation>): Promise<Automation> {
    const automation = await this.findById(id);
    Object.assign(automation, data);
    return this.automationRepository.save(automation);
  }

  async toggleStatus(id: string): Promise<Automation> {
    const automation = await this.findById(id);
    automation.isActive = !automation.isActive;
    automation.status = automation.isActive ? AutomationStatus.ACTIVE : AutomationStatus.INACTIVE;
    return this.automationRepository.save(automation);
  }

  async runNow(id: string): Promise<Automation> {
    const automation = await this.findById(id);
    automation.lastRunAt = new Date();
    automation.runCount++;
    automation.status = AutomationStatus.RUNNING;
    
    try {
      await this.executeAutomation(automation);
      automation.lastRunResult = 'success';
      automation.status = AutomationStatus.ACTIVE;
    } catch (error) {
      automation.lastRunResult = `error: ${error.message}`;
      automation.failCount++;
      automation.status = AutomationStatus.FAILED;
    }

    return this.automationRepository.save(automation);
  }

  private async executeAutomation(automation: Automation): Promise<void> {
    this.logger.log(`Otomasyon calistiriliyor: ${automation.name} (${automation.type})`);
    
    switch (automation.type) {
      case AutomationType.PRICE_UPDATE:
        // Fiyat guncelleme mantigi
        break;
      case AutomationType.STOCK_SYNC:
        // Stok senkronizasyonu
        break;
      case AutomationType.PRODUCT_IMPORT:
        // Urun importu
        break;
      case AutomationType.MARKETPLACE_SYNC:
        // Pazaryeri senkronizasyonu
        break;
      case AutomationType.REPORT_GENERATION:
        // Rapor olusturma
        break;
      case AutomationType.DISCOUNT_APPLY:
        // Indirim uygulama
        break;
      case AutomationType.INVENTORY_ALERT:
        // Stok uyarisi
        break;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledAutomations() {
    const dueAutomations = await this.automationRepository.find({
      where: {
        isActive: true,
        nextRunAt: LessThanOrEqual(new Date()),
      },
    });

    for (const automation of dueAutomations) {
      await this.runNow(automation.id);
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.automationRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Otomasyon bulunamadi');
  }
}
