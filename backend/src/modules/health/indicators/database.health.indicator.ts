import { Injectable } from '@nestjs/common';  
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';  
import { InjectDataSource } from '@nestjs/typeorm';  
import { DataSource } from 'typeorm';  
  
@Injectable()  
export class DatabaseHealthIndicator extends HealthIndicator {  
  constructor(@InjectDataSource() private dataSource: DataSource) { super(); }  
  async isHealthy(key: string): Promise<HealthIndicatorResult> { try { await this.dataSource.query('SELECT 1'); return this.getStatus(key, true); } catch { return this.getStatus(key, false, { message: 'Database connection failed' }); } }  
} 
