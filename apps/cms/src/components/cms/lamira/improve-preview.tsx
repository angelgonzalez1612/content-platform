"use client";

import { useState } from "react";
import type { CheckResult, AiDecision } from "@planazo/types";
import { labelClass } from "@/components/cms/dynamic-field";
import type { ContentBlockValue } from "@/components/cms/content-blocks-field";
import { summarizeBlocks } from "@/components/cms/lamira/content-blocks-util";

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

type BlockStatus = "nueva" | "modificada" | "igual";

const STATUS_META: Record<BlockStatus, { label: string; className: string }> = {
  nueva: { label: "Nueva", className: "bg-positive/12 text-positive" },
  modificada: { label: "Modificada", className: "bg-warning/14 text-warning" },
  igual: { label: "Sin cambios", className: "bg-hover text-ink-faint" },
};

function blockStatus(block: ContentBlockValue, current: ContentBlockValue[]): BlockStatus {
  const heading = (block.heading ?? "").trim().toLowerCase();
  const same = current.find((c) => (c.heading ?? "").trim().toLowerCase() === heading);
  if (!same) return current.length === 0 || heading ? "nueva" : "modificada";
  return same.paragraphs.join("\n") === block.paragraphs.join("\n") ? "igual" : "modificada";
}

const paragraphKey = (b: number, p: number) => `${b}:${p}`;

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
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  // "Generar otra vez" trae un resultado nuevo en la misma instancia: la
  // selección anterior ya no aplica, se reinicia (sin useEffect, en render).
  const [selectionFor, setSelectionFor] = useState(result);
  if (selectionFor !== result) {
    setSelectionFor(result);
    setSelectedFields(defaultFields());
    setExcluded(new Set());
  }

  const statuses = improvedBlocks.map((b) => blockStatus(b, blockField?.blocks?.current ?? []));

  const totalParagraphs = improvedBlocks.reduce((n, b) => n + Math.max(1, b.paragraphs.length), 0);
  const selectedParagraphs = totalParagraphs - excluded.size;

  function toggleField(key: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function keysOfBlock(b: number): string[] {
    const count = improvedBlocks[b].paragraphs.length;
    return count === 0 ? [paragraphKey(b, 0)] : improvedBlocks[b].paragraphs.map((_, p) => paragraphKey(b, p));
  }

  function toggleKeys(keys: string[], include: boolean) {
    setExcluded((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (include ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  function apply() {
    let blocks: ContentBlockValue[] | null = null;
    if (blockField && selectedParagraphs > 0) {
      blocks = improvedBlocks
        .map((block, b) => {
          if (block.paragraphs.length === 0) return excluded.has(paragraphKey(b, 0)) ? null : block;
          const paragraphs = block.paragraphs.filter((_, p) => !excluded.has(paragraphKey(b, p)));
          return paragraphs.length > 0 ? { ...block, paragraphs } : null;
        })
        .filter((b): b is ContentBlockValue => b !== null);
    }
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
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className={labelClass}>{blockField.label} mejorado</span>
            <span className="flex items-center gap-3 text-[12px]">
              <span className="text-ink-soft tabular-nums">
                {selectedParagraphs} de {totalParagraphs} párrafos marcados
              </span>
              <button
                type="button"
                onClick={() => setExcluded(selectedParagraphs === totalParagraphs ? new Set(improvedBlocks.flatMap((_, b) => keysOfBlock(b))) : new Set())}
                className="font-medium text-accent-fg hover:underline"
              >
                {selectedParagraphs === totalParagraphs ? "Desmarcar todo" : "Marcar todo"}
              </button>
            </span>
          </div>
          <p className="text-[12px] text-ink-soft">
            Actual: {summarizeBlocks(blockField.blocks?.current ?? []) || "(vacío)"}. Desmarca lo que no quieras; lo marcado reemplaza al cuerpo actual.
          </p>

          <ol className="flex flex-col gap-2">
            {improvedBlocks.map((block, b) => {
              const keys = keysOfBlock(b);
              const selectedInBlock = keys.filter((k) => !excluded.has(k)).length;
              const allSelected = selectedInBlock === keys.length;
              const status = STATUS_META[statuses[b]];
              return (
                <li
                  key={b}
                  className={`rounded-[10px] border bg-card transition-opacity duration-150 ${selectedInBlock === 0 ? "border-border-soft opacity-60" : "border-border"}`}
                >
                  <label className="flex cursor-pointer items-start gap-2.5 border-b border-border-soft px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedInBlock > 0 && !allSelected;
                      }}
                      onChange={() => toggleKeys(keys, !allSelected)}
                      className="mt-0.5 size-4 flex-none rounded border-border accent-brand"
                    />
                    <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink">{block.heading?.trim() || "Sección sin título"}</span>
                    <span className={`flex-none rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${status.className}`}>{status.label}</span>
                  </label>
                  {block.paragraphs.length > 0 && (
                    <ul className="flex flex-col">
                      {block.paragraphs.map((paragraph, p) => {
                        const key = paragraphKey(b, p);
                        const checked = !excluded.has(key);
                        return (
                          <li key={key}>
                            <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors hover:bg-hover">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleKeys([key], !checked)}
                                className="mt-0.5 size-4 flex-none rounded border-border accent-brand"
                              />
                              <span className={`text-[12.5px] leading-[1.55] ${checked ? "text-ink" : "text-ink-faint line-through"}`}>{paragraph}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
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
