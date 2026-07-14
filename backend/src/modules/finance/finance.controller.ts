import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FinanceService } from './finance.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { FinanceType, FinanceCategory } from './finance.entity';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Yeni finans kaydi ekle' })
  create(@Body() data: any) {
    return this.financeService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'Finans kayitlarini listele' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('type') type?: FinanceType,
    @Query('category') category?: FinanceCategory,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.findAll(+page, +limit, { type, category, startDate, endDate });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Finans ozetini getir' })
  getSummary(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.financeService.getSummary(startDate, endDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Finans kaydi detayi' })
  findOne(@Param('id') id: string) {
    return this.financeService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Finans kaydi guncelle' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.financeService.update(id, data);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Finans kaydi sil' })
  remove(@Param('id') id: string) {
    return this.financeService.remove(id);
  }
}
