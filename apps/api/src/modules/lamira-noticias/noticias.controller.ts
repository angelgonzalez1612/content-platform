import { Controller, Get, Param, Query } from '@nestjs/common';
import { NoticiasService } from './noticias.service';
import { queryNoticiasSchema } from './dto/noticia.dto';

@Controller('lamira/noticias')
export class NoticiasController {
  constructor(private readonly noticiasService: NoticiasService) {}

  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return this.noticiasService.findAll(queryNoticiasSchema.parse(query));
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.noticiasService.findBySlug(slug);
  }
}
