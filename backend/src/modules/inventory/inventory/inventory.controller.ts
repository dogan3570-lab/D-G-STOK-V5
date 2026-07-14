import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InventoryService } from './inventory.service';
import { MovementType } from './inventory-movement.entity';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/user.entity';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock/:productId')
  @ApiOperation({ summary: 'Urun stok durumu' })
  async getStock(@Param('productId') productId: string) {
    const stock = await this.inventoryService.getStockByProductId(productId);
    return { productId, stock };
  }

  @Get('stock/sku/:sku')
  @ApiOperation({ summary: 'SKU ile stok sorgula' })
  async getStockBySku(@Param('sku') sku: string) {
    const stock = await this.inventoryService.getStockBySku(sku);
    return { sku, stock };
  }

  @Post('movement')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Stok hareketi ekle' })
  async addMovement(@Body() data: {
    productId: string;
    sku: string;
    movementType: MovementType;
    quantity: number;
    referenceId?: string;
    referenceType?: string;
    description?: string;
  }) {
    return this.inventoryService.addMovement(data);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Stok hareketlerini listele' })
  async getMovements(
    @Query('productId') productId?: string,
    @Query('sku') sku?: string,
    @Query('movementType') movementType?: MovementType,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.inventoryService.getMovements(productId, sku, movementType, +page, +limit);
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Kritik stoktaki urunler' })
  async getLowStock(@Query('threshold') threshold = 10) {
    return this.inventoryService.getLowStockProducts(+threshold);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Stok ozeti' })
  async getSummary() {
    return this.inventoryService.getStockSummary();
  }
}
