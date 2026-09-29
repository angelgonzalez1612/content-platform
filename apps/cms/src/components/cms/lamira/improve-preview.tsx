"use client";

import { useState } from "react";
import type { CheckResult, AiDecision } from "@planazo/types";
import { labelClass } from "@/components/cms/dynamic-field";
import type { ContentBlockValue } from "@/components/cms/content-blocks-field";
import { summarizeBlocks } from "@/components/cms/lamira/content-blocks-util";
import { BlockSelectionList, blockStatus, useBlockSelection } from "@/components/cms/lamira/block-selection";

export interface ImproveResult {
  draft: Record<string, unknown>;
  checksRun: CheckResult[];
  decision: AiDecision;
}

export interface ImproveField {
  /** Identificador para saber si el editor lo eligió (ver ImproveSelection). */
  key?: string;
  label: string;
  current: string;
  improved: string;
  /** Cuerpo por bloques: si viene, se muestra sección por sección y párrafo por
   * párrafo con casillas, en vez del resumen de una línea. */
  blocks?: { current: ContentBlockValue[]; improved: ContentBlockValue[] };
}

/** Lo que el editor dejó marcado al aplicar. */
export interface ImproveSelection {
  /** `key` de los campos de texto marcados. */
  fields: Set<string>;
  /** Bloques del cuerpo con solo los párrafos marcados; `null` = no tocar el cuerpo. */
  blocks: ContentBlockValue[] | null;
}

/** Para los formularios: ¿aplicar este campo? Sin selección (llamada vieja) = sí. */
export function isFieldSelected(selection: ImproveSelection | undefined, key: string): boolean {
  return selection ? selection.fields.has(key) : true;
}

/** Vista de antes/después genérica para el resultado de "Mejorar con IA" —
 * "Aplicar" nunca guarda nada, solo llena el formulario de abajo (ver
 * *-form.tsx). Cada campo y cada párrafo del cuerpo se pueden desmarcar para
 * aplicar solo una parte de lo generado. */
export function ImprovePreview({
  result,
  fields,
  onApply,
  onDiscard,
  onRegenerate,
  regenerating = false,
}: {
  result: ImproveResult;
  fields: ImproveField[];
  onApply: (selection: ImproveSelection) => void;
  onDiscard: () => void;
  // Repite la generación con el mismo proveedor/modo/instrucciones, sin
  // volver a abrir el panel — para probar una alternativa antes de aplicar.
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const textFields = fields.filter((f) => !f.blocks);
  const blockField = fields.find((f) => f.blocks);
  const improvedBlocks = blockField?.blocks?.improved ?? [];

  // Por defecto se marca todo lo que trae algo distinto a lo actual.
  const defaultFields = () => new Set(textFields.filter((f) => f.improved.trim() && f.improved !== f.current).map((f) => f.key ?? f.label));
  const [selectedFields, setSelectedFields] = useState<Set<string>>(defaultFields);
  const selection = useBlockSelection(improvedBlocks, result);
  // "Generar otra vez" trae un resultado nuevo en la misma instancia: la
  // selección de campos anterior ya no aplica, se reinicia (sin useEffect).
  const [selectionFor, setSelectionFor] = useState(result);
  if (selectionFor !== result) {
    setSelectionFor(result);
    setSelectedFields(defaultFields());
  }

  const statuses = improvedBlocks.map((b) => blockStatus(b, blockField?.blocks?.current ?? []));
  const totalParagraphs = selection.total;
  const selectedParagraphs = selection.selected;

  function toggleField(key: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function apply() {
    const blocks = blockField && selectedParagraphs > 0 ? selection.selectedBlocks() : null;
    onApply({ fields: selectedFields, blocks });
  }

  const nothingSelected = selectedFields.size === 0 && (!blockField || selectedParagraphs === 0);

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-brand bg-accent p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-medium tracking-[.1em] text-accent-fg uppercase">Borrador mejorado — elige qué aplicar</span>
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-medium ${
            result.decision === "auto-published" ? "bg-positive/12 text-positive" : "bg-warning/14 text-warning"
          }`}
        >
          {result.decision === "auto-published" ? "Pasa todos los checks" : "Necesita revisión"}
        </span>
      </div>

      {textFields.length > 0 && (
        <div className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-2">
          {textFields.map((f) => {
            const key = f.key ?? f.label;
            const hasImprovement = !!f.improved.trim();
            return (
              <div key={key} className="contents">
                <div>
                  <span className={labelClass}>{f.label} actual</span>
                  <p className="mt-1 line-clamp-6 text-ink-soft">{f.current || "(vacío)"}</p>
                </div>
                <label className={`flex gap-2.5 ${hasImprovement ? "cursor-pointer" : "cursor-default opacity-60"}`}>
                  <input
                    type="checkbox"
                    checked={selectedFields.has(key)}
                    disabled={!hasImprovement}
                    onChange={() => toggleField(key)}
                    className="mt-0.5 size-4 flex-none rounded border-border accent-brand"
                  />
                  <span className="min-w-0">
                    <span className={labelClass}>{f.label} mejorado</span>
                    <span className="mt-1 line-clamp-6 block text-ink">{hasImprovement ? f.improved : "La IA no propuso cambios aquí."}</span>
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      )}

      {blockField && (
        <BlockSelectionList
          selection={selection}
          statuses={statuses}
          title={`${blockField.label} mejorado`}
          hint={<>Actual: {summarizeBlocks(blockField.blocks?.current ?? []) || "(vacío)"}. Desmarca lo que no quieras; lo marcado reemplaza al cuerpo actual.</>}
        />
      )}

      <div className="flex flex-col gap-1.5">
        {result.checksRun.map((c) => (
          <div key={c.name} className="flex items-start gap-2 text-[12px]">
            <span className={c.passed ? "text-positive" : c.blocking ? "text-negative" : "text-warning"}>{c.passed ? "✓" : c.blocking ? "✕" : "△"}</span>
            <span className="text-ink-soft">
              {c.name}
              {c.detail && <span className="text-ink-faint"> — {c.detail}</span>}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-brand/20 pt-4">
        <button
          type="button"
          onClick={apply}
          disabled={regenerating || nothingSelected}
          className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
        >
          {blockField && selectedParagraphs < totalParagraphs && selectedParagraphs > 0 ? "Aplicar lo marcado" : "Aplicar al formulario"}
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
