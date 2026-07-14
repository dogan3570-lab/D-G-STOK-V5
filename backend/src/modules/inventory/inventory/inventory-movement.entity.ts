import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum MovementType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  ADJUSTMENT = 'adjustment',
  TRANSFER = 'transfer',
  RETURN = 'return',
  SALE = 'sale',
}

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  productId!: string;

  @Column({ length: 100 })
  @Index()
  sku!: string;

  @Column({ type: 'varchar', length: 20, default: MovementType.ADJUSTMENT })
  movementType!: MovementType;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'int', default: 0 })
  stockBefore!: number;

  @Column({ type: 'int', default: 0 })
  stockAfter!: number;

  @Column({ nullable: true })
  referenceId!: string;

  @Column({ nullable: true })
  referenceType!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ nullable: true })
  performedBy!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
