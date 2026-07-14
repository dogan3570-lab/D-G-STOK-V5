import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { MessageStatus } from './message.entity';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Yeni mesaj gonder (herkese acik)' })
  create(@Body() data: any) {
    return this.messagesService.create(data);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Mesajlari listele' })
  findAll(@Query('page') page = 1, @Query('limit') limit = 10, @Query('status') status?: MessageStatus) {
    return this.messagesService.findAll(+page, +limit, status);
  }

  @Get('unread-count')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Okunmamis mesaj sayisi' })
  getUnreadCount() {
    return this.messagesService.getUnreadCount();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Mesaj detayi' })
  findOne(@Param('id') id: string) {
    return this.messagesService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Mesaj guncelle' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.messagesService.update(id, data);
  }

  @Put(':id/reply')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Mesaja yanit ver' })
  reply(@Param('id') id: string, @Body('reply') reply: string, @Req() req: any) {
    return this.messagesService.reply(id, reply, req.user.id);
  }

  @Put(':id/read')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Mesaji okundu olarak isaretle' })
  markAsRead(@Param('id') id: string) {
    return this.messagesService.markAsRead(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mesaj sil' })
  remove(@Param('id') id: string) {
    return this.messagesService.remove(id);
  }
}
