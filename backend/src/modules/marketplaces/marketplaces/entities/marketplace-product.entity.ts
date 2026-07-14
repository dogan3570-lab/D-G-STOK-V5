import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('marketplace_products')
export class MarketplaceProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  productId: string;

  @Column()
  marketplace: string;

  @Column({ nullable: true })
  marketplaceProductId: string;

  @Column({ nullable: true })
  marketplaceListingId: string;

  @Column({ default: false })
  isListed: boolean;

  @Column({ type: 'json', nullable: true })
  marketplaceData: Record<string, any>;

  @Column({ nullable: true })
  lastSyncAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
