import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { GuiasService } from './guias.service';
import { createGuiaSchema, updateGuiaSchema } from './dto/guia.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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
}
