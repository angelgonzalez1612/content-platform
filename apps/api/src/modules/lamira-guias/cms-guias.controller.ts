import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { GuiasService } from './guias.service';
import { createGuiaSchema, updateGuiaSchema } from './dto/guia.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { RevalidatesSite } from '../site-revalidation/revalidates-site.decorator';

@UseGuards(JwtAuthGuard)
@RevalidatesSite('la-mira')
@Controller('cms/lamira/guias')
export class CmsGuiasController {
  constructor(private readonly guiasService: GuiasService) {}

  @Get()
  findAll() {
    return this.guiasService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.guiasService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.guiasService.create(createGuiaSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.guiasService.update(id, updateGuiaSchema.parse(body));
  }

  // Eliminar es solo para administradores (no hay papelera: queda una copia en
  // el historial de versiones, ver guias.service.ts).
  @Delete(':id')
  remove(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    return this.guiasService.remove(id);
  }
}
