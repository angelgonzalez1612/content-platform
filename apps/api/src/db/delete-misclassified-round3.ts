import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Limpieza puntual (2026-09-10, ronda 3): re-auditoría con
// audit-content-quality.ts encontró 16 lugares más sin ningún dato
// verificable (dirección/teléfono/web/coordenadas), mismo bug de
// categorización que rondas 1 y 2 (noticia/artículo-listado clasificado como
// `place` por una regla de automatización sin contentTypes restringido).
// Tres de los 16 se crearon MIENTRAS se hacía esta limpieza (el
// @Interval de 15 min en AutomationRunnerService sigue corriendo con la API
// local levantada) — confirma que la regla de origen sigue activa y NO quedó
// arreglada del todo pese a los comentarios de rondas anteriores. Ver ese
// hallazgo por separado; este script solo limpia lo YA publicado.
//
// Uso: pnpm db:delete-misclassified-round3

const PLACE_IDS = [
  '343692fe-2f5a-4776-bbe3-ee1fdfe6c7c9', // Simplificará trámites el gobierno CDMX para adquisición de vivienda...
  'f9675d59-3d3f-45e2-8c9e-2aee4d2a3168', // Tour de tacos y comida callejera en la Ciudad de México
  'b289f1e6-be29-4166-a2c1-3242f52975d3', // Nuevas cafeterías en CDMX que están causando sensación este mes
  'f1537751-e83a-429c-b2e2-b29516876cd8', // Mascotas en CDMX: cuántos perros y gatos hay...
  '55610bc9-5eee-4e39-b209-73c1a7873b8e', // trend fotos 80s
  '27ede61f-c1e7-4207-b328-1719e07e0a15', // Wendy's en CDMX: ¿Dónde abrirán las próximas dos sucursales?
  'aa84402a-61e1-4429-bc8a-67dc3d45dc4b', // Inauguran Expo Café 2026 en CDMX
  'fad186ef-230e-416d-9a35-3934298eab22', // Bares nuevos en la CDMX que no llevan ni un año abiertos
  'b7109f9c-b209-4ed7-9d41-9a0d1e1c0085', // Unidades habitacionales deben recibir recursos de Alcaldías y Gobierno: PAN
  '73f5b460-d5df-4b27-8037-01bec05d94e8', // Entre lágrimas, Don Daniel siguió trabajando pese a la intimidación en CDMX
  'b09f5e7b-5a56-441a-adf2-01aa3516bd5b', // Javier Aranda Luna: El beso de la mujer araña...
  '248fa8ae-d394-40c8-88e3-d48dd92e0599', // Luz en la oscuridad aborda el alcance del espíritu...
  'ed507d50-4ff4-4c9c-a837-f9ee345ac772', // La Colección Gelman ya está en España; inauguró el Faro Santander
  'a27a493f-91cc-4f41-a38d-6e7cb09c99cf', // CDMX 2026: Los lugares gratuitos que debes visitar... (nueva copia, round1 ya borró una anterior)
  '66db4e89-fd29-400d-bc48-ba021359b89b', // Las 60 mejores atracciones para disfrutar en familia en la CDMX
  '0f81ec49-e008-437d-a3ab-2c89b1fdb8fd', // Los parques públicos más grandes de la CDMX
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  await db.delete(schema.placeCategories).where(inArray(schema.placeCategories.placeId, PLACE_IDS));
  await db.delete(schema.placeTags).where(inArray(schema.placeTags.placeId, PLACE_IDS));
  await db.delete(schema.placeServices).where(inArray(schema.placeServices.placeId, PLACE_IDS));
  await db.delete(schema.photos).where(inArray(schema.photos.placeId, PLACE_IDS));
  await db.delete(schema.socialLinks).where(inArray(schema.socialLinks.placeId, PLACE_IDS));
  await db.delete(schema.openingHours).where(inArray(schema.openingHours.placeId, PLACE_IDS));

  const deleted = await db
    .delete(schema.places)
    .where(inArray(schema.places.id, PLACE_IDS))
    .returning({ id: schema.places.id, name: schema.places.name });

  console.log(`Borrados: ${deleted.length}/${PLACE_IDS.length}`);
  for (const p of deleted) console.log(`  - ${p.name}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
