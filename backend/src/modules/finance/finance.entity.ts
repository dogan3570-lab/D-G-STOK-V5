import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum FinanceType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
}

export enum FinanceCategory {
  SALES = 'sales',
  PURCHASE = 'purchase',
  SHIPPING = 'shipping',
  COMMISSION = 'commission',
  TAX = 'tax',
  SALARY = 'salary',
  RENT = 'rent',
  UTILITY = 'utility',
  OTHER = 'other',
}

@Entity('finance_records')
export class FinanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50 })
  @Index()
  type: FinanceType;

  @Column({ length: 50, default: FinanceCategory.OTHER })
  category: FinanceCategory;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 500 })
  description: string;

  @Column({ nullable: true })
  referenceId: string; // Siparis no, fatura no vb.

  @Column({ nullable: true })
  referenceType: string; // order, invoice, vb.

  @Column({ nullable: true })
  paymentMethod: string; // kredi karti, havale, nakit

  @Column({ type: 'date', nullable: true })
  transactionDate: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
