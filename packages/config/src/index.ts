export const apiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
} as const;

// URLs públicas de los sitios reales — para el botón "Ver publicación" del
// CMS, que abre el contenido tal como quedó en vivo (no una previsualización).
export const siteConfig = {
  lamiraUrl: process.env.NEXT_PUBLIC_LAMIRA_URL ?? 'http://localhost:3000',
  planazoUrl: process.env.NEXT_PUBLIC_PLANAZO_URL ?? 'http://localhost:3003',
} as const;
