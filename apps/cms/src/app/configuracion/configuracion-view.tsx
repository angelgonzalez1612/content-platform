"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";

interface AiSettingsStatus {
  openaiApiKeySet: boolean;
  openaiApiKeyPreview: string | null;
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
      const res = await fetch(`${apiConfig.baseUrl}/cms/settings/ai`, {
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
      <div className="mb-5">
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Configuración</h1>
        <p className="text-[13px] text-ink-faint">Credenciales y proveedores de IA usados en Centro IA, Content Radar y Automatizaciones.</p>
      </div>

      <div className="max-w-[640px] rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <h2 className="mb-4 text-[15px] font-semibold tracking-tight">Inteligencia Artificial</h2>

        <div className="flex flex-col gap-2 border-b border-border-soft pb-5">
          <div className="flex items-center justify-between">
            <span className={labelClass}>OpenAI</span>
            <span className={`text-[12px] font-medium ${status.openaiApiKeySet ? "text-positive" : "text-ink-faint"}`}>
              {status.openaiApiKeySet ? `Configurada · termina en ${status.openaiApiKeyPreview}` : "No configurada"}
            </span>
          </div>
          <p className="text-[12px] leading-[1.4] text-ink-faint">
            Se usa cuando una regla de Automatizaciones o una generación de Centro IA elige el proveedor &quot;OpenAI&quot;. Pégala aquí en
            vez de editar <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">apps/api/.env</code> a mano.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={status.openaiApiKeySet ? "Pegar una nueva key para reemplazarla" : "sk-…"}
              className={`${fieldClass} flex-1`}
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
          {error && <p className="text-[12px] font-medium text-negative">{error}</p>}
        </div>

        <div className="flex flex-col gap-1.5 pt-5">
          <span className={labelClass}>Claude / Codex (sesión)</span>
          <p className="text-[12px] leading-[1.4] text-ink-faint">
            No necesitan una key aquí — corren contra la sesión de Claude Code / Codex ya autenticada en esta máquina. Si una regla con
            alguno de estos proveedores falla, revisa que la sesión del CLI siga iniciada en el servidor.
          </p>
        </div>
      </div>
    </div>
  );
}
