import 'reflect-metadata';
import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express } from 'express';
// IMPORTANTE: importa el JS ya compilado por `nest build` (tsc), NUNCA el
// TypeScript fuente. El bundler de funciones de Vercel usa esbuild, que no
// emite metadata de decoradores correctamente (emitDecoratorMetadata) — si
// esto importara ../src/app.module, Nest fallaría en runtime resolviendo
// dependencias inyectadas solo por tipo. Mismo patrón ya probado en
// apps/api/api/index.ts de custodia (repo hermano).
import { AppModule } from '../dist/app.module';
import { configureApp } from '../dist/bootstrap';

let cachedApp: Express | null = null;

async function getApp(): Promise<Express> {
  if (cachedApp) return cachedApp;

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bufferLogs: false });
  configureApp(app);
  await app.init();

  cachedApp = expressApp;
  return expressApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getApp();
  app(req, res);
}
