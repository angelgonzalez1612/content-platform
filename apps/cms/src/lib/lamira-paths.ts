// Mapea el `type` interno de la-mira al segmento de ruta real del sitio
// (src/app/<segmento>/[slug] en el repo la-mira) — usado tanto por la vista
// previa (URL simulada) como por el botón "Ver publicación" (URL real).
export const LAMIRA_TYPE_PATH: Record<string, string> = {
  noticia: "noticias",
  alerta: "alertas",
  guia: "guias",
  evento: "eventos",
  lugar: "lugares",
  reportaje: "reportajes",
};
