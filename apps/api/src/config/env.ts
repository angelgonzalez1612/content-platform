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
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000,http://localhost:3002'),
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
  // Google Programmable Search (Custom Search JSON API) — busca ligas reales
  // por cada frase de "Qué busca la gente" en /automatizaciones/frases, para
  // que el humano elija una como fuente citada antes de generar contenido
  // (ver WebSearchService). NO usa "buscar en toda la Web" (Google ya no lo
  // ofrece a buscadores nuevos, ver soporte 12397162) — en vez de eso, el
  // buscador de Google se configuró con una lista curada de sitios reales de
  // CDMX (noticias + gob.mx + planes), que si acepta gratis sin tarjeta.
  // Se probó Tavily antes — pide tarjeta incluso en su plan gratuito, se
  // descartó. Opcionales: sin ellas, "Buscar ligas" falla con un mensaje
  // claro en vez de tronar el arranque del server.
  GOOGLE_SEARCH_API_KEY: z.string().optional(),
  GOOGLE_SEARCH_ENGINE_ID: z.string().optional(),
  // Token personal de Vercel (Account Settings -> Tokens) — solo lectura de
  // deployments, usado por el Dashboard del CMS para mostrar "cuándo fue la
  // última vez que se subió a prod" de los 4 proyectos (ver
  // VercelDeploymentsService). Opcional: sin él, esa tarjeta simplemente
  // dice "no configurado" en vez de tronar el arranque del server.
  VERCEL_API_TOKEN: z.string().optional(),
  // URLs secretas de Deploy Hooks de Vercel. Se usan únicamente desde la API
  // cuando un editor pide publicar manualmente desde el Dashboard del CMS.
  // Crea un hook por proyecto en Vercel: Settings -> Git -> Deploy Hooks.
  VERCEL_DEPLOY_HOOK_API: z.url().optional(),
  VERCEL_DEPLOY_HOOK_CMS: z.url().optional(),
  VERCEL_DEPLOY_HOOK_LA_MIRA: z.url().optional(),
  VERCEL_DEPLOY_HOOK_PLANAZO: z.url().optional(),
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
