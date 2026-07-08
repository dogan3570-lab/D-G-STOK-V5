import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'; 
@Entity('products') 
export class Product { 
  @PrimaryGeneratedColumn('uuid') 
  id: string; 
 
  @Column({ length: 100, unique: true }) 
  @Index() 
  sku: string; 
 
  @Column({ length: 200 }) 
  barcode: string; 
 
  @Column({ length: 500 }) 
  name: string; 
 
  @Column({ type: 'text', nullable: true }) 
  description: string; 
 
  @Column({ type: 'decimal', precision: 10, scale: 2 }) 
  price: number; 
 
  @Column({ type: 'int', default: 0 }) 
  stock: number; 
 
  @Column({ type: 'int', default: 0 }) 
  criticalStock: number; 
 
  @Column({ default: true }) 
  isActive: boolean; 
 
  @CreateDateColumn() 
  createdAt: Date; 
 
  @UpdateDateColumn() 
  updatedAt: Date; 
} 
