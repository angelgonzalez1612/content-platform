import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { Reportaje } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { reportajes } from '../../db/schema';
import { SitesService } from '../sites/sites.service';
import { QueryReportajesDto, CreateReportajeDto, UpdateReportajeDto } from './dto/reportaje.dto';
import { toReportaje } from './reportajes.mapper';

@Injectable()
export class ReportajesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly sites: SitesService,
  ) {}

  async findAll(query: QueryReportajesDto): Promise<Reportaje[]> {
    const siteId = await this.sites.getId('la-mira');
    const rows = await this.db.query.reportajes.findMany({
      where: and(eq(reportajes.siteId, siteId), eq(reportajes.status, 'published')),
      limit: query.limit,
      offset: query.offset,
      with: { category: true },
      orderBy: (r, { desc }) => [desc(r.publishedAt)],
    });
    return rows.map(toReportaje);
  }

  async findBySlug(slug: string): Promise<Reportaje> {
    const row = await this.db.query.reportajes.findFirst({ where: eq(reportajes.slug, slug), with: { category: true } });
    if (!row) throw new NotFoundException(`Reportaje "${slug}" no existe`);
    return toReportaje(row);
  }

  async findAllForCms(): Promise<Reportaje[]> {
    const siteId = await this.sites.getId('la-mira');
    const rows = await this.db.query.reportajes.findMany({
      where: eq(reportajes.siteId, siteId),
      with: { category: true },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
    return rows.map(toReportaje);
  }

  async findByIdForCms(id: string): Promise<Reportaje> {
    const row = await this.db.query.reportajes.findFirst({ where: eq(reportajes.id, id), with: { category: true } });
    if (!row) throw new NotFoundException(`Reportaje "${id}" no existe`);
    return toReportaje(row);
  }

  async create(dto: CreateReportajeDto): Promise<Reportaje> {
    const siteId = await this.sites.getId('la-mira');
    const slug = await this.uniqueSlug(dto.title);
    const [inserted] = await this.db
      .insert(reportajes)
      .values({ ...dto, slug, siteId })
      .returning({ id: reportajes.id });
    return this.findByIdForCms(inserted.id);
  }

  async update(id: string, patch: UpdateReportajeDto): Promise<Reportaje> {
    const existing = await this.db.query.reportajes.findFirst({ where: eq(reportajes.id, id) });
    if (!existing) throw new NotFoundException(`Reportaje "${id}" no existe`);
    await this.db.update(reportajes).set(patch).where(eq(reportajes.id, id));
    return this.findByIdForCms(id);
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let attempt = 1;
    while (await this.db.query.reportajes.findFirst({ where: eq(reportajes.slug, candidate) })) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }
}
