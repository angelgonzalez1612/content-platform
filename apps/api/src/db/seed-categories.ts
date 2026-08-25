import 'dotenv/config';
import { eq, and, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import type { FieldSchemaEntry } from '@planazo/types';
import * as schema from './schema';

// Las 27 categorías canónicas y su field_schema, tal como se definieron y
// aprobaron en la Fase 0/1 del plan de arquitectura (2026-08-25) — ver el
// documento de plan para el razonamiento de por qué cada una quedó en su
// sitio (la-mira = periodismo/vigencia corta, Planazo = directorio de
// planes/evergreen, o genuinamente ambas).

type Site = 'la-mira' | 'planazo' | null; // null = compartida

interface CategorySeed {
  slug: string;
  name: string;
  site: Site;
  fieldSchema: FieldSchemaEntry[];
}

const CATEGORIES: CategorySeed[] = [
  // ── Compartidas ──────────────────────────────────────────────────────
  {
    slug: 'eventos',
    name: 'Eventos',
    site: null,
    fieldSchema: [
      { key: 'modalidad', label: 'Modalidad', type: 'select', options: ['presencial', 'virtual', 'hibrido'] },
      { key: 'edad_recomendada', label: 'Edad recomendada', type: 'text' },
    ],
  },
  {
    slug: 'cultura',
    name: 'Cultura',
    site: null,
    fieldSchema: [
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['museo', 'teatro', 'exposicion', 'danza', 'cine'] },
      { key: 'curador_o_compania', label: 'Curador / compañía', type: 'text', isFact: true },
      { key: 'fecha_fin_exposicion', label: 'Fecha fin de exposición', type: 'date', isFact: true },
    ],
  },
  {
    slug: 'comer',
    name: 'Comer',
    site: null,
    fieldSchema: [
      { key: 'tipo_cocina', label: 'Tipo de cocina', type: 'select', options: ['mexicana', 'italiana', 'asiatica', 'otra'] },
      { key: 'apto_vegano', label: 'Apto vegano', type: 'boolean' },
      { key: 'reservaciones_requeridas', label: 'Reservaciones requeridas', type: 'boolean' },
    ],
  },
  {
    slug: 'cine-tv',
    name: 'Cine y TV',
    site: null,
    fieldSchema: [
      { key: 'clasificacion', label: 'Clasificación', type: 'select', options: ['A', 'B', 'B15', 'C', 'D'], isFact: true },
      { key: 'duracion_minutos', label: 'Duración (min)', type: 'number', isFact: true },
      { key: 'plataforma_streaming', label: 'Plataforma de streaming', type: 'text', isFact: true },
      { key: 'genero', label: 'Género', type: 'text' },
      { key: 'reparto', label: 'Reparto', type: 'text', isFact: true },
    ],
  },
  {
    slug: 'musica',
    name: 'Música',
    site: null,
    fieldSchema: [
      { key: 'artista', label: 'Artista', type: 'text', isFact: true },
      { key: 'genero_musical', label: 'Género musical', type: 'text' },
      { key: 'venue', label: 'Venue (si no hay lugar asociado)', type: 'text', isFact: true },
      { key: 'boletos_url', label: 'URL de boletos', type: 'text', isFact: true },
    ],
  },

  // ── Exclusivas Planazo ───────────────────────────────────────────────
  {
    slug: 'cafes',
    name: 'Cafés',
    site: 'planazo',
    fieldSchema: [
      { key: 'wifi_disponible', label: 'WiFi disponible', type: 'boolean' },
      { key: 'espacio_trabajo', label: 'Espacio para trabajar', type: 'boolean' },
      { key: 'tipo_cafe', label: 'Tipo de café', type: 'select', options: ['specialty', 'tradicional'] },
    ],
  },
  {
    slug: 'bares',
    name: 'Bares',
    site: 'planazo',
    fieldSchema: [
      { key: 'tipo_bar', label: 'Tipo de bar', type: 'select', options: ['cantina', 'cocteleria', 'cerveceria', 'mezcaleria'] },
      { key: 'musica_en_vivo', label: 'Música en vivo', type: 'boolean' },
      { key: 'edad_minima', label: 'Edad mínima', type: 'number', isFact: true },
    ],
  },
  {
    slug: 'aire-libre',
    name: 'Aire libre',
    site: 'planazo',
    fieldSchema: [
      { key: 'tipo_actividad', label: 'Tipo de actividad', type: 'select', options: ['parque', 'ciclismo', 'senderismo', 'picnic'] },
      { key: 'nivel_dificultad', label: 'Nivel de dificultad', type: 'select', options: ['facil', 'moderado', 'dificil'] },
      { key: 'apto_ninos', label: 'Apto para niños', type: 'boolean' },
    ],
  },
  {
    slug: 'gaming',
    name: 'Gaming',
    site: 'planazo',
    fieldSchema: [
      { key: 'plataforma', label: 'Plataforma', type: 'multiselect', options: ['PC', 'consola', 'movil'] },
      { key: 'genero_juego', label: 'Género de juego', type: 'text' },
    ],
  },
  {
    slug: 'viajes',
    name: 'Viajes',
    site: 'planazo',
    fieldSchema: [
      { key: 'destino', label: 'Destino', type: 'text', isFact: true },
      { key: 'duracion_dias', label: 'Duración (días)', type: 'number', isFact: true },
      { key: 'presupuesto_estimado', label: 'Presupuesto estimado', type: 'text', isFact: true },
      { key: 'temporada_recomendada', label: 'Temporada recomendada', type: 'text' },
      { key: 'como_llegar', label: 'Cómo llegar', type: 'textarea' },
    ],
  },
  {
    slug: 'geek',
    name: 'Geek',
    site: 'planazo',
    fieldSchema: [
      { key: 'franquicia', label: 'Franquicia', type: 'text' },
      { key: 'tipo_evento', label: 'Tipo de evento', type: 'select', options: ['convencion', 'lanzamiento', 'torneo'] },
    ],
  },
  {
    slug: 'mascotas',
    name: 'Mascotas',
    site: 'planazo',
    fieldSchema: [
      { key: 'tipo_mascota', label: 'Tipo de mascota', type: 'select', options: ['perro', 'gato', 'otro'] },
      { key: 'restricciones', label: 'Restricciones', type: 'text', isFact: true },
    ],
  },

  // ── Exclusivas la-mira ───────────────────────────────────────────────
  { slug: 'ciudad', name: 'Ciudad', site: 'la-mira', fieldSchema: [] },
  {
    slug: 'seguridad',
    name: 'Seguridad',
    site: 'la-mira',
    fieldSchema: [
      { key: 'nivel_alerta', label: 'Nivel de alerta', type: 'select', options: ['bajo', 'medio', 'alto'] },
      { key: 'autoridad_responsable', label: 'Autoridad responsable', type: 'text', isFact: true },
    ],
  },
  {
    slug: 'politica',
    name: 'Política',
    site: 'la-mira',
    fieldSchema: [
      { key: 'funcionario_involucrado', label: 'Funcionario involucrado', type: 'text', isFact: true },
      { key: 'institucion', label: 'Institución', type: 'text', isFact: true },
    ],
  },
  {
    slug: 'economia',
    name: 'Economía',
    site: 'la-mira',
    fieldSchema: [
      { key: 'indicador_relacionado', label: 'Indicador relacionado', type: 'text' },
      { key: 'sector', label: 'Sector', type: 'text' },
    ],
  },
  {
    slug: 'medio-ambiente',
    name: 'Medio ambiente',
    site: 'la-mira',
    fieldSchema: [
      { key: 'tipo_impacto', label: 'Tipo de impacto', type: 'select', options: ['aire', 'agua', 'suelo', 'fauna'] },
      { key: 'zona_afectada', label: 'Zona afectada', type: 'text', isFact: true },
    ],
  },
  {
    slug: 'trafico',
    name: 'Tráfico',
    site: 'la-mira',
    fieldSchema: [
      { key: 'vialidad_afectada', label: 'Vialidad afectada', type: 'text', isFact: true },
      { key: 'duracion_estimada', label: 'Duración estimada', type: 'text', isFact: true },
      { key: 'alterno_sugerido', label: 'Alterno sugerido', type: 'textarea' },
    ],
  },
  {
    slug: 'metro',
    name: 'Metro',
    site: 'la-mira',
    fieldSchema: [
      {
        key: 'linea',
        label: 'Línea',
        type: 'select',
        isFact: true,
        options: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L12', 'A', 'B'],
      },
      { key: 'estacion_afectada', label: 'Estación afectada', type: 'text', isFact: true },
      { key: 'tipo_afectacion', label: 'Tipo de afectación', type: 'select', options: ['retraso', 'cierre', 'operativo'] },
    ],
  },
  {
    slug: 'metrobus',
    name: 'Metrobús',
    site: 'la-mira',
    fieldSchema: [
      { key: 'linea', label: 'Línea', type: 'select', isFact: true, options: ['1', '2', '3', '4', '5', '6', '7'] },
      { key: 'estacion_afectada', label: 'Estación afectada', type: 'text', isFact: true },
    ],
  },
  {
    slug: 'marchas',
    name: 'Marchas',
    site: 'la-mira',
    fieldSchema: [
      { key: 'punto_origen', label: 'Punto de origen', type: 'text', isFact: true },
      { key: 'punto_destino', label: 'Punto de destino', type: 'text', isFact: true },
      { key: 'hora_inicio', label: 'Hora de inicio', type: 'text', isFact: true },
      { key: 'motivo', label: 'Motivo', type: 'text' },
    ],
  },
  {
    slug: 'bloqueos',
    name: 'Bloqueos',
    site: 'la-mira',
    fieldSchema: [
      { key: 'ubicacion', label: 'Ubicación', type: 'text', isFact: true },
      { key: 'duracion_estimada', label: 'Duración estimada', type: 'text', isFact: true },
      { key: 'motivo', label: 'Motivo', type: 'text' },
    ],
  },
  {
    slug: 'transporte',
    name: 'Transporte',
    site: 'la-mira',
    fieldSchema: [
      {
        key: 'tipo_transporte',
        label: 'Tipo de transporte',
        type: 'select',
        options: ['RTP', 'trolebus', 'cablebus', 'tren ligero'],
      },
      { key: 'linea_o_ruta', label: 'Línea o ruta', type: 'text', isFact: true },
    ],
  },
  {
    slug: 'alertas',
    name: 'Alertas',
    site: 'la-mira',
    fieldSchema: [
      { key: 'nivel_riesgo', label: 'Nivel de riesgo', type: 'select', options: ['bajo', 'medio', 'alto', 'critico'] },
      { key: 'zona_afectada', label: 'Zona afectada', type: 'text', isFact: true },
    ],
  },
  {
    slug: 'clima',
    name: 'Clima',
    site: 'la-mira',
    fieldSchema: [
      {
        key: 'tipo_fenomeno',
        label: 'Tipo de fenómeno',
        type: 'select',
        options: ['lluvia', 'calor', 'frio', 'granizo', 'tormenta'],
      },
      { key: 'temperatura_esperada', label: 'Temperatura esperada', type: 'text', isFact: true },
      { key: 'alcaldias_afectadas', label: 'Alcaldías afectadas', type: 'multiselect', isFact: true },
    ],
  },
  {
    slug: 'deportes',
    name: 'Deportes',
    site: 'la-mira',
    fieldSchema: [
      { key: 'deporte', label: 'Deporte', type: 'select', options: ['futbol', 'basquetbol', 'box', 'beisbol', 'otro'] },
      { key: 'equipos_involucrados', label: 'Equipos involucrados', type: 'text', isFact: true },
      { key: 'resultado', label: 'Resultado', type: 'text', isFact: true },
      { key: 'competicion', label: 'Competición', type: 'text', isFact: true },
    ],
  },
  {
    slug: 'tecnologia',
    name: 'Tecnología',
    site: 'la-mira',
    fieldSchema: [
      { key: 'categoria_tech', label: 'Categoría tech', type: 'select', options: ['IA', 'apps', 'hardware', 'startups'] },
      { key: 'empresa_involucrada', label: 'Empresa involucrada', type: 'text', isFact: true },
    ],
  },
];

async function main() {
  const client = createClient({ url: process.env.DATABASE_URL ?? 'file:./data/dev.sqlite' });
  const db = drizzle(client, { schema });

  const siteIdBySlug = new Map<'la-mira' | 'planazo', string>();
  for (const slug of ['la-mira', 'planazo'] as const) {
    const existing = await db.query.sites.findFirst({ where: eq(schema.sites.slug, slug) });
    if (existing) {
      siteIdBySlug.set(slug, existing.id);
      continue;
    }
    const name = slug === 'la-mira' ? 'La Mira' : 'Planazo';
    const domain = slug === 'la-mira' ? 'lamira.mx' : 'planazo.com.mx';
    const [inserted] = await db.insert(schema.sites).values({ slug, name, domain }).returning({ id: schema.sites.id });
    siteIdBySlug.set(slug, inserted.id);
  }
  console.log(`${siteIdBySlug.size} sitios listos.`);

  let created = 0;
  let updated = 0;

  for (const cat of CATEGORIES) {
    const siteId = cat.site ? siteIdBySlug.get(cat.site) : null;
    const values = { name: cat.name, siteId: siteId ?? null, fieldSchema: cat.fieldSchema };

    // slug es único globalmente, pero por si acaso comparamos también por
    // site_id — dos categorías con el mismo slug en sitios distintos no
    // debería pasar con este set, pero deja la lógica correcta si pasara.
    const existing = await db.query.categories.findFirst({
      where: cat.site
        ? eq(schema.categories.slug, cat.slug)
        : and(eq(schema.categories.slug, cat.slug), isNull(schema.categories.siteId)),
    });

    if (existing) {
      await db.update(schema.categories).set(values).where(eq(schema.categories.id, existing.id));
      updated += 1;
    } else {
      await db.insert(schema.categories).values({ slug: cat.slug, ...values });
      created += 1;
    }
  }
  console.log(`${created} categorías creadas, ${updated} actualizadas (total ${CATEGORIES.length}).`);

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
