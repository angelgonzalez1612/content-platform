import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContentRadarPublishedService } from './content-radar-published.service';
import { markPublishedSchema } from './dto/mark-published.dto';

// Solo el CMS lo usa (marcar/leer qué temas de Content Radar ya se
// publicaron) — protegido igual que el resto de `/cms/*`, no es información
// pública.
@UseGuards(JwtAuthGuard)
@Controller('cms/content-radar')
export class ContentRadarPublishedController {
  constructor(private readonly service: ContentRadarPublishedService) {}

  @Get('published-topics')
  findAllTitles() {
    return this.service.findAllTitles();
  }

  @Post('mark-published')
  markPublished(@Body() body: unknown) {
    return this.service.markPublished(markPublishedSchema.parse(body));
  }
}
