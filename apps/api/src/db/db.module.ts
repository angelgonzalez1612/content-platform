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
        // Local file-based SQLite (via libsql) — no external DB service needed
        // while the schema is still being designed. Postgres/Supabase comes
        // back once the shape stabilizes; see DATABASE_URL comment in .env.example.
        const url = config.get<string>('DATABASE_URL') ?? 'file:./data/dev.sqlite';
        const client = createClient({ url });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule {}
