import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { Article } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { articles, articlePlaces } from '../../db/schema';
import { QueryArticlesDto } from './dto/query-articles.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { toArticle } from './articles.mapper';

const placesWith = {
  place: {
    with: {
      photos: true,
      placeCategories: { with: { category: true } },
      placeTags: { with: { tag: true } },
    },
  },
} as const;

@Injectable()
export class ArticlesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAll(query: QueryArticlesDto): Promise<Article[]> {
    const rows = await this.db.query.articles.findMany({
      where: eq(articles.status, 'published'),
      limit: query.limit,
      offset: query.offset,
      with: { articlePlaces: { with: placesWith } },
      orderBy: (a, { desc }) => [desc(a.publishedAt)],
    });
    return rows.map(toArticle);
  }

  async findBySlug(slug: string): Promise<Article> {
    const row = await this.db.query.articles.findFirst({
      where: eq(articles.slug, slug),
      with: { articlePlaces: { with: placesWith } },
    });
    if (!row) throw new NotFoundException(`Article "${slug}" not found`);
    return toArticle(row);
  }

  async findAllForCms(): Promise<Article[]> {
    const rows = await this.db.query.articles.findMany({
      with: { articlePlaces: { with: placesWith } },
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });
    return rows.map(toArticle);
  }

  async findByIdForCms(id: string): Promise<Article> {
    const row = await this.db.query.articles.findFirst({
      where: eq(articles.id, id),
      with: { articlePlaces: { with: placesWith } },
    });
    if (!row) throw new NotFoundException(`Article "${id}" not found`);
    return toArticle(row);
  }

  async create(dto: CreateArticleDto): Promise<Article> {
    const slug = await this.uniqueSlug(dto.title);
    const [inserted] = await this.db
      .insert(articles)
      .values({
        slug,
        title: dto.title,
        excerpt: dto.excerpt ?? null,
        content: dto.content ?? null,
        coverImageUrl: dto.coverImageUrl ?? null,
        status: dto.status,
        aiGenerated: dto.aiGenerated,
        sourceKeyword: dto.sourceKeyword ?? null,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        canonicalUrl: dto.canonicalUrl ?? null,
        ogImageUrl: dto.ogImageUrl ?? null,
        categoryData: dto.categoryData ?? {},
      })
      .returning({ id: articles.id });

    for (const placeId of dto.placeIds ?? []) {
      await this.db.insert(articlePlaces).values({ articleId: inserted.id, placeId });
    }

    return this.findByIdForCms(inserted.id);
  }

  async update(id: string, patch: UpdateArticleDto): Promise<Article> {
    const existing = await this.db.query.articles.findFirst({ where: eq(articles.id, id) });
    if (!existing) throw new NotFoundException(`Article "${id}" not found`);
    await this.db
      .update(articles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(articles.id, id));
    return this.findByIdForCms(id);
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let attempt = 1;
    while (await this.db.query.articles.findFirst({ where: eq(articles.slug, candidate) })) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }
}
