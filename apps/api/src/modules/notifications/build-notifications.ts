import type { ProviderHealth, ProviderHealthEvent } from '../ai/provider-health';
import type { AiProviderId } from '../ai/provider-registry.service';

export type NotificationSeverity = 'critical' | 'warning' | 'resolved';

export interface CmsNotification {
  /** Estable mientras el problema sea el mismo — el CMS lo usa para "leído". */
  id: string;
  severity: NotificationSeverity;
  title: string;
  detail: string;
  at: string;
  href: string;
}

const PROVIDER_LABEL: Record<AiProviderId, string> = {
  openai: 'OpenAI',
  'claude-cli': 'Claude',
  'codex-cli': 'Codex',
};

// 3 ticks del @Interval (15 min) sin revisar = la automatización no está corriendo.
export const STALLED_AFTER_MS = 45 * 60 * 1000;
const RUN_ERRORS_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface NotificationInputs {
  now: Date;
  providerHealth: ProviderHealth[];
  providerEvents: ProviderHealthEvent[];
  activeRulesCount: number;
  isRunning: boolean;
  lastCheckedAt: string | null;
  /** Corridas recientes con outcome 'error' (cualquier orden). */
  recentRunErrors: { ranAt: Date | string; topic: string; detail: string | null }[];
}

function formatAgo(ms: number): string {
  const minutes = Math.round(ms / 60000);
  return minutes >= 120 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
}

/**
 * Notificaciones de la campanita, derivadas del estado actual (no se guardan):
 * proveedores sin tokens o fallando, recuperaciones, automatización detenida y
 * errores recientes de la bitácora. Función pura para poder testearla.
 */
export function buildNotifications(input: NotificationInputs): CmsNotification[] {
  const items: CmsNotification[] = [];

  for (const h of input.providerHealth) {
    if (h.state === 'ok') continue;
    const label = PROVIDER_LABEL[h.provider];
    items.push({
      id: `provider:${h.provider}:${h.state}:${h.since ?? ''}`,
      severity: 'critical',
      title: h.state === 'sin-tokens' ? `${label} se quedó sin tokens` : `${label} no está generando`,
      detail:
        h.state === 'sin-tokens'
          ? 'Las automatizaciones que lo usan se detuvieron. Retoman solas cuando se renueve el límite, o cambia el proveedor predeterminado.'
          : `${h.consecutiveFailures} errores seguidos. Prueba la conexión en Configuración.`,
      at: h.since ?? input.now.toISOString(),
      href: '/configuracion',
    });
  }

  // Recuperaciones: solo si el proveedor sigue bien ahora (si volvió a caer,
  // ya lo cubre el aviso crítico de arriba).
  for (const e of input.providerEvents) {
    if (e.to !== 'ok') continue;
    const current = input.providerHealth.find((h) => h.provider === e.provider);
    if (current && current.state !== 'ok') continue;
    items.push({
      id: `provider-recovered:${e.provider}:${e.at}`,
      severity: 'resolved',
      title: `${PROVIDER_LABEL[e.provider]} volvió a generar`,
      detail:
        e.from === 'sin-tokens'
          ? 'Se renovaron los tokens; las automatizaciones retoman en el siguiente ciclo.'
          : 'Volvió a responder con normalidad.',
      at: e.at,
      href: '/configuracion',
    });
  }

  if (input.activeRulesCount > 0 && !input.isRunning) {
    const last = input.lastCheckedAt ? new Date(input.lastCheckedAt).getTime() : null;
    if (last === null || input.now.getTime() - last > STALLED_AFTER_MS) {
      items.push({
        id: `automation-stalled:${input.lastCheckedAt ?? 'never'}`,
        severity: 'warning',
        title: 'La automatización no está revisando',
        detail:
          last === null
            ? `Hay ${input.activeRulesCount} reglas activas pero nunca se ha ejecutado una revisión.`
            : `La última revisión fue hace ${formatAgo(input.now.getTime() - last)} (debería ser cada 15 min). Revisa que la API siga corriendo.`,
        at: input.lastCheckedAt ?? input.now.toISOString(),
        href: '/automatizaciones',
      });
    }
  }

  const windowStart = input.now.getTime() - RUN_ERRORS_WINDOW_MS;
  const errors = input.recentRunErrors
    .map((r) => ({ ...r, ranAt: new Date(r.ranAt) }))
    .filter((r) => r.ranAt.getTime() >= windowStart)
    .sort((a, b) => b.ranAt.getTime() - a.ranAt.getTime());
  if (errors.length > 0) {
    const latest = errors[0];
    items.push({
      id: `run-errors:${latest.ranAt.toISOString()}`,
      severity: 'warning',
      title: errors.length === 1 ? '1 tema falló al generarse' : `${errors.length} temas fallaron al generarse`,
      detail: `En las últimas 24 h. El más reciente: "${latest.topic.slice(0, 80)}"${latest.detail ? ` — ${latest.detail.slice(0, 140)}` : ''}`,
      at: latest.ranAt.toISOString(),
      href: '/automatizaciones',
    });
  }

  const rank: Record<NotificationSeverity, number> = { critical: 0, warning: 1, resolved: 2 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity] || b.at.localeCompare(a.at));
}
