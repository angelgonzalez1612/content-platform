# content-radar

Herramienta para saber qué publicar en contenido CDMX (noticias hiperlocales estilo `la-mira` + qué hacer en la ciudad estilo `Planazo`): junta varias fuentes, las categoriza y las muestra agrupadas en un visor web local o como Markdown.

## Sitio

Un solo `SiteConfig` en `src/sites.ts` (id `cdmx`) con ~20 categorías que combinan las de `la-mira` (Tráfico, Metro y Metrobús, Noticias Locales, Seguridad y Alertas, Clima, Economía, Deportes) y las de `Planazo` (Comer, Cafés, Bares, Cultura, Aire libre, Gaming, Viajes, Cine y TV, Geek, Mascotas, Música), más Eventos y Tecnología compartidas entre ambos.

Agregar un sitio nuevo = agregar otro `SiteConfig` en `SITES` (categorías + keywords + query de Google News + semilla de autocompletado por categoría). Todo lo demás (scoring, reporte, visor) ya es genérico y el switcher de sitio en la sidebar reaparece solo si hay más de uno.

## Diseño del visor

Paleta neutra cálida + Inter (UI) / JetBrains Mono (números y porcentajes), tomada de otro proyecto interno. Cada categoría se renderiza como una tarjeta (`src/server.ts`: `wrapSectionsInCards`); los chips de arriba son **filtros reales** (clic para mostrar solo esa categoría, multi-selección, "Todos" resetea) y saltan directo a la tarjeta — la barra de chips queda fija (`sticky`) al hacer scroll.

## Fuentes

Todas con manejo de fallas gracioso: si una fuente no está configurada o falla, esa sección simplemente no aparece — nunca truena el reporte completo.

1. **Trending Now (Google Trends)** — `trends.google.com/trending/rss?geo=<GEO>`. Temas más buscados a nivel país (mayormente nacional/internacional) con noticias ya asociadas. Sin API key. Cada tema se clasifica `MX`/`INTL` (`src/origin.ts`, heurística por dominio `.mx` de la fuente + palabras clave, no es dato oficial).
2. **Google News CDMX por categoría** — `news.google.com/rss/search?q=<query>`, una query fija por categoría. Trae contenido hiperlocal todos los días, a diferencia de Trending Now.
3. **RSS directo de medios** (`src/directNews.ts`) — feeds propios verificados en vivo (La Jornada por sección: capital/deportes/economía/cultura; El Financiero) para más control de calidad que vía Google News. Aparece como "De la fuente".
4. **Autocompletado de Google** (`src/suggest.ts`) — frases reales de búsqueda ("qué hacer en cdmx con niños"), globales del sitio y por categoría, con un peso relativo estimado por posición (no es volumen real).
5. **Clima en vivo** (`src/weather.ts`) — Open-Meteo, sin API key, coordenadas fijas de CDMX. Solo se inyecta en la categoría `clima`.
6. **YouTube** (`src/youtube.ts`) — búsqueda por categoría vía YouTube Data API v3. Requiere `YOUTUBE_API_KEY` en `.env` (ver `.env.example`); sin ella esta fuente no aparece. Tiene su propio presupuesto diario de unidades (`YOUTUBE_DAILY_UNIT_BUDGET`, default 8000 de las 10,000 gratis) que se corta **antes** de llegar al límite — el uso se trackea en `reports/.youtube-usage.json`.
7. **Bing (volumen real)** (`src/bingKeywords.ts`) — `GetKeywordStats` de Bing Webmaster API, volumen de búsqueda semanal REAL (no estimado). Requiere `BING_WEBMASTER_API_KEY` en `.env` y un dominio propio verificado en [bing.com/webmasters](https://www.bing.com/webmasters) (ya verificamos `lamira.mx` por DNS). Usa el endpoint JSON/HTTP (`.svc/json/...`), no el SOAP/POX que Microsoft retira el 31 de agosto de 2026 — verificado en vivo antes de conectarlo. Muchas frases de cola larga no tienen datos en Bing (mercado chico en México); en ese caso la categoría simplemente no muestra el dato.
8. **TMDB** (`src/tmdb.ts`) — trending semanal de películas y series vía `GET /trending/all/week`, con `TMDB_API_KEY` (v3 auth) de [themoviedb.org](https://www.themoviedb.org/settings/api). Autoservicio, gratis, sin aprobación manual. Solo se inyecta en la categoría "Cine y TV".

**Reddit se intentó y se descartó**: su API ahora requiere aprobación manual (no autoservicio), no vale la pena para un proyecto personal — ver historial de commits/conversación si se quiere reintentar.

**Spotify se intentó y se descartó**: en febrero de 2026 Spotify eliminó el endpoint de lanzamientos nuevos (`/v1/browse/new-releases`) sin reemplazo, le quitó el campo `popularity` a lo que quedó de `/search`, y ahora exige cuenta Premium para crear apps en Development Mode — ya no hay forma útil y gratuita de sacar tendencias musicales reales de México.

**Eventbrite quedó pendiente de investigar**: su API pública se restringió hace unos años (probablemente ya no deja buscar eventos de terceros, solo administrar los tuyos) — habría que probarla en vivo antes de prometer algo, igual que se hizo con Bing.

## Uso

```bash
npm install
npm run trends -- --geo=MX --site=cdmx
npm run web                                  # visor en http://localhost:4310
```

En el visor: historial de reportes, chips de categoría como filtros (clic para ver solo esa categoría, "Todos" resetea), y botón "Actualizar ahora" para correr una consulta nueva sin usar la terminal.

Opciones del CLI:

- `--site` id del sitio. Default y único por ahora: `cdmx`.
- `--geo` código de país para Trending Now (`MX`, `US`, etc). Default: `MX`. (El resto de las fuentes son CDMX fijo, no dependen de este flag.)

El reporte se guarda como Markdown en `reports/YYYY-MM-DD-<geo>-<site>.md` (esa carpeta está en `.gitignore`).

## Cómo se categoriza

Cada tema de Trending Now se compara (por palabra completa, no substring) contra las keywords de cada categoría — ver `src/relevance.ts`. Los temas de Google News/RSS directo/YouTube ya vienen pre-categorizados por la query que los trajo.

## Corrida diaria automática

Tarea en Windows Task Scheduler (`ContentRadar-Trends-MX`) que corre `scripts/run-daily.ps1` todos los días a las 7:00 AM.

```powershell
Get-ScheduledTask -TaskName "ContentRadar-Trends-MX"          # ver estado
Start-ScheduledTask -TaskName "ContentRadar-Trends-MX"        # forzar corrida ya
Unregister-ScheduledTask -TaskName "ContentRadar-Trends-MX"   # eliminarla
```

## Posibles siguientes pasos

- Pasar cada tema por un LLM para que sugiera un ángulo/título de nota en vez de solo listar datos crudos.
- Mandar el reporte diario por Slack/email/Telegram en vez de tener que abrir el visor.
- Sumar más feeds RSS directos si una categoría sale floja seguido.
