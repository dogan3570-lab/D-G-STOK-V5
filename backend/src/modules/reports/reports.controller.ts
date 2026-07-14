import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Dashboard istatistikleri' })
  getDashboardStats() {
    return this.reportsService.getDashboardStats();
  }

  @Get('sales')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Satis raporu' })
  getSalesReport(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.reportsService.getSalesReport(startDate, endDate);
  }

  @Get('products')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Urun raporu' })
  getProductReport() {
    return this.reportsService.getProductReport();
  }

  @Get('inventory')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Stok raporu' })
  getInventoryReport(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.reportsService.getInventoryReport(startDate, endDate);
  }

  @Get('categories')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Kategori raporu' })
  getCategoryReport() {
    return this.reportsService.getCategoryReport();
  }
}
