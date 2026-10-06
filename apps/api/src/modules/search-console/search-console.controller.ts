import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchConsoleService } from './search-console.service';

const siteSchema = z.enum(['la-mira', 'planazo']);

@UseGuards(JwtAuthGuard)
@Controller('cms/search-console')
export class SearchConsoleController {
  constructor(private readonly searchConsole: SearchConsoleService) {}

  /** ¿Está configurada la cuenta de servicio y qué propiedad ve de cada sitio? */
  @Get('status')
  status() {
    return this.searchConsole.status();
  }

  /** Rendimiento (clics, impresiones, búsquedas, páginas) y sitemaps de un sitio. */
  @Get('summary')
  summary(@Query() query: unknown) {
    const dto = z
      .object({ site: siteSchema, days: z.coerce.number().int().refine((d) => [7, 28, 90].includes(d)).default(28) })
      .parse(query);
    return this.searchConsole.summary(dto.site, dto.days);
  }

  /** Estado de indexación de una URL (usa cuota: 2,000 al día por propiedad). */
  @Post('inspect')
  inspect(@Body() body: unknown) {
    const dto = z.object({ site: siteSchema, url: z.string().url(), fresh: z.boolean().optional() }).parse(body);
    return this.searchConsole.inspect(dto.site, dto.url, dto.fresh);
  }
}
