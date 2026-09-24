# apps/cms — Panel de administración (Next.js)

CMS unificado para La Mira y Planazo. Parte del monorepo `content-platform` —
para correrlo y las convenciones ver **[`../../AGENTS.md`](../../AGENTS.md)**; para
usuarios, propósito y **principios de diseño** ver **[`PRODUCT.md`](./PRODUCT.md)**.

- **Stack:** Next.js 16 (App Router, **Turbopack**) · React · Tailwind.
- **Puerto:** `3002`. Dev: `pnpm dev`. Login: `/login` con `SEED_ADMIN_*` de `apps/api/.env`.
- **Habla con la API** vía `@planazo/config` (`apiConfig`): `baseUrl` (server-side)
  y `clientBaseUrl` (browser), siempre con `credentials: "include"` para mandar
  la cookie de sesión. Helpers en `src/lib/cms-api.ts`, `auth.ts`.

## Rutas (`src/app/`)

| Ruta | Qué es |
|---|---|
| `/login` | Autenticación |
| `/` (dashboard) | Resumen / actividad |
| `/crear` | Flujo de creación de contenido (pasos) |
| `/centro-ia` | Generación con IA (recibe `?name=&hints=&source=` desde otras pantallas) |
| `/contenido` | Listado/gestión de contenido |
| `/plantillas` | Plantillas por tipo/sitio |
| `/content-radar` | Reporte de temas en tendencia |
| `/entidades` | Mapa de interés por estado + **búsqueda de notas reales** (ver AGENTS.md §4) |
| `/automatizaciones` · `/automatizaciones/frases` | **Reglas de automatización** + frases de búsqueda (ver AGENTS.md §5) |
| `/calendario` | Calendario editorial |
| `/multimedia` | Biblioteca de medios |
| `/usuarios` · `/configuracion` · `/perfil` | Administración |

## Componentes (`src/components/cms/`)

- **Chrome/layout:** `cms-shell.tsx`, `sidebar.tsx`, `topbar.tsx`, `site-tabs.tsx`,
  `command-palette.tsx`, `copilot-panel.tsx`.
- **Generación/edición IA:** `publish-flow.tsx`, `expand-draft-panel.tsx`,
  `improve-with-ai-panel.tsx`, `block-improve-panel.tsx`, `seo-panel.tsx`,
  `generate-place-flow.tsx`.
- **Campos/editor:** `content-blocks-field.tsx`, `rich-textarea.tsx`,
  `dynamic-field.tsx`, `category-fields-section.tsx`, `tags-field.tsx`,
  `pair-list-field.tsx`, `version-history.tsx`.
- **Por feature:** `entidades/` (mapa + panel de notas), `lamira/`, `planazo/`.

## Convenciones de UI

- Sigue los **principios de `PRODUCT.md`**: escaneable primero (colapsa/expande,
  no fuerces scroll largo), controles compactos, contenido protagonista,
  consistencia entre pantallas, sin look de dashboard SaaS.
- **Verifica cambios de layout en el navegador** — typecheck/lint no cazan bugs
  de CSS (scroll, ancho, anidación).
- Reusa tokens/clases existentes (`ink`, `ink-soft`, `ink-faint`, `brand`,
  `border`, `card`, `hover`, `background`) antes de inventar estilos.

## Antes de commitear

`pnpm typecheck` y `pnpm exec eslint <archivo>`. Ver [`../../AGENTS.md`](../../AGENTS.md) §3.
