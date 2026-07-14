import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuditLogsService } from './audit-logs.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { AuditAction } from './audit-log.entity';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Yeni log kaydi ekle' })
  create(@Body() data: any) {
    return this.auditLogsService.log(data);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Log kayitlarini listele' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('action') action?: AuditAction,
    @Query('entity') entity?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditLogsService.findAll(+page, +limit, { action, entity, userId, startDate, endDate });
  }

  @Get('recent')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Son aktiviteleri getir' })
  getRecentActivities(@Query('limit') limit = 20) {
    return this.auditLogsService.getRecentActivities(+limit);
  }

  @Get('entity/:entity/:entityId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Entity bazli loglari getir' })
  findByEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.auditLogsService.findByEntity(entity, entityId, +page, +limit);
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Kullanici bazli loglari getir' })
  findByUser(@Param('userId') userId: string, @Query('page') page = 1, @Query('limit') limit = 10) {
    return this.auditLogsService.findByUser(userId, +page, +limit);
  }

  @Delete('clear')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eski loglari temizle' })
  clearOldLogs(@Query('days') days = 90) {
    return this.auditLogsService.clearOldLogs(+days);
  }
}
