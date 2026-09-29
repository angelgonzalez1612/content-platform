import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PlanazoGuidesService } from './guides.service';
import { createGuideSchema, updateGuideSchema } from './dto/guide.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { RevalidatesSite } from '../site-revalidation/revalidates-site.decorator';

@UseGuards(JwtAuthGuard)
@RevalidatesSite('planazo')
@Controller('cms/guides')
export class CmsPlanazoGuidesController {
  constructor(private readonly guidesService: PlanazoGuidesService) {}

  @Get()
  findAll() {
    return this.guidesService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.guidesService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.guidesService.create(createGuideSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.guidesService.update(id, updateGuideSchema.parse(body));
  }

  // Eliminar es solo para administradores (no hay papelera: queda una copia en
  // el historial de versiones, ver guides.service.ts).
  @Delete(':id')
  remove(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    return this.guidesService.remove(id);
  }
}
