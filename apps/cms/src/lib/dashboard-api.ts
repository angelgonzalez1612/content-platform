// Tipos + helpers para el dashboard — todo lo que consume viene de datos
// reales (apps/api DashboardService), no hay mock aquí. Ver
// dashboard-content.tsx.

export interface DashboardContentRef {
  contentType: string;
  contentId: string;
  title: string;
  site: "la-mira" | "planazo";
  at: string;
}

export interface DashboardStaleItem extends DashboardContentRef {
  daysSinceUpdate: number;
}

export interface DashboardStats {
  counts: { published: number; draft: number; inReview: number; scheduled: number };
  aiGeneratedTotal: number;
  aiGeneratedLast30Days: number;
  recentlyCreated: DashboardContentRef[];
  staleContent: DashboardStaleItem[];
  alerts: { title: string; meta: string }[];
}

const TYPE_LABEL: Record<string, string> = {
  noticia: "Noticia",
  alerta: "Alerta",
  guia: "Guía",
  evento: "Evento",
  lugar: "Lugar",
  reportaje: "Reportaje",
  place: "Lugar",
  "evento-planazo": "Evento",
  "planazo-guia": "Guía",
};

const TYPE_ICON: Record<string, string> = {
  noticia: "📰",
  alerta: "🚨",
  guia: "📘",
  evento: "📅",
  lugar: "📍",
  reportaje: "🔎",
  place: "📍",
  "evento-planazo": "📅",
  "planazo-guia": "📘",
};

const LAMIRA_TYPES = new Set(["noticia", "alerta", "guia", "evento", "lugar", "reportaje"]);

export function contentTypeLabel(contentType: string): string {
  return TYPE_LABEL[contentType] ?? contentType;
}

export function contentTypeIcon(contentType: string): string {
  return TYPE_ICON[contentType] ?? "•";
}

export function contentEditHref(contentType: string, contentId: string): string {
  if (contentType === "place") return `/contenido/${contentId}`;
  if (contentType === "evento-planazo") return `/contenido/planazo-evento/${contentId}`;
  if (contentType === "planazo-guia") return `/contenido/planazo-guia/${contentId}`;
  if (LAMIRA_TYPES.has(contentType)) return `/contenido/lamira/${contentType}/${contentId}`;
  return "/contenido";
}

export function daysAgoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

export interface LastDeploy {
  project: string;
  label: string;
  deployedAt: string | null;
  state: string | null;
  url: string | null;
}

// Más fino que daysAgoLabel (minutos/horas) — un deploy típico es cuestión
// de minutos/horas, no de días, "hoy"/"hace 2 días" sería inútil aquí.
export function relativeTimeLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

const DEPLOY_STATE_LABEL: Record<string, string> = {
  READY: "Listo",
  ERROR: "Error",
  BUILDING: "Compilando",
  QUEUED: "En cola",
  CANCELED: "Cancelado",
  BLOCKED: "Bloqueado",
  INITIALIZING: "Iniciando",
  error: "No se pudo checar",
};

export function deployStateLabel(state: string | null): string {
  if (!state) return "Sin datos";
  return DEPLOY_STATE_LABEL[state] ?? state;
}
