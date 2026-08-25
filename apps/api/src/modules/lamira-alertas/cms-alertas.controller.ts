import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AlertasService } from './alertas.service';
import { createAlertaSchema, updateAlertaSchema } from './dto/alerta.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cms/lamira/alertas')
export class CmsAlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get()
  findAll() {
    return this.alertasService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alertasService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.alertasService.create(createAlertaSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.alertasService.update(id, updateAlertaSchema.parse(body));
  }
}
