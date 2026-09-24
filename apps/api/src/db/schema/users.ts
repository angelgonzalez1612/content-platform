import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn, updatedAtColumn } from './columns.helpers';
import { USER_ROLE_VALUES } from './enums';

export const users = sqliteTable('users', {
  id: idColumn(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: USER_ROLE_VALUES }).default('editor').notNull(),
  // Se copia al JWT. Incrementarlo invalida de inmediato todas las sesiones
  // emitidas antes de un cambio de contraseña o de permisos.
  sessionVersion: integer('session_version').notNull().default(0),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
