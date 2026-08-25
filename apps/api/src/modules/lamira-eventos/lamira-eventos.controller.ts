import { Controller, Get, Param, Query } from '@nestjs/common';
import { LamiraEventosService } from './lamira-eventos.service';
import { queryLamiraEventosSchema } from './dto/lamira-evento.dto';

@Controller('lamira/eventos')
export class LamiraEventosController {
  constructor(private readonly eventosService: LamiraEventosService) {}

  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return this.eventosService.findAll(queryLamiraEventosSchema.parse(query));
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.eventosService.findBySlug(slug);
  }
}
