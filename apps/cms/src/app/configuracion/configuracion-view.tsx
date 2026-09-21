"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { Icon } from "@/components/icon";
import type { AiSettingsStatus, AiProviderId } from "@/lib/cms-api";

type ProviderId = AiProviderId;

const PROVIDER_LABEL: Record<ProviderId, string> = {
  openai: "OpenAI",
  "claude-cli": "Claude",
  "codex-cli": "Codex",
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

// API key pegada a mano — se guarda/revoca desde aquí en vez de editar
// apps/api/.env directo.
const LOCK_ICON = "M6 11V8a6 6 0 0 1 12 0v3M5 11h14a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a1 1 0 0 1 1-1z";
// Corre contra una sesión de CLI ya autenticada en este servidor — mismo
// glyph para Claude y Codex a propósito: es el mismo tipo de credencial
// (sesión, no key), así que comparten el mismo icono.
const TERMINAL_ICON = "M4 5l6 6-6 6M12 19h8";

// Mismos pares bg/fg que StatusBadge (status-badge.tsx) — "positive"/"negative"
// para un estado ya verificado con una prueba real, "neutral" para uno
// puramente informativo (nunca implica una verificación que no se hizo).
const PILL_STYLE = {
  positive: { bg: "#EAF7EF", fg: "#2E9E5B" },
  negative: { bg: "#FDECEA", fg: "#C4453A" },
  neutral: { bg: "#F3F0EC", fg: "#5C564F" },
} as const;

function Pill({ tone, children }: { tone: keyof typeof PILL_STYLE; children: React.ReactNode }) {
  const s = PILL_STYLE[tone];
  return (
    <span
      className="inline-flex flex-none items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {children}
    </span>
  );
}

function ProviderIcon({ d }: { d: string }) {
  return (
    <span className="grid size-9 flex-none place-items-center rounded-full border border-border-soft bg-background text-ink-soft">
      <Icon d={d} size={16} strokeWidth={1.6} />
    </span>
  );
}

// Fila de "Probar conexión" — una llamada real y barata al proveedor
// (models.list() en OpenAI, un prompt trivial en las CLI), nunca un chequeo
// automático (cada corrida gasta una llamada real), así que el resultado
// solo existe después de que el editor lo pide a propósito.
function ConnectionCheck({ state, onCheck }: { state: CheckState; onCheck: () => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={onCheck}
        disabled={state.loading}
        className="flex-none rounded-[10px] border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-faint disabled:cursor-default disabled:opacity-60"
      >
        {state.loading ? "Probando…" : "Probar conexión"}
      </button>
      {state.result && (
        <span className={`text-[12px] leading-[1.4] font-medium ${state.result.ok ? "text-positive" : "text-negative"}`}>
          {state.result.ok ? "✓" : "✕"} {state.result.detail}
        </span>
      )}
    </div>
  );
}

export function ConfiguracionView({ initialAiSettings }: { initialAiSettings: AiSettingsStatus }) {
  const [status, setStatus] = useState(initialAiSettings);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState(EMPTY_CHECKS);
  const [preferredProvider, setPreferredProvider] = useState<ProviderId | "">(initialAiSettings.preferredProvider ?? "");
  const [fallbackProvider, setFallbackProvider] = useState<ProviderId | "">(initialAiSettings.fallbackProvider ?? "");
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferenceSavedAt, setPreferenceSavedAt] = useState<number | null>(null);
  const [preferenceError, setPreferenceError] = useState("");

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
      setStatus(await res.json());
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

  async function savePreference(next: { preferredProvider: ProviderId | ""; fallbackProvider: ProviderId | "" }) {
    setSavingPreference(true);
    setPreferenceError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/settings/ai/preference`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredProvider: next.preferredProvider || null,
          fallbackProvider: next.fallbackProvider || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setPreferenceError(body?.message ?? "No se pudo guardar.");
        return;
      }
      setStatus(await res.json());
      setPreferenceSavedAt(Date.now());
    } catch {
      setPreferenceError("No se pudo conectar con el servidor.");
    } finally {
      setSavingPreference(false);
    }
  }

  // Antes de probar, cada proveedor muestra su pill puramente informativa de
  // siempre (OpenAI: si hay key guardada; Claude/Codex: que corren por
  // sesión) — después de un "Probar conexión", el resultado real manda.
  function statusPill(provider: ProviderId, fallback: { tone: keyof typeof PILL_STYLE; label: string }) {
    const check = checks[provider];
    if (check.result) {
      return <Pill tone={check.result.ok ? "positive" : "negative"}>{check.result.ok ? "Conectado" : "Error de conexión"}</Pill>;
    }
    return <Pill tone={fallback.tone}>{fallback.label}</Pill>;
  }

  return (
    <div className="p-[26px] pb-[60px]">
      <div className="mb-6">
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Configuración</h1>
        <p className="text-[13px] text-ink-faint">Credenciales y proveedores de IA usados en Centro IA, Content Radar y Automatizaciones.</p>
      </div>

      <div className="max-w-[720px] overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="border-b border-border-soft px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight">Proveedores de IA</h2>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            Cada regla de Automatizaciones y cada generación de Centro IA elige uno de estos al correr — &quot;Probar conexión&quot; hace
            la misma llamada mínima que haría una generación real, para saber de un vistazo si de verdad va a funcionar.
          </p>
        </div>

        <div className="flex items-start gap-4 border-b border-border-soft p-5">
          <ProviderIcon d={LOCK_ICON} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold tracking-tight">OpenAI</h3>
              {statusPill("openai", {
                tone: status.openaiApiKeySet ? "positive" : "neutral",
                label: status.openaiApiKeySet ? `Configurada · termina en ${status.openaiApiKeyPreview}` : "No configurada",
              })}
            </div>
            <p className="mt-1 max-w-[52ch] text-[12.5px] leading-[1.5] text-ink-soft">
              Se usa cuando una regla o una generación elige el proveedor &quot;OpenAI&quot;. Pégala aquí en vez de editar{" "}
              <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">apps/api/.env</code> a mano.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={status.openaiApiKeySet ? "Pegar una nueva key para reemplazarla" : "sk-…"}
                className={`${fieldClass} max-w-[320px] flex-1`}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => save(keyInput)}
                disabled={saving || !keyInput}
                className="flex-none rounded-[10px] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar"}
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
            {error && <p className="mt-2 text-[12px] font-medium text-negative">{error}</p>}

            <ConnectionCheck state={checks.openai} onCheck={() => checkConnection("openai")} />
          </div>
        </div>

        <div className="flex items-start gap-4 border-b border-border-soft p-5">
          <ProviderIcon d={TERMINAL_ICON} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold tracking-tight">Claude (sesión)</h3>
              {statusPill("claude-cli", { tone: "neutral", label: "Sesión del servidor" })}
            </div>
            <p className="mt-1 max-w-[52ch] text-[12.5px] leading-[1.5] text-ink-soft">
              No necesita key aquí — corre contra la sesión de Claude Code ya autenticada en esta máquina. Si una regla con este proveedor
              falla, revisa que la sesión del CLI siga iniciada en el servidor.
            </p>

            <ConnectionCheck state={checks["claude-cli"]} onCheck={() => checkConnection("claude-cli")} />
          </div>
        </div>

        <div className="flex items-start gap-4 p-5">
          <ProviderIcon d={TERMINAL_ICON} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold tracking-tight">Codex (sesión)</h3>
              {statusPill("codex-cli", { tone: "neutral", label: "Sesión del servidor" })}
            </div>
            <p className="mt-1 max-w-[52ch] text-[12.5px] leading-[1.5] text-ink-soft">
              Igual que Claude — corre contra la sesión de Codex ya autenticada en esta máquina, sin key que guardar aquí.
            </p>

            <ConnectionCheck state={checks["codex-cli"]} onCheck={() => checkConnection("codex-cli")} />
          </div>
        </div>
      </div>

      <div className="mt-5 max-w-[720px] overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="border-b border-border-soft px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight">Preferencia de redacción</h2>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            Si el proveedor preferido falla al generar (sesión caída, límite alcanzado, timeout), se reintenta una vez con el de respaldo
            antes de fallar del todo. Sin preferencia, cada pantalla usa el proveedor que elijas ahí, sin reintento automático.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3 p-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pref-preferred" className={labelClass}>
              Preferido
            </label>
            <select
              id="pref-preferred"
              value={preferredProvider}
              onChange={(e) => {
                const next = e.target.value as ProviderId | "";
                setPreferredProvider(next);
                if (next === fallbackProvider) setFallbackProvider("");
                setPreferenceSavedAt(null);
              }}
              className={`${fieldClass} min-w-[170px]`}
            >
              <option value="">Sin preferencia</option>
              <option value="codex-cli">Codex</option>
              <option value="claude-cli">Claude</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pref-fallback" className={labelClass}>
              Respaldo si falla
            </label>
            <select
              id="pref-fallback"
              value={fallbackProvider}
              onChange={(e) => {
                setFallbackProvider(e.target.value as ProviderId | "");
                setPreferenceSavedAt(null);
              }}
              disabled={!preferredProvider}
              className={`${fieldClass} min-w-[170px] disabled:cursor-default disabled:opacity-50`}
            >
              <option value="">Sin respaldo</option>
              {(["openai", "claude-cli", "codex-cli"] as ProviderId[])
                .filter((p) => p !== preferredProvider)
                .map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABEL[p]}
                  </option>
                ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => savePreference({ preferredProvider, fallbackProvider })}
            disabled={savingPreference}
            className="flex-none rounded-[10px] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
          >
            {savingPreference ? "Guardando…" : "Guardar"}
          </button>
          {preferenceSavedAt && <span className="font-mono text-[12px] text-positive">Guardado ✓</span>}
        </div>
        {preferenceError && <p className="px-5 pb-4 text-[12px] font-medium text-negative">{preferenceError}</p>}
      </div>
    </div>
  );
}
