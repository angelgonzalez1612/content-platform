import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { updateCategorySchema } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cms/categories')
export class CmsCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@Query('site') site?: string) {
    return this.categoriesService.findAll(site);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.categoriesService.update(id, updateCategorySchema.parse(body));
  }
}
