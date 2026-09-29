import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { LamiraEventosService } from './lamira-eventos.service';
import { createLamiraEventoSchema, updateLamiraEventoSchema } from './dto/lamira-evento.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { RevalidatesSite } from '../site-revalidation/revalidates-site.decorator';

@UseGuards(JwtAuthGuard)
@RevalidatesSite('la-mira')
@Controller('cms/lamira/eventos')
export class CmsLamiraEventosController {
  constructor(private readonly eventosService: LamiraEventosService) {}

  @Get()
  findAll() {
    return this.eventosService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventosService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.eventosService.create(createLamiraEventoSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.eventosService.update(id, updateLamiraEventoSchema.parse(body));
  }

  // Eliminar es solo para administradores (no hay papelera: queda una copia en
  // el historial de versiones, ver lamira-eventos.service.ts).
  @Delete(':id')
  remove(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    return this.eventosService.remove(id);
  }
}
