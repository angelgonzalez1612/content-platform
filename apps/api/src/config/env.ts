import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.url(),
  // Solo la necesita una URL libsql:// remota (Turso) — un archivo local no
  // usa auth, así que en desarrollo se queda sin definir.
  DATABASE_AUTH_TOKEN: z.string().optional(),
  REDIS_URL: z.url().optional(),
  // Comma-separated list — the API is shared between planazo_fronted and planazo_cms.
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:3002'),
  JWT_SECRET: z.string().min(16),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_ADMIN_NAME: z.string().default('Admin'),
  OPENAI_API_KEY: z.string().optional(),
  // Autoriza al cron de Vercel a disparar la automatización (ver
  // AutomationCronController) — sin esto, ese endpoint rechaza todo.
  CRON_SECRET: z.string().optional(),
  // Hosting FTP donde se guardan las imágenes que se buscan y salvan desde
  // la Biblioteca Multimedia (ver FtpStorageService) — deliberadamente fuera
  // de la base de datos, solo se guarda ahí la URL final. Todos opcionales:
  // sin ellos, "guardar imagen" falla con un mensaje claro en vez de tronar
  // el arranque del server.
  FTP_HOST: z.string().optional(),
  FTP_USER: z.string().optional(),
  FTP_PASSWORD: z.string().optional(),
  FTP_PORT: z.coerce.number().default(21),
  FTP_UPLOAD_DIR: z.string().default('public_html/media-library'),
  MEDIA_PUBLIC_BASE_URL: z.string().optional(),
  // Bing Image Search (Azure AI Services) — tercera fuente del buscador de
  // imágenes, opcional (sin ella, ImageSearchService simplemente no incluye
  // resultados de Bing, igual que ya pasa con OPENAI_API_KEY).
  BING_API_KEY: z.string().optional(),
  // Búsqueda web para ligas reales por cada frase de "Qué busca la gente" en
  // /automatizaciones/frases, para que el humano elija una como fuente citada
  // antes de generar contenido (ver WebSearchService). Tavily primero (hecha
  // para que la use una IA); Brave se agrega después como segunda fuente —
  // se descartó Google Programmable Search: dejó de ofrecer "buscar en toda
  // la Web" a cuentas nuevas (ver soporte de Google, respuesta 12397162),
  // así que un buscador creado hoy queda atado a un puñado de sitios fijos,
  // inútil para frases genéricas. Opcional: sin ella, "Buscar ligas" falla
  // con un mensaje claro en vez de tronar el arranque del server.
  TAVILY_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
