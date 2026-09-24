# apps/api — Backend (NestJS)

API que alimenta el CMS y los dos sitios (La Mira, Planazo). Parte del monorepo
`content-platform` — para correrlo, convenciones y el sistema de automatización
ver **[`../../AGENTS.md`](../../AGENTS.md)** primero.

- **Stack:** NestJS 11 · Drizzle ORM sobre **SQLite/Turso** (`@libsql/client`) ·
  validación con **zod** · auth por **cookie de sesión JWT** · `@nestjs/schedule`.
- **Puerto:** `4001` (`apps/api/.env` → `PORT`). Dev: `pnpm dev` (o `pnpm start:dev`).
- **Entrada:** `src/main.ts` → `src/bootstrap.ts` → `src/app.module.ts`.
- **Env validado:** `src/config/env.ts` (zod; si falta algo obligatorio, no
  arranca). Opcionales degradan con mensaje claro, no tumban el server.

## Módulos (`src/modules/`)

- **Tipos de contenido:** `lamira-noticias`, `lamira-alertas`, `lamira-reportajes`,
  `lamira-eventos`, `lamira-lugares`, `lamira-guias`, `places`, `events`,
  `planazo-guides`, `articles`.
- **Plataforma:** `auth`, `users`, `sites`, `categories`, `locations`, `entidades`.
- **IA & automatización:** `ai` (`AiDraftService` genera/clasifica/mejora),
  `automation` (reglas + runner + búsqueda de noticias), `content-radar-published`.
- **Infra/soporte:** `health`, `dashboard`, `media`, `calendar`, `content-versions`.

## Base de datos (Drizzle)

Esquema en `src/db/schema/*.ts` (`index.ts` reexporta; `relations.ts` define
relaciones). Comandos (desde `apps/api`):

```bash
pnpm db:generate   # genera migraciones a partir del schema
pnpm db:migrate    # aplica migraciones
pnpm db:studio     # Drizzle Studio (inspección visual)
pnpm db:seed       # semilla base (admin, etc.)
```

> `package.json` tiene además **muchos scripts `db:*` de mantenimiento puntual**
> (dedupe, fix de fotos, borrado de contenido mal clasificado, etc.). Son
> one-offs históricos — **no los corras a ciegas**; cada uno muta datos reales.

## Auth

`POST /api/auth/login` `{email,password}` valida contra la DB y setea una cookie
`httpOnly` de sesión (JWT). Las rutas `cms/*` están protegidas con
`JwtAuthGuard`. Credenciales de admin sembrado: `SEED_ADMIN_*` en `.env`.

## Rutas destacadas

- `GET /api/health` — healthcheck.
- `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`.
- `cms/automation/*` — reglas de automatización (ver [`../../AGENTS.md`](../../AGENTS.md) §5).
- `cms/entidades/*` — interés por estado, frases, y `local-search` (notas reales
  de Google News; ver AGENTS.md §4).
- `cron/automation` — corrida de automatización para Vercel Cron (`Bearer CRON_SECRET`).

## Antes de commitear

`pnpm typecheck` (raíz o en `apps/api`) y `pnpm lint`. Ver convenciones en
[`../../AGENTS.md`](../../AGENTS.md) §3.
