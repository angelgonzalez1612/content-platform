"use client";

import type { CheckResult, AiDecision, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";

const CHECK_LABELS: Record<string, string> = {
  completitud: "Completitud de campos",
  "seguridad-hechos": "Seguridad de hechos",
  "seo-titulo": "Título SEO",
  "seo-descripcion": "Descripción SEO",
  "slug-unico": "Slug único",
  "imagen-con-alt": "Imagen con texto alternativo",
  "calidad-longitud": "Longitud del contenido",
};

/** Editable (formularios manuales/edición) cuando se pasa `onChange`; solo
 * lectura (revisión de un borrador de IA) cuando no. `checksRun`/`decision`
 * son opcionales — no todo formulario tiene un resultado de checks todavía. */
export function SeoPanel({
  seo,
  onChange,
  checksRun,
  decision,
}: {
  seo: Seo | null;
  onChange?: (seo: Seo) => void;
  checksRun?: CheckResult[];
  decision?: AiDecision;
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
