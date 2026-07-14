import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AutomationService } from './automation.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { AutomationType, AutomationStatus } from './automation.entity';

@ApiTags('Automation')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Yeni otomasyon ekle' })
  create(@Body() data: any) {
    return this.automationService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'Otomasyonlari listele' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('type') type?: AutomationType,
    @Query('status') status?: AutomationStatus,
  ) {
    return this.automationService.findAll(+page, +limit, type, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Otomasyon detayi' })
  findOne(@Param('id') id: string) {
    return this.automationService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Otomasyon guncelle' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.automationService.update(id, data);
  }

  @Post(':id/toggle')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Otomasyon durumunu degistir' })
  toggleStatus(@Param('id') id: string) {
    return this.automationService.toggleStatus(id);
  }

  @Post(':id/run')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Otomasyonu simdi calistir' })
  runNow(@Param('id') id: string) {
    return this.automationService.runNow(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Otomasyon sil' })
  remove(@Param('id') id: string) {
    return this.automationService.remove(id);
  }
}
