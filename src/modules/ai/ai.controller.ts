import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CONTENT_PROVIDER, type ContentProvider } from './content-provider.interface';
import { generatePlaceSchema } from './dto/generate-place.dto';

@UseGuards(JwtAuthGuard)
@Controller('cms/ai')
export class AiController {
  constructor(@Inject(CONTENT_PROVIDER) private readonly provider: ContentProvider) {}

  @Post('generate-place')
  generatePlace(@Body() body: unknown) {
    const dto = generatePlaceSchema.parse(body);
    return this.provider.generatePlaceDraft(dto);
  }
}
