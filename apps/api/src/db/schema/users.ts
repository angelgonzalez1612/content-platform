import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn, updatedAtColumn } from './columns.helpers';
import { USER_ROLE_VALUES } from './enums';

export const users = sqliteTable('users', {
  id: idColumn(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: USER_ROLE_VALUES }).default('editor').notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
