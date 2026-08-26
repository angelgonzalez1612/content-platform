export interface SiteCategory {
  slug: string;
  label: string;
  // Para matchear temas de Trending Now (Google Trends) por palabra completa.
  keywords: string[];
  // Query de Google News para traer contenido CDMX directo de esta categoría.
  cdmxQuery: string;
  // Semilla de autocompletado de Google específica de esta categoría
  // (ej. "mejores bares en cdmx " para la categoría Bares). Opcional.
  searchSeed?: string;
  // Feeds RSS directos de medios (no vía Google News) para esta categoría. Opcional:
  // solo se agrega donde ya verificamos en vivo que el feed existe y trae lo esperado.
  directRss?: { url: string; source: string }[];
}

export interface SiteConfig {
  id: string;
  name: string;
  description: string;
  categories: SiteCategory[];
  // Semillas de autocompletado de Google ("qué hacer en ", "mejores planes en cdmx ")
  // para capturar frases de búsqueda reales, no solo temas/titulares.
  searchSeeds?: string[];
}

// Un solo sitio que junta las categorías de la-mira (periódico hiperlocal: tráfico,
// metro, seguridad, clima, gobierno) y Planazo (qué hacer en CDMX: comer, bares,
// cultura...). "eventos" y "tecnologia" existían en ambos — se combinaron en una sola
// entrada cada una en vez de duplicarlas.
const CDMX: SiteConfig = {
  id: "cdmx",
  name: "La Mira + Planazo",
  description: "Contenido CDMX: noticias hiperlocales (la-mira) + qué hacer en la ciudad (Planazo), en un solo lugar.",
  categories: [
    {
      slug: "trafico",
      label: "Tráfico",
      keywords: [
        "trafico",
        "tráfico",
        "vialidad",
        "circulacion",
        "circulación",
        "carril",
        "periferico",
        "periférico",
        "viaducto",
        "embotellamiento",
        "avenida",
      ],
      cdmxQuery: "tráfico CDMX OR vialidad CDMX",
      searchSeed: "cómo está el tráfico en cdmx ",
    },
    {
      slug: "metro-metrobus",
      label: "Metro y Metrobús",
      keywords: ["metro", "metrobus", "metrobús", "cablebus", "cablebús", "stc", "tren ligero", "rtp"],
      cdmxQuery: "Metro CDMX OR Metrobús CDMX",
      searchSeed: "cierre de metro cdmx ",
    },
    {
      slug: "noticias-locales",
      label: "Noticias Locales",
      keywords: [
        "cdmx",
        "jefa de gobierno",
        "clara brugada",
        "gobierno capitalino",
        "alcaldia",
        "alcaldía",
        "alvaro obregon",
        "azcapotzalco",
        "benito juarez",
        "coyoacan",
        "cuajimalpa",
        "cuauhtemoc",
        "gustavo a. madero",
        "iztacalco",
        "iztapalapa",
        "magdalena contreras",
        "miguel hidalgo",
        "milpa alta",
        "tlahuac",
        "tlalpan",
        "venustiano carranza",
        "xochimilco",
      ],
      cdmxQuery: "CDMX gobierno OR alcaldía CDMX",
      searchSeed: "noticias de cdmx ",
      directRss: [{ url: "https://www.jornada.com.mx/rss/capital.xml", source: "La Jornada (Capital)" }],
    },
    {
      slug: "eventos",
      label: "Eventos",
      keywords: [
        "concierto",
        "festival",
        "feria",
        "exposicion",
        "exposición",
        "maraton",
        "maratón",
        "evento",
        "eventos",
        "pop-up",
        "popup",
      ],
      cdmxQuery: "eventos CDMX este fin de semana OR qué hacer en CDMX",
      searchSeed: "eventos en cdmx ",
    },
    {
      slug: "seguridad",
      label: "Seguridad y Alertas",
      keywords: ["seguridad", "robo", "asalto", "balacera", "operativo", "secuestro", "homicidio", "ssc", "fiscalia", "fiscalía"],
      cdmxQuery: "seguridad CDMX OR C5 CDMX",
      searchSeed: "seguridad en cdmx ",
    },
    {
      slug: "clima",
      label: "Clima",
      keywords: ["clima", "lluvia", "lluvias", "granizo", "tormenta", "calor", "frio", "frío", "alerta atmosferica", "alerta atmosférica"],
      cdmxQuery: "clima CDMX OR lluvias CDMX",
      searchSeed: "clima cdmx ",
    },
    {
      slug: "economia",
      label: "Economía",
      keywords: ["economia", "economía", "precios", "inflacion", "inflación", "empleo", "negocio", "comercio", "pemex"],
      cdmxQuery: "economía CDMX",
      searchSeed: "economía cdmx ",
      directRss: [
        { url: "https://www.jornada.com.mx/rss/economia.xml", source: "La Jornada (Economía)" },
        { url: "https://www.elfinanciero.com.mx/rss", source: "El Financiero" },
      ],
    },
    {
      slug: "tecnologia",
      label: "Tecnología",
      keywords: ["tecnologia", "tecnología", "inteligencia artificial", "ia", "app", "startup", "gadget"],
      cdmxQuery: "tecnología CDMX startups",
      searchSeed: "tecnología cdmx ",
    },
    {
      slug: "deportes",
      label: "Deportes",
      keywords: [
        "futbol",
        "fútbol",
        "liga mx",
        "gol",
        "goles",
        "partido",
        "seleccion mexicana",
        "selección mexicana",
        "mundial",
        "nba",
        "nfl",
        "mlb",
        "beisbol",
        "béisbol",
        "box",
        "boxeo",
        "ufc",
        "tenis",
        "wnba",
        "champions league",
        "uefa",
        "maraton",
        "maratón",
      ],
      // Equipos con sede en CDMX (Cruz Azul, América, Pumas) para no llenar la sección
      // de ligas extranjeras que ya cubre "Lo más buscado ahora" a nivel nacional.
      cdmxQuery: "Cruz Azul OR Club América OR Pumas UNAM CDMX",
      searchSeed: "resultados liga mx ",
      directRss: [{ url: "https://www.jornada.com.mx/rss/deportes.xml", source: "La Jornada (Deportes)" }],
    },
    {
      slug: "comer",
      label: "Comer",
      keywords: ["restaurante", "restaurantes", "comida", "gastronomia", "gastronomía", "chef", "brunch", "taqueria", "taquería"],
      cdmxQuery: "restaurantes nuevos CDMX OR aperturas CDMX comida",
      searchSeed: "dónde comer en cdmx ",
    },
    {
      slug: "cafes",
      label: "Cafés",
      keywords: ["cafe", "café", "cafeteria", "cafetería", "coffee"],
      cdmxQuery: "cafés nuevos CDMX",
      searchSeed: "mejores cafés en cdmx ",
    },
    {
      slug: "bares",
      label: "Bares",
      keywords: ["bar", "bares", "cantina", "coctel", "cóctel", "cerveceria", "cervecería", "mezcal", "antro"],
      cdmxQuery: "bares nuevos CDMX OR vida nocturna CDMX",
      searchSeed: "mejores bares en cdmx ",
    },
    {
      slug: "cultura",
      label: "Cultura",
      keywords: ["museo", "teatro", "arte", "galeria", "galería", "danza", "exposicion", "exposición"],
      cdmxQuery: "museos CDMX OR exposiciones CDMX OR teatro CDMX",
      searchSeed: "qué museos visitar en cdmx ",
      directRss: [{ url: "https://www.jornada.com.mx/rss/cultura.xml", source: "La Jornada (Cultura)" }],
    },
    {
      slug: "aire-libre",
      label: "Aire libre",
      keywords: ["parque", "ciclismo", "senderismo", "picnic", "alberca", "camping", "excursion", "excursión"],
      cdmxQuery: "parques CDMX OR actividades aire libre CDMX",
      searchSeed: "parques para visitar en cdmx ",
    },
    {
      slug: "gaming",
      label: "Gaming",
      keywords: ["videojuego", "videojuegos", "gamer", "esports", "playstation", "xbox", "nintendo"],
      cdmxQuery: "videojuegos México OR esports México",
      searchSeed: "torneos de videojuegos en méxico ",
    },
    {
      slug: "viajes",
      label: "Viajes",
      keywords: ["viaje", "viajes", "turismo", "vuelo", "aeropuerto", "destino"],
      cdmxQuery: "viajes desde CDMX OR turismo México",
      searchSeed: "viajes desde cdmx ",
    },
    {
      slug: "cine-tv",
      label: "Cine y TV",
      keywords: ["cine", "pelicula", "película", "serie", "streaming", "netflix", "estreno"],
      cdmxQuery: "estrenos cine México OR series streaming México",
      searchSeed: "estrenos de cine en méxico ",
    },
    {
      slug: "geek",
      label: "Geek",
      keywords: ["comic", "cómic", "anime", "manga", "cosplay", "marvel"],
      cdmxQuery: "cultura geek México OR anime México",
      searchSeed: "convenciones geek en méxico ",
    },
    {
      slug: "mascotas",
      label: "Mascotas",
      keywords: ["mascota", "mascotas", "perro", "perros", "gato", "gatos", "veterinaria", "adopcion", "adopción"],
      cdmxQuery: "mascotas CDMX",
      searchSeed: "lugares pet friendly en cdmx ",
    },
    {
      slug: "musica",
      label: "Música",
      keywords: ["concierto", "musica", "música", "banda", "album", "álbum"],
      cdmxQuery: "conciertos CDMX",
      searchSeed: "conciertos en cdmx ",
    },
  ],
  searchSeeds: [
    "qué pasa en cdmx ",
    "noticias cdmx ",
    "cómo está el tráfico en cdmx ",
    "clima cdmx ",
    "qué hacer en ",
    "qué hacer en cdmx ",
    "qué hacer este fin de semana en ",
    "planes para hoy en ",
    "mejores planes en cdmx ",
    "dónde ir en cdmx ",
  ],
};

export const SITES: Record<string, SiteConfig> = {
  [CDMX.id]: CDMX,
};

export const DEFAULT_SITE_ID = CDMX.id;

export function getSite(id: string): SiteConfig {
  const site = SITES[id];
  if (!site) {
    throw new Error(`Sitio desconocido: "${id}". Sitios válidos: ${Object.keys(SITES).join(", ")}`);
  }
  return site;
}
