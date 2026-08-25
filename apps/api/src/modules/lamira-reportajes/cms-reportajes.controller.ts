import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ReportajesService } from './reportajes.service';
import { createReportajeSchema, updateReportajeSchema } from './dto/reportaje.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cms/lamira/reportajes')
export class CmsReportajesController {
  constructor(private readonly reportajesService: ReportajesService) {}

  @Get()
  findAll() {
    return this.reportajesService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportajesService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.reportajesService.create(createReportajeSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.reportajesService.update(id, updateReportajeSchema.parse(body));
  }
}
