import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { ZodExceptionFilter } from './common/zod-exception.filter';

// Configuración compartida entre `main.ts` (dev local, `nest start`) y
// `api/index.ts` (función serverless de Vercel) — para no tener dos copias
// que se puedan desincronizar.
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // Sin esto, un DTO inválido (ej. campo requerido vacío al crear/editar)
  // tiraba un 500 genérico sin decir qué campo — ver ZodExceptionFilter.
  app.useGlobalFilters(new ZodExceptionFilter());
  // Imágenes subidas a mano (ver ImagesController) — servidas tal cual, sin
  // pasar por el prefijo /api, para que la URL sea corta y estable. En
  // Vercel esto solo sirve lo que venga empaquetado en el deploy — un
  // archivo subido en runtime no persiste entre invocaciones (sin disco
  // compartido), así que la subida manual de imágenes no funciona ahí
  // todavía; el resto del sitio no depende de eso (las imágenes de
  // contenido generado por IA usan URLs externas, no este endpoint).
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const origins = config
    .get<string>('CORS_ORIGIN')!
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: origins, credentials: true });
}
