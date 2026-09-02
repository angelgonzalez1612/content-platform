import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { PlanazoEvent } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { events } from '../../db/schema';
import { QueryEventsDto } from './dto/query-events.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { toPlanazoEvent } from './events.mapper';

const placeWith = {
  photos: true,
  placeCategories: { with: { category: true } },
  placeTags: { with: { tag: true } },
} as const;

@Injectable()
export class EventsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAll(query: QueryEventsDto): Promise<PlanazoEvent[]> {
    const conditions = [eq(events.status, 'published')];
    if (query.alcaldiaSlug)
      conditions.push(eq(events.alcaldiaSlug, query.alcaldiaSlug));

    const rows = await this.db.query.events.findMany({
      where: and(...conditions),
      limit: query.limit,
      offset: query.offset,
      with: { place: { with: placeWith }, category: true },
      // Nulls-last a propósito: un evento sin fecha (ver comentario en el
      // schema) no debe aparecer primero solo porque NULL ordena antes que
      // cualquier fecha real en SQLite.
      orderBy: (e, { asc }) => [sql`${e.startDate} IS NULL`, asc(e.startDate)],
    });
    return rows.map(toPlanazoEvent);
  }

  async findBySlug(slug: string): Promise<PlanazoEvent> {
    const row = await this.db.query.events.findFirst({
      where: eq(events.slug, slug),
      with: { place: { with: placeWith }, category: true },
    });
    if (!row) throw new NotFoundException(`Event "${slug}" not found`);
    return toPlanazoEvent(row);
  }

  async findAllForCms(): Promise<PlanazoEvent[]> {
    const rows = await this.db.query.events.findMany({
      with: { place: { with: placeWith }, category: true },
      orderBy: (e, { desc }) => [desc(e.createdAt)],
    });
    return rows.map(toPlanazoEvent);
  }

  async findByIdForCms(id: string): Promise<PlanazoEvent> {
    const row = await this.db.query.events.findFirst({
      where: eq(events.id, id),
      with: { place: { with: placeWith }, category: true },
    });
    if (!row) throw new NotFoundException(`Event "${id}" not found`);
    return toPlanazoEvent(row);
  }

  async create(dto: CreateEventDto): Promise<PlanazoEvent> {
    const slug = await this.uniqueSlug(dto.name);
    const [inserted] = await this.db
      .insert(events)
      .values({
        slug,
        name: dto.name,
        description: dto.description ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        placeId: dto.placeId ?? null,
        locationName: dto.locationName ?? null,
        alcaldiaSlug: dto.alcaldiaSlug ?? null,
        categoryId: dto.categoryId ?? null,
        imageUrl: dto.imageUrl ?? null,
        imageCredit: dto.imageCredit ?? null,
        status: dto.status,
        categoryData: dto.categoryData ?? {},
        seo: dto.seo ?? null,
        content: dto.content ?? [],
      })
      .returning({ id: events.id });
    return this.findByIdForCms(inserted.id);
  }

  async update(id: string, patch: UpdateEventDto): Promise<PlanazoEvent> {
    const existing = await this.db.query.events.findFirst({
      where: eq(events.id, id),
    });
    if (!existing) throw new NotFoundException(`Event "${id}" not found`);
    await this.db.update(events).set(patch).where(eq(events.id, id));
    return this.findByIdForCms(id);
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let attempt = 1;
    while (
      await this.db.query.events.findFirst({
        where: eq(events.slug, candidate),
      })
    ) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }
}
