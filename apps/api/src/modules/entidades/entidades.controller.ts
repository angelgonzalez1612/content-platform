import {
  Controller,
  Get,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  GoogleTrendsService,
  TrendsUnavailableError,
} from './google-trends.service';
import { LocalSearchService } from './local-search.service';
import {
  ENTIDADES_CATEGORIES,
  getCategoryKeyword,
} from './entidades-categories';
import { MEXICO_STATES } from './mexico-states';
import {
  interestQuerySchema,
  phrasesQuerySchema,
} from './dto/entidades-query.dto';
import { localSearchQuerySchema } from './dto/local-search-query.dto';

// Convierte el único error de dominio (Trends bloqueado/caído) en una
// respuesta HTTP con el mensaje real — sin esto, NestJS lo aplana a un 500
// genérico "Internal server error" y el CMS nunca sabría que sí es un
// problema de Trends (para mostrar "no disponible, reintenta") y no un bug.
function toHttpError(err: unknown): never {
  if (err instanceof TrendsUnavailableError)
    throw new ServiceUnavailableException(err.message);
  throw err;
}

@UseGuards(JwtAuthGuard)
@Controller('cms/entidades')
export class EntidadesController {
  constructor(
    private readonly trends: GoogleTrendsService,
    private readonly localSearchService: LocalSearchService,
  ) {}

  // Catálogo de estados + categorías editoriales — el CMS los pide una vez al
  // cargar la página en vez de hardcodearlos por triplicado en el cliente.
  @Get('meta')
  meta() {
    return { states: MEXICO_STATES, categories: ENTIDADES_CATEGORIES };
  }

  @Get('interest')
  async interest(@Query() query: Record<string, unknown>) {
    const dto = interestQuerySchema.parse(query);
    try {
      return await this.trends.interestByState(
        getCategoryKeyword(dto.category),
      );
    } catch (err) {
      toHttpError(err);
    }
  }

  @Get('phrases')
  async phrases(@Query() query: Record<string, unknown>) {
    const dto = phrasesQuerySchema.parse(query);
    try {
      return await this.trends.phrasesForState(
        dto.state,
        getCategoryKeyword(dto.category),
      );
    } catch (err) {
      toHttpError(err);
    }
  }

  // "Búsquedas locales" — notas reales (buscador real, no Trends) para un
  // municipio/alcaldía específico. A diferencia de /phrases, el error de
  // WebSearchService (ya un HttpException con mensaje real, ver
  // WebSearchService.search) no necesita toHttpError: Nest lo propaga tal
  // cual sin aplanarlo a "Internal server error".
  @Get('local-search')
  localSearch(@Query() query: Record<string, unknown>) {
    const dto = localSearchQuerySchema.parse(query);
    // Frase libre (`q`) tiene prioridad — así una frase de Trends ("noticias
    // hoy") se busca tal cual como nota real; si no, se usa el keyword general
    // de la categoría (categoría "suave", ver LocalSearchService).
    const term = dto.q ?? getCategoryKeyword(dto.category!);
    return this.localSearchService.searchLocal(dto.place, term);
  }
}
