# AGENTS.md — Guía para agentes (Claude Code / Codex)

Guía operativa para que un agente de IA entienda, corra y **gestione** este
proyecto. Complementa (no reemplaza) `README.md` (qué es y estructura) y
`apps/cms/PRODUCT.md` (usuarios, propósito, principios de diseño del CMS).

> Documento vivo. Empezado el 2026-09-24; extiéndelo cuando toques un área
> nueva. Si algo aquí ya no cuadra con el código, el código manda — corrige
> este archivo en el mismo cambio.

---

## 1. Qué es (resumen de 30s)

Monorepo (pnpm + turbo) que da **un CMS unificado + una API** a **dos sitios
editoriales** que comparten infraestructura pero tienen voz propia:
- **La Mira** — periódico hiperlocal CDMX (noticias, alertas, guías, eventos,
  lugares, reportajes). Repo aparte: `la-mira`.
- **Planazo** — directorio de planes (lugares y eventos recomendados, guías).
  Repo aparte: `planazo_fronted`.

La meta del producto: que un equipo chico produzca contenido **con ayuda de
IA** (generación, clasificación de sitio/tipo/categoría) **sin perder control
editorial** — la IA nunca inventa datos verificables; un humano revisa antes de
publicar.

```
apps/
  api/           NestJS 11 + Drizzle ORM (SQLite/Turso vía libsql). Puerto 4001.
  cms/           Next.js 16 (App Router, Turbopack). Puerto 3002.
  content-radar/ Genera el reporte diario de tendencias (ESM puro; se invoca por subproceso).
packages/
  types/  config/  shared/  tsconfig/   (workspaces reales, no se copian a mano)
```
> El README dice "Postgres"; el estado real es **SQLite/Turso (libsql)** — ver
> `apps/api/.env` (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`) y `apps/api/src/db`.

---

## 2. Cómo correrlo en local

**Comando normal:** desde la raíz, `pnpm dev` levanta API (4001) + CMS (3002) +
content-radar con turbo.

**Gotchas de esta máquina (importantes):**
1. **Claude Code no bindea puertos bajo su sandbox.** Lanza los `pnpm dev` con
   `dangerouslyDisableSandbox: true` en el tool Bash, o el proceso queda vivo
   pero nadie se conecta.
2. **Turbo a veces cuelga el watcher de Nest** ("Found 0 errors. Watching…" sin
   "Nest application successfully started" ni bindear 4001). Si pasa, corre
   standalone: `cd apps/api && pnpm dev` y `cd apps/cms && pnpm dev` por
   separado. Dale a la API ~30-40s tras compilar antes de asumir que colgó.
3. Al reiniciar la API con `--webpack --watch` a veces arrancan **dos**
   instancias y una tira `EADDRINUSE :::4001` — es normal, la otra sí bindeó.
4. **Cache de datos de Next** (`.next/cache`) persiste en disco entre reinicios.
   Si cambias el *shape* de una respuesta de la API, borra `.next` del repo
   afectado (`rm -rf apps/cms/.next`) antes de relanzar, o servirá JSON viejo.

**Login del CMS:** `http://localhost:3002/login` con las credenciales
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` de `apps/api/.env`.

**Smoke test:**
```bash
curl http://localhost:4001/api/health                                   # {"status":"ok",...}
curl -o /dev/null -w "%{http_code}" http://localhost:3002/login          # 200
```

**Autenticarse por API** (para probar endpoints protegidos por `JwtAuthGuard`):
`POST /api/auth/login` con `{email,password}` guarda una cookie de sesión
(usa un cookie jar de curl y mándala en las siguientes llamadas).

---

## 3. Convenciones

- **Antes de commitear:** `pnpm typecheck` y `pnpm exec eslint <archivo>` en el
  workspace que tocaste. **El typecheck/lint NO detectan bugs de layout CSS**
  (scroll, ancho, anidación) — cambios visuales se verifican mirando el CMS en
  el navegador.
- **Commits:** mensajes en **español, imperativos/descriptivos** ("Agrega…",
  "Corrige…", "Reemplaza…"), directo a `main` (flujo solo-dev). `push` requiere
  la cuenta de GitHub **angelgonzalez1612** (remote `origin`).
- **Secretos:** `apps/api/.env` está gitignoreado; nunca commitees llaves.
- **`packages/types`** es el contrato compartido — cámbialo ahí, no dupliques
  tipos entre api/cms (salvo listas chicas ya duplicadas a propósito, p.ej. las
  categorías de Entidades en `entidades-explorer.tsx`).

---

## 4. Feature: Entidades + fuente de noticias reales

Pantalla `/entidades` del CMS (`apps/cms/src/components/cms/entidades/`): mapa de
interés de búsqueda por estado (Google Trends) para descubrir temas, y
**búsqueda de notas reales** para generar contenido con fuente citada.

**Fuente de noticias = Google News RSS, sin API key.**
`apps/api/src/modules/automation/web-search.service.ts` (`WebSearchService`)
consulta `https://news.google.com/rss/search` (es-419/MX), parsea `<item>` con
regex y devuelve `{title, url, snippet}` (snippet = `"MEDIO · fecha"`).
- **No usa Google Custom Search** (se descartó: requería key + proyecto de
  Google Cloud y chocaba con políticas de la org de la cuenta). News RSS es
  gratis, sin llave, sin límite de 100/día.
- Las ligas son de **redirección de Google News** (`news.google.com/rss/...`):
  abren la nota real en el navegador, pero **no siempre se scrapean
  server-side** → cuando `scrapeSourceFromHints` no puede, el generador redacta
  desde el titular real (degradación elegante, no truena).

**Quién consume `WebSearchService.search(query)`:**
- `SearchPhrasesService.research()` → botón "Buscar ligas" en `/automatizaciones/frases` (manual).
- `LocalSearchService` (`modules/entidades/local-search.service.ts`) → mapa de Entidades (cachea 1h). Endpoint `GET /api/cms/entidades/local-search` acepta `category` **o** `q` (frase libre) + `place`.
- `AutomationRunnerService.enrichSearchPhraseTopic()` → automatización (ver §5).

**Formato de cita** que espera el generador: `hints = "— MEDIO (https://url)"`
(lo extrae `AiDraftService.urlFromHints` / `sourceLabelFromHints`).

---

## 5. Sistema de automatización (autogeneración de contenido)

Módulo `apps/api/src/modules/automation/`. **Genera borradores solo**, cruzando
temas del día contra "reglas" configurables.

### Reglas (`automationRules`, esquema en `apps/api/src/db/schema/automation.ts`)
Campos (DTO: `dto/automation-rule.dto.ts`):
- `name`, `active` (bool)
- `site`: `'la-mira' | 'planazo' | null` (null = ambos)
- `categorySlugs: string[]` (`[]` = todas), `contentTypes: string[]` (`[]` = todos)
- `provider`: `'openai' | 'claude-cli' | 'codex-cli'`
- `dailyLimit` (1-50, piezas/día por regla), `expandIfShort`, `includeSearchPhrases`

**6 tipos de contenido automatizables:** `noticia`, `alerta`, `reportaje`
(La Mira) · `place`, `evento-planazo`, `planazo-guia` (Planazo). Los últimos dos
**siempre caen en `in_review`** por el check `revision-humana` (por diseño, no
se autopublican solos). No hay trigger/schedule por regla — el "cuándo" es
global (§ runner).

### Gestionar reglas
- **UI:** `/automatizaciones` (crear/editar/activar, "Ejecutar ahora", bitácora).
  Sub-pantalla `/automatizaciones/frases` para las frases de búsqueda.
- **API** (JWT), bajo `@Controller('cms/automation')`:
  `GET/POST/PATCH/DELETE /api/cms/automation/rules`, `GET runs`, `GET status`,
  `POST run-now`, `GET queue`.
  Ejemplo de creación:
  ```json
  POST /api/cms/automation/rules
  {"name":"General — Noticias (La Mira)","site":"la-mira","contentTypes":["noticia"],
   "categorySlugs":[],"provider":"claude-cli","dailyLimit":2,
   "expandIfShort":false,"includeSearchPhrases":true,"active":true}
  ```
  ⚠️ Cuidado con PATCH: el shape base NO trae `.default()` a propósito — un
  PATCH parcial `{active:true}` NO debe borrar `categorySlugs`/`contentTypes`
  (bug histórico del 2026-09-07). Manda solo los campos que cambias.

### Runner (`automation-runner.service.ts`) — qué corre y cuándo
- `@Interval(15 min)` mientras la API viva → `run()`. `@Interval(3h)`
  `autoPublishSafeReviewed` (publica eventos/guías de Planazo que quedaron en
  review solo por `revision-humana` y pasaron todo lo demás).
- Serverless (Vercel, donde `@Interval` no vive): `GET /cron/automation` con
  `Authorization: Bearer CRON_SECRET`, disparado por Vercel Cron.
- **De dónde salen los temas:** el reporte diario de **content-radar** (invocado
  por subproceso `tsx`; el `.md` del reporte está gitignoreado y **solo existe
  en local** — pendiente migrar a Turso para prod) **+** las frases de "Qué
  busca la gente".
- **Frases → nota real:** para temas `search-phrase`, antes de generar y solo si
  ya hay una regla candidata, `enrichSearchPhraseTopic()` busca la frase en
  Google News RSS, toma el 1er resultado y reescribe el tema con el titular real
  + `hints = "— MEDIO (url)"`, para que la IA genere **citando fuente** en vez
  de a ciegas (antes mandaba `hints:''`). Esto además hace que la automatización
  por frases funcione en **producción/Vercel** sin el reporte local.
- `AiDraftService.draft()` clasifica sitio/tipo/categoría y redacta; si la regla
  acepta la clasificación, crea la pieza (status `published` si pasó todos los
  checks, o `in_review`).

---

## 6. Archivos clave (mapa rápido)

| Área | Archivo |
|---|---|
| Fuente de noticias | `apps/api/src/modules/automation/web-search.service.ts` |
| Búsqueda local (Entidades) | `apps/api/src/modules/entidades/local-search.service.ts`, `.controller.ts`, `dto/local-search-query.dto.ts` |
| UI de Entidades | `apps/cms/src/components/cms/entidades/entidades-explorer.tsx` |
| Motor de automatización | `apps/api/src/modules/automation/automation-runner.service.ts` |
| CRUD de reglas | `automation-rules.service.ts`, `automation.controller.ts`, `dto/automation-rule.dto.ts` |
| Generación con IA | `apps/api/src/modules/ai/ai-draft.service.ts` (`urlFromHints`, `scrapeSourceFromHints`, `draft`) |
| Tipos de contenido | `apps/api/src/modules/ai/content-types.ts` |
| Validación de env | `apps/api/src/config/env.ts` |
| UI de automatización | `apps/cms/src/app/automatizaciones/automation-view.tsx` |

---

## 7. Pendientes conocidos / deuda

- El reporte de content-radar es local y gitignoreado → la automatización por
  temas de reporte **no corre en producción** todavía (migrar a Turso). La ruta
  por **frases** sí, gracias a News RSS (§5).
- Documentación por app (`apps/api`, `apps/cms`) aún sin consolidar (README §).
