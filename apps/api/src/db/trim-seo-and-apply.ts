import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq, and, desc } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { ChecksService } from '../modules/ai/checks.service';
import { getContentTypeConfig } from '../modules/ai/content-types';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Cierra la cola de revisión que dejó la Fase 6.5 (apply-mejorar-lamira.ts):
// de los 31 items en "needs-review", 29 fallaron SOLO por longitud de SEO
// (título/descripción unos cuantos caracteres por encima) — el texto ya
// generado por la IA era bueno, no hacía falta volver a llamar al modelo.
// Este script recorta seo.title/seo.description a un límite de palabra
// completa (nunca a media palabra) y RE-CORRE los checks reales antes de
// aplicar — si el recorte no basta o el item falló por otra razón (los 2
// errores de CLI sin aiOutput, o cualquier cosa que no sea solo SEO), se
// deja intacto para revisión de verdad, no se fuerza.
//
// Uso: pnpm db:trim-seo-and-apply

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return trimmed.trim().replace(/[.,;:¡!¿?\-–—]+$/, '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mismo motivo que apply-mejorar-lamira.ts
interface TypeSpec {
  type: string;
  table: any;
  hasUpdatedAt: boolean;
  applyFields: (draft: Record<string, unknown>) => Record<string, unknown>;
}

const TYPES: TypeSpec[] = [
  { type: 'noticia', table: schema.noticias, hasUpdatedAt: true, applyFields: (d) => ({ dek: d.dek, content: d.content, seo: d.seo }) },
  { type: 'alerta', table: schema.alertas, hasUpdatedAt: true, applyFields: (d) => ({ description: d.description, seo: d.seo }) },
  { type: 'guia', table: schema.guias, hasUpdatedAt: true, applyFields: (d) => ({ dek: d.dek, content: d.content, faq: d.faq, seo: d.seo }) },
  { type: 'evento', table: schema.lamiraEventos, hasUpdatedAt: false, applyFields: (d) => ({ description: d.description, seo: d.seo }) },
  { type: 'lugar', table: schema.lamiraLugares, hasUpdatedAt: false, applyFields: (d) => ({ description: d.description, seo: d.seo }) },
  { type: 'reportaje', table: schema.reportajes, hasUpdatedAt: false, applyFields: (d) => ({ dek: d.dek, content: d.content, seo: d.seo }) },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);
  const checks = app.get(ChecksService);

  const site = await db.query.sites.findFirst({ where: eq(schema.sites.slug, 'la-mira') });
  if (!site) throw new Error("Sitio 'la-mira' no existe.");

  const logs = await db.query.contentAuditLog.findMany({
    where: and(eq(schema.contentAuditLog.siteId, site.id), eq(schema.contentAuditLog.mode, 'improve'), eq(schema.contentAuditLog.decision, 'needs-review')),
    orderBy: [desc(schema.contentAuditLog.createdAt)],
  });

  // Puede haber más de una corrida por item (ej. si esto se corre dos veces) —
  // solo la más reciente por (contentType, contentId) importa.
  const latestByKey = new Map<string, (typeof logs)[number]>();
  for (const log of logs) {
    const key = `${log.contentType}:${log.contentId}`;
    if (!latestByKey.has(key)) latestByKey.set(key, log);
  }

  let applied = 0;
  let skipped = 0;

  for (const log of latestByKey.values()) {
    const spec = TYPES.find((t) => t.type === log.contentType);
    const failing = (log.checksRun as { name: string; passed: boolean; blocking: boolean }[]).filter((c) => c.blocking && !c.passed).map((c) => c.name);
    const onlySeo = failing.length > 0 && failing.every((n) => n === 'seo-titulo' || n === 'seo-descripcion');

    if (!spec || !log.aiOutput || !onlySeo) {
      console.log(`SKIP [${log.contentType}] ${log.contentId} — ${!log.aiOutput ? 'sin aiOutput (falló antes de generar)' : `falla algo más que SEO: ${failing.join(', ')}`}`);
      skipped++;
      continue;
    }

    const draft = { ...(log.aiOutput as Record<string, unknown>) };
    const originalSeo = draft.seo as { title?: string; description?: string };
    const seo = { ...originalSeo };
    if (seo.title && seo.title.length > 60) seo.title = truncateAtWord(seo.title, 60);
    if (seo.description && seo.description.length > 160) seo.description = truncateAtWord(seo.description, 160);
    draft.seo = seo;

    const typeConfig = getContentTypeConfig(log.contentType);
    const { checksRun, decision } = checks.run({
      mode: 'improve',
      requiredFields: [...typeConfig.requiredEditorialFields],
      // seguridad-hechos ya había pasado en la corrida original (no está en
      // `failing`) y esta pasada no toca categoryData — no hace falta
      // recalcularlo contra la categoría real.
      factFields: [],
      draftData: draft,
      seo: draft.seo as { title?: string; description?: string },
      hasImageWithAlt: undefined,
      slugAvailable: true,
      bodyText: JSON.stringify(draft),
    });

    if (decision !== 'auto-published') {
      console.log(`SKIP [${log.contentType}] ${log.contentId} — sigue sin pasar tras recortar: ${checksRun.filter((c) => c.blocking && !c.passed).map((c) => `${c.name} (${c.detail})`).join('; ')}`);
      skipped++;
      continue;
    }

    const fields = spec.applyFields(draft);
    if (spec.hasUpdatedAt) fields.updatedAt = new Date();
    await db.update(spec.table).set(fields).where(eq(spec.table.id, log.contentId));

    await db.insert(schema.contentAuditLog).values({
      siteId: site.id,
      contentType: log.contentType,
      contentId: log.contentId,
      categoryId: log.categoryId,
      mode: 'improve',
      sourceContext: { note: 'SEO recortado mecánicamente (a límite de palabra completa) tras quedar en needs-review por longitud' },
      inputFacts: log.inputFacts,
      aiModel: log.aiModel,
      aiOutput: draft,
      checksRun,
      decision,
      statusBefore: log.statusAfter,
      statusAfter: log.statusAfter,
      actorId: null,
    });

    applied++;
    console.log(`OK [${log.contentType}] ${log.contentId} — título ${(seo.title ?? '').length} car., descripción ${(seo.description ?? '').length} car.`);
  }

  console.log(`\nTotal: ${applied} aplicados tras recorte, ${skipped} sin resolver (necesitan revisión de verdad).`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
