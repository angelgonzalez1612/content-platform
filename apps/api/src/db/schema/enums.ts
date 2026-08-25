// SQLite (via libsql) has no native enum type — Postgres's pgEnum is replaced
// by a plain string-array constant, used inline as `text('col', { enum: X })`
// in each table definition. Values are unchanged from the Postgres version.
export const CONTENT_STATUS_VALUES = [
  'draft',
  'in_review',
  'published',
  'archived',
] as const;

export type ContentStatus = (typeof CONTENT_STATUS_VALUES)[number];

export const USER_ROLE_VALUES = ['admin', 'editor'] as const;

export type UserRole = (typeof USER_ROLE_VALUES)[number];
