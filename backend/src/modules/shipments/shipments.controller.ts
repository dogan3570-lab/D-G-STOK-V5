import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ShipmentsService } from './shipments.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { ShipmentStatus } from './shipment.entity';

@ApiTags('Shipments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Yeni kargo kaydi ekle' })
  create(@Body() data: any) {
    return this.shipmentsService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'Kargo kayitlarini listele' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 10, @Query('status') status?: ShipmentStatus) {
    return this.shipmentsService.findAll(+page, +limit, status);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Siparise ait kargo kayitlari' })
  findByOrder(@Param('orderId') orderId: string) {
    return this.shipmentsService.findByOrder(orderId);
  }

  @Get('tracking/:trackingNumber')
  @ApiOperation({ summary: 'Takip numarasina gore kargo sorgula' })
  findByTracking(@Param('trackingNumber') trackingNumber: string) {
    return this.shipmentsService.findByTracking(trackingNumber);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kargo detayi' })
  findOne(@Param('id') id: string) {
    return this.shipmentsService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Kargo kaydi guncelle' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.shipmentsService.update(id, data);
  }

  @Put(':id/status')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Kargo durumu guncelle' })
  updateStatus(@Param('id') id: string, @Body('status') status: ShipmentStatus) {
    return this.shipmentsService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Kargo kaydi sil' })
  remove(@Param('id') id: string) {
    return this.shipmentsService.remove(id);
  }
}
