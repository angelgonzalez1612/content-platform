import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, or, isNull } from 'drizzle-orm';
import type { Category } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { categories, sites } from '../../db/schema';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /** Sin `siteSlug`: todas. Con `siteSlug`: las de ese sitio + las compartidas (siteId null). */
  async findAll(siteSlug?: string): Promise<Category[]> {
    if (!siteSlug) {
      return this.db.query.categories.findMany({ orderBy: (c, { asc }) => [asc(c.name)] });
    }
    const site = await this.db.query.sites.findFirst({ where: eq(sites.slug, siteSlug) });
    if (!site) return [];
    return this.db.query.categories.findMany({
      where: or(eq(categories.siteId, site.id), isNull(categories.siteId)),
      orderBy: (c, { asc }) => [asc(c.name)],
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.db.query.categories.findFirst({ where: eq(categories.id, id) });
    if (!category) {
      throw new NotFoundException(`Categoría "${id}" no existe`);
    }
    return category;
  }

  async update(id: string, patch: UpdateCategoryDto): Promise<Category> {
    await this.findOne(id); // 404 si no existe
    await this.db.update(categories).set(patch).where(eq(categories.id, id));
    return this.findOne(id);
  }
}
