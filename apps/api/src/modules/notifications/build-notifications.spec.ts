import { buildNotifications, STALLED_AFTER_MS, type NotificationInputs } from './build-notifications';

const now = new Date('2026-09-28T20:00:00.000Z');

function inputs(overrides: Partial<NotificationInputs> = {}): NotificationInputs {
  return {
    now,
    providerHealth: [],
    providerEvents: [],
    activeRulesCount: 32,
    isRunning: false,
    lastCheckedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    recentRunErrors: [],
    ...overrides,
  };
}

describe('buildNotifications', () => {
  it('sin problemas no hay notificaciones', () => {
    expect(buildNotifications(inputs())).toEqual([]);
  });

  it('un proveedor sin tokens es crítico y va primero', () => {
    const items = buildNotifications(
      inputs({
        providerHealth: [
          { provider: 'codex-cli', state: 'sin-tokens', consecutiveFailures: 1, lastError: 'limit', since: '2026-09-28T19:00:00.000Z', lastSuccessAt: null },
        ],
        recentRunErrors: [{ ranAt: '2026-09-28T19:30:00.000Z', topic: 'Tema', detail: 'timeout' }],
      }),
    );
    expect(items.map((i) => [i.severity, i.title])).toEqual([
      ['critical', 'Codex se quedó sin tokens'],
      ['warning', '1 tema falló al generarse'],
    ]);
  });

  it('avisa la recuperación solo si el proveedor sigue bien', () => {
    const event = { provider: 'codex-cli' as const, from: 'sin-tokens' as const, to: 'ok' as const, at: '2026-09-28T19:50:00.000Z', detail: null };
    expect(buildNotifications(inputs({ providerEvents: [event] }))[0]).toMatchObject({ severity: 'resolved', title: 'Codex volvió a generar' });

    const fellAgain = buildNotifications(
      inputs({
        providerEvents: [event],
        providerHealth: [
          { provider: 'codex-cli', state: 'sin-tokens', consecutiveFailures: 1, lastError: 'limit', since: '2026-09-28T19:55:00.000Z', lastSuccessAt: null },
        ],
      }),
    );
    expect(fellAgain.map((i) => i.severity)).toEqual(['critical']);
  });

  it('avisa si la automatización dejó de revisar, pero no durante una corrida larga', () => {
    const stale = new Date(now.getTime() - STALLED_AFTER_MS - 60_000).toISOString();
    expect(buildNotifications(inputs({ lastCheckedAt: stale }))[0]).toMatchObject({ title: 'La automatización no está revisando' });
    expect(buildNotifications(inputs({ lastCheckedAt: stale, isRunning: true }))).toEqual([]);
    expect(buildNotifications(inputs({ lastCheckedAt: stale, activeRulesCount: 0 }))).toEqual([]);
  });

  it('ignora errores de hace más de 24 h', () => {
    expect(buildNotifications(inputs({ recentRunErrors: [{ ranAt: '2026-09-27T10:00:00.000Z', topic: 'Viejo', detail: null }] }))).toEqual([]);
  });
});
