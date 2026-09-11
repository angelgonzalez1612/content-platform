export const apiConfig = {
  // Para código de servidor (Server Components/Actions, auth.ts, cms-api.ts):
  // URL absoluta, servidor-a-servidor, sin problema de cookies cross-site.
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  // Para componentes de cliente: ruta relativa al propio origen del CMS.
  // El rewrite en next.config.ts la manda a la API real — así el navegador
  // solo habla con el dominio del CMS y el cookie de sesión queda ahí.
  clientBaseUrl: '/api',
} as const;

// URLs públicas de los sitios reales — para el botón "Ver publicación" del
// CMS, que abre el contenido tal como quedó en vivo (no una previsualización).
export const siteConfig = {
  lamiraUrl: process.env.NEXT_PUBLIC_LAMIRA_URL ?? 'http://localhost:3000',
  planazoUrl: process.env.NEXT_PUBLIC_PLANAZO_URL ?? 'http://localhost:3003',
} as const;
