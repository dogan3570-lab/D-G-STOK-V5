import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { VariantsService } from './variants.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('Variants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('variants')
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Yeni varyant ekle' })
  create(@Body() data: any) {
    return this.variantsService.create(data);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Toplu varyant ekle' })
  bulkCreate(@Body() data: any[]) {
    return this.variantsService.bulkCreate(data);
  }

  @Get()
  @ApiOperation({ summary: 'Varyantlari listele' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 10, @Query('productId') productId?: string) {
    return this.variantsService.findAll(+page, +limit, productId);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Urune ait varyantlari getir' })
  findByProduct(@Param('productId') productId: string) {
    return this.variantsService.findByProduct(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Varyant detayi' })
  findOne(@Param('id') id: string) {
    return this.variantsService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Varyant guncelle' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.variantsService.update(id, data);
  }

  @Put('bulk-stock')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Toplu stok guncelle' })
  bulkUpdateStock(@Body() items: { id: string; stock: number }[]) {
    return this.variantsService.bulkUpdateStock(items);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Varyant sil' })
  remove(@Param('id') id: string) {
    return this.variantsService.remove(id);
  }
}
