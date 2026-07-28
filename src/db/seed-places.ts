import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const CATEGORIES = [
  { name: 'Comer', slug: 'comer' },
  { name: 'Cafés', slug: 'cafes' },
  { name: 'Bares', slug: 'bares' },
  { name: 'Cultura', slug: 'cultura' },
  { name: 'Aire libre', slug: 'aire-libre' },
  { name: 'Tecnología', slug: 'tecnologia' },
] as const;

const PLACES = [
  {
    slug: 'nudo-panaderia-cava',
    name: 'Nudo Panadería & Cava',
    description: 'Panadería de masa madre por el día, cava de vinos naturales por la noche.',
    zone: 'Roma Norte',
    address: 'Colima 180, Roma Norte, CDMX',
    priceLevel: 2,
    price: 400,
    rating: 4.9,
    reviewCount: 318,
    status: 'published' as const,
    category: 'comer',
  },
  {
    slug: 'cafe-tostado-lento',
    name: 'Café Tostado Lento',
    description: 'Tueste propio en lotes chicos, método de goteo a la vista.',
    zone: 'Juárez',
    address: 'Havre 15, Juárez, CDMX',
    priceLevel: 1,
    price: 120,
    rating: 4.6,
    reviewCount: 512,
    status: 'published' as const,
    category: 'cafes',
  },
  {
    slug: 'taller-de-mezcal-y-maiz',
    name: 'Taller de mezcal y maíz',
    description: 'Dos horas de cata guiada y nixtamalización a mano en un patio de Coyoacán.',
    zone: 'Coyoacán',
    address: 'Francisco Sosa 10, Coyoacán, CDMX',
    priceLevel: 3,
    price: 620,
    rating: 4.9,
    reviewCount: 204,
    status: 'published' as const,
    category: 'cultura',
  },
  {
    slug: 'terraza-mirador-24',
    name: 'Terraza Mirador 24',
    description: 'Rooftop en el piso 24 con la mejor vista al Centro Histórico.',
    zone: 'Centro Histórico',
    address: 'Piso 24, Eje Central 24, Centro Histórico, CDMX',
    priceLevel: 2,
    price: 350,
    rating: 4.5,
    reviewCount: 890,
    status: 'in_review' as const,
    category: 'bares',
  },
  {
    slug: 'museo-tamayo-nueva-sala',
    name: 'Museo Tamayo: nueva sala',
    description: 'Nueva sala permanente de arte contemporáneo mexicano.',
    zone: 'Bosque de Chapultepec',
    address: 'Paseo de la Reforma 51, Bosque de Chapultepec, CDMX',
    priceLevel: 1,
    price: 95,
    rating: 4.7,
    reviewCount: 1500,
    status: 'published' as const,
    category: 'cultura',
  },
  {
    slug: 'jardin-botanico',
    name: 'Jardín Botánico',
    description: 'Jardín botánico de la UNAM, con invernadero de cactáceas.',
    zone: 'Coyoacán',
    address: 'Av. Universidad 3000, Coyoacán, CDMX',
    priceLevel: null,
    price: null,
    rating: 4.6,
    reviewCount: 700,
    status: 'draft' as const,
    category: 'aire-libre',
  },
  {
    slug: 'centro-cultural-digital',
    name: 'Centro Cultural Digital',
    description: 'Exhibiciones de arte digital e instalaciones interactivas frente al Zócalo.',
    zone: 'Centro Histórico',
    address: 'Av. Juárez y Eje Central, Centro Histórico, CDMX',
    priceLevel: null,
    price: null,
    rating: 4.6,
    reviewCount: 540,
    status: 'draft' as const,
    category: 'tecnologia',
  },
  {
    slug: 'lan-center-retro',
    name: 'LAN Center Retro',
    description: 'PCs gamer de alta gama por hora y una zona de consolas retro.',
    zone: 'Narvarte',
    address: 'Universidad 220, Narvarte, CDMX',
    priceLevel: 1,
    price: 80,
    rating: 4.7,
    reviewCount: 295,
    status: 'in_review' as const,
    category: 'tecnologia',
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  // Idempotent per-slug upsert instead of an all-or-nothing early exit —
  // safe to re-run after adding new fields to PLACES.
  const categoryIdBySlug = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const existing = await db.query.categories.findFirst({ where: eq(schema.categories.slug, cat.slug) });
    if (existing) {
      categoryIdBySlug.set(cat.slug, existing.id);
      continue;
    }
    const [inserted] = await db.insert(schema.categories).values(cat).returning({ id: schema.categories.id });
    categoryIdBySlug.set(cat.slug, inserted.id);
  }
  console.log(`${categoryIdBySlug.size} categorías listas.`);

  let created = 0;
  let updated = 0;

  for (const place of PLACES) {
    const values = {
      name: place.name,
      description: place.description,
      zone: place.zone,
      address: place.address,
      priceLevel: place.priceLevel,
      price: place.price,
      rating: place.rating,
      reviewCount: place.reviewCount,
      status: place.status,
    };

    const existing = await db.query.places.findFirst({ where: eq(schema.places.slug, place.slug) });
    let placeId: string;

    if (existing) {
      await db.update(schema.places).set(values).where(eq(schema.places.slug, place.slug));
      placeId = existing.id;
      updated += 1;
    } else {
      const [inserted] = await db
        .insert(schema.places)
        .values({ slug: place.slug, ...values })
        .returning({ id: schema.places.id });
      placeId = inserted.id;
      created += 1;

      const categoryId = categoryIdBySlug.get(place.category);
      if (categoryId) {
        await db.insert(schema.placeCategories).values({ placeId, categoryId });
      }
    }
  }
  console.log(`${created} lugares creados, ${updated} actualizados.`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
