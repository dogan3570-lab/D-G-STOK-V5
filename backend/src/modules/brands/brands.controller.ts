import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BrandsService } from './brands.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('Brands')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Yeni marka ekle' })
  create(@Body() data: any) {
    return this.brandsService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'Markalari listele' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 10, @Query('search') search?: string) {
    return this.brandsService.findAll(+page, +limit, search);
  }

  @Get('active')
  @ApiOperation({ summary: 'Aktif markalari listele' })
  findAllActive() {
    return this.brandsService.findAllActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Marka detayi' })
  findOne(@Param('id') id: string) {
    return this.brandsService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Marka guncelle' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.brandsService.update(id, data);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Marka sil' })
  remove(@Param('id') id: string) {
    return this.brandsService.remove(id);
  }
}
