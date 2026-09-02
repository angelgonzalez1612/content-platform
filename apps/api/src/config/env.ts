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
