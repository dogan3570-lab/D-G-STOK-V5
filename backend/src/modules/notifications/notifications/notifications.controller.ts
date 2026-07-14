import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { RolesGuard } from '../../../common/guards/roles.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bildirimleri listele' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.notificationsService.findAll(+page, +limit);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Okunmamis bildirimler' })
  findUnread() {
    return this.notificationsService.findUnread();
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Okunmamis bildirim sayisi' })
  getUnreadCount() {
    return this.notificationsService.getUnreadCount();
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Bildirimi okundu isaretle' })
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Tum bildirimleri okundu isaretle' })
  markAllAsRead() {
    return this.notificationsService.markAllAsRead();
  }
}
