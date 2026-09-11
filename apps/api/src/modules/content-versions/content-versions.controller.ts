import { Controller, Get, Post, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContentVersionsService } from './content-versions.service';

@Controller('cms/content-versions')
@UseGuards(JwtAuthGuard)
export class ContentVersionsController {
  constructor(private readonly versions: ContentVersionsService) {}

  @Get()
  async list(@Query('contentType') contentType?: string, @Query('contentId') contentId?: string) {
    if (!contentType || !contentId) {
      throw new BadRequestException('Faltan datos o hay campos inválidos — se requieren contentType y contentId.');
    }
    return this.versions.list(contentType, contentId);
  }

  @Post(':id/restore')
  async restore(@Param('id') id: string) {
    return this.versions.restore(id);
  }
}
