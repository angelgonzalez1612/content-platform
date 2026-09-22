// Estructura de navegación + contexto del panel Copiloto. Los KPIs/alertas
// reales del dashboard viven en @/lib/dashboard-api (datos reales de
// DashboardService en la API) — getCopilotBrief/getCopilotLog siguen siendo
// contenido de ejemplo para el panel de Copiloto, que es una feature aparte.

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
      {
        // Primero en la lista a propósito: es el paso 0 del flujo editorial —
        // de aquí sale el tema/contexto que luego alimenta Crear/Centro IA.
        id: "content-radar",
        name: "Content Radar",
        icon: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 12l5-3M12 3v4M12 17v4M3 12h4M17 12h4",
      },
      { id: "crear", name: "Crear", icon: "M12 5v14M5 12h14" },
      {
        // Referencia de qué pide cada tipo de contenido antes de generar — no
        // es un paso del flujo en sí, por eso va después de Crear/Centro IA.
        id: "plantillas",
        name: "Plantillas",
        icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
      },
      {
        // El badge de este ítem no sale de acá — Sidebar lo pisa en runtime
        // con counts.inReview real (ver sidebar.tsx). Se deja sin badge fijo
        // para no mostrar un número mentiroso antes de que cargue el real.
        id: "contenido",
        name: "Contenido",
        icon: "M5 4h9l5 5v11H5zM14 4v5h5M8 13h8M8 16.5h5",
      },
      { id: "calendario", name: "Calendario Editorial", icon: "M5 6h14v14H5zM5 10h14M9 4v4M15 4v4" },
      { id: "automatizaciones", name: "Reglas de automatización", icon: "M6 5h5v5H6zM13 14h5v5h-5zM8.5 10v6.5H13" },
      { id: "automatizaciones-frases", name: "Frases de búsqueda", icon: "M4 5h16v11H8l-4 4z" },
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

export interface CopilotBrief {
  context: string;
  actions: string[];
}

/** Copiloto context varies by screen — keyed by pathname, not just the page title. */
export function getCopilotBrief(pathname: string, screenTitle: string): CopilotBrief {
  if (pathname === "/") {
    return {
      context: "Vista general de la operación. Hoy hay 3 publicaciones y 2 revisiones pendientes.",
      actions: [
        "Resumir el rendimiento de la semana",
        "Detectar contenido que perdió tráfico",
        "Proponer 5 keywords nuevas",
        "Auditar los artículos de Eventos",
      ],
    };
  }

  if (pathname === "/crear") {
    return {
      context: "Elige cómo crear un lugar nuevo: con IA a partir del nombre, o llenando la ficha a mano.",
      actions: ["Sugerir 5 lugares populares que faltan", "Explicar qué campos completa la IA vs. tú"],
    };
  }

  if (pathname === "/crear/manual") {
    return {
      context: "Llenando la ficha de un lugar nuevo a mano. Se crea como borrador hasta que lo publiques.",
      actions: ["Sugerir una descripción a partir del nombre", "Recomendar categoría y etiquetas"],
    };
  }

  if (pathname === "/centro-ia") {
    return {
      context: "Generando un borrador con IA. Completa dirección, teléfono y precio después de crearlo.",
      actions: ["Sugerir lugares de la zona sin cubrir", "Explicar de dónde saca los datos la IA"],
    };
  }

  if (pathname === "/contenido") {
    return {
      context: "Listado de lugares. Filtra por estado para ver qué falta revisar o publicar.",
      actions: ["Mostrar los borradores más antiguos", "Detectar lugares sin categoría"],
    };
  }

  if (pathname.startsWith("/contenido/")) {
    return {
      context: `Editando "${screenTitle}". Los cambios se guardan al presionar Guardar cambios.`,
      actions: [`Revisar "${screenTitle}" en busca de datos faltantes`, "Sugerir una mejor descripción"],
    };
  }

  return {
    context: `Estás en ${screenTitle}. Todavía no hay contexto específico para esta pantalla.`,
    actions: ["Resumir el rendimiento de la semana", "Proponer 5 keywords nuevas"],
  };
}

export interface BreadcrumbItem {
  label: string;
  /** Omitted for the current (last) crumb. */
  href?: string;
}

/** Full breadcrumb trail for the topbar — keyed by pathname, not just the page title. */
export function getBreadcrumb(pathname: string, screenTitle: string): BreadcrumbItem[] {
  const home: BreadcrumbItem = { label: "Content CMS", href: "/" };

  if (pathname === "/") return [{ label: "Content CMS" }];
  if (pathname === "/crear") return [home, { label: "Crear" }];
  if (pathname === "/crear/manual") return [home, { label: "Crear", href: "/crear" }, { label: "Manual" }];
  if (pathname === "/centro-ia") return [home, { label: "Centro IA" }];
  if (pathname === "/plantillas") return [home, { label: "Plantillas" }];
  if (pathname === "/contenido") return [home, { label: "Contenido" }];
  if (pathname.startsWith("/contenido/")) return [home, { label: "Contenido", href: "/contenido" }, { label: screenTitle }];
  if (pathname === "/perfil") return [home, { label: "Perfil" }];
  if (pathname === "/usuarios") return [home, { label: "Usuarios" }];

  return [home, { label: screenTitle }];
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
