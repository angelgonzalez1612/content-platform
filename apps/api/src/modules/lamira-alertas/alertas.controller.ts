import { Controller, Get, Param, Query } from '@nestjs/common';
import { AlertasService } from './alertas.service';
import { queryAlertasSchema } from './dto/alerta.dto';

@Controller('lamira/alertas')
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return this.alertasService.findAll(queryAlertasSchema.parse(query));
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.alertasService.findBySlug(slug);
  }
}
