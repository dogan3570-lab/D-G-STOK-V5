import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceConfig, MarketplaceType } from './entities/marketplace-config.entity';
import { MarketplaceProduct } from './entities/marketplace-product.entity';

@Injectable()
export class MarketplacesService {
  private readonly logger = new Logger(MarketplacesService.name);

  constructor(
    @InjectRepository(MarketplaceConfig)
    private readonly configRepository: Repository<MarketplaceConfig>,
    @InjectRepository(MarketplaceProduct)
    private readonly productRepository: Repository<MarketplaceProduct>,
  ) {}

  // Marketplace Config CRUD
  async getConfigs(): Promise<MarketplaceConfig[]> {
    return this.configRepository.find();
  }

  async getConfig(marketplace: MarketplaceType): Promise<MarketplaceConfig> {
    const config = await this.configRepository.findOne({ where: { marketplace } });
    if (!config) throw new NotFoundException(`${marketplace} konfigurasyonu bulunamadi`);
    return config;
  }

  async upsertConfig(
    marketplace: MarketplaceType,
    data: { isActive?: boolean; credentials?: Record<string, any>; settings?: Record<string, any> },
  ): Promise<MarketplaceConfig> {
    let config = await this.configRepository.findOne({ where: { marketplace } });
    if (!config) {
      config = this.configRepository.create({ marketplace, ...data });
    } else {
      Object.assign(config, data);
    }
    return this.configRepository.save(config);
  }

  async deleteConfig(marketplace: MarketplaceType): Promise<void> {
    const result = await this.configRepository.delete({ marketplace });
    if (result.affected === 0) throw new NotFoundException(`${marketplace} konfigurasyonu bulunamadi`);
  }

  // Marketplace Product operations
  async getListedProducts(marketplace?: string, page = 1, limit = 20) {
    const where: any = {};
    if (marketplace) where.marketplace = marketplace;

    const [data, total] = await this.productRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async getProductListing(productId: string, marketplace: string): Promise<MarketplaceProduct | null> {
    return this.productRepository.findOne({ where: { productId, marketplace } });
  }

  async upsertProductListing(data: {
    productId: string;
    marketplace: string;
    marketplaceProductId?: string;
    marketplaceListingId?: string;
    isListed?: boolean;
    marketplaceData?: Record<string, any>;
  }): Promise<MarketplaceProduct> {
    let listing = await this.productRepository.findOne({
      where: { productId: data.productId, marketplace: data.marketplace },
    });

    if (!listing) {
      listing = this.productRepository.create(data);
    } else {
      Object.assign(listing, data);
    }

    listing.lastSyncAt = new Date();
    return this.productRepository.save(listing);
  }

  async bulkSyncProducts(marketplace: string, productIds: string[]): Promise<number> {
    let synced = 0;
    for (const productId of productIds) {
      try {
        await this.upsertProductListing({
          productId,
          marketplace,
          isListed: true,
          marketplaceData: { syncedAt: new Date().toISOString() },
        });
        synced++;
      } catch (error) {
        this.logger.error(`Sync failed for product ${productId} on ${marketplace}: ${error.message}`);
      }
    }
    return synced;
  }
}
