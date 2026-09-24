import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';

// Auditoría de calidad de contenido, solo-lectura (2026-09-07) — consolida
// en un script real del repo las verificaciones que antes se hacían con
// scripts sueltos de Python fuera del proyecto durante la limpieza para
// AdSense. Pensado para correrse cuando se quiera re-chequear el estado del
// contenido ("chécalo de nuevo"), no solo el día que se escribió.
//
// Uso: pnpm db:audit-content-quality

const WORD_THRESHOLD = 300;
const FAKE_PHOTO_HOSTS = ['picsum.photos', 'images.unsplash.com'];

const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'que', 'un', 'una', 'los', 'las', 'del',
  'al', 'su', 'con', 'por', 'para', 'se', 'es', 'lo', 'ya', 'más', 'tras',
  'no', 'le', 'sus', 'como', 'entre', 'este', 'esta',
]);

function normalizeTitle(t: string): string {
  return t.trim().replace(/\s+/g, ' ').toLowerCase();
}

function significantWords(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(/[^a-záéíóúñ0-9]+/i)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

// Mismo criterio que looksLikeSameStory en automation-runner.service.ts —
// duplicado a propósito para que este script sea standalone y no dependa
// de un import cruzado de un módulo con sus propias dependencias de Nest.
function looksLikeSameStory(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return shared / Math.min(wa.size, wb.size) >= 0.5;
}

function countContentWords(content: unknown): number {
  const blocks = (content as { heading?: string | null; paragraphs?: string[] }[]) ?? [];
  let total = 0;
  for (const b of blocks) {
    total += (b.heading ?? '').split(/\s+/).filter(Boolean).length;
    for (const p of b.paragraphs ?? []) total += p.split(/\s+/).filter(Boolean).length;
  }
  return total;
}

// Comparación exhaustiva (todos contra todos), no solo contra un "ancla" —
// ese fue el hueco que dejó pasar 11 duplicados reales en la primera ronda
// de limpieza del 2026-09-07 (ver dedupe-lamira-content-round2.ts).
function findDuplicateGroups(titles: { id: string; title: string }[]): { id: string; title: string }[][] {
  const used = new Array(titles.length).fill(false);
  const groups: { id: string; title: string }[][] = [];
  for (let i = 0; i < titles.length; i++) {
    if (used[i]) continue;
    const group = [titles[i]];
    used[i] = true;
    for (let j = i + 1; j < titles.length; j++) {
      if (used[j]) continue;
      if (looksLikeSameStory(titles[i].title, titles[j].title)) {
        group.push(titles[j]);
        used[j] = true;
      }
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  console.log('=== Auditoría de calidad de contenido ===\n');

  // 1. Duplicados por similitud de título — La Mira (noticia/alerta/reportaje).
  const noticias = await db.query.noticias.findMany();
  const alertas = await db.query.alertas.findMany();
  const reportajes = await db.query.reportajes.findMany();

  for (const [label, rows, titleField] of [
    ['noticias', noticias, 'title'],
    ['alertas', alertas, 'title'],
    ['reportajes', reportajes, 'title'],
  ] as const) {
    const titles = rows.map((r) => ({ id: r.id, title: (r as Record<string, unknown>)[titleField] as string }));
    const groups = findDuplicateGroups(titles);
    console.log(`-- ${label}: ${rows.length} total, ${groups.length} grupos de posible duplicado --`);
    for (const g of groups) {
      for (const item of g) console.log(`   ${item.id} | ${item.title}`);
      console.log();
    }
  }

  // 2. Noticias/reportajes bajo el umbral de palabras.
  const thinNews = [...noticias, ...reportajes]
    .map((n) => ({ id: n.id, title: n.title, words: countContentWords(n.content) }))
    .filter((n) => n.words < WORD_THRESHOLD);
  console.log(`\n-- Noticias/reportajes bajo ${WORD_THRESHOLD} palabras: ${thinNews.length} --`);
  for (const n of thinNews.sort((a, b) => a.words - b.words)) console.log(`   ${n.words}w | ${n.id} | ${n.title}`);

  // 3. Lugares sin ningún dato verificable real (posible mala categorización).
  const places = await db.query.places.findMany({ with: { photos: true } });
  const fakePlaces = places.filter((p) => !p.address && !p.phone && !p.website && !p.latitude);
  console.log(`\n-- Lugares sin dirección/teléfono/web/coordenadas: ${fakePlaces.length} de ${places.length} --`);
  for (const p of fakePlaces) console.log(`   ${p.id} | ${p.name}`);

  // 4. Fotos de hosts conocidos como falsos.
  const fakePhotos = places.flatMap((p) =>
    p.photos.filter((ph) => {
      try {
        return FAKE_PHOTO_HOSTS.includes(new URL(ph.url).hostname);
      } catch {
        return false;
      }
    }),
  );
  console.log(`\n-- Fotos de hosts falsos (picsum/unsplash): ${fakePhotos.length} --`);

  // NOTA: se intentó un check #5 de "mismo segundo exacto de creación" para
  // detectar lotes de prueba (así se encontraron los 8 lugares de prueba
  // borrados el 2026-09-07) — se quitó porque en la primera corrida real
  // marcó TAMBIÉN los 100 negocios reales de la migración legítima
  // (migrate-planazo-mock.ts también inserta en lote, agrupado por
  // segundo). El timestamp agrupado por sí solo no distingue "migración
  // real en lote" de "seed de prueba en lote" — lo que sí los distinguió esa
  // vez fue la FECHA (un día antes de la migración documentada) + sin foto
  // real encontrable + descripción de <15 palabras, juntos, no uno solo.
  // Si se sospecha un lote de prueba nuevo, revisar esas 3 señales a mano
  // en vez de confiar en un check automático aquí.

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
