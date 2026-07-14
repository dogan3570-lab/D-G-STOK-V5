import { Controller, Post, Get, Delete, Param, UseInterceptors, UploadedFile, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('Import')
@Controller('import')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('xml')
  @ApiOperation({ summary: 'XML dosyasi ile urun import et' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importXml(@UploadedFile() file: Express.Multer.File) {
    return this.importService.importXml(file);
  }

  @Post('excel')
  @ApiOperation({ summary: 'Excel dosyasi ile urun import et' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    return this.importService.importExcel(file);
  }

  @Get('history')
  @ApiOperation({ summary: 'Import gecmisini listele' })
  async getHistory() {
    return this.importService.getHistory();
  }

  @Delete('history/:id')
  @ApiOperation({ summary: 'Import kaydini sil' })
  async deleteHistory(@Param('id') id: string) {
    return this.importService.deleteHistory(id);
  }
}
