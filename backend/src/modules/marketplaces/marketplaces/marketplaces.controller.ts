import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MarketplacesService } from './marketplaces.service';
import { MarketplaceType } from './entities/marketplace-config.entity';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/user.entity';

@ApiTags('Marketplaces')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('marketplaces')
export class MarketplacesController {
  constructor(private readonly marketplacesService: MarketplacesService) {}

  // Configuration endpoints
  @Get('config')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Pazaryeri konfigurasyonlarini listele' })
  getConfigs() {
    return this.marketplacesService.getConfigs();
  }

  @Get('config/:marketplace')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Pazaryeri konfigurasyon detayi' })
  getConfig(@Param('marketplace') marketplace: MarketplaceType) {
    return this.marketplacesService.getConfig(marketplace);
  }

  @Post('config/:marketplace')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Pazaryeri konfigurasyonu olustur/guncelle' })
  upsertConfig(
    @Param('marketplace') marketplace: MarketplaceType,
    @Body() data: { isActive?: boolean; credentials?: Record<string, any>; settings?: Record<string, any> },
  ) {
    return this.marketplacesService.upsertConfig(marketplace, data);
  }

  @Delete('config/:marketplace')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Pazaryeri konfigurasyonu sil' })
  deleteConfig(@Param('marketplace') marketplace: MarketplaceType) {
    return this.marketplacesService.deleteConfig(marketplace);
  }

  // Product listing endpoints
  @Get('products')
  @ApiOperation({ summary: 'Pazaryeri urun listelerini getir' })
  getListedProducts(
    @Query('marketplace') marketplace?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.marketplacesService.getListedProducts(marketplace, +page, +limit);
  }

  @Get('products/:productId/:marketplace')
  @ApiOperation({ summary: 'Urun pazaryeri listing detayi' })
  getProductListing(
    @Param('productId') productId: string,
    @Param('marketplace') marketplace: string,
  ) {
    return this.marketplacesService.getProductListing(productId, marketplace);
  }

  @Post('products')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Urun pazaryeri listing olustur/guncelle' })
  upsertProductListing(@Body() data: {
    productId: string;
    marketplace: string;
    marketplaceProductId?: string;
    marketplaceListingId?: string;
    isListed?: boolean;
    marketplaceData?: Record<string, any>;
  }) {
    return this.marketplacesService.upsertProductListing(data);
  }

  @Post('sync/:marketplace')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Toplu urun senkronizasyonu' })
  bulkSync(
    @Param('marketplace') marketplace: string,
    @Body() data: { productIds: string[] },
  ) {
    return this.marketplacesService.bulkSyncProducts(marketplace, data.productIds);
  }
}
