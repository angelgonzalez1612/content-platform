import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Las 16 alcaldías de CDMX + 19 municipios conurbados del Edomex (Zona
// Metropolitana del Valle de México) — mismos slugs/nombres que ya usan
// apps/cms/src/lib/locations.ts, la-mira/src/data/mock/alcaldias.ts+municipios.ts,
// y planazo_fronted/src/lib/data/local.ts (todos migrando a leer de aquí).
interface LocationSeed {
  slug: string;
  name: string;
  kind: 'alcaldia' | 'municipio';
}

const LOCATIONS: LocationSeed[] = [
  { slug: 'alvaro-obregon', name: 'Álvaro Obregón', kind: 'alcaldia' },
  { slug: 'azcapotzalco', name: 'Azcapotzalco', kind: 'alcaldia' },
  { slug: 'benito-juarez', name: 'Benito Juárez', kind: 'alcaldia' },
  { slug: 'coyoacan', name: 'Coyoacán', kind: 'alcaldia' },
  {
    slug: 'cuajimalpa-de-morelos',
    name: 'Cuajimalpa de Morelos',
    kind: 'alcaldia',
  },
  { slug: 'cuauhtemoc', name: 'Cuauhtémoc', kind: 'alcaldia' },
  { slug: 'gustavo-a-madero', name: 'Gustavo A. Madero', kind: 'alcaldia' },
  { slug: 'iztacalco', name: 'Iztacalco', kind: 'alcaldia' },
  { slug: 'iztapalapa', name: 'Iztapalapa', kind: 'alcaldia' },
  {
    slug: 'magdalena-contreras',
    name: 'La Magdalena Contreras',
    kind: 'alcaldia',
  },
  { slug: 'miguel-hidalgo', name: 'Miguel Hidalgo', kind: 'alcaldia' },
  { slug: 'milpa-alta', name: 'Milpa Alta', kind: 'alcaldia' },
  { slug: 'tlahuac', name: 'Tláhuac', kind: 'alcaldia' },
  { slug: 'tlalpan', name: 'Tlalpan', kind: 'alcaldia' },
  {
    slug: 'venustiano-carranza',
    name: 'Venustiano Carranza',
    kind: 'alcaldia',
  },
  { slug: 'xochimilco', name: 'Xochimilco', kind: 'alcaldia' },
  { slug: 'ecatepec', name: 'Ecatepec', kind: 'municipio' },
  { slug: 'nezahualcoyotl', name: 'Nezahualcóyotl', kind: 'municipio' },
  { slug: 'naucalpan', name: 'Naucalpan', kind: 'municipio' },
  { slug: 'tlalnepantla', name: 'Tlalnepantla', kind: 'municipio' },
  { slug: 'chimalhuacan', name: 'Chimalhuacán', kind: 'municipio' },
  { slug: 'cuautitlan-izcalli', name: 'Cuautitlán Izcalli', kind: 'municipio' },
  { slug: 'coacalco', name: 'Coacalco', kind: 'municipio' },
  {
    slug: 'atizapan-de-zaragoza',
    name: 'Atizapán de Zaragoza',
    kind: 'municipio',
  },
  { slug: 'tultitlan', name: 'Tultitlán', kind: 'municipio' },
  { slug: 'ixtapaluca', name: 'Ixtapaluca', kind: 'municipio' },
  { slug: 'chalco', name: 'Chalco', kind: 'municipio' },
  { slug: 'huixquilucan', name: 'Huixquilucan', kind: 'municipio' },
  { slug: 'nicolas-romero', name: 'Nicolás Romero', kind: 'municipio' },
  { slug: 'texcoco', name: 'Texcoco', kind: 'municipio' },
  { slug: 'chicoloapan', name: 'Chicoloapan', kind: 'municipio' },
  { slug: 'cuautitlan', name: 'Cuautitlán', kind: 'municipio' },
  { slug: 'tecamac', name: 'Tecámac', kind: 'municipio' },
  { slug: 'zumpango', name: 'Zumpango', kind: 'municipio' },
  {
    slug: 'valle-de-chalco-solidaridad',
    name: 'Valle de Chalco Solidaridad',
    kind: 'municipio',
  },
];

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? 'file:./data/dev.sqlite',
  });
  const db = drizzle(client, { schema });

  let created = 0;
  let updated = 0;

  for (const loc of LOCATIONS) {
    const existing = await db.query.locations.findFirst({
      where: eq(schema.locations.slug, loc.slug),
    });
    if (existing) {
      await db
        .update(schema.locations)
        .set({ name: loc.name, kind: loc.kind })
        .where(eq(schema.locations.slug, loc.slug));
      updated += 1;
    } else {
      await db.insert(schema.locations).values(loc);
      created += 1;
    }
  }
  console.log(
    `${created} ubicaciones creadas, ${updated} actualizadas (total ${LOCATIONS.length}).`,
  );

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
