import { FAILING_AFTER_CONSECUTIVE_ERRORS, ProviderHealthService, isQuotaError } from './provider-health';

describe('isQuotaError', () => {
  it.each([
    'El CLI terminó con error: Claude AI usage limit reached|1790000000',
    "El CLI terminó con error: You've hit your limit · resets 7pm",
    "Codex CLI terminó con código 1: ERROR: You've hit your usage limit. Try again later.",
    'Error: 429 You exceeded your current quota, please check your plan and billing details.',
    'insufficient_quota',
    'stream error: rate_limit_exceeded',
  ])('detecta "%s" como sin tokens', (message) => {
    expect(isQuotaError(message)).toBe(true);
  });

  it.each([
    'Claude CLI superó el tiempo límite de 60000ms.',
    'Claude CLI no devolvió datos válidos tras reintentar: invalid_type',
    'spawn claude ENOENT',
  ])('no confunde "%s" con falta de tokens', (message) => {
    expect(isQuotaError(message)).toBe(false);
  });

  it('ignora menciones de límite dentro del prompt repetido en stderr', () => {
    const echoedPrompt = `user\nLa nota dice que se alcanzó el usage limit del Metro… ${'x'.repeat(2000)}`;
    expect(isQuotaError(`Codex CLI terminó con código 1: ${echoedPrompt}\nERROR: stream disconnected`)).toBe(false);
  });
});

describe('ProviderHealthService', () => {
  it('marca sin tokens al primer error de cuota y lo limpia con un éxito', () => {
    const health = new ProviderHealthService();
    expect(health.recordFailure('codex-cli', "You've hit your usage limit")).toBe('sin-tokens');
    expect(health.recordFailure('codex-cli', 'timeout')).toBe('sin-tokens');
    health.recordSuccess('codex-cli');
    expect(health.getAll()).toEqual([expect.objectContaining({ provider: 'codex-cli', state: 'ok', consecutiveFailures: 0 })]);
  });

  it(`marca "fallando" tras ${FAILING_AFTER_CONSECUTIVE_ERRORS} errores seguidos que no son de tokens`, () => {
    const health = new ProviderHealthService();
    for (let i = 1; i < FAILING_AFTER_CONSECUTIVE_ERRORS; i++) {
      expect(health.recordFailure('claude-cli', 'timeout')).toBe('ok');
    }
    expect(health.recordFailure('claude-cli', 'timeout')).toBe('fallando');
  });
});

describe('ProviderHealthService.getEvents', () => {
  it('registra la caída y la recuperación, sin repetir estados iguales', () => {
    const health = new ProviderHealthService();
    health.recordSuccess('codex-cli');
    health.recordFailure('codex-cli', "You've hit your usage limit");
    health.recordFailure('codex-cli', "You've hit your usage limit");
    health.recordSuccess('codex-cli');
    expect(health.getEvents().map((e) => `${e.from}→${e.to}`)).toEqual(['sin-tokens→ok', 'ok→sin-tokens']);
  });
});
