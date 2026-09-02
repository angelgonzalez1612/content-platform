import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { updatedAtColumn } from './columns.helpers';

// Fila única (id 'singleton', mismo patrón que automationState en
// automation.ts) para credenciales de proveedores de IA configurables desde
// la pantalla de Configuración — evita tener que editar apps/api/.env a mano
// y reiniciar el proceso cada vez que cambia una API key. Claude/Codex CLI no
// tienen columna aquí porque no usan API key: corren contra la sesión ya
// autenticada del CLI en esta máquina (ver claude-cli-provider.ts /
// codex-cli-provider.ts).
export const aiSettings = sqliteTable('ai_settings', {
  id: text('id').primaryKey(),
  openaiApiKey: text('openai_api_key'),
  updatedAt: updatedAtColumn(),
});

export type AiSettingsRow = typeof aiSettings.$inferSelect;
