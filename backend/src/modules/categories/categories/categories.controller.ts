import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CategoriesService } from './categories.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/user.entity';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Tum kategorileri listele' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('products')
  @ApiOperation({ summary: 'Kategorilendirilecek urunleri listele (sayfali)' })
  getProductsForMatching(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('matched') matched?: string,
  ) {
    return this.categoriesService.getProductsForMatching(+page, +limit, { search, categoryId, matched });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kategori detayi' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Kategori olustur (Admin)' })
  create(@Body() data: any) {
    return this.categoriesService.create(data);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Kategori guncelle (Admin)' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.categoriesService.update(id, data);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Kategori sil (Admin)' })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  // === KATEGORI ESLESTIRME ENDPOINTS ===

  @Post('match/single')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Tek urun icin kategori ata' })
  matchSingle(@Body() body: { productId: string; categoryId: string }) {
    return this.categoriesService.matchSingle(body.productId, body.categoryId);
  }

  @Post('match/bulk')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Toplu urun kategori atama' })
  matchBulk(@Body() body: { productIds: string[]; categoryId: string }) {
    return this.categoriesService.matchBulk(body.productIds, body.categoryId);
  }

  @Post('match/auto')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Yapay zeka ile otomatik kategori eslestirmesi' })
  matchAuto(@Body() body: { productIds?: string[]; threshold?: number }) {
    return this.categoriesService.matchAuto(body.productIds, body.threshold || 60);
  }
}
