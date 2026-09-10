import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Migra el contenido mock de planazo_fronted (apps/web/src/data/events.json,
// copiado el 2026-09-10 a seed-data/planazo-mock/) al backend real, con
// status='published' — mismo espíritu que migrate-planazo-mock.ts (places):
// sin esto, /eventos queda casi vacío apenas planazo_fronted se conecta al
// backend real, porque su fallback a fixture solo se activa si el fetch
// FALLA, no si vuelve un array vacío o corto.
//
// Alcance explícito: el schema `events` no modela zone/address/price/rating
// como columnas propias (esos datos, si existen, vienen del `place` vinculado
// — ver adapt-event.ts en planazo_fronted). Ningún evento real de Planazo
// coincide hoy con un Place catalogado (ver comentario en EventItem.placeId,
// data/types.ts), así que no se intenta ningún matching automático —
// `locationName` recibe el `address` completo del mock para no perder esa
// información en la vista de detalle, aunque el campo estructurado `zone`
// quede vacío hasta que el schema lo modele. `tags`, `recurringDays`,
// `organizer` tampoco se migran: adapt-event.ts no los lee hoy, así que
// agregarlos no cambiaría nada visible (mismo criterio que descriptionLong
// en migrate-planazo-mock.ts).

const DATA_DIR = join(__dirname, 'seed-data', 'planazo-mock');

interface MockEvent {
  id: string;
  slug: string;
  name: string;
  category: string;
  address: string;
  startDate: string;
  cover: { url?: string; alt: string };
  description: string;
}

async function main() {
  const url = process.env.DATABASE_URL ?? 'file:./data/dev.sqlite';
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient(authToken ? { url, authToken } : { url });
  const db = drizzle(client, { schema });

  const allCategories = await db.query.categories.findMany();
  const categoryIdBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));

  const mockEvents = JSON.parse(
    readFileSync(join(DATA_DIR, 'events.json'), 'utf8'),
  ) as MockEvent[];

  let created = 0;
  let updated = 0;

  for (const me of mockEvents) {
    const categoryId = categoryIdBySlug.get(me.category);
    if (!categoryId)
      throw new Error(
        `Categoría "${me.category}" (evento "${me.slug}") no existe en la tabla categories.`,
      );

    const values = {
      name: me.name,
      description: me.description,
      startDate: new Date(me.startDate),
      categoryId,
      locationName: me.address,
      imageUrl: me.cover.url ?? null,
      status: 'published' as const,
    };

    const existing = await db
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(eq(schema.events.slug, me.slug))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.events)
        .set(values)
        .where(eq(schema.events.id, existing[0].id));
      updated += 1;
    } else {
      await db.insert(schema.events).values({ slug: me.slug, ...values });
      created += 1;
    }
  }

  console.log(
    `Eventos: ${mockEvents.length} procesados (${created} creados, ${updated} actualizados).`,
  );
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
