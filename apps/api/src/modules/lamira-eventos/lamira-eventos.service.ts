import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { LamiraEvento } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { lamiraEventos } from '../../db/schema';
import { SitesService } from '../sites/sites.service';
import { QueryLamiraEventosDto, CreateLamiraEventoDto, UpdateLamiraEventoDto } from './dto/lamira-evento.dto';
import { toLamiraEvento } from './lamira-eventos.mapper';

@Injectable()
export class LamiraEventosService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly sites: SitesService,
  ) {}

  async findAll(query: QueryLamiraEventosDto): Promise<LamiraEvento[]> {
    const siteId = await this.sites.getId('la-mira');
    const rows = await this.db.query.lamiraEventos.findMany({
      where: eq(lamiraEventos.siteId, siteId),
      limit: query.limit,
      offset: query.offset,
      with: { category: true },
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
    return rows.map(toLamiraEvento);
  }

  async findBySlug(slug: string): Promise<LamiraEvento> {
    const row = await this.db.query.lamiraEventos.findFirst({ where: eq(lamiraEventos.slug, slug), with: { category: true } });
    if (!row) throw new NotFoundException(`Evento "${slug}" no existe`);
    return toLamiraEvento(row);
  }

  async findAllForCms(): Promise<LamiraEvento[]> {
    return this.findAll({ limit: 100, offset: 0 });
  }

  async findByIdForCms(id: string): Promise<LamiraEvento> {
    const row = await this.db.query.lamiraEventos.findFirst({ where: eq(lamiraEventos.id, id), with: { category: true } });
    if (!row) throw new NotFoundException(`Evento "${id}" no existe`);
    return toLamiraEvento(row);
  }

  async create(dto: CreateLamiraEventoDto): Promise<LamiraEvento> {
    const siteId = await this.sites.getId('la-mira');
    const slug = await this.uniqueSlug(dto.title);
    const [inserted] = await this.db
      .insert(lamiraEventos)
      .values({ ...dto, slug, siteId })
      .returning({ id: lamiraEventos.id });
    return this.findByIdForCms(inserted.id);
  }

  async update(id: string, patch: UpdateLamiraEventoDto): Promise<LamiraEvento> {
    const existing = await this.db.query.lamiraEventos.findFirst({ where: eq(lamiraEventos.id, id) });
    if (!existing) throw new NotFoundException(`Evento "${id}" no existe`);
    await this.db.update(lamiraEventos).set(patch).where(eq(lamiraEventos.id, id));
    return this.findByIdForCms(id);
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let attempt = 1;
    while (await this.db.query.lamiraEventos.findFirst({ where: eq(lamiraEventos.slug, candidate) })) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }
}
