import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Place, PlaceDetail } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { places } from '../../db/schema';
import { QueryPlacesDto } from './dto/query-places.dto';
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
}
