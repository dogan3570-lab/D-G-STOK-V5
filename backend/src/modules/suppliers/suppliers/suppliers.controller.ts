import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SuppliersService } from './suppliers.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/user.entity';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Yeni tedarikci ekle' })
  create(@Body() data: any) {
    return this.suppliersService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'Tedarikcileri listele' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.suppliersService.findAll(+page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Tedarikci detayi' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tedarikci guncelle' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.suppliersService.update(id, data);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tedarikci sil' })
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}
