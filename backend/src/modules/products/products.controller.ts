import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'; 
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'; 
import { AuthGuard } from '@nestjs/passport'; 
import { ProductsService } from './products.service'; 
import { RolesGuard } from '../../common/guards/roles.guard'; 
 
@ApiTags('Products') 
@ApiBearerAuth() 
@UseGuards(AuthGuard('jwt'), RolesGuard) 
@Controller('products') 
export class ProductsController { 
  constructor(private readonly productsService: ProductsService) {} 
 
  @Get() 
  @ApiOperation({ summary: 'Urunleri listele' }) 
  findAll(@Query('page') page = 1, @Query('limit') limit = 10) { 
    return this.productsService.findAll(+page, +limit); 
  } 
 
  @Get(':id') 
  @ApiOperation({ summary: 'Urun detayi' }) 
  findOne(@Param('id') id: string) { 
    return this.productsService.findById(id); 
  } 
} 
