"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import type { CheckResult, AiDecision, Seo } from "@planazo/types";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { useOpenAiAvailable } from "@/lib/use-openai-available";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

type ProviderId = "openai" | "claude-cli" | "codex-cli";

const PROVIDERS: Array<{ id: ProviderId; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "claude-cli", label: "Claude (tu sesión)" },
  { id: "codex-cli", label: "Codex (tu sesión)" },
];

const CHECK_LABELS: Record<string, string> = {
  completitud: "Completitud de campos",
  "seguridad-hechos": "Seguridad de hechos",
  "seo-titulo": "Título SEO",
  "seo-descripcion": "Descripción SEO",
  "slug-unico": "Slug único",
  "imagen-con-alt": "Imagen con texto alternativo",
  "calidad-longitud": "Longitud del contenido",
};

/** "Generar SEO" — para cuando título/descripción SEO todavía están vacíos
 * (contenido creado a mano, o un tipo sin flujo de "Generar borrador"). Mismo
 * principio que el resto de los botones de IA del CMS: nunca sobreescribe
 * directo, muestra el resultado para aplicar o descartar. */
function GenerateSeoButton({ contentTitle, contentContext, onApply }: { contentTitle: string; contentContext?: string; onApply: (seo: Seo) => void }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Seo | null>(null);
  const openaiAvailable = useOpenAiAvailable();
  const providers = PROVIDERS.filter((p) => p.id !== "openai" || openaiAvailable === true);
  const effectiveProvider = openaiAvailable === false && provider === "openai" ? "claude-cli" : provider;

  async function handleGenerate() {
    if (!contentTitle.trim()) {
      setError("Escribe primero el título/nombre de arriba — la IA lo necesita para generar el SEO.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/generate-seo`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: effectiveProvider,
          contentTitle,
          contentContext: contentContext || undefined,
          instructions: instructions || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar.");
        return;
      }
      setResult(await res.json());
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!result) return;
    onApply(result);
    setResult(null);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 self-start text-[12px] font-semibold text-brand hover:text-brand-pressed"
      >
        <Icon d={SPARK_ICON} size={12} strokeWidth={1.8} />
        {open ? "Cerrar generador" : "Generar SEO"}
      </button>

      {open && (
        <div className="flex flex-col gap-2.5 rounded-[10px] border border-border-soft bg-card p-3">
          <div className="flex gap-1.5">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={`flex-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                  provider === p.id ? "border-brand bg-accent" : "border-border bg-card hover:border-ink-faint"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <textarea
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instrucciones (opcional) — ej. enfócalo en CDMX"
            className={`${fieldClass} resize-none text-[12px]`}
          />

          {error && <p className="rounded-lg bg-[#FDECEA] px-2.5 py-1.5 text-[12px] font-medium text-[#C4453A]">{error}</p>}

          {result ? (
            <div className="flex flex-col gap-2 rounded-[8px] border border-border-soft bg-background p-2.5">
              <p className="text-[12px] font-semibold">{result.title}</p>
              <p className="text-[12px] leading-[1.5] text-ink-soft">{result.description}</p>
              <div className="flex gap-2">
                <button type="button" onClick={handleApply} className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-pressed">
                  Aplicar
                </button>
                <button type="button" onClick={() => setResult(null)} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:text-negative">
                  Descartar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 self-start rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-70"
            >
              {loading ? "Generando…" : "Generar título y descripción"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Editable (formularios manuales/edición) cuando se pasa `onChange`; solo
 * lectura (revisión de un borrador de IA) cuando no. `checksRun`/`decision`
 * son opcionales — no todo formulario tiene un resultado de checks todavía.
 * `contentTitle`/`contentContext` alimentan el botón "Generar SEO" — solo
 * hace falta cuando `onChange` está presente. */
export function SeoPanel({
  seo,
  onChange,
  checksRun,
  decision,
  contentTitle,
  contentContext,
}: {
  seo: Seo | null;
  onChange?: (seo: Seo) => void;
  checksRun?: CheckResult[];
  decision?: AiDecision;
  contentTitle?: string;
  contentContext?: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-border-soft bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">SEO</span>
        {decision && (
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-medium tracking-[.03em] ${
              decision === "auto-published" ? "bg-[#EAF7EF] text-[#2E9E5B]" : "bg-[#FEF6E7] text-[#9A6B12]"
            }`}
          >
            {decision === "auto-published" ? "Pasa todos los checks" : "Necesita revisión"}
          </span>
        )}
      </div>

      {onChange ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="seo-title" className={labelClass}>
              Título SEO
            </label>
            <input
              id="seo-title"
              value={seo?.title ?? ""}
              onChange={(e) => onChange({ ...seo, title: e.target.value })}
              maxLength={60}
              className={fieldClass}
            />
            <span className="font-mono text-[10.5px] text-ink-faint">{(seo?.title ?? "").length}/60</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="seo-description" className={labelClass}>
              Descripción SEO
            </label>
            <textarea
              id="seo-description"
              rows={2}
              value={seo?.description ?? ""}
              onChange={(e) => onChange({ ...seo, description: e.target.value })}
              className={`${fieldClass} resize-none`}
            />
            <span className="font-mono text-[10.5px] text-ink-faint">{(seo?.description ?? "").length} caracteres (120-160 sugerido)</span>
          </div>

          <GenerateSeoButton contentTitle={contentTitle ?? ""} contentContext={contentContext} onApply={onChange} />
        </>
      ) : (
        <>
          <div>
            <span className={labelClass}>Título SEO</span>
            <p className="mt-1 text-[13.5px] text-ink">{seo?.title || "—"}</p>
          </div>
          <div>
            <span className={labelClass}>Descripción SEO</span>
            <p className="mt-1 text-[13.5px] text-ink">{seo?.description || "—"}</p>
          </div>
        </>
      )}

      {checksRun && checksRun.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border-soft pt-3">
          {checksRun.map((check) => (
            <div key={check.name} className="flex items-start gap-2 text-[12.5px]">
              <span className={check.passed ? "text-[#2E9E5B]" : check.blocking ? "text-[#C4453A]" : "text-[#9A6B12]"}>
                {check.passed ? "✓" : check.blocking ? "✕" : "△"}
              </span>
              <span className="text-ink-soft">
                {CHECK_LABELS[check.name] ?? check.name}
                {check.detail && <span className="text-ink-faint"> — {check.detail}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
