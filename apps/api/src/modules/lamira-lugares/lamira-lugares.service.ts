import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { LamiraLugar } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { lamiraLugares } from '../../db/schema';
import { SitesService } from '../sites/sites.service';
import { QueryLamiraLugaresDto, CreateLamiraLugarDto, UpdateLamiraLugarDto } from './dto/lamira-lugar.dto';
import { toLamiraLugar } from './lamira-lugares.mapper';

@Injectable()
export class LamiraLugaresService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly sites: SitesService,
  ) {}

  async findAll(query: QueryLamiraLugaresDto): Promise<LamiraLugar[]> {
    const siteId = await this.sites.getId('la-mira');
    const rows = await this.db.query.lamiraLugares.findMany({
      where: eq(lamiraLugares.siteId, siteId),
      limit: query.limit,
      offset: query.offset,
      with: { category: true },
      orderBy: (l, { desc }) => [desc(l.createdAt)],
    });
    return rows.map(toLamiraLugar);
  }

  async findBySlug(slug: string): Promise<LamiraLugar> {
    const row = await this.db.query.lamiraLugares.findFirst({ where: eq(lamiraLugares.slug, slug), with: { category: true } });
    if (!row) throw new NotFoundException(`Lugar "${slug}" no existe`);
    return toLamiraLugar(row);
  }

  async findAllForCms(): Promise<LamiraLugar[]> {
    return this.findAll({ limit: 100, offset: 0 });
  }

  async findByIdForCms(id: string): Promise<LamiraLugar> {
    const row = await this.db.query.lamiraLugares.findFirst({ where: eq(lamiraLugares.id, id), with: { category: true } });
    if (!row) throw new NotFoundException(`Lugar "${id}" no existe`);
    return toLamiraLugar(row);
  }

  async create(dto: CreateLamiraLugarDto): Promise<LamiraLugar> {
    const siteId = await this.sites.getId('la-mira');
    const slug = await this.uniqueSlug(dto.name);
    const [inserted] = await this.db
      .insert(lamiraLugares)
      .values({ ...dto, slug, siteId })
      .returning({ id: lamiraLugares.id });
    return this.findByIdForCms(inserted.id);
  }

  async update(id: string, patch: UpdateLamiraLugarDto): Promise<LamiraLugar> {
    const existing = await this.db.query.lamiraLugares.findFirst({ where: eq(lamiraLugares.id, id) });
    if (!existing) throw new NotFoundException(`Lugar "${id}" no existe`);
    await this.db.update(lamiraLugares).set(patch).where(eq(lamiraLugares.id, id));
    return this.findByIdForCms(id);
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let attempt = 1;
    while (await this.db.query.lamiraLugares.findFirst({ where: eq(lamiraLugares.slug, candidate) })) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }
}
