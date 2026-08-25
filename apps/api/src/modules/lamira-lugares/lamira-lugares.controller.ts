import { Controller, Get, Param, Query } from '@nestjs/common';
import { LamiraLugaresService } from './lamira-lugares.service';
import { queryLamiraLugaresSchema } from './dto/lamira-lugar.dto';

@Controller('lamira/lugares')
export class LamiraLugaresController {
  constructor(private readonly lugaresService: LamiraLugaresService) {}

  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return this.lugaresService.findAll(queryLamiraLugaresSchema.parse(query));
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.lugaresService.findBySlug(slug);
  }
}
