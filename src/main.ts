import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  const origins = config
    .get<string>('CORS_ORIGIN')!
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: origins, credentials: true });

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
}
void bootstrap();
