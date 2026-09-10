import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlanazoGuidesService } from './guides.service';
import { createGuideSchema, updateGuideSchema } from './dto/guide.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cms/guides')
export class CmsPlanazoGuidesController {
  constructor(private readonly guidesService: PlanazoGuidesService) {}

  @Get()
  findAll() {
    return this.guidesService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.guidesService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.guidesService.create(createGuideSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.guidesService.update(id, updateGuideSchema.parse(body));
  }
}
