"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { Icon } from "@/components/icon";

interface AiSettingsStatus {
  openaiApiKeySet: boolean;
  openaiApiKeyPreview: string | null;
}

// API key pegada a mano — se guarda/revoca desde aquí en vez de editar
// apps/api/.env directo.
const LOCK_ICON = "M6 11V8a6 6 0 0 1 12 0v3M5 11h14a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a1 1 0 0 1 1-1z";
// Corre contra una sesión de CLI ya autenticada en este servidor — mismo
// glyph para Claude y Codex a propósito: es el mismo tipo de credencial
// (sesión, no key), así que comparten el mismo icono.
const TERMINAL_ICON = "M4 5l6 6-6 6M12 19h8";

// Mismos pares bg/fg que StatusBadge (status-badge.tsx) — "positive" para un
// estado verificado, "neutral" para uno informativo (nunca implica una
// verificación que no se hizo, ver comentario en la fila de sesión abajo).
const PILL_STYLE = {
  positive: { bg: "#EAF7EF", fg: "#2E9E5B" },
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

export function ConfiguracionView({ initialAiSettings }: { initialAiSettings: AiSettingsStatus }) {
  const [status, setStatus] = useState(initialAiSettings);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-[26px] pb-[60px]">
      <div className="mb-6">
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Configuración</h1>
        <p className="text-[13px] text-ink-faint">Credenciales y proveedores de IA usados en Centro IA, Content Radar y Automatizaciones.</p>
      </div>

      <div className="max-w-[720px] overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="border-b border-border-soft px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight">Proveedores de IA</h2>
          <p className="mt-0.5 text-[12px] text-ink-faint">Cada regla de Automatizaciones y cada generación de Centro IA elige uno de estos al correr.</p>
        </div>

        {/* OpenAI — única fila con acción real (guardar/quitar key); las
            otras dos son informativas porque no hay nada que configurar
            aquí (corren contra la sesión del servidor). */}
        <div className="flex items-start gap-4 border-b border-border-soft p-5">
          <ProviderIcon d={LOCK_ICON} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold tracking-tight">OpenAI</h3>
              <Pill tone={status.openaiApiKeySet ? "positive" : "neutral"}>
                {status.openaiApiKeySet ? `Configurada · termina en ${status.openaiApiKeyPreview}` : "No configurada"}
              </Pill>
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
                  className="flex-none rounded-[10px] border border-border bg-white px-3.5 py-2.5 text-[13px] font-medium text-negative transition-colors hover:border-negative disabled:cursor-default disabled:opacity-60"
                >
                  Quitar
                </button>
              )}
            </div>
            {error && <p className="mt-2 text-[12px] font-medium text-negative">{error}</p>}
          </div>
        </div>

        <div className="flex items-start gap-4 border-b border-border-soft p-5">
          <ProviderIcon d={TERMINAL_ICON} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold tracking-tight">Claude (sesión)</h3>
              <Pill tone="neutral">Sesión del servidor</Pill>
            </div>
            <p className="mt-1 max-w-[52ch] text-[12.5px] leading-[1.5] text-ink-soft">
              No necesita key aquí — corre contra la sesión de Claude Code ya autenticada en esta máquina. Si una regla con este proveedor
              falla, revisa que la sesión del CLI siga iniciada en el servidor.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-5">
          <ProviderIcon d={TERMINAL_ICON} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold tracking-tight">Codex (sesión)</h3>
              <Pill tone="neutral">Sesión del servidor</Pill>
            </div>
            <p className="mt-1 max-w-[52ch] text-[12.5px] leading-[1.5] text-ink-soft">
              Igual que Claude — corre contra la sesión de Codex ya autenticada en esta máquina, sin key que guardar aquí.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
