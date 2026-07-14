import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplacesController } from './marketplaces.controller';
import { MarketplacesService } from './marketplaces.service';
import { MarketplaceConfig } from './entities/marketplace-config.entity';
import { MarketplaceProduct } from './entities/marketplace-product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketplaceConfig, MarketplaceProduct])],
  controllers: [MarketplacesController],
  providers: [MarketplacesService],
  exports: [MarketplacesService],
})
export class MarketplacesModule {}
