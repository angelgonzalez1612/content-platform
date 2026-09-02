// Tipos compartidos entre cms-api.ts (server, importa next/headers) y los
// componentes cliente de /automatizaciones — separado para que el cliente no
// arrastre next/headers solo por importar estos tipos.

// Solo estos 5 tipos se pueden crear de principio a fin sin un humano — ver
// AUTOMATABLE_CONTENT_TYPES en apps/api/src/modules/automation/dto/automation-rule.dto.ts.
export const AUTOMATABLE_CONTENT_TYPES = ["noticia", "alerta", "reportaje", "place", "evento-planazo"] as const;
export type AutomatableContentType = (typeof AUTOMATABLE_CONTENT_TYPES)[number];

export interface AutomationRule {
  id: string;
  name: string;
  active: boolean;
  site: "la-mira" | "planazo" | null;
  categorySlugs: string[];
  contentTypes: AutomatableContentType[];
  provider: "openai" | "claude-cli" | "codex-cli";
  dailyLimit: number;
  expandIfShort: boolean;
  includeSearchPhrases: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  ruleId: string | null;
  ruleName: string | null;
  ranAt: string;
  topic: string;
  categoryLabel: string | null;
  site: "la-mira" | "planazo" | null;
  contentType: string | null;
  outcome: "published" | "draft" | "skipped_duplicate" | "skipped_no_match" | "error";
  contentId: string | null;
  contentSlug: string | null;
  detail: string | null;
  source: "report" | "search-phrase";
}

export interface PendingTopic {
  title: string;
  categoryLabel: string;
  hasCandidateRule: boolean;
  source: "report" | "search-phrase";
}

export interface AutomationQueue {
  totalTopics: number;
  alreadyHandled: number;
  pending: PendingTopic[];
}

// Compartido entre la bitácora de /automatizaciones y la tarjeta de
// "en tiempo real" del Dashboard — mismo criterio visual para cada outcome.
export const OUTCOME_META: Record<AutomationRun["outcome"], { label: string; bg: string; fg: string }> = {
  published: { label: "Publicado solo", bg: "#EAF7EF", fg: "#2E9E5B" },
  draft: { label: "Creado como borrador", bg: "#FEF6E7", fg: "#9A6B12" },
  skipped_duplicate: { label: "Ya publicado antes", bg: "#F3F0EC", fg: "#8A837B" },
  skipped_no_match: { label: "No encajó con la regla", bg: "#F3F0EC", fg: "#8A837B" },
  error: { label: "Error", bg: "#FDECEA", fg: "#C4453A" },
};
