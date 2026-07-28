import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { AppModule } from './app.module';

// Vercel keeps warm lambda instances between requests — reuse the same
// Nest app across invocations instead of re-bootstrapping every time.
let cachedApp: Express | null = null;

export async function getApp(): Promise<Express> {
  if (cachedApp) return cachedApp;

  const expressApp = express();
  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  const config = nestApp.get(ConfigService);

  nestApp.setGlobalPrefix('api');
  nestApp.use(cookieParser());

  const origins = config
    .get<string>('CORS_ORIGIN')!
    .split(',')
    .map((origin) => origin.trim());
  nestApp.enableCors({ origin: origins, credentials: true });

  await nestApp.init();
  cachedApp = expressApp;
  return expressApp;
}
