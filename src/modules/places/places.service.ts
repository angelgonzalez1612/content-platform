import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { Place, PlaceDetail } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { places, categories, tags, placeCategories, placeTags } from '../../db/schema';
import { QueryPlacesDto } from './dto/query-places.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { CreatePlaceDto } from './dto/create-place.dto';
import { toPlaceSummary, toPlaceDetail } from './places.mapper';

@Injectable()
export class PlacesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAll(query: QueryPlacesDto): Promise<Place[]> {
    const rows = await this.db.query.places.findMany({
      where: eq(places.status, 'published'),
      limit: query.limit,
      offset: query.offset,
      with: {
        photos: true,
        placeCategories: { with: { category: true } },
        placeTags: { with: { tag: true } },
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    return rows.map(toPlaceSummary);
  }

  async findBySlug(slug: string): Promise<PlaceDetail> {
    const row = await this.db.query.places.findFirst({
      where: eq(places.slug, slug),
      with: {
        photos: true,
        socialLinks: true,
        openingHours: true,
        placeCategories: { with: { category: true } },
        placeTags: { with: { tag: true } },
        placeServices: { with: { service: true } },
        promotions: true,
        articlePlaces: { with: { article: true } },
      },
    });

    if (!row) {
      throw new NotFoundException(`Place "${slug}" not found`);
    }

    return toPlaceDetail(row);
  }

  /** CMS: every place regardless of status — editors need to see drafts too. */
  async findAllForCms(): Promise<Place[]> {
    const rows = await this.db.query.places.findMany({
      with: {
        photos: true,
        placeCategories: { with: { category: true } },
        placeTags: { with: { tag: true } },
      },
      orderBy: (p, { desc }) => [desc(p.updatedAt)],
    });

    return rows.map(toPlaceSummary);
  }

  async findByIdForCms(id: string): Promise<PlaceDetail> {
    const row = await this.db.query.places.findFirst({
      where: eq(places.id, id),
      with: {
        photos: true,
        socialLinks: true,
        openingHours: true,
        placeCategories: { with: { category: true } },
        placeTags: { with: { tag: true } },
        placeServices: { with: { service: true } },
        promotions: true,
        articlePlaces: { with: { article: true } },
      },
    });

    if (!row) {
      throw new NotFoundException(`Place "${id}" not found`);
    }

    return toPlaceDetail(row);
  }

  async update(id: string, patch: UpdatePlaceDto): Promise<PlaceDetail> {
    const existing = await this.db.query.places.findFirst({ where: eq(places.id, id) });
    if (!existing) {
      throw new NotFoundException(`Place "${id}" not found`);
    }

    await this.db
      .update(places)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(places.id, id));

    return this.findByIdForCms(id);
  }

  async create(dto: CreatePlaceDto): Promise<PlaceDetail> {
    const category = await this.db.query.categories.findFirst({ where: eq(categories.slug, dto.categorySlug) });
    if (!category) {
      throw new BadRequestException(`Categoría "${dto.categorySlug}" no existe`);
    }

    const slug = await this.uniqueSlug(dto.name);

    const [inserted] = await this.db
      .insert(places)
      .values({
        slug,
        name: dto.name,
        description: dto.description ?? null,
        zone: dto.zone ?? null,
        address: dto.address ?? null,
        priceLevel: dto.priceLevel ?? null,
        price: dto.price ?? null,
        rating: dto.rating ?? null,
        status: dto.status,
      })
      .returning({ id: places.id });

    await this.db.insert(placeCategories).values({ placeId: inserted.id, categoryId: category.id });

    for (const tagName of dto.tags ?? []) {
      const tagSlug = slugify(tagName);
      let tag = await this.db.query.tags.findFirst({ where: eq(tags.slug, tagSlug) });
      if (!tag) {
        const [insertedTag] = await this.db.insert(tags).values({ name: tagName, slug: tagSlug }).returning();
        tag = insertedTag;
      }
      await this.db.insert(placeTags).values({ placeId: inserted.id, tagId: tag.id });
    }

    return this.findByIdForCms(inserted.id);
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let attempt = 1;
    while (await this.db.query.places.findFirst({ where: eq(places.slug, candidate) })) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }
}
