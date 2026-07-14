import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TemplatesService } from './templates.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('Templates')
@Controller('templates')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.EDITOR)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Tum sablonlari listele' })
  findAll() {
    return this.templatesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Sablon detayi' })
  findOne(@Param('id') id: string) {
    return this.templatesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Yeni sablon olustur' })
  create(@Body() data: any) {
    return this.templatesService.create(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sablon guncelle' })
  update(@Param('id') id: string, @Body() data: any) {
    return this.templatesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Sablon sil' })
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }

  @Post('apply/:id')
  @ApiOperation({ summary: 'Sablonu urunlere uygula' })
  applyTemplate(@Param('id') id: string, @Body() body: { productIds: string[] }) {
    return this.templatesService.applyTemplate(id, body.productIds);
  }
}
