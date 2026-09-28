"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { Icon } from "@/components/icon";
import type { AiSettingsStatus, AiProviderId } from "@/lib/cms-api";
import type { ProviderHealth } from "@/lib/automation-types";
import { describeProviderHealth } from "@/lib/provider-health";
import { timeAgo } from "@/lib/time-ago";

type ProviderId = AiProviderId;

// Mismo orden que el selector de reglas en Automatizaciones: Codex primero
// porque es el predeterminado del sistema cuando no hay nada guardado.
const PROVIDERS: ProviderId[] = ["codex-cli", "claude-cli", "openai"];
const SYSTEM_DEFAULT: ProviderId = "codex-cli";

const TERMINAL_ICON = "M4 5l6 6-6 6M12 19h8";
const LOCK_ICON = "M6 11V8a6 6 0 0 1 12 0v3M5 11h14a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a1 1 0 0 1 1-1z";

const PROVIDER_META: Record<ProviderId, { label: string; credential: string; cost: string; icon: string }> = {
  "codex-cli": {
    label: "Codex",
    credential: "Sesión de ChatGPT en este servidor",
    cost: "Usa el límite de tu plan de ChatGPT, sin cobro por token.",
    icon: TERMINAL_ICON,
  },
  "claude-cli": {
    label: "Claude",
    credential: "Sesión de Claude Code en este servidor",
    cost: "Comparte el límite con tu propio uso de Claude Code: si la automatización lo agota, tú también te quedas sin tokens.",
    icon: TERMINAL_ICON,
  },
  openai: {
    label: "OpenAI",
    credential: "API key",
    cost: "Se cobra por token a la cuenta dueña de la key.",
    icon: LOCK_ICON,
  },
};

interface CheckResult {
  ok: boolean;
  detail: string;
}

interface CheckState {
  loading: boolean;
  result: CheckResult | null;
}

const EMPTY_CHECKS: Record<ProviderId, CheckState> = {
  openai: { loading: false, result: null },
  "claude-cli": { loading: false, result: null },
  "codex-cli": { loading: false, result: null },
};

// Tintes sobre los tokens semánticos (funcionan igual en tema claro y oscuro).
const PILL_TONE = {
  positive: "bg-positive/12 text-positive",
  negative: "bg-negative/12 text-negative",
  neutral: "bg-hover text-ink-soft",
} as const;

function Pill({ tone, children, title }: { tone: keyof typeof PILL_TONE; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${PILL_TONE[tone]}`}
    >
      {tone !== "neutral" && <span className="size-[5px] rounded-full bg-current" />}
      {children}
    </span>
  );
}

/**
 * Estado de un proveedor, en orden de confianza: una prueba de conexión que el
 * editor acaba de pedir > lo que dijeron las generaciones reales (sin tokens,
 * dejó de generar, última generación OK) > nada verificado todavía.
 */
function ProviderStatePill({ check, health, idleLabel }: { check: CheckState; health: ProviderHealth | undefined; idleLabel: string }) {
  if (check.result) {
    return <Pill tone={check.result.ok ? "positive" : "negative"}>{check.result.ok ? "Conectado" : "Error de conexión"}</Pill>;
  }
  if (health && health.state !== "ok") {
    return (
      <Pill tone="negative" title={health.lastError ?? undefined}>
        {health.state === "sin-tokens" ? "Sin tokens" : "No está generando"}
      </Pill>
    );
  }
  if (health?.lastSuccessAt) {
    return <Pill tone="positive">Generó {timeAgo(health.lastSuccessAt)}</Pill>;
  }
  return <Pill tone="neutral">{idleLabel}</Pill>;
}

function Section({ title, description, children }: { title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <header className="border-b border-border-soft px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-balance">{title}</h2>
        <p className="mt-1 max-w-[68ch] text-[12.5px] leading-[1.5] text-ink-soft">{description}</p>
      </header>
      {children}
    </section>
  );
}

// "Probar conexión" — una llamada real y barata al proveedor (models.list() en
// OpenAI, un prompt trivial en las CLI), nunca automática: cada prueba gasta
// una llamada real, así que solo corre cuando el editor la pide.
function ConnectionCheck({ state, onCheck }: { state: CheckState; onCheck: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={onCheck}
        disabled={state.loading}
        className="flex flex-none items-center gap-1.5 rounded-[10px] border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-faint disabled:cursor-default disabled:opacity-60"
      >
        <Icon
          d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"
          size={13}
          strokeWidth={1.8}
          className={state.loading ? "animate-spin text-ink-faint" : "text-ink-faint"}
        />
        {state.loading ? "Probando…" : "Probar conexión"}
      </button>
      {state.result && (
        <span className={`text-[12px] leading-[1.4] font-medium ${state.result.ok ? "text-positive" : "text-negative"}`}>
          {state.result.detail}
        </span>
      )}
    </div>
  );
}

export function ConfiguracionView({
  initialAiSettings,
  rulesUsingDefault,
}: {
  initialAiSettings: AiSettingsStatus;
  rulesUsingDefault: number;
}) {
  const [status, setStatus] = useState(initialAiSettings);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState(EMPTY_CHECKS);
  const [preferredProvider, setPreferredProvider] = useState<ProviderId>(initialAiSettings.preferredProvider ?? SYSTEM_DEFAULT);
  const [fallbackProvider, setFallbackProvider] = useState<ProviderId | "">(initialAiSettings.fallbackProvider ?? "");
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferenceSavedAt, setPreferenceSavedAt] = useState<number | null>(null);
  const [preferenceError, setPreferenceError] = useState("");

  const savedPreferred = status.preferredProvider ?? SYSTEM_DEFAULT;
  const savedFallback = status.fallbackProvider ?? "";
  const preferenceDirty = preferredProvider !== savedPreferred || fallbackProvider !== savedFallback;
  const healthOf = (provider: ProviderId) => status.providerHealth?.find((h) => h.provider === provider);

  async function save(openaiApiKey: string | null) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/settings/ai`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiApiKey }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo guardar.");
        return;
      }
      // El PUT devuelve el estado sin providerHealth — se conserva el que ya había.
      const next = (await res.json()) as AiSettingsStatus;
      setStatus((prev) => ({ ...next, providerHealth: next.providerHealth ?? prev.providerHealth }));
      setKeyInput("");
      // La key acaba de cambiar — un resultado de prueba viejo (con la key
      // anterior) ya no significa nada, se limpia para no confundir.
      setChecks((c) => ({ ...c, openai: { loading: false, result: null } }));
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function checkConnection(provider: ProviderId) {
    setChecks((c) => ({ ...c, [provider]: { loading: true, result: null } }));
    let result: CheckResult;
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/settings/ai/check/${provider}`, {
        method: "POST",
        credentials: "include",
      });
      result = res.ok ? await res.json() : { ok: false, detail: "No se pudo ejecutar la prueba." };
    } catch {
      result = { ok: false, detail: "No se pudo conectar con el servidor." };
    }
    setChecks((c) => ({ ...c, [provider]: { loading: false, result } }));
  }

  async function savePreference() {
    setSavingPreference(true);
    setPreferenceError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/settings/ai/preference`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredProvider, fallbackProvider: fallbackProvider || null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setPreferenceError(body?.message ?? "No se pudo guardar.");
        return;
      }
      const next = (await res.json()) as AiSettingsStatus;
      setStatus((prev) => ({ ...next, providerHealth: next.providerHealth ?? prev.providerHealth }));
      setPreferenceSavedAt(Date.now());
    } catch {
      setPreferenceError("No se pudo conectar con el servidor.");
    } finally {
      setSavingPreference(false);
    }
  }

  function choosePreferred(next: ProviderId) {
    setPreferredProvider(next);
    if (next === fallbackProvider) setFallbackProvider("");
    setPreferenceSavedAt(null);
  }

  const idleLabel = (provider: ProviderId) =>
    provider === "openai" ? (status.openaiApiKeySet ? `Key ${status.openaiApiKeyPreview ?? ""}` : "Sin key") : "Sin verificar";

  return (
    <div className="p-[26px] pb-[60px]">
      <div className="mb-6">
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Configuración</h1>
        <p className="text-[13px] text-ink-soft">Qué IA redacta el contenido del CMS y con qué credenciales.</p>
      </div>

      <div className="flex max-w-[780px] flex-col gap-5">
        <Section
          title="Proveedor predeterminado"
          description={
            <>
              Redacta en todas las reglas de Automatizaciones marcadas como &quot;Predeterminado&quot;
              {rulesUsingDefault > 0 && (
                <>
                  {" "}
                  (hoy{" "}
                  <span className="font-semibold text-ink">
                    {rulesUsingDefault} regla{rulesUsingDefault === 1 ? "" : "s"} activa{rulesUsingDefault === 1 ? "" : "s"}
                  </span>
                  )
                </>
              )}
              . Cámbialo aquí y cambian todas a la vez.
            </>
          }
        >
          <fieldset>
            <legend className="sr-only">Proveedor predeterminado</legend>
            <div className="divide-y divide-border-soft">
              {PROVIDERS.map((provider) => {
                const meta = PROVIDER_META[provider];
                const selected = preferredProvider === provider;
                const health = healthOf(provider);
                return (
                  <label
                    key={provider}
                    className={`flex cursor-pointer items-start gap-3.5 px-5 py-3.5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand ${
                      selected ? "bg-accent/60" : "hover:bg-hover"
                    }`}
                  >
                    <input
                      type="radio"
                      name="preferred-provider"
                      value={provider}
                      checked={selected}
                      onChange={() => choosePreferred(provider)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={`mt-0.5 grid size-[18px] flex-none place-items-center rounded-full border-[1.5px] transition-colors duration-150 ${
                        selected ? "border-brand" : "border-ink-faint"
                      }`}
                    >
                      <span className={`size-2 rounded-full bg-brand transition-transform duration-150 ${selected ? "scale-100" : "scale-0"}`} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold tracking-tight text-ink">{meta.label}</span>
                        {fallbackProvider === provider && (
                          <span className="rounded-md border border-border px-1.5 py-px text-[10.5px] font-medium text-ink-soft">Respaldo</span>
                        )}
                      </span>
                      <span className="text-[12.5px] leading-[1.45] text-ink-soft">
                        {meta.credential}. {meta.cost}
                      </span>
                      {health && health.state !== "ok" && (
                        <span className="mt-1 text-[12px] leading-[1.45] font-medium text-negative">{describeProviderHealth(health).long}</span>
                      )}
                    </span>
                    <ProviderStatePill check={checks[provider]} health={health} idleLabel={idleLabel(provider)} />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border-soft bg-background/60 px-5 py-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="pref-fallback" className={labelClass}>
                Si {PROVIDER_META[preferredProvider].label} falla, reintentar con
              </label>
              <select
                id="pref-fallback"
                value={fallbackProvider}
                onChange={(e) => {
                  setFallbackProvider(e.target.value as ProviderId | "");
                  setPreferenceSavedAt(null);
                }}
                className={`${fieldClass} w-[240px] max-w-full`}
              >
                <option value="">Nadie (detener y avisar)</option>
                {PROVIDERS.filter((p) => p !== preferredProvider).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_META[p].label}
                  </option>
                ))}
              </select>
              <p className="max-w-[48ch] text-[12px] leading-[1.45] text-ink-soft">
                {fallbackProvider
                  ? `Cada generación que falle (sin tokens, timeout) se repite una vez con ${PROVIDER_META[fallbackProvider].label} y gasta de esa cuenta.`
                  : "Si se queda sin tokens, las automatizaciones se detienen y te avisamos en la campanita."}
              </p>
            </div>
            <div className="flex flex-none items-center gap-3">
              {preferenceSavedAt && !preferenceDirty && <span className="text-[12px] font-medium text-positive">Guardado</span>}
              <button
                type="button"
                onClick={savePreference}
                disabled={savingPreference || !preferenceDirty}
                className="rounded-[10px] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-50 disabled:shadow-none"
              >
                {savingPreference ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
          {preferenceError && <p className="px-5 pb-4 text-[12px] font-medium text-negative">{preferenceError}</p>}
        </Section>

        <Section
          title="Conexiones"
          description="Credenciales de cada proveedor. “Probar conexión” hace la misma llamada mínima que una generación real, para saber si de verdad va a funcionar."
        >
          <div className="divide-y divide-border-soft">
            {PROVIDERS.map((provider) => {
              const meta = PROVIDER_META[provider];
              const isDefault = savedPreferred === provider;
              const isFallback = savedFallback === provider;
              return (
                <div key={provider} className="flex items-start gap-4 p-5">
                  <span className="grid size-9 flex-none place-items-center rounded-full border border-border-soft bg-background text-ink-soft">
                    <Icon d={meta.icon} size={16} strokeWidth={1.6} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="flex flex-wrap items-center gap-2 text-[14px] font-semibold tracking-tight">
                          {meta.label}
                          {isDefault && <span className="rounded-md bg-accent px-1.5 py-px text-[10.5px] font-semibold text-accent-fg">Predeterminado</span>}
                          {isFallback && (
                            <span className="rounded-md border border-border px-1.5 py-px text-[10.5px] font-medium text-ink-soft">Respaldo</span>
                          )}
                        </h3>
                        <p className="mt-0.5 max-w-[60ch] text-[12.5px] leading-[1.45] text-ink-soft">
                          {provider === "openai" ? (
                            <>
                              Pega aquí la key en vez de editar{" "}
                              <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">apps/api/.env</code> a mano.
                            </>
                          ) : (
                            `Corre con la ${meta.credential.toLowerCase()}, sin key que guardar. Si falla, revisa que la sesión del CLI siga iniciada.`
                          )}
                        </p>
                      </div>
                      <ProviderStatePill check={checks[provider]} health={healthOf(provider)} idleLabel={idleLabel(provider)} />
                    </div>

                    {provider === "openai" && (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="password"
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            placeholder={status.openaiApiKeySet ? "Pegar una nueva key para reemplazarla" : "sk-…"}
                            aria-label="API key de OpenAI"
                            className={`${fieldClass} max-w-[320px] min-w-[200px] flex-1`}
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() => save(keyInput)}
                            disabled={saving || !keyInput}
                            className="flex-none rounded-[10px] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-50 disabled:shadow-none"
                          >
                            {saving ? "Guardando…" : "Guardar key"}
                          </button>
                          {status.openaiApiKeySet && (
                            <button
                              type="button"
                              onClick={() => save(null)}
                              disabled={saving}
                              className="flex-none rounded-[10px] border border-border bg-card px-3.5 py-2.5 text-[13px] font-medium text-negative transition-colors hover:border-negative disabled:cursor-default disabled:opacity-60"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                        {error && <p className="text-[12px] font-medium text-negative">{error}</p>}
                      </div>
                    )}

                    <ConnectionCheck state={checks[provider]} onCheck={() => checkConnection(provider)} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}
