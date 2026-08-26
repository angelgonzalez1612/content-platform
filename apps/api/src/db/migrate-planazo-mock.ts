import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Migra el contenido mock de planazo_fronted (apps/web/src/data/places.json,
// copiado el 2026-08-26 a seed-data/planazo-mock/) al backend real, con
// site_id='planazo' y status='published' — mismo espíritu que
// migrate-lamira-mock.ts de la Fase 6: el mock ya se consideraba "publicado"
// en el sitio, y sin esto la mayoría de las categorías de Planazo quedan
// vacías apenas se conecta planazo_fronted al backend real (el fallback de
// planazo_fronted solo se activa si el fetch FALLA, no si vuelve vacío).
//
// Las 12 categorías del mock (comer, cafes, bares, cultura, aire-libre,
// tecnologia, gaming, musica, cine-tv, geek, mascotas, viajes) ya coinciden
// 1:1 con las categorías canónicas sembradas por seed-categories.ts — a
// diferencia de la-mira, aquí no hizo falta ningún remapeo.
//
// Alcance explícito de esta pasada: se migran name/slug/description/zone/
// address/priceLevel/price/rating/reviewCount/coordinates/tags/fotos/
// servicios/instagram. `descriptionLong` NO se migra — adapt-place.ts (el
// adaptador que ya usa planazo_fronted) nunca lo expone en el Place
// adaptado, así que agregarlo aquí no cambiaría nada visible; ver ese
// archivo si se quiere resolver de verdad (requeriría una columna nueva).
// `openingHours` tampoco se migra — el mock las guarda como RANGOS de día
// en texto libre ("Lunes a jueves"), mientras que el schema real pide un
// row por día concreto (`day_of_week` 0-6); expandir el rango a mano por
// cada uno de los ~40 lugares que sí traen horario no valía la pena para
// esta pasada — se puede completar después desde el CMS.

const DATA_DIR = join(__dirname, 'seed-data', 'planazo-mock');

// Dos formas de foto en el mock: con `url` real, o solo `seed` (placeholder
// determinístico de Picsum — mismo patrón que `placeholderPhoto()` en
// planazo_fronted/src/lib/data/photo.ts, replicado aquí porque `photos.url`
// es NOT NULL en el backend real).
interface MockPhoto {
  url?: string;
  alt: string;
  seed?: string;
  width?: number;
  height?: number;
}

interface MockPlace {
  id: string;
  slug: string;
  name: string;
  category: string;
  zone: string;
  address: string;
  priceLabel: string;
  price: number;
  rating: number;
  reviewCount: number;
  cover: MockPhoto;
  gallery: MockPhoto[];
  description: string;
  descriptionLong?: string;
  tags: string[];
  services?: string[];
  social?: { instagram?: string; whatsapp?: string };
  coordinates?: { lat: number; lng: number };
}

function photoUrl(photo: MockPhoto): string {
  if (photo.url) return photo.url;
  return `https://picsum.photos/seed/${encodeURIComponent(photo.seed ?? photo.alt)}/${photo.width ?? 800}/${photo.height ?? 600}`;
}

/** "$ · $150 p/p" -> 1, "$$$ · ..." -> 3, "$85 MXN" (sin "·") -> null (no se sabe el nivel, solo el monto). */
function parsePriceLevel(label: string): number | null {
  const m = label.match(/^(\${1,4})\s*·/);
  return m ? m[1].length : null;
}

/** El mock usa price=0 para "Gratis"/"Entrada libre"; el adaptador real
 * (adapt-place.ts) espera price=null para mostrar "Gratis" — son
 * convenciones distintas, hay que traducir explícitamente. */
function normalizePrice(label: string, price: number): number | null {
  if (label === 'Gratis' || label === 'Entrada libre') return null;
  return price;
}

function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@/, '')}`;
}

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? 'file:./data/dev.sqlite',
  });
  const db = drizzle(client, { schema });

  const site = await db.query.sites.findFirst({
    where: eq(schema.sites.slug, 'planazo'),
  });
  if (!site)
    throw new Error(
      "Sitio 'planazo' no existe — corre antes db:seed:categories.",
    );

  const allCategories = await db.query.categories.findMany();
  const categoryIdBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));

  const tagIdBySlug = new Map<string, string>();
  async function getOrCreateTag(name: string): Promise<string> {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    const cached = tagIdBySlug.get(slug);
    if (cached) return cached;
    const existing = await db.query.tags.findFirst({
      where: eq(schema.tags.slug, slug),
    });
    if (existing) {
      tagIdBySlug.set(slug, existing.id);
      return existing.id;
    }
    const [created] = await db
      .insert(schema.tags)
      .values({ name, slug })
      .returning({ id: schema.tags.id });
    tagIdBySlug.set(slug, created.id);
    return created.id;
  }

  const serviceIdBySlug = new Map<string, string>();
  async function getOrCreateService(name: string): Promise<string> {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    const cached = serviceIdBySlug.get(slug);
    if (cached) return cached;
    const existing = await db.query.services.findFirst({
      where: eq(schema.services.slug, slug),
    });
    if (existing) {
      serviceIdBySlug.set(slug, existing.id);
      return existing.id;
    }
    const [created] = await db
      .insert(schema.services)
      .values({ name, slug })
      .returning({ id: schema.services.id });
    serviceIdBySlug.set(slug, created.id);
    return created.id;
  }

  const mockPlaces = JSON.parse(
    readFileSync(join(DATA_DIR, 'places.json'), 'utf8'),
  ) as MockPlace[];

  let created = 0;
  let updated = 0;

  for (const mp of mockPlaces) {
    const categoryId = categoryIdBySlug.get(mp.category);
    if (!categoryId)
      throw new Error(
        `Categoría "${mp.category}" (lugar "${mp.slug}") no existe en la tabla categories.`,
      );

    const values = {
      name: mp.name,
      description: mp.description,
      zone: mp.zone,
      address: mp.address,
      priceLevel: parsePriceLevel(mp.priceLabel),
      price: normalizePrice(mp.priceLabel, mp.price),
      rating: mp.rating || null,
      reviewCount: mp.reviewCount ?? 0,
      latitude: mp.coordinates ? String(mp.coordinates.lat) : null,
      longitude: mp.coordinates ? String(mp.coordinates.lng) : null,
      status: 'published' as const,
      categoryData: {},
    };

    const existing = await db
      .select({ id: schema.places.id })
      .from(schema.places)
      .where(and(eq(schema.places.slug, mp.slug)))
      .limit(1);

    let placeId: string;
    if (existing.length > 0) {
      placeId = existing[0].id;
      await db
        .update(schema.places)
        .set(values)
        .where(eq(schema.places.id, placeId));
      updated += 1;
    } else {
      const [inserted] = await db
        .insert(schema.places)
        .values({ slug: mp.slug, siteId: site.id, ...values } as never)
        .returning({ id: schema.places.id });
      placeId = inserted.id;
      created += 1;
    }

    // Relaciones: se borran y se re-insertan frescas — hace el script
    // idempotente sin tener que diffear arrays contra lo que ya había.
    await db
      .delete(schema.placeCategories)
      .where(eq(schema.placeCategories.placeId, placeId));
    await db.insert(schema.placeCategories).values({ placeId, categoryId });

    await db
      .delete(schema.placeTags)
      .where(eq(schema.placeTags.placeId, placeId));
    for (const tagName of mp.tags) {
      const tagId = await getOrCreateTag(tagName);
      await db.insert(schema.placeTags).values({ placeId, tagId });
    }

    await db.delete(schema.photos).where(eq(schema.photos.placeId, placeId));
    const coverUrl = photoUrl(mp.cover);
    const photoRows = [
      mp.cover,
      ...mp.gallery.filter((g) => photoUrl(g) !== coverUrl),
    ];
    for (let i = 0; i < photoRows.length; i++) {
      await db.insert(schema.photos).values({
        placeId,
        url: photoUrl(photoRows[i]),
        alt: photoRows[i].alt,
        position: i,
      });
    }

    if (mp.services && mp.services.length > 0) {
      await db
        .delete(schema.placeServices)
        .where(eq(schema.placeServices.placeId, placeId));
      for (const serviceName of mp.services) {
        const serviceId = await getOrCreateService(serviceName);
        await db.insert(schema.placeServices).values({ placeId, serviceId });
      }
    }

    if (mp.social?.instagram) {
      await db
        .delete(schema.socialLinks)
        .where(eq(schema.socialLinks.placeId, placeId));
      await db.insert(schema.socialLinks).values({
        placeId,
        platform: 'instagram',
        url: instagramUrl(mp.social.instagram),
      });
    }
  }

  console.log(
    `Lugares: ${mockPlaces.length} procesados (${created} creados, ${updated} actualizados).`,
  );
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
