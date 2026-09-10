import { Controller, Get, Param, Query } from '@nestjs/common';
import { PlanazoGuidesService } from './guides.service';
import { queryGuidesSchema } from './dto/guide.dto';

@Controller('guides')
export class PlanazoGuidesController {
  constructor(private readonly guidesService: PlanazoGuidesService) {}

  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return this.guidesService.findAll(queryGuidesSchema.parse(query));
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.guidesService.findBySlug(slug);
  }
}
