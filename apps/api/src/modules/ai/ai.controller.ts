import { BadRequestException, Body, Controller, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CONTENT_PROVIDER, type ContentProvider } from './content-provider.interface';
import { generatePlaceSchema } from './dto/generate-place.dto';
import { draftRequestSchema, improveRequestSchema } from './dto/draft-request.dto';
import { AiDraftService } from './ai-draft.service';

@UseGuards(JwtAuthGuard)
@Controller('cms/ai')
export class AiController {
  constructor(
    @Inject(CONTENT_PROVIDER) private readonly provider: ContentProvider,
    private readonly draftService: AiDraftService,
  ) {}

  @Post('generate-place')
  generatePlace(@Body() body: unknown) {
    const dto = generatePlaceSchema.parse(body);
    return this.provider.generatePlaceDraft(dto);
  }

  @Post('draft')
  draft(@Body() body: unknown) {
    return this.draftService.draft(draftRequestSchema.parse(body));
  }

  // Ruta genérica (:type/:id) a propósito, aunque hoy solo 'place' esté
  // implementado — el resto de los tipos se agregan aquí conforme tengan su
  // propio CRUD (ver Fase 2 pendiente), sin cambiar la forma de la URL.
  @Post('improve/:type/:id')
  improve(@Param('type') type: string, @Param('id') id: string, @Body() body: unknown, @Req() req: RequestWithSession) {
    if (type !== 'place') {
      throw new BadRequestException(`"Mejorar" todavía no está implementado para el tipo "${type}" — solo 'place' por ahora.`);
    }
    return this.draftService.improvePlace(id, improveRequestSchema.parse(body), req.session?.sub);
  }
}
