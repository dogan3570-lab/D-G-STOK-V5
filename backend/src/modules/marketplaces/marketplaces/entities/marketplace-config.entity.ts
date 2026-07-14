import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum MarketplaceType {
  TRENDYOL = 'trendyol',
  HEPSIBURADA = 'hepsiburada',
  AMAZON = 'amazon',
}

@Entity('marketplace_configs')
export class MarketplaceConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
  })
  marketplace: MarketplaceType;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  credentials: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  settings: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
