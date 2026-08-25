import { integer, text } from 'drizzle-orm/sqlite-core';

// SQLite has no native uuid type — Postgres's uuid().defaultRandom().primaryKey()
// becomes a text primary key filled by the same crypto.randomUUID() the app
// already relies on elsewhere. Column name matches the Postgres version so
// call sites (`.id`, `.placeId`, etc.) don't change.
export function idColumn(name = 'id') {
  return text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
}

// SQLite has no native timestamp type — stored as unix-epoch milliseconds via
// Drizzle's `{ mode: 'timestamp' }`, which still hands the app real Date
// objects on read, same as the Postgres driver did.
export function createdAtColumn(name = 'created_at') {
  return integer(name, { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date());
}

export function updatedAtColumn(name = 'updated_at') {
  return integer(name, { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date());
}
