"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { RichTextarea } from "@/components/cms/rich-textarea";
import { ImageSearchPicker } from "@/components/cms/lamira/image-search-picker";

export interface ContentBlockValue {
  heading: string | null;
  paragraphs: string[];
  // Imagen embebida en este bloque (opcional) — mismo shape {url, credit} que
  // la imagen principal del artículo, elegida por búsqueda o URL manual,
  // NUNCA generada por la IA.
  image?: { url: string; credit: string } | null;
}

/** Editor del cuerpo de noticias/reportajes/guías — bloques de {heading?,
 * paragraphs[], image?}. El `id` de cada bloque de Guía se deriva del heading
 * al guardar (ver *-form.tsx), no se edita aquí. */
export function ContentBlocksField({
  blocks,
  onChange,
  headingRequired = false,
}: {
  blocks: ContentBlockValue[];
  onChange: (blocks: ContentBlockValue[]) => void;
  headingRequired?: boolean;
}) {
  const [editingImageFor, setEditingImageFor] = useState<number | null>(null);

  function updateBlock(i: number, patch: Partial<ContentBlockValue>) {
    onChange(blocks.map((b, bi) => (bi === i ? { ...b, ...patch } : b)));
  }
  function addBlock() {
    onChange([...blocks, { heading: headingRequired ? "" : null, paragraphs: [""] }]);
  }
  function removeBlock(i: number) {
    onChange(blocks.filter((_, bi) => bi !== i));
  }
  function moveBlock(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function updateParagraph(bi: number, pi: number, value: string) {
    updateBlock(bi, { paragraphs: blocks[bi].paragraphs.map((p, ppi) => (ppi === pi ? value : p)) });
  }
  function addParagraph(bi: number) {
    updateBlock(bi, { paragraphs: [...blocks[bi].paragraphs, ""] });
  }
  function removeParagraph(bi: number, pi: number) {
    updateBlock(bi, { paragraphs: blocks[bi].paragraphs.filter((_, ppi) => ppi !== pi) });
  }

  return (
    <div className="flex flex-col gap-3">
      <span className={labelClass}>Cuerpo</span>
      <div className="flex flex-col gap-4">
        {blocks.map((block, bi) => (
          <div key={bi} className="flex flex-col gap-2.5 rounded-[12px] border border-border-soft bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <input
                value={block.heading ?? ""}
                onChange={(e) => updateBlock(bi, { heading: e.target.value || (headingRequired ? "" : null) })}
                placeholder={headingRequired ? "Encabezado (requerido)" : "Encabezado (opcional)"}
                required={headingRequired}
                className={`${fieldClass} flex-1`}
              />
              <div className="flex flex-none items-center gap-1">
                <button type="button" onClick={() => moveBlock(bi, -1)} disabled={bi === 0} className="rounded-md px-1.5 py-1 text-ink-faint hover:text-ink disabled:opacity-30">
                  ↑
                </button>
                <button type="button" onClick={() => moveBlock(bi, 1)} disabled={bi === blocks.length - 1} className="rounded-md px-1.5 py-1 text-ink-faint hover:text-ink disabled:opacity-30">
                  ↓
                </button>
                <button type="button" onClick={() => removeBlock(bi)} className="rounded-md px-1.5 py-1 text-ink-faint hover:text-negative">
                  ×
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {block.paragraphs.map((p, pi) => (
                <div key={pi} className="flex items-start gap-2">
                  <RichTextarea
                    value={p}
                    onChange={(v) => updateParagraph(bi, pi, v)}
                    rows={3}
                    placeholder="Párrafo…"
                    className={`${fieldClass} flex-1 resize-none`}
                  />
                  <button
                    type="button"
                    onClick={() => removeParagraph(bi, pi)}
                    disabled={block.paragraphs.length === 1}
                    className="mt-2 flex-none rounded-md px-1.5 py-1 text-ink-faint hover:text-negative disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addParagraph(bi)}
                className="self-start text-[12px] font-medium text-brand hover:text-brand-pressed"
              >
                + Párrafo
              </button>
            </div>

            {editingImageFor === bi ? (
              <div className="flex flex-col gap-2 rounded-[10px] border border-border-soft bg-white p-3">
                <ImageSearchPicker initialQuery={block.heading ?? ""} onSelect={(img) => { updateBlock(bi, { image: img }); setEditingImageFor(null); }} />
                <button type="button" onClick={() => setEditingImageFor(null)} className="self-start text-[12px] font-medium text-ink-soft hover:text-brand">
                  Cancelar
                </button>
              </div>
            ) : block.image ? (
              <div className="flex items-start gap-3 rounded-[10px] border border-border-soft bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
                <img src={block.image.url} alt="" className="h-16 w-24 flex-none rounded-[8px] object-cover" />
                <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                  <p className="truncate text-[11.5px] text-ink-soft">{block.image.credit}</p>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setEditingImageFor(bi)} className="text-[11.5px] font-medium text-ink-soft hover:text-brand">
                      Reemplazar
                    </button>
                    <button type="button" onClick={() => updateBlock(bi, { image: null })} className="text-[11.5px] font-medium text-ink-soft hover:text-negative">
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingImageFor(bi)}
                className="self-start rounded-lg border border-dashed border-border bg-white px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
              >
                + Imagen en este bloque
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addBlock}
        className="self-start rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint"
      >
        + Bloque
      </button>
    </div>
  );
}
