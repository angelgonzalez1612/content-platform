import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { Noticia } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { noticias } from '../../db/schema';
import { SitesService } from '../sites/sites.service';
import { QueryNoticiasDto } from './dto/noticia.dto';
import { CreateNoticiaDto, UpdateNoticiaDto } from './dto/noticia.dto';
import { toNoticia } from './noticias.mapper';

@Injectable()
export class NoticiasService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly sites: SitesService,
  ) {}

  async findAll(query: QueryNoticiasDto): Promise<Noticia[]> {
    const siteId = await this.sites.getId('la-mira');
    const rows = await this.db.query.noticias.findMany({
      where: and(eq(noticias.siteId, siteId), eq(noticias.status, 'published')),
      limit: query.limit,
      offset: query.offset,
      with: { category: true },
      orderBy: (n, { desc }) => [desc(n.publishedAt)],
    });
    return rows.map(toNoticia);
  }

  async findBySlug(slug: string): Promise<Noticia> {
    const row = await this.db.query.noticias.findFirst({ where: eq(noticias.slug, slug), with: { category: true } });
    if (!row) throw new NotFoundException(`Noticia "${slug}" no existe`);
    return toNoticia(row);
  }

  async findAllForCms(): Promise<Noticia[]> {
    const siteId = await this.sites.getId('la-mira');
    const rows = await this.db.query.noticias.findMany({
      where: eq(noticias.siteId, siteId),
      with: { category: true },
      orderBy: (n, { desc }) => [desc(n.createdAt)],
    });
    return rows.map(toNoticia);
  }

  async findByIdForCms(id: string): Promise<Noticia> {
    const row = await this.db.query.noticias.findFirst({ where: eq(noticias.id, id), with: { category: true } });
    if (!row) throw new NotFoundException(`Noticia "${id}" no existe`);
    return toNoticia(row);
  }

  async create(dto: CreateNoticiaDto): Promise<Noticia> {
    const siteId = await this.sites.getId('la-mira');
    const slug = await this.uniqueSlug(dto.title);
    const [inserted] = await this.db
      .insert(noticias)
      .values({ ...dto, slug, siteId })
      .returning({ id: noticias.id });
    return this.findByIdForCms(inserted.id);
  }

  async update(id: string, patch: UpdateNoticiaDto): Promise<Noticia> {
    const existing = await this.db.query.noticias.findFirst({ where: eq(noticias.id, id) });
    if (!existing) throw new NotFoundException(`Noticia "${id}" no existe`);
    await this.db.update(noticias).set(patch).where(eq(noticias.id, id));
    return this.findByIdForCms(id);
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let attempt = 1;
    while (await this.db.query.noticias.findFirst({ where: eq(noticias.slug, candidate) })) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }
}
