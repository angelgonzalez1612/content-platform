import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { updatedAtColumn } from './columns.helpers';

export const authLoginAttempts = sqliteTable('auth_login_attempts', {
  key: text('key').primaryKey(),
  failureCount: integer('failure_count').notNull().default(0),
  windowStartedAt: integer('window_started_at', { mode: 'timestamp' }).notNull(),
  blockedUntil: integer('blocked_until', { mode: 'timestamp' }),
  updatedAt: updatedAtColumn(),
});
