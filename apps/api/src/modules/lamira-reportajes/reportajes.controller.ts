import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReportajesService } from './reportajes.service';
import { queryReportajesSchema } from './dto/reportaje.dto';

@Controller('lamira/reportajes')
export class ReportajesController {
  constructor(private readonly reportajesService: ReportajesService) {}

  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return this.reportajesService.findAll(queryReportajesSchema.parse(query));
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.reportajesService.findBySlug(slug);
  }
}
