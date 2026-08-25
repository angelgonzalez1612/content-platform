import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { NoticiasService } from './noticias.service';
import { createNoticiaSchema, updateNoticiaSchema } from './dto/noticia.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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
}
