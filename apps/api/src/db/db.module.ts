import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export type DrizzleDb = LibSQLDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Local file-based SQLite (via libsql) en desarrollo — mismo driver que
        // Turso en producción, así que pasar a producción es solo cambiar
        // DATABASE_URL a una URL libsql:// remota y setear DATABASE_AUTH_TOKEN
        // (Turso lo requiere; un archivo local no usa auth, por eso es opcional).
        const url = config.get<string>('DATABASE_URL') ?? 'file:./data/dev.sqlite';
        const authToken = config.get<string>('DATABASE_AUTH_TOKEN');
        const client = createClient(authToken ? { url, authToken } : { url });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule {}
