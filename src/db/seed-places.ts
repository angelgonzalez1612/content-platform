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
    address: 'Colima 180, Roma Norte, CDMX',
    priceLevel: 2,
    status: 'published' as const,
    category: 'comer',
  },
  {
    slug: 'cafe-tostado-lento',
    name: 'Café Tostado Lento',
    description: 'Tueste propio en lotes chicos, método de goteo a la vista.',
    address: 'Havre 15, Juárez, CDMX',
    priceLevel: 1,
    status: 'published' as const,
    category: 'cafes',
  },
  {
    slug: 'taller-de-mezcal-y-maiz',
    name: 'Taller de mezcal y maíz',
    description: 'Dos horas de cata guiada y nixtamalización a mano en un patio de Coyoacán.',
    address: 'Francisco Sosa 10, Coyoacán, CDMX',
    priceLevel: 3,
    status: 'published' as const,
    category: 'cultura',
  },
  {
    slug: 'terraza-mirador-24',
    name: 'Terraza Mirador 24',
    description: 'Rooftop en el piso 24 con la mejor vista al Centro Histórico.',
    address: 'Piso 24, Eje Central 24, Centro Histórico, CDMX',
    priceLevel: 2,
    status: 'in_review' as const,
    category: 'bares',
  },
  {
    slug: 'museo-tamayo-nueva-sala',
    name: 'Museo Tamayo: nueva sala',
    description: 'Nueva sala permanente de arte contemporáneo mexicano.',
    address: 'Paseo de la Reforma 51, Bosque de Chapultepec, CDMX',
    priceLevel: 1,
    status: 'published' as const,
    category: 'cultura',
  },
  {
    slug: 'jardin-botanico',
    name: 'Jardín Botánico',
    description: 'Jardín botánico de la UNAM, con invernadero de cactáceas.',
    address: 'Av. Universidad 3000, Coyoacán, CDMX',
    priceLevel: null,
    status: 'draft' as const,
    category: 'aire-libre',
  },
  {
    slug: 'centro-cultural-digital',
    name: 'Centro Cultural Digital',
    description: 'Exhibiciones de arte digital e instalaciones interactivas frente al Zócalo.',
    address: 'Av. Juárez y Eje Central, Centro Histórico, CDMX',
    priceLevel: null,
    status: 'draft' as const,
    category: 'tecnologia',
  },
  {
    slug: 'lan-center-retro',
    name: 'LAN Center Retro',
    description: 'PCs gamer de alta gama por hora y una zona de consolas retro.',
    address: 'Universidad 220, Narvarte, CDMX',
    priceLevel: 1,
    status: 'in_review' as const,
    category: 'tecnologia',
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  const existingPlace = await db.query.places.findFirst();
  if (existingPlace) {
    console.log('Ya hay lugares en la base — nada que sembrar.');
    await pool.end();
    return;
  }

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

  for (const place of PLACES) {
    const [inserted] = await db
      .insert(schema.places)
      .values({
        slug: place.slug,
        name: place.name,
        description: place.description,
        address: place.address,
        priceLevel: place.priceLevel,
        status: place.status,
      })
      .returning({ id: schema.places.id });

    const categoryId = categoryIdBySlug.get(place.category);
    if (categoryId) {
      await db.insert(schema.placeCategories).values({ placeId: inserted.id, categoryId });
    }
  }
  console.log(`${PLACES.length} lugares creados.`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
