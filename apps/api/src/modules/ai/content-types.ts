import { z } from 'zod';

// Registro de tipos de contenido que el agente editorial sabe redactar.
// Cada entrada define SOLO los campos editoriales propios de ese tipo (no
// los del field_schema de la categoría, que se agregan dinámicamente vía
// field-schema-builder.ts) y el prompt base. Agregar un tipo nuevo es
// mecánico: copiar una entrada, ajustar el shape y el prompt — el resto del
// pipeline (checks, auditoría, dynamic schema) ya es genérico.
//
// Empieza con 'place' (ya probado, existía como generate-place) y 'noticia'
// (el tipo insignia de la-mira) para validar el patrón antes de replicarlo
// al resto — ver Fase 3 del plan.

export interface ContentTypeConfig {
  contentType: string;
  label: string;
  editorialShape: z.ZodRawShape;
  requiredEditorialFields: string[];
  systemPrompt: string;
}

const LAMIRA_BASE_PROMPT = `Eres redactor de la-mira, un periódico digital hiperlocal de la Ciudad de México.

Reglas estrictas:
- Solo escribes con la información y las fuentes que te da el editor. NUNCA inventes cifras, nombres, fechas, ubicaciones exactas ni citas que no te dieron — el periodismo inventado es inaceptable, no un detalle menor.
- Si el editor no dio suficiente información para un dato específico, escribe alrededor de esa ausencia en vez de rellenar con una suposición.
- Tono: directo, informativo, sin adjetivos innecesarios — noticia, no opinión.
- Responde siempre en español de México.`;

export const CONTENT_TYPES: Record<string, ContentTypeConfig> = {
  place: {
    contentType: 'place',
    label: 'Lugar (Planazo)',
    editorialShape: {
      description: z
        .string()
        .describe('80-120 palabras, editorial, en español de México, para una guía de planes de CDMX.'),
      suggestedTags: z.array(z.string()).min(1).max(5),
    },
    requiredEditorialFields: ['description', 'suggestedTags'],
    systemPrompt: `Eres redactor editorial de Planazo, una guía de planes y lugares de la Ciudad de México.

Reglas estrictas:
- Solo escribes con la información que te da el editor (nombre + notas + categoría). NUNCA inventes dirección, teléfono, precios, horarios ni datos verificables que no te dieron — eso lo completa un humano después.
- El tono es directo y útil, como alguien que ya fue y te está recomendando, no como un anuncio.
- Responde siempre en español de México.`,
  },
  noticia: {
    contentType: 'noticia',
    label: 'Noticia (la-mira)',
    editorialShape: {
      dek: z.string().describe('Bajada de 1-2 líneas, resume la noticia sin repetir el título.'),
      content: z
        .array(z.object({ heading: z.string().nullable(), paragraphs: z.array(z.string()) }))
        .min(1)
        .describe('Cuerpo de la nota en bloques; heading es opcional (null si no aplica).'),
    },
    requiredEditorialFields: ['dek', 'content'],
    systemPrompt: LAMIRA_BASE_PROMPT,
  },
  alerta: {
    contentType: 'alerta',
    label: 'Alerta (la-mira)',
    editorialShape: {
      description: z.string().describe('1-3 párrafos, explica la situación con lo que se sabe hasta ahora.'),
    },
    requiredEditorialFields: ['description'],
    systemPrompt: LAMIRA_BASE_PROMPT,
  },
  guia: {
    contentType: 'guia',
    label: 'Guía (la-mira)',
    editorialShape: {
      dek: z.string().describe('Bajada de 1-2 líneas, resume qué resuelve la guía.'),
      content: z
        .array(z.object({ id: z.string(), heading: z.string(), paragraphs: z.array(z.string()) }))
        .min(1)
        .describe('Cuerpo de la guía en bloques con heading obligatorio.'),
      faq: z.array(z.object({ question: z.string(), answer: z.string() })).describe('Preguntas frecuentes reales sobre el trámite.'),
    },
    requiredEditorialFields: ['dek', 'content'],
    systemPrompt: `${LAMIRA_BASE_PROMPT}\n\nEsta pieza es una guía de trámite ("evergreen"), no una noticia — quickFacts y officialSource ya están capturados aparte y no debes repetirlos ni contradecirlos en el cuerpo.`,
  },
  evento: {
    contentType: 'evento',
    label: 'Evento (la-mira)',
    editorialShape: {
      description: z.string().describe('1-2 párrafos que inviten a asistir, sin inventar fecha/hora/lugar/precio — esos ya están capturados aparte.'),
    },
    requiredEditorialFields: ['description'],
    systemPrompt: LAMIRA_BASE_PROMPT,
  },
  lugar: {
    contentType: 'lugar',
    label: 'Lugar (la-mira)',
    editorialShape: {
      description: z.string().describe('1-2 párrafos que describan el lugar para alguien que nunca ha ido.'),
    },
    requiredEditorialFields: ['description'],
    systemPrompt: LAMIRA_BASE_PROMPT,
  },
  reportaje: {
    contentType: 'reportaje',
    label: 'Reportaje (la-mira)',
    editorialShape: {
      dek: z.string().describe('Bajada de 1-2 líneas, resume el ángulo del reportaje sin repetir el título.'),
      content: z
        .array(z.object({ heading: z.string().nullable(), paragraphs: z.array(z.string()) }))
        .min(1)
        .describe('Cuerpo del reportaje en bloques; heading es opcional (null si no aplica).'),
    },
    requiredEditorialFields: ['dek', 'content'],
    systemPrompt: `${LAMIRA_BASE_PROMPT}\n\nEsta pieza es un reportaje de análisis (más largo, más contexto), no una noticia de último momento.`,
  },
};

export function getContentTypeConfig(contentType: string): ContentTypeConfig {
  const config = CONTENT_TYPES[contentType];
  if (!config) {
    throw new Error(`Tipo de contenido desconocido: "${contentType}". Válidos: ${Object.keys(CONTENT_TYPES).join(', ')}`);
  }
  return config;
}
