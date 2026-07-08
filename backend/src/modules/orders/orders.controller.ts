import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from './orders.service';
import { OrderStatus } from './order.entity';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}
  @Get()
  @ApiOperation({ summary: 'Siparisleri listele' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 10) { return this.ordersService.findAll(+page, +limit); }
  @Get(':id')
  @ApiOperation({ summary: 'Siparis detayi' })
  findOne(@Param('id') id: string) { return this.ordersService.findById(id); }
  @Patch(':id/status')
  @ApiOperation({ summary: 'Siparis durumu guncelle' })
  updateStatus(@Param('id') id: string, @Body('status') status: OrderStatus) { return this.ordersService.updateStatus(id, status); }
}
