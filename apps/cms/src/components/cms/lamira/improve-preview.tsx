"use client";

import type { CheckResult, AiDecision } from "@planazo/types";
import { labelClass } from "@/components/cms/dynamic-field";

export interface ImproveResult {
  draft: Record<string, unknown>;
  checksRun: CheckResult[];
  decision: AiDecision;
}

/** Vista de antes/después genérica para el resultado de "Mejorar con IA" en
 * los 6 tipos de la-mira — misma UI que place-edit-form.tsx tenía inline,
 * generalizada a una lista de campos en vez de solo `description`. "Aplicar"
 * nunca guarda nada, solo llena el formulario de abajo (ver *-form.tsx). */
export function ImprovePreview({
  result,
  fields,
  onApply,
  onDiscard,
  onRegenerate,
  regenerating = false,
}: {
  result: ImproveResult;
  fields: { label: string; current: string; improved: string }[];
  onApply: () => void;
  onDiscard: () => void;
  // Repite la generación con el mismo proveedor/modo/instrucciones, sin
  // volver a abrir el panel — para probar una alternativa antes de aplicar.
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-brand bg-accent p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-medium tracking-[.1em] text-accent-fg uppercase">Borrador mejorado — revisa antes de aplicar</span>
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-medium ${
            result.decision === "auto-published" ? "bg-[#EAF7EF] text-[#2E9E5B]" : "bg-[#FEF6E7] text-[#9A6B12]"
          }`}
        >
          {result.decision === "auto-published" ? "Pasa todos los checks" : "Necesita revisión"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="contents">
            <div>
              <span className={labelClass}>{f.label} actual</span>
              <p className="mt-1 line-clamp-6 text-ink-soft">{f.current || "(vacío)"}</p>
            </div>
            <div>
              <span className={labelClass}>{f.label} mejorado</span>
              <p className="mt-1 line-clamp-6 text-ink">{f.improved || "—"}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {result.checksRun.map((c) => (
          <div key={c.name} className="flex items-start gap-2 text-[12px]">
            <span className={c.passed ? "text-[#2E9E5B]" : c.blocking ? "text-[#C4453A]" : "text-[#9A6B12]"}>{c.passed ? "✓" : c.blocking ? "✕" : "△"}</span>
            <span className="text-ink-soft">
              {c.name}
              {c.detail && <span className="text-ink-faint"> — {c.detail}</span>}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[#FFE2CC] pt-4">
        <button
          type="button"
          onClick={onApply}
          disabled={regenerating}
          className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-pressed disabled:cursor-default disabled:opacity-70"
        >
          Aplicar al formulario
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:cursor-default disabled:opacity-70"
          >
            {regenerating ? "Generando…" : "Generar otra vez"}
          </button>
        )}
        <button type="button" onClick={onDiscard} disabled={regenerating} className="text-[13px] font-medium text-ink-soft hover:text-brand disabled:cursor-default disabled:opacity-70">
          Descartar
        </button>
      </div>
      <p className="text-[11.5px] text-ink-faint">Aplicar solo llena el formulario de abajo — nada se guarda hasta que presiones &quot;Guardar cambios&quot;.</p>
    </div>
  );
}
