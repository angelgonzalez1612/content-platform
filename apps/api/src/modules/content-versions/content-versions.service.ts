import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import * as schema from '../../db/schema';

// Los 9 tipos con columnas editoriales propias (mismo universo que
// content_audit_log) — relaciones aparte (fotos, tags, categorías) quedan
// fuera a propósito, ver comentario en schema/content-versions.ts.
export type VersionedContentType =
  | 'noticia'
  | 'alerta'
  | 'guia'
  | 'evento'
  | 'lugar'
  | 'reportaje'
  | 'place'
  | 'evento-planazo'
  | 'planazo-guia';

const VERSIONED_TYPES: readonly VersionedContentType[] = [
  'noticia', 'alerta', 'guia', 'evento', 'lugar', 'reportaje', 'place', 'evento-planazo', 'planazo-guia',
];

function isVersionedType(contentType: string): contentType is VersionedContentType {
  return (VERSIONED_TYPES as readonly string[]).includes(contentType);
}

@Injectable()
export class ContentVersionsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /**
   * Guarda la fila COMPLETA actual (antes de que se sobreescriba) — se llama
   * desde cada servicio de contenido, justo antes de su propio `db.update()`.
   * No lanza si el contentType no está entre los versionados: mejor no
   * versionar que tronar un update real por esto.
   */
  async snapshot(contentType: string, contentId: string, currentRow: Record<string, unknown>, label: string): Promise<void> {
    if (!isVersionedType(contentType)) return;
    await this.db.insert(schema.contentVersions).values({
      contentType,
      contentId,
      label,
      snapshot: currentRow,
    });
  }

  async list(contentType: string, contentId: string) {
    return this.db.query.contentVersions.findMany({
      where: and(eq(schema.contentVersions.contentType, contentType), eq(schema.contentVersions.contentId, contentId)),
      orderBy: [desc(schema.contentVersions.createdAt)],
    });
  }

  /**
   * Restaura una versión: escribe su snapshot de vuelta a la tabla principal
   * (solo columnas propias) — y ANTES de hacerlo, guarda la fila actual como
   * una versión nueva (así "restaurar" también es reversible, nunca se
   * pierde el estado de justo antes de restaurar). Un switch explícito por
   * tipo, no una tabla genérica resuelta en runtime: drizzle no puede tipar
   * `.update(tablaVariable).set(...)` de forma segura cuando la tabla es un
   * valor dinámico, así que se opta por 9 casos concretos en vez de pelear
   * contra el sistema de tipos.
   */
  async restore(versionId: string): Promise<{ contentType: string; contentId: string }> {
    const version = await this.db.query.contentVersions.findFirst({ where: eq(schema.contentVersions.id, versionId) });
    if (!version) throw new NotFoundException(`Versión "${versionId}" no existe`);
    if (!isVersionedType(version.contentType)) {
      throw new NotFoundException(`Tipo de contenido "${version.contentType}" ya no se puede restaurar`);
    }

    const contentId = version.contentId;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = version.snapshot as Record<string, unknown>;

    switch (version.contentType) {
      case 'noticia': {
        const current = await this.db.query.noticias.findFirst({ where: eq(schema.noticias.id, contentId) });
        if (!current) throw new NotFoundException(`Noticia "${contentId}" ya no existe`);
        await this.snapshot('noticia', contentId, current, 'Antes de restaurar una versión anterior');
        await this.db.update(schema.noticias).set({ ...fields, updatedAt: new Date() }).where(eq(schema.noticias.id, contentId));
        break;
      }
      case 'alerta': {
        const current = await this.db.query.alertas.findFirst({ where: eq(schema.alertas.id, contentId) });
        if (!current) throw new NotFoundException(`Alerta "${contentId}" ya no existe`);
        await this.snapshot('alerta', contentId, current, 'Antes de restaurar una versión anterior');
        await this.db.update(schema.alertas).set({ ...fields, updatedAt: new Date() }).where(eq(schema.alertas.id, contentId));
        break;
      }
      case 'guia': {
        const current = await this.db.query.guias.findFirst({ where: eq(schema.guias.id, contentId) });
        if (!current) throw new NotFoundException(`Guía "${contentId}" ya no existe`);
        await this.snapshot('guia', contentId, current, 'Antes de restaurar una versión anterior');
        await this.db.update(schema.guias).set({ ...fields, updatedAt: new Date() }).where(eq(schema.guias.id, contentId));
        break;
      }
      case 'evento': {
        const current = await this.db.query.lamiraEventos.findFirst({ where: eq(schema.lamiraEventos.id, contentId) });
        if (!current) throw new NotFoundException(`Evento "${contentId}" ya no existe`);
        await this.snapshot('evento', contentId, current, 'Antes de restaurar una versión anterior');
        await this.db.update(schema.lamiraEventos).set({ ...fields }).where(eq(schema.lamiraEventos.id, contentId));
        break;
      }
      case 'lugar': {
        const current = await this.db.query.lamiraLugares.findFirst({ where: eq(schema.lamiraLugares.id, contentId) });
        if (!current) throw new NotFoundException(`Lugar "${contentId}" ya no existe`);
        await this.snapshot('lugar', contentId, current, 'Antes de restaurar una versión anterior');
        await this.db.update(schema.lamiraLugares).set({ ...fields }).where(eq(schema.lamiraLugares.id, contentId));
        break;
      }
      case 'reportaje': {
        const current = await this.db.query.reportajes.findFirst({ where: eq(schema.reportajes.id, contentId) });
        if (!current) throw new NotFoundException(`Reportaje "${contentId}" ya no existe`);
        await this.snapshot('reportaje', contentId, current, 'Antes de restaurar una versión anterior');
        await this.db.update(schema.reportajes).set({ ...fields }).where(eq(schema.reportajes.id, contentId));
        break;
      }
      case 'place': {
        const current = await this.db.query.places.findFirst({ where: eq(schema.places.id, contentId) });
        if (!current) throw new NotFoundException(`Lugar "${contentId}" ya no existe`);
        await this.snapshot('place', contentId, current, 'Antes de restaurar una versión anterior');
        await this.db.update(schema.places).set({ ...fields, updatedAt: new Date() }).where(eq(schema.places.id, contentId));
        break;
      }
      case 'evento-planazo': {
        const current = await this.db.query.events.findFirst({ where: eq(schema.events.id, contentId) });
        if (!current) throw new NotFoundException(`Evento "${contentId}" ya no existe`);
        await this.snapshot('evento-planazo', contentId, current, 'Antes de restaurar una versión anterior');
        await this.db.update(schema.events).set(fields).where(eq(schema.events.id, contentId));
        break;
      }
      case 'planazo-guia': {
        const current = await this.db.query.planazoGuides.findFirst({ where: eq(schema.planazoGuides.id, contentId) });
        if (!current) throw new NotFoundException(`Guía "${contentId}" ya no existe`);
        await this.snapshot('planazo-guia', contentId, current, 'Antes de restaurar una versión anterior');
        await this.db.update(schema.planazoGuides).set({ ...fields, updatedAt: new Date() }).where(eq(schema.planazoGuides.id, contentId));
        break;
      }
    }

    return { contentType: version.contentType, contentId };
  }
}
