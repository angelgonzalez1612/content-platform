import { Controller, Get, Param, Query } from '@nestjs/common';
import { GuiasService } from './guias.service';
import { queryGuiasSchema } from './dto/guia.dto';

@Controller('lamira/guias')
export class GuiasController {
  constructor(private readonly guiasService: GuiasService) {}

  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return this.guiasService.findAll(queryGuiasSchema.parse(query));
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.guiasService.findBySlug(slug);
  }
}
