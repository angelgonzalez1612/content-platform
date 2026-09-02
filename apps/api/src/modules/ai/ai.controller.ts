import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CONTENT_PROVIDER,
  type ContentProvider,
} from './content-provider.interface';
import { generatePlaceSchema } from './dto/generate-place.dto';
import {
  draftRequestSchema,
  improveRequestSchema,
  draftExpandRequestSchema,
} from './dto/draft-request.dto';
import { searchImagesSchema } from './dto/search-images.dto';
import { fetchImageSchema } from './dto/fetch-image.dto';
import { AiDraftService } from './ai-draft.service';
import { ImageSearchService } from './image-search.service';
import { ImageUploadService } from './image-upload.service';

@UseGuards(JwtAuthGuard)
@Controller('cms/ai')
export class AiController {
  constructor(
    @Inject(CONTENT_PROVIDER) private readonly provider: ContentProvider,
    private readonly draftService: AiDraftService,
    private readonly imageSearch: ImageSearchService,
    private readonly imageUpload: ImageUploadService,
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

  // "Generar más contenido" en la pantalla de revisión de Centro IA, ANTES de
  // crear — a diferencia de improve/:type/:id (que opera sobre algo ya
  // guardado), aquí el cliente manda el estado actual del borrador completo,
  // no un id (ver AiDraftService.expandDraft).
  @Post('draft-expand')
  draftExpand(@Body() body: unknown) {
    return this.draftService.expandDraft(draftExpandRequestSchema.parse(body));
  }

  // Imágenes de uso libre (Wikimedia Commons + Openverse) para adjuntar a un
  // borrador — alternativa a la imagen scrapeada de la fuente (Fase 4) cuando
  // no hay ninguna, o cuando se prefiere otra. El humano elige de resultados
  // reales, nunca se inventa una imagen ni un crédito.
  @Post('search-images')
  searchImages(@Body() body: unknown) {
    const dto = searchImagesSchema.parse(body);
    return this.imageSearch.search(dto.query);
  }

  // Imagen de OTRA URL (una nota de otra fuente sobre el mismo tema) — solo
  // se extrae su imagen principal y se cita esa fuente, nunca se lee su
  // texto (ver AiDraftService.fetchImageFromUrl). `null` si esa página no
  // tiene imagen o no se pudo leer (paywall, bloqueo de bots, etc.).
  @Post('fetch-image')
  fetchImage(@Body() body: unknown) {
    const dto = fetchImageSchema.parse(body);
    return this.draftService.fetchImageFromUrl(dto.url);
  }

  // Subida manual de una imagen (además de buscarla o pegar una URL) — se
  // guarda en disco local y se sirve tal cual (ver ImageUploadService).
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithSession,
  ) {
    const publicOrigin = `${req.protocol}://${req.get('host')}`;
    return this.imageUpload.save(file, publicOrigin);
  }

  // Ruta genérica (:type/:id) — 'place' y los 6 tipos de la-mira
  // (noticia/alerta/guia/evento/lugar/reportaje) ya la implementan, ver
  // AiDraftService.improveContent.
  @Post('improve/:type/:id')
  improve(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: RequestWithSession,
  ) {
    return this.draftService.improveContent(
      type,
      id,
      improveRequestSchema.parse(body),
      req.session?.sub,
    );
  }
}
