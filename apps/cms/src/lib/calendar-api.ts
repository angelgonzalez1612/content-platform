// Tipos para el Calendario Editorial — datos reales de CalendarService (API).
// contentEditHref/contentTypeLabel/contentTypeIcon ya existen en
// dashboard-api.ts (genéricos, no específicos del dashboard) — se reusan
// desde ahí en vez de duplicarlos.

export interface CalendarItem {
  contentType: string;
  contentId: string;
  title: string;
  slug: string;
  site: "la-mira" | "planazo";
  date: string;
}
