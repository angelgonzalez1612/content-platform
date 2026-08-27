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
  // A qué sitio pertenece este tipo — usado por AiDraftService.classifyContentType
  // para decidir sitio+tipo en un solo paso cuando el caller no los manda (flujo
  // de Publicar desde content-radar, que ya no fija el destino de antemano).
  site: 'la-mira' | 'planazo';
  // Descripción corta (1 línea) de cuándo encaja este tipo — es lo que ve el
  // clasificador junto al contentType, no el humano.
  classifyHint: string;
  editorialShape: z.ZodRawShape;
  requiredEditorialFields: string[];
  systemPrompt: string;
}

const LAMIRA_BASE_PROMPT = `Eres redactor de la-mira, un periódico digital hiperlocal de la Ciudad de México.

Reglas estrictas:
- Solo escribes con la información y las fuentes que te da el editor. NUNCA inventes cifras, nombres, fechas, ubicaciones exactas ni citas que no te dieron — el periodismo inventado es inaceptable, no un detalle menor.
- Si el editor no dio suficiente información para un dato específico, escribe alrededor de esa ausencia en vez de rellenar con una suposición.
- Cuando el editor te dé el texto completo de un artículo de otro medio como "material de referencia": es SOLO para que te informes de los hechos, nunca para copiar. No repitas oraciones completas, no sigas la misma estructura de párrafos, no cites textualmente. Redacta la nota con tu propio criterio editorial y tus propias palabras — es reporteo original de la-mira, no una reescritura de otro medio.
- Tono: directo, informativo, sin adjetivos innecesarios — noticia, no opinión.
- Responde siempre en español de México.`;

export const CONTENT_TYPES: Record<string, ContentTypeConfig> = {
  place: {
    contentType: 'place',
    label: 'Lugar (Planazo)',
    site: 'planazo',
    classifyHint: 'Ficha de negocio/lugar para el directorio evergreen de Planazo — el tema ES un lugar puntual (restaurante, bar, museo, parque…), no una noticia de coyuntura ni un evento con fecha.',
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
    site: 'la-mira',
    classifyHint: 'Hecho puntual con vigencia corta — algo que pasó o se anunció, sin ser una disrupción activa urgente.',
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
    site: 'la-mira',
    classifyHint: 'Disrupción activa EN CURSO ahora mismo (bloqueo, cierre, riesgo de seguridad, clima severo) que amerita urgencia — no un hecho ya cerrado.',
    editorialShape: {
      description: z.string().describe('1-3 párrafos, explica la situación con lo que se sabe hasta ahora.'),
    },
    requiredEditorialFields: ['description'],
    systemPrompt: LAMIRA_BASE_PROMPT,
  },
  guia: {
    contentType: 'guia',
    label: 'Guía (la-mira)',
    site: 'la-mira',
    classifyHint: 'Contenido evergreen tipo trámite/how-to ("cómo tramitar X", "qué hacer si Y") — no tiene fecha de vigencia.',
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
    site: 'la-mira',
    classifyHint: 'Evento noticioso de una sola vez o de agenda pública (marcha, festival grande, anuncio oficial) — angle de periodismo/cobertura, no una recomendación evergreen de plan. Si el evento está ligado a un negocio/lugar recurrente (bar, foro, restaurante) y el angle es "qué hacer", usa evento-planazo en vez de este.',
    editorialShape: {
      description: z.string().describe('1-2 párrafos que inviten a asistir, sin inventar fecha/hora/lugar/precio — esos ya están capturados aparte.'),
    },
    requiredEditorialFields: ['description'],
    systemPrompt: LAMIRA_BASE_PROMPT,
  },
  'evento-planazo': {
    contentType: 'evento-planazo',
    label: 'Evento (Planazo)',
    site: 'planazo',
    classifyHint: 'Evento como recomendación de plan (angle "qué hacer"), típicamente ligado a un lugar/negocio recurrente — para la guía evergreen de Planazo, no para cobertura noticiosa. Si el evento es más bien noticia de agenda pública/cobertura, usa evento (la-mira) en vez de este.',
    editorialShape: {
      description: z.string().describe('1-2 párrafos que inviten a asistir, tono de recomendación de plan — sin inventar fecha/hora/lugar/precio, esos ya están capturados aparte.'),
    },
    requiredEditorialFields: ['description'],
    systemPrompt: `Eres redactor editorial de Planazo, una guía de planes y lugares de la Ciudad de México.

Reglas estrictas:
- Solo escribes con la información que te da el editor. NUNCA inventes fecha, hora, lugar, precio ni otros datos verificables que no te dieron — eso lo completa un humano después.
- El tono es directo y útil, como alguien que te está recomendando un plan, no como un anuncio ni como cobertura noticiosa.
- Responde siempre en español de México.`,
  },
  lugar: {
    contentType: 'lugar',
    label: 'Lugar (la-mira)',
    site: 'la-mira',
    classifyHint: 'Reseña/cobertura de un lugar con angle noticioso (apertura, cierre, hecho reciente) — no una ficha de directorio evergreen (para eso existe "place" en Planazo).',
    editorialShape: {
      description: z.string().describe('1-2 párrafos que describan el lugar para alguien que nunca ha ido.'),
    },
    requiredEditorialFields: ['description'],
    systemPrompt: LAMIRA_BASE_PROMPT,
  },
  reportaje: {
    contentType: 'reportaje',
    label: 'Reportaje (la-mira)',
    site: 'la-mira',
    classifyHint: 'Análisis largo, con más contexto y profundidad — no una noticia de último momento ni una nota corta.',
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
