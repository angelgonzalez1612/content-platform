"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import type { CheckResult, AiDecision } from "@planazo/types";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

type ProviderId = "openai" | "claude-cli";

const PROVIDERS: Array<{ id: ProviderId; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "claude-cli", label: "Claude (tu sesión)" },
];

interface ImproveResult {
  draft: Record<string, unknown>;
  checksRun: CheckResult[];
  decision: AiDecision;
}

/** "Mejorar" nunca sobreescribe directo — solo pide el borrador al agente y
 * lo entrega al componente padre para que el humano decida si lo aplica. */
export function ImproveWithAiPanel({
  placeId,
  expanded,
  onToggle,
  onResult,
}: {
  placeId: string;
  expanded: boolean;
  onToggle: () => void;
  onResult: (result: ImproveResult) => void;
}) {
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleImprove() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/ai/improve/place/${placeId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, instructions: instructions || undefined }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar la mejora.");
        return;
      }

      onResult(await res.json());
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-[13.5px] font-semibold">
          <Icon d={SPARK_ICON} size={15} strokeWidth={1.8} className="text-brand" />
          Mejorar con IA
        </span>
        <span className="text-[12px] text-ink-faint">{expanded ? "Cerrar" : "Abrir"}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-border-soft p-5">
          <p className="text-[12.5px] leading-[1.5] text-ink-soft">
            El agente reescribe la descripción y el SEO para mejorar texto genérico o ambiguo — nunca cambia
            dirección, teléfono, precio ni otros datos verificables sin que tú lo apruebes.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Proveedor de IA</span>
            <div className="flex gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors ${
                    provider === p.id ? "border-brand bg-accent" : "border-border bg-white hover:border-ink-faint"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="improve-instructions" className={labelClass}>
              Instrucciones (opcional)
            </label>
            <textarea
              id="improve-instructions"
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="ej. hazla más atractiva para familias con niños"
              className={`${fieldClass} resize-none`}
            />
          </div>

          {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

          <button
            type="button"
            onClick={handleImprove}
            disabled={loading}
            className="flex items-center justify-center gap-2 self-start rounded-[10px] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-70"
          >
            {loading ? (
              <>
                <Icon d={SPARK_ICON} size={14} strokeWidth={1.8} className="animate-spin" />
                Generando… {provider === "claude-cli" && "(puede tardar ~30s)"}
              </>
            ) : (
              "Generar mejora"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
