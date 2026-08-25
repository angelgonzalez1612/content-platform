import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { sites } from '../../db/schema';

// Resuelve slug de sitio ('la-mira' | 'planazo') -> id real, con cache en
// memoria — la tabla `sites` prácticamente nunca cambia en runtime, no vale
// la pena una consulta nueva en cada request de los módulos de contenido.
@Injectable()
export class SitesService {
  private cache = new Map<string, string>();

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async getId(slug: 'la-mira' | 'planazo'): Promise<string> {
    const cached = this.cache.get(slug);
    if (cached) return cached;

    const site = await this.db.query.sites.findFirst({ where: eq(sites.slug, slug) });
    if (!site) {
      throw new InternalServerErrorException(`Sitio "${slug}" no existe en la tabla sites — corre el seed de categorías.`);
    }
    this.cache.set(slug, site.id);
    return site.id;
  }
}
