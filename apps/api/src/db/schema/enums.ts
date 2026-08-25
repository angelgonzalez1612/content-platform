// SQLite (via libsql) has no native enum type — Postgres's pgEnum is replaced
// by a plain string-array constant, used inline as `text('col', { enum: X })`
// in each table definition. Values are unchanged from the Postgres version.
// Unifica dos enums que NO coincidían del todo: Planazo original (draft,
// in_review, published, archived — 4, inglés) y el ContentStatus que
// la-mira ya definía pero nunca usaba (borrador, revision, programado,
// publicado, archivado — 5, español, con "programado" que Planazo no
// tenía). Se agrega "scheduled" en inglés (consistente con el resto del
// enum) para cubrir ese estado real de "programado" — el mapeo español↔inglés
// se resuelve en la capa de UI/CMS, no aquí.
export const CONTENT_STATUS_VALUES = [
  'draft',
  'in_review',
  'scheduled',
  'published',
  'archived',
] as const;

export type ContentStatus = (typeof CONTENT_STATUS_VALUES)[number];

export const USER_ROLE_VALUES = ['admin', 'editor'] as const;

export type UserRole = (typeof USER_ROLE_VALUES)[number];

// Propios de la-mira — independientes de ContentStatus. Un Evento "en-curso"
// puede seguir "publicado" a la vez; son dos ejes distintos (workflow
// editorial vs. estado real del evento en el mundo).
export const ALERTA_STATUS_VALUES = ['activa', 'en-seguimiento', 'resuelta'] as const;
export type AlertaStatus = (typeof ALERTA_STATUS_VALUES)[number];

export const EVENTO_STATUS_VALUES = ['proximo', 'en-curso', 'finalizado', 'cancelado'] as const;
export type EventoStatus = (typeof EVENTO_STATUS_VALUES)[number];

export const LUGAR_KIND_VALUES = [
  'parque',
  'plaza',
  'museo',
  'monumento',
  'colonia',
  'estacion-metro',
  'estacion-metrobus',
] as const;
export type LugarKind = (typeof LUGAR_KIND_VALUES)[number];
