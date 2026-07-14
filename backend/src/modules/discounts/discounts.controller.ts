import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DiscountsService } from './discounts.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('Discounts')
@Controller('discounts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get()
  @ApiOperation({ summary: 'Tum indirimleri listele' })
  findAll() {
    return this.discountsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Indirim detayi' })
  findOne(@Param('id') id: string) {
    return this.discountsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Yeni indirim olustur' })
  create(@Body() data: any) {
    return this.discountsService.create(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Indirim guncelle' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.discountsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Indirim sil' })
  remove(@Param('id') id: string) {
    return this.discountsService.remove(id);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Indirimi urunlere uygula' })
  applyToProducts(@Param('id') id: string, @Body() body: { productIds: string[] }) {
    return this.discountsService.applyDiscountToProducts(id, body.productIds);
  }
}
