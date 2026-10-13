import { Injectable } from '@nestjs/common';
import type { AiProviderId } from './provider-registry.service';

// Tras cuántos fallos seguidos (que no sean de tokens) se considera que un
// proveedor "ya no está generando". 3 y no 1: un timeout o un JSON mal
// formado aislado es normal; tres seguidos ya es un patrón.
export const FAILING_AFTER_CONSECUTIVE_ERRORS = 3;

// Mensajes reales con los que los CLI/API avisan que se acabó la cuota de la
// cuenta: Claude Code ("Claude AI usage limit reached", "You've hit your
// limit"), Codex/ChatGPT ("You've hit your usage limit", "rate limit"),
// OpenAI API ("insufficient_quota", "exceeded your current quota", 429).
const QUOTA_PATTERNS = [
  /usage limit/i,
  // "You've hit your session limit · resets 3:20pm" / "...weekly limit..." /
  // "...Opus limit..." — el CLI de Claude nombra el tipo de límite en medio,
  // y el patrón anterior (solo "usage") dejaba pasar los dos más comunes: la
  // corrida seguía y cada tema quedaba como 'error' (cientos de intentos
  // quemados contra una cuota ya agotada).
  /hit your (\w+ )?limit/i,
  /(session|weekly|daily|monthly) limit/i,
  /limit (reached|exceeded)/i,
  /rate[ _-]?limit/i,
  /insufficient_quota/i,
  /exceeded your current quota/i,
  /credit balance is too low/i,
  /out of (credits|tokens)/i,
  /status(?: code)?:? 429/i,
];

// Solo la cola del mensaje: el stderr de `codex exec` repite el prompt
// (texto de la nota incluido) antes del error real, y ese texto no debe
// poder disparar un falso "sin tokens".
const QUOTA_SCAN_TAIL_CHARS = 1500;

export function isQuotaError(message: string): boolean {
  const tail = message.slice(-QUOTA_SCAN_TAIL_CHARS);
  return QUOTA_PATTERNS.some((re) => re.test(tail));
}

export type ProviderHealthState = 'ok' | 'sin-tokens' | 'fallando';

export interface ProviderHealth {
  provider: AiProviderId;
  state: ProviderHealthState;
  consecutiveFailures: number;
  lastError: string | null;
  /** Desde cuándo está en el estado actual (ISO), null si nunca se ha usado. */
  since: string | null;
  lastSuccessAt: string | null;
}

/** Cambio de estado de un proveedor — alimenta la campanita de
 * notificaciones (ver NotificationsService), incluida la recuperación. */
export interface ProviderHealthEvent {
  provider: AiProviderId;
  from: ProviderHealthState;
  to: ProviderHealthState;
  at: string;
  detail: string | null;
}

// Suficiente para cubrir un día normal de altibajos sin crecer sin límite.
const MAX_EVENTS = 30;

/** Se lanza cuando el proveedor (y su respaldo, si hay) se quedó sin tokens —
 * AutomationRunnerService lo usa para detener la corrida completa en vez de
 * seguir quemando intentos tema por tema. */
export class ProviderQuotaExceededError extends Error {
  constructor(
    readonly provider: AiProviderId,
    detail: string,
  ) {
    super(`Sin tokens en ${provider}: ${detail}`);
    this.name = 'ProviderQuotaExceededError';
  }
}

/**
 * Estado en memoria de cada proveedor, alimentado por cada generación real
 * (ProviderRegistry.generateWithFallback) — sin llamadas extra a la IA para
 * saberlo. En memoria a propósito: los proveedores CLI solo corren en esta
 * máquina, y si la API se reinicia el estado se vuelve a descubrir con la
 * siguiente generación.
 */
@Injectable()
export class ProviderHealthService {
  private readonly health = new Map<AiProviderId, ProviderHealth>();
  private readonly events: ProviderHealthEvent[] = [];
  // Último fallo que dejó al proveedor en 'sin-tokens' o 'fallando' (epoch ms).
  // A diferencia de `since` (que no se renueva mientras siga en ese estado),
  // este sí se actualiza en cada fallo, para poder pausar reintentos un rato
  // desde el último.
  private readonly pausedAt = new Map<AiProviderId, number>();

  /** true si el proveedor se quedó sin cuota o está fallando (3 errores
   * seguidos: CLI que no arranca, proceso muerto, poca memoria…) hace menos de
   * `cooldownMs` — el runner lo usa para no volver a intentar cada 15 min
   * contra algo que sigue roto. Pasado el cooldown deja pasar UNA corrida de
   * prueba: si falla otra vez, el cooldown se reinicia; si funciona,
   * recordSuccess lo limpia. */
  isPaused(provider: AiProviderId, cooldownMs: number): boolean {
    const at = this.pausedAt.get(provider);
    return at !== undefined && Date.now() - at < cooldownMs;
  }

  private pushEvent(provider: AiProviderId, from: ProviderHealthState, to: ProviderHealthState, detail: string | null) {
    if (from === to) return;
    this.events.unshift({ provider, from, to, at: new Date().toISOString(), detail });
    this.events.length = Math.min(this.events.length, MAX_EVENTS);
  }

  recordSuccess(provider: AiProviderId): void {
    const now = new Date().toISOString();
    const prev = this.health.get(provider);
    this.pausedAt.delete(provider);
    if (prev) this.pushEvent(provider, prev.state, 'ok', null);
    this.health.set(provider, {
      provider,
      state: 'ok',
      consecutiveFailures: 0,
      lastError: null,
      since: prev?.state === 'ok' ? prev.since : now,
      lastSuccessAt: now,
    });
  }

  /** Devuelve el estado resultante, para que el llamador sepa si fue de tokens. */
  recordFailure(provider: AiProviderId, message: string): ProviderHealthState {
    const prev = this.health.get(provider);
    const consecutiveFailures = (prev?.consecutiveFailures ?? 0) + 1;
    let state: ProviderHealthState;
    if (isQuotaError(message)) {
      state = 'sin-tokens';
      this.pausedAt.set(provider, Date.now());
    }
    else if (consecutiveFailures >= FAILING_AFTER_CONSECUTIVE_ERRORS) {
      state = 'fallando';
      this.pausedAt.set(provider, Date.now());
    }
    // Un fallo suelto no quita un "sin tokens" ya detectado — solo un éxito lo limpia.
    else state = prev?.state ?? 'ok';
    this.pushEvent(provider, prev?.state ?? 'ok', state, message.slice(0, 500));
    this.health.set(provider, {
      provider,
      state,
      consecutiveFailures,
      lastError: message.slice(0, 500),
      since: prev?.state === state ? prev.since : new Date().toISOString(),
      lastSuccessAt: prev?.lastSuccessAt ?? null,
    });
    return state;
  }

  getAll(): ProviderHealth[] {
    return [...this.health.values()];
  }

  /** Cambios de estado recientes, el más nuevo primero. */
  getEvents(): ProviderHealthEvent[] {
    return [...this.events];
  }
}
