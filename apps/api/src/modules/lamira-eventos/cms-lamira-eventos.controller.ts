import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LamiraEventosService } from './lamira-eventos.service';
import { createLamiraEventoSchema, updateLamiraEventoSchema } from './dto/lamira-evento.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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
}
