// Datos de operación (KPIs, rendimiento, alertas, actividad) — mock por ahora.
// Cuando existan los endpoints reales en planazo_backend, estas funciones son
// el único lugar a cambiar; los componentes no deberían tocarse.

export interface NavItem {
  id: string;
  name: string;
  icon: string;
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { id: "dashboard", name: "Dashboard", icon: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" },
      { id: "ia", name: "Centro IA", icon: "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z", badge: "IA" },
      { id: "contenido", name: "Contenido", icon: "M5 4h9l5 5v11H5zM14 4v5h5M8 13h8M8 16.5h5", badge: "24" },
      { id: "calendario", name: "Calendario Editorial", icon: "M5 6h14v14H5zM5 10h14M9 4v4M15 4v4" },
      { id: "automatizaciones", name: "Automatizaciones", icon: "M6 5h5v5H6zM13 14h5v5h-5zM8.5 10v6.5H13" },
    ],
  },
  {
    label: "Conocimiento",
    items: [
      { id: "entidades", name: "Entidades", icon: "M12 3l7 4v10l-7 4-7-4V7zM12 3v18M5 7l7 4 7-4" },
      { id: "keywords", name: "Keywords", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5L21 21", badge: "14" },
      { id: "seo", name: "SEO", icon: "M4 17a8 8 0 1 1 16 0M12 13l4-3" },
      { id: "multimedia", name: "Biblioteca Multimedia", icon: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5" },
    ],
  },
  {
    label: "Negocio",
    items: [
      { id: "analytics", name: "Analytics", icon: "M5 19V9M10 19V5M15 19v-6M20 19v-9" },
      { id: "publicidad", name: "Publicidad", icon: "M4 9h4l7-4v14l-7-4H4zM19 9v6" },
      { id: "negocios", name: "Negocios", icon: "M4 9h16v11H4zM4 9l2-5h12l2 5M10 20v-6h4v6" },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        id: "usuarios",
        name: "Usuarios",
        icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M17 20h4a5.5 5.5 0 0 0-3-4.9",
      },
      {
        id: "config",
        name: "Configuración",
        icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3.5v2M12 18.5v2M5.5 5.5L7 7M17 17l1.5 1.5M3.5 12h2M18.5 12h2M5.5 18.5L7 17M17 7l1.5-1.5",
      },
    ],
  },
];

export interface Kpi {
  label: string;
  value: string;
  delta: string;
  deltaColor: string;
  barColor: string;
  spark: number[];
}

export function getKpis(): Kpi[] {
  return [
    { label: "Artículos publicados", value: "1,284", delta: "+42", deltaColor: "#2E9E5B", barColor: "#EDEAE6", spark: [30, 45, 38, 60, 52, 70, 58, 75, 68, 82, 74, 90] },
    { label: "Borradores", value: "37", delta: "+9", deltaColor: "#8A837B", barColor: "#EDEAE6", spark: [50, 42, 55, 48, 60, 52, 66, 58, 70, 62, 74, 68] },
    { label: "Programados", value: "18", delta: "esta semana", deltaColor: "#8A837B", barColor: "#EDEAE6", spark: [20, 35, 28, 45, 40, 55, 48, 60, 55, 70, 62, 78] },
    { label: "Generados por IA", value: "612", delta: "48% del total", deltaColor: "#C0561A", barColor: "#FFD9BB", spark: [15, 25, 32, 40, 48, 55, 60, 68, 72, 80, 86, 94] },
    { label: "Keywords pendientes", value: "142", delta: "14 nuevas", deltaColor: "#C0561A", barColor: "#EDEAE6", spark: [60, 55, 62, 58, 66, 60, 70, 64, 72, 68, 76, 72] },
    { label: "Tráfico estimado / mes", value: "412K", delta: "+18.4%", deltaColor: "#2E9E5B", barColor: "#EDEAE6", spark: [40, 44, 48, 52, 50, 58, 62, 66, 64, 72, 80, 88] },
    { label: "Visitas de hoy", value: "14,902", delta: "+6.1%", deltaColor: "#2E9E5B", barColor: "#EDEAE6", spark: [22, 38, 55, 62, 70, 78, 84, 80, 72, 60, 44, 30] },
    { label: "CTR promedio", value: "4.8%", delta: "+0.4 pts", deltaColor: "#2E9E5B", barColor: "#EDEAE6", spark: [40, 42, 46, 44, 50, 48, 54, 52, 58, 56, 62, 64] },
    { label: "Ingresos estimados", value: "$182K", delta: "+22.7%", deltaColor: "#2E9E5B", barColor: "#FFD9BB", spark: [30, 36, 42, 40, 50, 56, 52, 64, 70, 76, 84, 92] },
    { label: "RPM", value: "$4.42", delta: "-0.11", deltaColor: "#C4453A", barColor: "#EDEAE6", spark: [70, 68, 72, 66, 70, 64, 68, 62, 66, 60, 58, 56] },
  ];
}

export interface TopArticle {
  title: string;
  category: string;
  ai: boolean;
  visits: string;
  ctr: string;
  rpm: string;
  revenue: string;
}

export function getTopArticles(): TopArticle[] {
  return [
    { title: "20 terrazas en la Condesa para ver el atardecer", category: "Lugares", ai: true, visits: "48,210", ctr: "6.2%", rpm: "$5.80", revenue: "$279" },
    { title: "Guía completa del Corredor Cultural Roma-Condesa", category: "Guías", ai: false, visits: "31,455", ctr: "5.1%", rpm: "$4.90", revenue: "$154" },
    { title: "Qué hacer este fin de semana en CDMX · 25-27 jul", category: "Eventos", ai: true, visits: "27,880", ctr: "7.4%", rpm: "$4.10", revenue: "$114" },
    { title: "Mercados de comida en Coyoacán que valen la fila", category: "Comida", ai: true, visits: "22,640", ctr: "4.8%", rpm: "$5.20", revenue: "$118" },
    { title: "Brunch en Polanco: 14 lugares probados", category: "Comida", ai: false, visits: "19,102", ctr: "4.4%", rpm: "$6.10", revenue: "$117" },
  ];
}

export interface NeedsUpdateItem {
  title: string;
  why: string;
  color: string;
}

export function getNeedsUpdate(): NeedsUpdateItem[] {
  return [
    { title: "Bares de mezcal en Roma Sur", why: "3 negocios cerraron · -32% tráfico", color: "#C4453A" },
    { title: "Museos gratis en CDMX", why: "Precios de 2024 · posición 4→9", color: "#E0A020" },
    { title: "Rooftops con alberca", why: "Sin schema · CTR bajo", color: "#E0A020" },
    { title: "Cafeterías para trabajar", why: "Competencia publicó guía nueva", color: "#E0A020" },
  ];
}

export interface SeoOpportunity {
  keyword: string;
  volume: string;
  kd: string;
  gap: string;
  score: string;
}

export function getSeoOpportunities(): SeoOpportunity[] {
  return [
    { keyword: "brunch condesa domingo", volume: "8.1K", kd: "19", gap: "no tienes contenido", score: "94" },
    { keyword: "cafeterías roma norte", volume: "12.4K", kd: "24", gap: "posición 8", score: "91" },
    { keyword: "qué hacer en xochimilco", volume: "22K", kd: "31", gap: "artículo de 2023", score: "84" },
    { keyword: "tacos al pastor cdmx", volume: "40K", kd: "44", gap: "cluster incompleto", score: "78" },
  ];
}

export interface Alert {
  icon: string;
  bg: string;
  fg: string;
  title: string;
  meta: string;
}

export function getAlerts(): Alert[] {
  return [
    { icon: "!", bg: "#FDECEA", fg: "#C4453A", title: "3 páginas con error de indexación en Search Console", meta: "Detectado hace 2 h · requiere acción" },
    { icon: "↓", bg: "#FEF6E7", fg: "#9A6B12", title: "RPM cayó 4% en la categoría Eventos", meta: "Tendencia de 5 días" },
    { icon: "★", bg: "#FFF2E8", fg: "#C0561A", title: "Café Nin solicitó plan Premium", meta: "Negocios · pendiente de revisión" },
  ];
}

export interface ActivityItem {
  text: string;
  who: string;
  when: string;
  dot: string;
}

export function getActivity(): ActivityItem[] {
  return [
    { text: "IA generó “Las 12 mejores cafeterías de Roma Norte”", who: "Copiloto", when: "hace 8 min", dot: "#FD690D" },
    { text: "Diego aprobó y programó 4 artículos para agosto", who: "Diego M.", when: "hace 41 min", dot: "#2E9E5B" },
    { text: "Automatización “Cluster semanal” creó 6 borradores", who: "Sistema", when: "hace 2 h", dot: "#FD690D" },
    { text: "Sofía actualizó la ficha de Panadería Rosetta", who: "Sofía L.", when: "hace 3 h", dot: "#8A837B" },
    { text: "Se publicó “Qué hacer este fin de semana”", who: "Mariana R.", when: "hace 5 h", dot: "#2E9E5B" },
    { text: "GSC sincronizó 28 días de datos", who: "Integración", when: "hace 6 h", dot: "#8A837B" },
  ];
}

export function getCopilotContext(): string {
  return "Vista general de la operación. Hoy hay 3 publicaciones y 2 revisiones pendientes.";
}

export function getCopilotActions(): string[] {
  return [
    "Resumir el rendimiento de la semana",
    "Detectar contenido que perdió tráfico",
    "Proponer 5 keywords nuevas",
    "Auditar los artículos de Eventos",
  ];
}

export interface CopilotLogEntry {
  text: string;
  when: string;
  cost: string;
}

export function getCopilotLog(): CopilotLogEntry[] {
  return [
    { text: "Generó 6 borradores desde “Cluster semanal”", when: "hace 2 h", cost: "4,200 tokens" },
    { text: "Optimizó 14 meta descriptions", when: "hace 5 h", cost: "1,100 tokens" },
    { text: "Detectó 3 negocios cerrados en Roma Sur", when: "ayer", cost: "890 tokens" },
    { text: "Tradujo 4 artículos a inglés", when: "ayer", cost: "6,400 tokens" },
  ];
}
