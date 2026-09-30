"use client";

import { useRef, useState } from "react";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { RichTextarea } from "@/components/cms/rich-textarea";
import { ImageSearchPicker } from "@/components/cms/lamira/image-search-picker";
import { BlockImprovePanel, type BlockImprovePanelHandle } from "@/components/cms/block-improve-panel";
import { hasInlineVideo, placeVideo, videoPositions, videoSlot } from "@/lib/inline-video";

export interface ContentBlockValue {
  heading: string | null;
  paragraphs: string[];
  // Imagen embebida en este bloque (opcional) — mismo shape {url, credit} que
  // la imagen principal del artículo, elegida por búsqueda o URL manual,
  // NUNCA generada por la IA.
  image?: { url: string; credit: string } | null;
  // El video de la pieza va dentro de este bloque, después de este párrafo
  // (-1 = antes del primero). Ver lib/inline-video.ts.
  videoAfter?: number | null;
}

/** Editor del cuerpo de noticias/reportajes/guías — bloques de {heading?,
 * paragraphs[], image?}. El `id` de cada bloque de Guía se deriva del heading
 * al guardar (ver *-form.tsx), no se edita aquí. */
export function ContentBlocksField({
  blocks,
  onChange,
  headingRequired = false,
  articleImages,
  articleTitle,
  youtubeId,
}: {
  blocks: ContentBlockValue[];
  onChange: (blocks: ContentBlockValue[]) => void;
  headingRequired?: boolean;
  // Imágenes candidatas del artículo scrapeado (ver GenerateLamiraContentFlow)
  // — se ofrecen también aquí para usarlas dentro de un bloque específico.
  articleImages?: { url: string; credit: string }[];
  // Título del artículo completo — contexto opcional para BlockImprovePanel,
  // para que la IA no repita lo que ya dice el resto del contenido.
  articleTitle?: string;
  // Video de la pieza: si se pasa, se puede colocar entre párrafos del cuerpo
  // en vez de su lugar de siempre (bajo la imagen principal).
  youtubeId?: string | null;
}) {
  const [editingImageFor, setEditingImageFor] = useState<number | null>(null);
  const improvePanelRef = useRef<BlockImprovePanelHandle>(null);

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
  function moveParagraph(bi: number, pi: number, dir: -1 | 1) {
    const paragraphs = blocks[bi].paragraphs;
    const pj = pi + dir;
    if (pj < 0 || pj >= paragraphs.length) return;
    const next = [...paragraphs];
    [next[pi], next[pj]] = [next[pj], next[pi]];
    updateBlock(bi, { paragraphs: next });
  }

  const positions = youtubeId ? videoPositions(blocks) : [];
  function moveVideo(bi: number, slot: number, dir: -1 | 1) {
    const idx = positions.findIndex(([b, p]) => b === bi && p === slot);
    const next = positions[idx + dir];
    if (next) onChange(placeVideo(blocks, next));
  }

  function videoMarker(bi: number, slot: number) {
    const idx = positions.findIndex(([b, p]) => b === bi && p === slot);
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-brand/30 bg-accent/50 p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura pública de YouTube */}
        <img src={`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`} alt="" className="h-10 w-[72px] flex-none rounded-[6px] object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-ink">▶ Video aquí</p>
          <p className="text-[11px] text-ink-soft">Muévelo con las flechas entre párrafos y bloques.</p>
        </div>
        <div className="flex flex-none items-center gap-1">
          <button type="button" onClick={() => moveVideo(bi, slot, -1)} disabled={idx <= 0} title="Subir el video" className="rounded-md px-1.5 py-1 text-ink-soft hover:text-ink disabled:opacity-30">
            ↑
          </button>
          <button type="button" onClick={() => moveVideo(bi, slot, 1)} disabled={idx >= positions.length - 1} title="Bajar el video" className="rounded-md px-1.5 py-1 text-ink-soft hover:text-ink disabled:opacity-30">
            ↓
          </button>
          <button
            type="button"
            onClick={() => onChange(placeVideo(blocks, null))}
            title="Regresar el video bajo la imagen principal"
            className="rounded-md px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-ink-soft hover:text-brand"
          >
            Volver arriba
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className={labelClass}>Cuerpo</span>
      {youtubeId && blocks.length > 0 && !hasInlineVideo(blocks) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] border border-dashed border-border bg-card px-3 py-2">
          <span className="text-[12px] text-ink-soft">
            <span className="font-semibold text-ink">▶ Video</span> · va bajo la imagen principal
          </span>
          <button
            type="button"
            onClick={() => onChange(placeVideo(blocks, [0, Math.min(0, blocks[0].paragraphs.length - 1)]))}
            className="text-[12px] font-semibold text-brand hover:text-brand-pressed"
          >
            Ponerlo entre párrafos
          </button>
        </div>
      )}
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
              {youtubeId && videoSlot(blocks, bi) === -1 && videoMarker(bi, -1)}
              {block.paragraphs.map((p, pi) => (
                <div key={pi} className="contents">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <RichTextarea value={p} onChange={(v) => updateParagraph(bi, pi, v)} rows={3} placeholder="Párrafo…" />
                  </div>
                  <div className="mt-2 flex flex-none flex-col items-center gap-0.5">
                    <button type="button" onClick={() => moveParagraph(bi, pi, -1)} disabled={pi === 0} className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-faint hover:text-ink disabled:opacity-30">
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveParagraph(bi, pi, 1)}
                      disabled={pi === block.paragraphs.length - 1}
                      className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-faint hover:text-ink disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeParagraph(bi, pi)}
                      disabled={block.paragraphs.length === 1}
                      className="rounded-md px-1.5 py-0.5 text-ink-faint hover:text-negative disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                </div>
                {youtubeId && videoSlot(blocks, bi) === pi && videoMarker(bi, pi)}
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
              <div className="flex flex-col gap-2 rounded-[10px] border border-border-soft bg-card p-3">
                <ImageSearchPicker
                  initialQuery={block.heading ?? ""}
                  articleImages={articleImages}
                  onSelect={(img) => { updateBlock(bi, { image: img }); setEditingImageFor(null); }}
                />
                <button type="button" onClick={() => setEditingImageFor(null)} className="self-start text-[12px] font-medium text-ink-soft hover:text-brand">
                  Cancelar
                </button>
              </div>
            ) : block.image ? (
              <div className="flex items-start gap-3 rounded-[10px] border border-border-soft bg-card p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
                <img src={block.image.url} alt="" className="h-16 w-24 flex-none rounded-[8px] object-cover" />
                <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                  <p className="truncate text-[11.5px] text-ink-soft">{block.image.credit}</p>
                  <div className="flex items-center gap-3">
                    <a href={block.image.url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] font-medium text-ink-soft hover:text-brand">
                      Abrir ↗
                    </a>
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
                className="self-start rounded-lg border border-dashed border-border bg-card px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
              >
                + Imagen en este bloque
              </button>
            )}

            <button
              type="button"
              onClick={() => improvePanelRef.current?.openFor(bi, "expand")}
              className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-border bg-card px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
            >
              ✨ + Párrafos con IA
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addBlock}
        className="self-start rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint"
      >
        + Bloque
      </button>

      <BlockImprovePanel ref={improvePanelRef} blocks={blocks} onChange={onChange} articleTitle={articleTitle} />
    </div>
  );
}
