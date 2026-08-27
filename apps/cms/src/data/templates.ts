// Registro estático de "qué pide cada plantilla" — describe en un solo lugar
// lo que hoy vive repartido en el prompt del backend (content-types.ts) y en
// cada Generate*Flow del CMS (los campos "extra" que llena el humano). No es
// la fuente de la verdad ejecutable (eso lo sigue siendo content-types.ts en
// el backend) — es la versión legible para la página /plantillas, mantenida
// a mano en paralelo. Si se agrega/cambia un tipo de contenido allá, hay que
// reflejarlo aquí también.

export interface TemplateHumanField {
  label: string;
  optional: boolean;
  hint?: string;
}

export interface ContentTemplate {
  contentType: string;
  site: "la-mira" | "planazo";
  label: string;
  description: string;
  aiFields: string[];
  humanFields: TemplateHumanField[];
}

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    contentType: "noticia",
    site: "la-mira",
    label: "Noticia",
    description: "Hecho puntual con vigencia corta — la IA lee el artículo completo de la fuente y redacta con voz propia, sin copiar ni parafrasear de cerca.",
    aiFields: ["Encabezado", "Bajada (dek)", "Cuerpo en bloques", "SEO (título + descripción)", "Imagen y crédito (de la fuente)"],
    humanFields: [{ label: "Autor", optional: false }],
  },
  {
    contentType: "alerta",
    site: "la-mira",
    label: "Alerta",
    description: "Disrupción activa en curso (bloqueo, cierre, riesgo) — se publica de inmediato, no tiene borrador.",
    aiFields: ["Encabezado", "Descripción", "SEO (título + descripción)", "Imagen y crédito (de la fuente)"],
    humanFields: [
      { label: "Estado", optional: true, hint: "Activa / En seguimiento / Resuelta — arranca en \"Activa\"; solo cámbialo si ya sabes que cambió." },
      { label: "Alcaldía", optional: true },
    ],
  },
  {
    contentType: "guia",
    site: "la-mira",
    label: "Guía",
    description: "Contenido evergreen tipo trámite/how-to — no tiene fecha de vigencia.",
    aiFields: ["Encabezado", "Bajada (dek)", "Cuerpo en bloques con encabezados"],
    humanFields: [
      { label: "Grupo de trámite", optional: false, hint: "En qué sección de la guía de trámites vive (documentos, licencias, transporte…)." },
      { label: "Preguntas frecuentes", optional: true, hint: "La IA no las genera — se agregan después de crear, en la edición." },
    ],
  },
  {
    contentType: "evento",
    site: "la-mira",
    label: "Evento",
    description: "Evento noticioso de una sola vez o de agenda pública — angle de cobertura, no recomendación de plan (para eso existe Evento de Planazo).",
    aiFields: ["Encabezado", "Descripción", "SEO (título + descripción)"],
    humanFields: [
      { label: "Fecha", optional: false },
      { label: "Hora", optional: false },
      { label: "Ubicación", optional: false },
      { label: "Precio", optional: false },
      { label: "Organizador", optional: false },
      { label: "Alcaldía", optional: true },
    ],
  },
  {
    contentType: "lugar",
    site: "la-mira",
    label: "Lugar",
    description: "Reseña/cobertura de un lugar con angle noticioso (apertura, cierre, hecho reciente) — no un directorio evergreen (para eso existe Lugar de Planazo).",
    aiFields: ["Descripción"],
    humanFields: [
      { label: "Tipo de lugar", optional: false },
      { label: "Alcaldía", optional: false },
    ],
  },
  {
    contentType: "reportaje",
    site: "la-mira",
    label: "Reportaje",
    description: "Análisis largo, con más contexto y profundidad — no una noticia de último momento.",
    aiFields: ["Encabezado", "Bajada (dek)", "Cuerpo en bloques"],
    humanFields: [
      { label: "Autor", optional: false },
      { label: "Pie de foto", optional: false },
      { label: "Etiquetas", optional: true, hint: "Si se deja vacío, se usa \"Reportaje\" por default." },
    ],
  },
  {
    contentType: "place",
    site: "planazo",
    label: "Lugar",
    description: "Ficha de negocio/lugar para el directorio evergreen de Planazo — el tema es un lugar puntual, no una noticia.",
    aiFields: ["Descripción", "Etiquetas sugeridas"],
    humanFields: [{ label: "Dirección, teléfono, precio, horario", optional: true, hint: "La IA nunca los inventa — se completan después de crear, en la edición." }],
  },
  {
    contentType: "evento-planazo",
    site: "planazo",
    label: "Evento",
    description: "Evento como recomendación de plan, típicamente ligado a un lugar/negocio recurrente — no cobertura noticiosa (para eso existe Evento de La Mira).",
    aiFields: ["Descripción"],
    humanFields: [
      { label: "Fecha y hora de inicio", optional: false },
      { label: "Fecha y hora de fin", optional: true },
      { label: "Lugar", optional: true },
    ],
  },
];
