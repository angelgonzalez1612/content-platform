import { pgEnum } from 'drizzle-orm/pg-core';

export const contentStatusEnum = pgEnum('content_status', [
  'draft',
  'in_review',
  'published',
  'archived',
]);
