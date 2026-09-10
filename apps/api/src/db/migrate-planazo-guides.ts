import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import type { GuideSection } from '@planazo/types';

// Migra el contenido mock de planazo_fronted (apps/web/src/data/guides.json,
// copiado el 2026-09-10 a seed-data/planazo-mock/) a la tabla `planazo_guides`,
// con status='published' — mismo espíritu que migrate-planazo-mock.ts
// (places) y migrate-planazo-events.ts: sin esto, /guias queda vacío apenas
// planazo_fronted se conecta al backend real, porque el fallback a fixture
// solo se activa si el fetch FALLA, no si vuelve un array vacío.
//
// `placeSlugs` no se migra como columna aparte — guides.mapper.ts (API) ya
// lo deriva de `sections[].placeSlug` al leer, igual que hace el fixture
// original en planazo_fronted (placeSlugs vive una sola vez, en `sections`).

const DATA_DIR = join(__dirname, 'seed-data', 'planazo-mock');

interface MockGuideSection {
  heading: string;
  body: string;
  placeSlug?: string;
}

interface MockGuide {
  id: string;
  slug: string;
  title: string;
  description: string;
  type?: string;
  intro?: string;
  sections: MockGuideSection[];
  categoryLabel: string;
  readTime: string;
  cover: { url?: string; alt: string; credit?: string };
  excerpt?: string;
  budget?: string;
  duration?: string;
  audience?: string[];
}

async function main() {
  const url = process.env.DATABASE_URL ?? 'file:./data/dev.sqlite';
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient(authToken ? { url, authToken } : { url });
  const db = drizzle(client, { schema });

  const mockGuides = JSON.parse(
    readFileSync(join(DATA_DIR, 'guides.json'), 'utf8'),
  ) as MockGuide[];

  let created = 0;
  let updated = 0;

  for (const mg of mockGuides) {
    const sections: GuideSection[] = mg.sections.map((s) => ({
      heading: s.heading,
      body: s.body,
      placeSlug: s.placeSlug ?? null,
    }));

    const values = {
      title: mg.title,
      description: mg.description,
      type: mg.type ?? null,
      intro: mg.intro ?? null,
      sections,
      categoryLabel: mg.categoryLabel,
      readTime: mg.readTime,
      imageUrl: mg.cover.url ?? null,
      imageAlt: mg.cover.alt ?? null,
      imageCredit: mg.cover.credit ?? null,
      excerpt: mg.excerpt ?? null,
      budget: mg.budget ?? null,
      duration: mg.duration ?? null,
      audience: mg.audience ?? [],
      status: 'published' as const,
    };

    const existing = await db
      .select({ id: schema.planazoGuides.id })
      .from(schema.planazoGuides)
      .where(eq(schema.planazoGuides.slug, mg.slug))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.planazoGuides)
        .set(values)
        .where(eq(schema.planazoGuides.id, existing[0].id));
      updated += 1;
    } else {
      await db
        .insert(schema.planazoGuides)
        .values({ slug: mg.slug, ...values });
      created += 1;
    }
  }

  console.log(
    `Guías: ${mockGuides.length} procesadas (${created} creadas, ${updated} actualizadas).`,
  );
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
