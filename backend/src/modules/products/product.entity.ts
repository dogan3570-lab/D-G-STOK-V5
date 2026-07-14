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

  @Column({ length: 36, nullable: true })
  categoryId: string;
 
  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  shortDescription: string;

  @Column({ type: 'text', nullable: true })
  metaTitle: string;

  @Column({ type: 'text', nullable: true })
  metaDescription: string;
 
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  comparedPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  purchasePrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discountRate: number;

  @Column({ type: 'int', default: 0 })
  vatRate: number;
 
  @Column({ type: 'int', default: 0 })
  stock: number;
 
  @Column({ type: 'int', default: 0 })
  criticalStock: number;

  @Column({ length: 200, nullable: true })
  brand: string;

  @Column({ length: 500, nullable: true })
  categoryPath: string;

  @Column({ type: 'simple-array', nullable: true })
  images: string[];

  @Column({ length: 500, nullable: true })
  image: string;

  @Column({ length: 100, nullable: true })
  variantGroup: string;

  @Column({ length: 200, nullable: true })
  variantValue: string;

  @Column({ length: 50, nullable: true })
  variantType: string;

  @Column({ default: false })
  vatIncluded: boolean;

  @Column({ length: 50, nullable: true })
  source: string;

  @Column({ length: 255, nullable: true })
  sourceFile: string;
 
  @Column({ default: true })
  isActive: boolean;
 
  @CreateDateColumn()
  createdAt: Date;
 
  @UpdateDateColumn()
  updatedAt: Date;
}
