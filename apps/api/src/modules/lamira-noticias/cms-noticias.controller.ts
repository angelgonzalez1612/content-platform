import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { NoticiasService } from './noticias.service';
import { createNoticiaSchema, updateNoticiaSchema } from './dto/noticia.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { RevalidatesSite } from '../site-revalidation/revalidates-site.decorator';

@UseGuards(JwtAuthGuard)
@RevalidatesSite('la-mira')
@Controller('cms/lamira/noticias')
export class CmsNoticiasController {
  constructor(private readonly noticiasService: NoticiasService) {}

  @Get()
  findAll() {
    return this.noticiasService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.noticiasService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.noticiasService.create(createNoticiaSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.noticiasService.update(id, updateNoticiaSchema.parse(body));
  }

  // Eliminar es solo para administradores (no hay papelera: queda una copia en
  // el historial de versiones, ver noticias.service.ts).
  @Delete(':id')
  remove(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    return this.noticiasService.remove(id);
  }
}
