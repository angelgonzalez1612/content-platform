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
import {
  ENTIDADES_CATEGORIES,
  getCategoryKeyword,
} from './entidades-categories';
import { MEXICO_STATES } from './mexico-states';
import {
  interestQuerySchema,
  phrasesQuerySchema,
} from './dto/entidades-query.dto';

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
  constructor(private readonly trends: GoogleTrendsService) {}

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
}
