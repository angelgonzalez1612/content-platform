import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { Guia } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { guias } from '../../db/schema';
import { SitesService } from '../sites/sites.service';
import { QueryGuiasDto, CreateGuiaDto, UpdateGuiaDto } from './dto/guia.dto';
import { toGuia } from './guias.mapper';

@Injectable()
export class GuiasService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly sites: SitesService,
  ) {}

  async findAll(query: QueryGuiasDto): Promise<Guia[]> {
    const siteId = await this.sites.getId('la-mira');
    const rows = await this.db.query.guias.findMany({
      where: and(eq(guias.siteId, siteId), eq(guias.status, 'published')),
      limit: query.limit,
      offset: query.offset,
      with: { category: true },
      orderBy: (g, { desc }) => [desc(g.updatedAt)],
    });
    return rows.map(toGuia);
  }

  async findBySlug(slug: string): Promise<Guia> {
    const row = await this.db.query.guias.findFirst({ where: eq(guias.slug, slug), with: { category: true } });
    if (!row) throw new NotFoundException(`Guía "${slug}" no existe`);
    return toGuia(row);
  }

  async findAllForCms(): Promise<Guia[]> {
    const siteId = await this.sites.getId('la-mira');
    const rows = await this.db.query.guias.findMany({
      where: eq(guias.siteId, siteId),
      with: { category: true },
      orderBy: (g, { desc }) => [desc(g.updatedAt)],
    });
    return rows.map(toGuia);
  }

  async findByIdForCms(id: string): Promise<Guia> {
    const row = await this.db.query.guias.findFirst({ where: eq(guias.id, id), with: { category: true } });
    if (!row) throw new NotFoundException(`Guía "${id}" no existe`);
    return toGuia(row);
  }

  async create(dto: CreateGuiaDto): Promise<Guia> {
    const siteId = await this.sites.getId('la-mira');
    const slug = await this.uniqueSlug(dto.title);
    const [inserted] = await this.db
      .insert(guias)
      .values({ ...dto, slug, siteId, updatedAt: new Date() })
      .returning({ id: guias.id });
    return this.findByIdForCms(inserted.id);
  }

  async update(id: string, patch: UpdateGuiaDto): Promise<Guia> {
    const existing = await this.db.query.guias.findFirst({ where: eq(guias.id, id) });
    if (!existing) throw new NotFoundException(`Guía "${id}" no existe`);
    await this.db.update(guias).set({ ...patch, updatedAt: new Date() }).where(eq(guias.id, id));
    return this.findByIdForCms(id);
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let attempt = 1;
    while (await this.db.query.guias.findFirst({ where: eq(guias.slug, candidate) })) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }
}
