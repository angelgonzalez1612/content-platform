import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { contentRadarPublished } from '../../db/schema';

export interface MarkPublishedDto {
  title: string;
  site?: string;
  contentType?: string;
  contentId?: string;
}

@Injectable()
export class ContentRadarPublishedService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAllTitles(): Promise<string[]> {
    const rows = await this.db.query.contentRadarPublished.findMany({
      columns: { title: true },
    });
    return rows.map((r) => r.title);
  }

  // Idempotente por `title` a mano (check-then-write) — si el mismo tema ya
  // se había marcado (ej. el usuario reintentó tras un error), actualiza el
  // registro existente en vez de tronar por la unicidad.
  async markPublished(dto: MarkPublishedDto): Promise<void> {
    const existing = await this.db.query.contentRadarPublished.findFirst({
      where: eq(contentRadarPublished.title, dto.title),
    });

    if (existing) {
      await this.db
        .update(contentRadarPublished)
        .set({
          site: dto.site ?? null,
          contentType: dto.contentType ?? null,
          contentId: dto.contentId ?? null,
        })
        .where(eq(contentRadarPublished.title, dto.title));
      return;
    }

    await this.db.insert(contentRadarPublished).values({
      title: dto.title,
      site: dto.site ?? null,
      contentType: dto.contentType ?? null,
      contentId: dto.contentId ?? null,
    });
  }
}
