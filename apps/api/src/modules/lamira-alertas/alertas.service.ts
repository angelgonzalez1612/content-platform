import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { Alerta } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { alertas } from '../../db/schema';
import { SitesService } from '../sites/sites.service';
import { QueryAlertasDto, CreateAlertaDto, UpdateAlertaDto } from './dto/alerta.dto';
import { toAlerta } from './alertas.mapper';

// Sin workflow editorial (draft/published) a propósito — una Alerta es
// contenido operativo en vivo, no editorial; todas las que existen se
// consideran visibles. Ver la-mira/src/lib/types.ts original.
@Injectable()
export class AlertasService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly sites: SitesService,
  ) {}

  async findAll(query: QueryAlertasDto): Promise<Alerta[]> {
    const siteId = await this.sites.getId('la-mira');
    const rows = await this.db.query.alertas.findMany({
      where: eq(alertas.siteId, siteId),
      limit: query.limit,
      offset: query.offset,
      with: { category: true },
      orderBy: (a, { desc }) => [desc(a.updatedAt)],
    });
    return rows.map(toAlerta);
  }

  async findBySlug(slug: string): Promise<Alerta> {
    const row = await this.db.query.alertas.findFirst({ where: eq(alertas.slug, slug), with: { category: true } });
    if (!row) throw new NotFoundException(`Alerta "${slug}" no existe`);
    return toAlerta(row);
  }

  async findAllForCms(): Promise<Alerta[]> {
    return this.findAll({ limit: 100, offset: 0 });
  }

  async findByIdForCms(id: string): Promise<Alerta> {
    const row = await this.db.query.alertas.findFirst({ where: eq(alertas.id, id), with: { category: true } });
    if (!row) throw new NotFoundException(`Alerta "${id}" no existe`);
    return toAlerta(row);
  }

  async create(dto: CreateAlertaDto): Promise<Alerta> {
    const siteId = await this.sites.getId('la-mira');
    const slug = await this.uniqueSlug(dto.title);
    const [inserted] = await this.db
      .insert(alertas)
      .values({ ...dto, slug, siteId, updatedAt: new Date() })
      .returning({ id: alertas.id });
    return this.findByIdForCms(inserted.id);
  }

  async update(id: string, patch: UpdateAlertaDto): Promise<Alerta> {
    const existing = await this.db.query.alertas.findFirst({ where: eq(alertas.id, id) });
    if (!existing) throw new NotFoundException(`Alerta "${id}" no existe`);
    await this.db.update(alertas).set({ ...patch, updatedAt: new Date() }).where(eq(alertas.id, id));
    return this.findByIdForCms(id);
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let attempt = 1;
    while (await this.db.query.alertas.findFirst({ where: eq(alertas.slug, candidate) })) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }
}
