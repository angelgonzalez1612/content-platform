import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ReportajesService } from './reportajes.service';
import { createReportajeSchema, updateReportajeSchema } from './dto/reportaje.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { RevalidatesSite } from '../site-revalidation/revalidates-site.decorator';

@UseGuards(JwtAuthGuard)
@RevalidatesSite('la-mira')
@Controller('cms/lamira/reportajes')
export class CmsReportajesController {
  constructor(private readonly reportajesService: ReportajesService) {}

  @Get()
  findAll() {
    return this.reportajesService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportajesService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.reportajesService.create(createReportajeSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.reportajesService.update(id, updateReportajeSchema.parse(body));
  }

  // Eliminar es solo para administradores (no hay papelera: queda una copia en
  // el historial de versiones, ver reportajes.service.ts).
  @Delete(':id')
  remove(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    return this.reportajesService.remove(id);
  }
}
