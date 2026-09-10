import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/dev.sqlite',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
  strict: true,
  verbose: true,
});
