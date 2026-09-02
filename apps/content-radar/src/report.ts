import type { SiteConfig } from "./sites";
import type { ScoredTopic } from "./relevance";
import type { CategoryNews, NewsItem } from "./cdmxNews";
import type { CategoryPhrases, WeightedPhrase } from "./suggest";
import type { CategoryDirectNews, DirectNewsItem } from "./directNews";
import type { CategoryYoutubeVideos, YoutubeVideo } from "./youtube";
import type { BingKeywordStat, CategoryBingStat } from "./bingKeywords";
import type { WeatherNow } from "./weather";
import { weatherLabel } from "./weather";
import type { TmdbItem } from "./tmdb";
import { classifyOrigin } from "./origin";
import { classifyGeo, classifyGeoFromTitle } from "./geo";
import { todayLocal } from "./date";

// Span con HTML crudo (marked deja pasar HTML inline en markdown) para poder darle
// color propio — verde/neutro — en vez del gris genérico de los \`code\` badges.
function originBadge(topic: ScoredTopic): string {
  const origin = classifyOrigin(topic);
  return origin === "nacional"
    ? '<span class="origin-badge origin-mx">MX</span>'
    : '<span class="origin-badge origin-intl">INTL</span>';
}

// Solo tiene sentido mostrarlo para temas nacionales (INTL ya no se desglosa por
// estado). Heurística igual que el origin badge — no es geolocalización real.
function geoBadge(topic: ScoredTopic): string {
  if (classifyOrigin(topic) !== "nacional") return "";
  const { entidad, municipio } = classifyGeo(topic);
  if (!entidad) return "";
  const text = municipio ? `${entidad} · ${municipio}` : entidad;
  return ` <span class="geo-tag">${text}</span>`;
}

// Mismo badge que geoBadge, pero para una nota individual dentro de una
// categoría (Google News CDMX, "De la fuente", YouTube) — solo se tiene el
// título, no el contexto completo del tema, así que clasifica peor (más
// "sin ubicación") pero deja ver de un vistazo qué alcaldía/municipio toca
// cada nota, sin abrir el acordeón. Vacío si no detecta nada — no se rellena
// con "Sin ubicación" para no ensuciar cada fila.
function itemGeoBadge(title: string): string {
  const { entidad, municipio } = classifyGeoFromTitle(title);
  if (!entidad) return "";
  const text = municipio ? `${entidad} · ${municipio}` : entidad;
  return ` <span class="geo-tag">${text}</span>`;
}

function renderTrendTopic(topic: ScoredTopic, index: number): string[] {
  const lines: string[] = [];
  lines.push(`### ${index}. ${topic.title}`);
  lines.push(`- Volumen aproximado: \`${topic.traffic || "N/D"}\` ${originBadge(topic)}${geoBadge(topic)}`);
  if (topic.newsItems.length) {
    lines.push("- Noticias relacionadas:");
    topic.newsItems.forEach((n) => {
      lines.push(`  - [${n.title}](${n.url}) — ${n.source}`);
    });
  } else {
    lines.push("- _Sin noticias asociadas todavía._");
  }
  lines.push("");
  return lines;
}

export const HOTTEST_HEADING = "Lo más caliente";

// Puntaje simple: relevante al sitio pesa más que ser nacional, ambos pesan más que
// nada. No es volumen real combinado con nada raro, solo para ordenar qué mirar primero.
function hotnessScore(topic: ScoredTopic): number {
  let score = 0;
  if (topic.categories.length > 0) score += 2;
  if (classifyOrigin(topic) === "nacional") score += 1;
  return score;
}

function categoryTags(topic: ScoredTopic, site: SiteConfig): string {
  const labels = topic.categories
    .map((slug) => site.categories.find((c) => c.slug === slug)?.label)
    .filter((l): l is string => Boolean(l));
  return labels.map((l) => `<span class="tag">${l}</span>`).join(" ");
}

// Top de Trending Now combinando relevancia + origen + volumen, para no tener que
// revisar categoría por categoría buscando qué sí sirve. Siempre trae algo (top 8),
// aunque sea de menor puntaje, en vez de quedar vacío en días flojos.
function renderHottest(site: SiteConfig, topics: ScoredTopic[]): string[] {
  if (topics.length === 0) return [];
  const ranked = [...topics].sort((a, b) => {
    const diff = hotnessScore(b) - hotnessScore(a);
    return diff !== 0 ? diff : parseTraffic(b.traffic) - parseTraffic(a.traffic);
  });
  const top = ranked.slice(0, 8);

  const lines: string[] = [`## ${HOTTEST_HEADING} \`(${top.length})\``, ""];
  top.forEach((topic, i) => {
    const tags = categoryTags(topic, site);
    lines.push(`### ${i + 1}. ${topic.title}`);
    lines.push(
      `- Volumen aproximado: \`${topic.traffic || "N/D"}\` ${originBadge(topic)}${geoBadge(topic)}${tags ? " " + tags : ""}`
    );
    if (topic.newsItems.length) {
      const top1 = topic.newsItems[0];
      lines.push(`  - [${top1.title}](${top1.url}) — ${top1.source}`);
    }
    lines.push("");
  });
  return lines;
}

export const TOP_SEARCHES_HEADING = "Lo más buscado ahora";

function parseTraffic(traffic: string): number {
  const digits = traffic.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

// Lo más buscado primero, dentro de cada sección.
function byTrafficDesc(topics: ScoredTopic[]): ScoredTopic[] {
  return [...topics].sort((a, b) => parseTraffic(b.traffic) - parseTraffic(a.traffic));
}

// Ranking crudo de qué está buscando la gente ahora mismo (Trending Now MX), sin
// filtrar por categoría — es el mismo para cualquier sitio, ya que es una sola
// consulta nacional. Las secciones por categoría de abajo ya traen el detalle
// (noticias, etc.) para los temas que sí encajan con este sitio.
function renderTopSearches(topics: ScoredTopic[]): string[] {
  if (topics.length === 0) return [];
  const sorted = byTrafficDesc(topics);
  const lines: string[] = [`## ${TOP_SEARCHES_HEADING} \`(${sorted.length})\``, ""];
  sorted.forEach((t, i) => {
    lines.push(`${i + 1}. **${t.title}** — \`${t.traffic || "N/D"}\` ${originBadge(t)}${geoBadge(t)}`);
  });
  lines.push("");
  return lines;
}

export const SEARCH_PHRASES_HEADING = "Qué busca la gente (frases)";
export const OTHER_NATIONAL_HEADING = "Otros — Nacional";
export const OTHER_INTERNATIONAL_HEADING = "Otros — Internacional";

// Frases reales de búsqueda (autocompletado de Google) a partir de semillas de
// intención del sitio ("qué hacer en...") — a diferencia de Trending Now, esto no
// son temas/entidades sino la forma exacta en que la gente escribe la búsqueda.
function renderSearchPhrases(phrases: string[]): string[] {
  if (phrases.length === 0) return [];
  const lines: string[] = [`## ${SEARCH_PHRASES_HEADING} \`(${phrases.length})\``, ""];
  phrases.forEach((p) => lines.push(`- ${p}`));
  lines.push("");
  return lines;
}

function subLabel(text: string): string {
  return `<p class="sub-label">${text}</p>`;
}

function renderCdmxNews(items: NewsItem[]): string[] {
  if (items.length === 0) return [];
  // La línea en blanco después del <p> es obligatoria: sin ella, marked trata la
  // lista siguiente como texto plano dentro del bloque HTML en vez de parsearla.
  const lines: string[] = [subLabel("Google News CDMX"), ""];
  items.forEach((n) => lines.push(`- [${n.title}](${n.url}) — ${n.source}${itemGeoBadge(n.title)}`));
  lines.push("");
  return lines;
}

// Peso relativo por posición del autocompletado (no es volumen real, ver suggest.ts).
function renderCategoryPhrases(phrases: WeightedPhrase[]): string[] {
  if (phrases.length === 0) return [];
  const lines: string[] = [
    subLabel('Frases que la gente busca <span class="sub-label-hint">peso relativo, no volumen real</span>'),
    "",
  ];
  phrases.forEach((p) => lines.push(`- ${p.phrase} — \`~${p.weightPct}%\``));
  lines.push("");
  return lines;
}

// Clima real (Open-Meteo, sin API key) — dato en vivo en vez de esperar a que algún
// medio ya haya publicado la nota. Solo se inyecta en la categoría "clima" del sitio
// que la tenga.
function renderWeather(weather: WeatherNow | null): string[] {
  if (!weather) return [];
  const lines: string[] = [subLabel("Clima ahora mismo (Open-Meteo, en vivo)"), ""];
  lines.push(
    `- Ahorita: \`${Math.round(weather.tempC)}°C\`, ${weatherLabel(weather.weatherCode)}, ` +
      `viento \`${Math.round(weather.windKmh)} km/h\`, humedad \`${weather.humidityPct}%\``
  );
  weather.forecast.forEach((day, i) => {
    const label = i === 0 ? "Hoy" : i === 1 ? "Mañana" : day.date;
    lines.push(
      `- ${label}: \`${Math.round(day.maxC)}° / ${Math.round(day.minC)}°C\`, ` +
        `${weatherLabel(day.weatherCode)}, \`${day.rainProbPct}%\` prob. de lluvia`
    );
  });
  lines.push("");
  return lines;
}

// RSS directo de medios (La Jornada por sección, El Financiero) — no vía Google News,
// más control de calidad. Solo aparece en categorías donde ya verificamos el feed.
function renderDirectNews(items: DirectNewsItem[]): string[] {
  if (items.length === 0) return [];
  const lines: string[] = [subLabel("De la fuente"), ""];
  items.forEach((n) => lines.push(`- [${n.title}](${n.url}) — ${n.source}${itemGeoBadge(n.title)}`));
  lines.push("");
  return lines;
}

// Videos reales de YouTube (búsqueda por región MX) — formato distinto a texto/nota,
// útil sobre todo para categorías tipo "qué hacer"/reseñas. Sin YOUTUBE_API_KEY llega [].
function renderYoutubeVideos(videos: YoutubeVideo[]): string[] {
  if (videos.length === 0) return [];
  const lines: string[] = [subLabel("Videos en YouTube"), ""];
  videos.forEach((v) => lines.push(`- [${v.title}](${v.url}) — ${v.channel}${itemGeoBadge(v.title)}`));
  lines.push("");
  return lines;
}

// Volumen real semanal de Bing (no estimado, no inventado por posición) para la
// semilla de esta categoría. Muchas frases de cola larga no tienen datos en Bing
// (mercado chico en México) — en ese caso simplemente no se muestra el dato.
function renderBingStat(stat: BingKeywordStat | null): string[] {
  if (!stat) return [];
  return [
    `**Volumen real en Bing (promedio semanal):** \`${stat.avgWeeklyImpressions}\` búsquedas exactas · \`${stat.avgWeeklyBroadImpressions}\` amplias`,
    "",
  ];
}

// Trending semanal de TMDB (películas + series) — solo se inyecta en "cine-tv".
function renderTmdbTrending(items: TmdbItem[]): string[] {
  if (items.length === 0) return [];
  const lines: string[] = [subLabel("Tendencia en TMDB (películas y series)"), ""];
  items.forEach((t) => {
    const kind = t.mediaType === "tv" ? "Serie" : "Película";
    lines.push(`- [${t.title}](${t.url}) — ${kind} · \`${t.releaseDate || "N/D"}\``);
  });
  lines.push("");
  return lines;
}

function renderSection(
  title: string,
  trendTopics: ScoredTopic[],
  cdmxItems: NewsItem[],
  phrases: WeightedPhrase[] = [],
  weather: WeatherNow | null = null,
  directItems: DirectNewsItem[] = [],
  youtubeVideos: YoutubeVideo[] = [],
  bingStat: BingKeywordStat | null = null,
  tmdbItems: TmdbItem[] = []
): string[] {
  if (
    trendTopics.length === 0 &&
    cdmxItems.length === 0 &&
    phrases.length === 0 &&
    directItems.length === 0 &&
    youtubeVideos.length === 0 &&
    !weather &&
    !bingStat &&
    tmdbItems.length === 0
  ) {
    return [];
  }
  const count =
    trendTopics.length +
    cdmxItems.length +
    phrases.length +
    directItems.length +
    youtubeVideos.length +
    (weather ? 1 : 0) +
    (bingStat ? 1 : 0) +
    tmdbItems.length;
  const lines: string[] = [`## ${title} \`(${count})\``, ""];
  lines.push(...renderWeather(weather));
  lines.push(...renderTmdbTrending(tmdbItems));
  lines.push(...renderDirectNews(directItems));
  trendTopics.forEach((topic, i) => lines.push(...renderTrendTopic(topic, i + 1)));
  lines.push(...renderCdmxNews(cdmxItems));
  lines.push(...renderYoutubeVideos(youtubeVideos));
  lines.push(...renderBingStat(bingStat));
  lines.push(...renderCategoryPhrases(phrases));
  return lines;
}

export function buildMarkdownReport(
  site: SiteConfig,
  geo: string,
  topics: ScoredTopic[],
  cdmxNews: CategoryNews[] = [],
  searchPhrases: string[] = [],
  categoryPhrases: CategoryPhrases[] = [],
  weather: WeatherNow | null = null,
  directNews: CategoryDirectNews[] = [],
  youtubeByCategory: CategoryYoutubeVideos[] = [],
  bingStatsByCategory: CategoryBingStat[] = [],
  tmdbTrending: TmdbItem[] = []
): string {
  const today = todayLocal();
  const lines: string[] = [];
  const newsByCategory = new Map(cdmxNews.map((c) => [c.category, c.items]));
  const phrasesByCategory = new Map(categoryPhrases.map((c) => [c.category, c.phrases]));
  const directNewsByCategory = new Map(directNews.map((c) => [c.category, c.items]));
  const youtubeByCategoryMap = new Map(youtubeByCategory.map((c) => [c.category, c.videos]));
  const bingStatsByCategoryMap = new Map(bingStatsByCategory.map((c) => [c.category, c.stat]));
  const totalCdmxNews = cdmxNews.reduce((sum, c) => sum + c.items.length, 0);

  lines.push(`# ${site.name} — Tendencias ${geo} - ${today}`, "");

  if (topics.length === 0 && totalCdmxNews === 0 && searchPhrases.length === 0) {
    lines.push("_Sin datos de tendencias para esta región._", "");
    return lines.join("\n");
  }

  const relevantTrending = topics.filter((t) => t.categories.length > 0).length;
  lines.push(
    `${relevantTrending} de ${topics.length} temas de Trending Now encajan con categorías de ${site.name}. ` +
      `+${totalCdmxNews} notas de Google News CDMX por categoría.`,
    ""
  );

  lines.push(...renderHottest(site, topics));
  lines.push(...renderSearchPhrases(searchPhrases));
  lines.push(...renderTopSearches(topics));

  for (const cat of site.categories) {
    const inCategory = byTrafficDesc(topics.filter((t) => t.categories.includes(cat.slug)));
    const news = newsByCategory.get(cat.slug) ?? [];
    const phrases = phrasesByCategory.get(cat.slug) ?? [];
    const catWeather = cat.slug === "clima" ? weather : null;
    const directItems = directNewsByCategory.get(cat.slug) ?? [];
    const youtubeVideos = youtubeByCategoryMap.get(cat.slug) ?? [];
    const bingStat = bingStatsByCategoryMap.get(cat.slug) ?? null;
    const catTmdb = cat.slug === "cine-tv" ? tmdbTrending : [];
    lines.push(
      ...renderSection(
        cat.label,
        inCategory,
        news,
        phrases,
        catWeather,
        directItems,
        youtubeVideos,
        bingStat,
        catTmdb
      )
    );
  }

  // El resto casi siempre es ruido internacional (deportes/celebridades extranjeras);
  // separarlo de lo nacional evita que ahogue lo poco relevante que sí trae. Lo
  // nacional además se separa por entidad (heurística, ver geo.ts) — así no hay que
  // leer una nota de Chiapas para encontrar la que sí es de CDMX/Edomex.
  const uncategorized = byTrafficDesc(topics.filter((t) => t.categories.length === 0));
  const uncategorizedNational = uncategorized.filter((t) => classifyOrigin(t) === "nacional");
  const uncategorizedIntl = uncategorized.filter((t) => classifyOrigin(t) === "internacional");

  const byEntidad = new Map<string, ScoredTopic[]>();
  for (const t of uncategorizedNational) {
    const key = classifyGeo(t).entidad ?? "Sin ubicación";
    (byEntidad.get(key) ?? byEntidad.set(key, []).get(key)!).push(t);
  }
  const entidadGroups = [...byEntidad.entries()].sort((a, b) => {
    if (a[0] === "Sin ubicación") return 1;
    if (b[0] === "Sin ubicación") return -1;
    return b[1].length - a[1].length;
  });
  for (const [entidad, entidadTopics] of entidadGroups) {
    lines.push(...renderSection(`${OTHER_NATIONAL_HEADING} — ${entidad}`, entidadTopics, []));
  }
  lines.push(...renderSection(OTHER_INTERNATIONAL_HEADING, uncategorizedIntl, []));

  return lines.join("\n");
}
