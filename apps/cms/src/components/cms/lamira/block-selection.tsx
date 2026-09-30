"use client";

import { useState } from "react";
import type { ContentBlockValue } from "@/components/cms/content-blocks-field";

export type BlockStatus = "nueva" | "modificada" | "igual";

const STATUS_META: Record<BlockStatus, { label: string; className: string }> = {
  nueva: { label: "Nueva", className: "bg-positive/12 text-positive" },
  modificada: { label: "Modificada", className: "bg-warning/14 text-warning" },
  igual: { label: "Sin cambios", className: "bg-hover text-ink-faint" },
};

/** ¿Esta sección es nueva, cambió o quedó igual respecto al cuerpo actual? */
export function blockStatus(block: ContentBlockValue, current: ContentBlockValue[]): BlockStatus {
  const heading = (block.heading ?? "").trim().toLowerCase();
  const same = current.find((c) => (c.heading ?? "").trim().toLowerCase() === heading);
  if (!same) return current.length === 0 || heading ? "nueva" : "modificada";
  return same.paragraphs.join("\n") === block.paragraphs.join("\n") ? "igual" : "modificada";
}

const paragraphKey = (b: number, p: number) => `${b}:${p}`;

/**
 * Qué secciones/párrafos de un conjunto de bloques generados quedaron
 * marcados (todo marcado por defecto). `resetToken`: cuando cambia (p.ej. un
 * resultado nuevo de "Generar otra vez"), la selección vuelve a "todo".
 */
export function useBlockSelection(blocks: ContentBlockValue[], resetToken: unknown) {
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [selectionFor, setSelectionFor] = useState(resetToken);
  if (selectionFor !== resetToken) {
    setSelectionFor(resetToken);
    setExcluded(new Set());
  }

  const keysOfBlock = (b: number): string[] =>
    blocks[b].paragraphs.length === 0 ? [paragraphKey(b, 0)] : blocks[b].paragraphs.map((_, p) => paragraphKey(b, p));
  const total = blocks.reduce((n, b) => n + Math.max(1, b.paragraphs.length), 0);
  const selected = total - excluded.size;

  function toggle(keys: string[], include: boolean) {
    setExcluded((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (include ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  return {
    blocks,
    excluded,
    total,
    selected,
    keysOfBlock,
    toggle,
    toggleAll: () => setExcluded(selected === total ? new Set(blocks.flatMap((_, b) => keysOfBlock(b))) : new Set()),
    /** Bloques con solo los párrafos marcados (sin los que quedaron vacíos); `from` = a partir de qué bloque. */
    selectedBlocks: (from = 0): ContentBlockValue[] =>
      blocks
        .map((block, b) => {
          if (b < from) return null;
          if (block.paragraphs.length === 0) return excluded.has(paragraphKey(b, 0)) ? null : block;
          const paragraphs = block.paragraphs.filter((_, p) => !excluded.has(paragraphKey(b, p)));
          return paragraphs.length > 0 ? { ...block, paragraphs } : null;
        })
        .filter((b): b is ContentBlockValue => b !== null),
  };
}

export type BlockSelection = ReturnType<typeof useBlockSelection>;

/** Lista de secciones con casillas por sección y por párrafo, y "Marcar/Desmarcar todo". */
export function BlockSelectionList({
  selection,
  title,
  hint,
  statuses,
}: {
  selection: BlockSelection;
  title: string;
  hint?: React.ReactNode;
  /** Estado de cada bloque (misma posición); sin él, todas se marcan "Nueva". */
  statuses?: BlockStatus[];
}) {
  const { blocks, excluded, total, selected, keysOfBlock, toggle, toggleAll } = selection;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">{title}</span>
        <span className="flex items-center gap-3 text-[12px]">
          <span className="text-ink-soft tabular-nums">
            {selected} de {total} párrafos marcados
          </span>
          <button type="button" onClick={toggleAll} className="font-medium text-accent-fg hover:underline">
            {selected === total ? "Desmarcar todo" : "Marcar todo"}
          </button>
        </span>
      </div>
      {hint && <p className="text-[12px] text-ink-soft">{hint}</p>}

      <ol className="flex flex-col gap-2">
        {blocks.map((block, b) => {
          const keys = keysOfBlock(b);
          const selectedInBlock = keys.filter((k) => !excluded.has(k)).length;
          const allSelected = selectedInBlock === keys.length;
          const status = STATUS_META[statuses?.[b] ?? "nueva"];
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
                  onChange={() => toggle(keys, !allSelected)}
                  className="mt-0.5 size-4 flex-none rounded border-border accent-brand"
                />
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink">{block.heading?.trim() || "Sección sin título"}</span>
                <span className={`flex-none rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${status.className}`}>{status.label}</span>
                <RemoveToggle removed={selectedInBlock === 0} onToggle={() => toggle(keys, selectedInBlock === 0)} what="sección" />
              </label>
              {block.paragraphs.length > 0 && (
                <ul className="flex flex-col">
                  {block.paragraphs.map((paragraph, p) => {
                    const key = paragraphKey(b, p);
                    const checked = !excluded.has(key);
                    return (
                      <li key={key}>
                        <label className="group flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors hover:bg-hover">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle([key], !checked)}
                            className="mt-0.5 size-4 flex-none rounded border-border accent-brand"
                          />
                          <span className={`min-w-0 flex-1 text-[12.5px] leading-[1.55] ${checked ? "text-ink" : "text-ink-faint line-through"}`}>{paragraph}</span>
                          <RemoveToggle removed={!checked} onToggle={() => toggle([key], !checked)} what="párrafo" subtle />
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
  );
}

/** "Quitar" / "Recuperar" explícito (mismo efecto que la casilla, pero más claro). */
function RemoveToggle({ removed, onToggle, what, subtle = false }: { removed: boolean; onToggle: () => void; what: string; subtle?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault(); // dentro de un <label>: que no cambie también la casilla
        onToggle();
      }}
      title={removed ? `Recuperar este ${what}` : `Quitar este ${what}`}
      className={`flex flex-none items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
        removed
          ? "text-accent-fg hover:bg-accent"
          : `text-ink-faint hover:bg-negative/10 hover:text-negative ${subtle ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100" : ""}`
      }`}
    >
      {removed ? (
        "↺ Recuperar"
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
          Quitar
        </>
      )}
    </button>
  );
}
