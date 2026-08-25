import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { updateArticleSchema } from './dto/update-article.dto';
import { createArticleSchema } from './dto/create-article.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cms/articles')
export class CmsArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  findAll() {
    return this.articlesService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.articlesService.create(createArticleSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.articlesService.update(id, updateArticleSchema.parse(body));
  }
}
