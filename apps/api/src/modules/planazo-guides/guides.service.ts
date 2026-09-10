import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { PlanazoGuide } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { planazoGuides } from '../../db/schema';
import { CreateGuideDto, QueryGuidesDto, UpdateGuideDto } from './dto/guide.dto';
import { toPlanazoGuide } from './guides.mapper';

@Injectable()
export class PlanazoGuidesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAll(query: QueryGuidesDto): Promise<PlanazoGuide[]> {
    const rows = await this.db.query.planazoGuides.findMany({
      where: eq(planazoGuides.status, 'published'),
      limit: query.limit,
      offset: query.offset,
      orderBy: (g, { desc }) => [desc(g.createdAt)],
    });
    return rows.map(toPlanazoGuide);
  }

  async findBySlug(slug: string): Promise<PlanazoGuide> {
    const row = await this.db.query.planazoGuides.findFirst({
      where: and(eq(planazoGuides.slug, slug), eq(planazoGuides.status, 'published')),
    });
    if (!row) throw new NotFoundException(`Guía "${slug}" no existe`);
    return toPlanazoGuide(row);
  }

  /** CMS: toda guía sin importar status — el editor necesita ver borradores. */
  async findAllForCms(): Promise<PlanazoGuide[]> {
    const rows = await this.db.query.planazoGuides.findMany({
      orderBy: (g, { desc }) => [desc(g.updatedAt)],
    });
    return rows.map(toPlanazoGuide);
  }

  async findByIdForCms(id: string): Promise<PlanazoGuide> {
    const row = await this.db.query.planazoGuides.findFirst({ where: eq(planazoGuides.id, id) });
    if (!row) throw new NotFoundException(`Guía "${id}" no existe`);
    return toPlanazoGuide(row);
  }

  async create(dto: CreateGuideDto): Promise<PlanazoGuide> {
    const slug = await this.uniqueSlug(dto.title);
    const [inserted] = await this.db
      .insert(planazoGuides)
      .values({
        slug,
        title: dto.title,
        description: dto.description,
        type: dto.type ?? null,
        intro: dto.intro ?? null,
        sections: dto.sections ?? [],
        categoryLabel: dto.categoryLabel,
        readTime: dto.readTime,
        imageUrl: dto.imageUrl ?? null,
        imageAlt: dto.imageAlt ?? null,
        imageCredit: dto.imageCredit ?? null,
        excerpt: dto.excerpt ?? null,
        budget: dto.budget ?? null,
        duration: dto.duration ?? null,
        audience: dto.audience ?? [],
        status: dto.status,
      })
      .returning({ id: planazoGuides.id });

    return this.findByIdForCms(inserted.id);
  }

  async update(id: string, patch: UpdateGuideDto): Promise<PlanazoGuide> {
    const existing = await this.db.query.planazoGuides.findFirst({ where: eq(planazoGuides.id, id) });
    if (!existing) throw new NotFoundException(`Guía "${id}" no existe`);

    await this.db
      .update(planazoGuides)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(planazoGuides.id, id));

    return this.findByIdForCms(id);
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let attempt = 1;
    while (await this.db.query.planazoGuides.findFirst({ where: eq(planazoGuides.slug, candidate) })) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }
}
