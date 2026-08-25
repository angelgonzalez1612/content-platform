# content-platform

Backend (`apps/api`) + panel de administración (`apps/cms`) compartidos entre
[`la-mira`](https://github.com/angelgonzalez1612/la-mira) y
[`planazo_fronted`](https://github.com/angelgonzalez1612/planazo_fronted).

Nace de fusionar `planazo_backend` + `planazo_cms` (historial de commits
conservado vía `git subtree`) para dejar de sincronizar `packages/types` a
mano entre dos repos y para poder modelar contenido multi-sitio (ver el plan
de arquitectura en la conversación que originó este repo).

## Estructura

```
apps/
  api/      NestJS 11 + Drizzle ORM sobre Postgres — antes planazo_backend/apps/api
  cms/      Next.js 16 (App Router) — antes planazo_cms/apps/cms
packages/
  types/    Contrato de datos compartido (workspace real, ya no se copia a mano)
  config/   Config de API/sitio
  tsconfig/ Presets de TypeScript compartidos
```

Documentación detallada por app pendiente de consolidar (ver los README
originales de `apps/api` y `apps/cms` mientras tanto).
