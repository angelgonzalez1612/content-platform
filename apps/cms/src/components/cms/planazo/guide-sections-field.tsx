"use client";

import { useRef, useState } from "react";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { RichTextarea } from "@/components/cms/rich-textarea";
import { ImageSearchPicker } from "@/components/cms/lamira/image-search-picker";
import { BlockImprovePanel, type BlockImprovePanelHandle } from "@/components/cms/block-improve-panel";
import type { ContentBlockValue } from "@/components/cms/content-blocks-field";

export interface GuideSectionValue {
  heading: string;
  paragraphs: string[];
  placeSlug: string;
  // Mismo shape {url, alt, credit} que GuideSection en @planazo/types —
  // a diferencia de ContentBlockValue.image (sin alt), por eso este campo
  // no se reusa tal cual al alimentar BlockImprovePanel (ver blocksView).
  image?: { url: string; alt: string; credit: string } | null;
}

export interface PlaceOption {
  slug: string;
  label: string;
}

/**
 * Editor de las "paradas" de una guía — cada sección narra un Place/Evento
 * real por slug (ver GuideSection en @planazo/types) y ahora tiene el mismo
 * diseño de cuerpo que noticia/reportaje/etc. de La Mira: título + párrafos
 * editables uno por uno (no un solo textarea), imagen opcional y "+ Párrafos
 * con IA" — reusa BlockImprovePanel (el endpoint /cms/ai/improve-block es
 * genérico, no le importa de qué tipo de contenido viene el bloque) a
 * través de una vista derivada sin `placeSlug`, mezclando el resultado de
 * vuelta sin tocar ese campo. `eyebrow`, `time` y `order` (solo relevantes
 * para "itinerario"/"comparacion", casi sin uso real todavía — ver Guide en
 * planazo_fronted) se dejan fuera de este formulario manual a propósito,
 * para no complicar el caso común.
 */
export function GuideSectionsField({
  sections,
  onChange,
  placeOptions,
  guideTitle,
}: {
  sections: GuideSectionValue[];
  onChange: (sections: GuideSectionValue[]) => void;
  placeOptions: PlaceOption[];
  guideTitle?: string;
}) {
  const [editingImageFor, setEditingImageFor] = useState<number | null>(null);
  const improvePanelRef = useRef<BlockImprovePanelHandle>(null);

  function update(i: number, patch: Partial<GuideSectionValue>) {
    onChange(sections.map((s, ii) => (ii === i ? { ...s, ...patch } : s)));
  }
  function add() {
    onChange([...sections, { heading: "", paragraphs: [""], placeSlug: "" }]);
  }
  function remove(i: number) {
    onChange(sections.filter((_, ii) => ii !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function updateParagraph(si: number, pi: number, value: string) {
    update(si, { paragraphs: sections[si].paragraphs.map((p, ppi) => (ppi === pi ? value : p)) });
  }
  function addParagraph(si: number) {
    update(si, { paragraphs: [...sections[si].paragraphs, ""] });
  }
  function removeParagraph(si: number, pi: number) {
    update(si, { paragraphs: sections[si].paragraphs.filter((_, ppi) => ppi !== pi) });
  }
  function moveParagraph(si: number, pi: number, dir: -1 | 1) {
    const paragraphs = sections[si].paragraphs;
    const pj = pi + dir;
    if (pj < 0 || pj >= paragraphs.length) return;
    const next = [...paragraphs];
    [next[pi], next[pj]] = [next[pj], next[pi]];
    update(si, { paragraphs: next });
  }

  // BlockImprovePanel no conoce `placeSlug` ni el shape exacto de `image`
  // (GuideSection.image trae `alt`, ContentBlockValue.image no) — se le
  // pasa una vista derivada de solo heading+paragraphs, y su resultado se
  // mezcla de vuelta preservando placeSlug/image intactos.
  const blocksView: ContentBlockValue[] = sections.map((s) => ({ heading: s.heading || null, paragraphs: s.paragraphs }));
  function handleBlocksChange(next: ContentBlockValue[]) {
    onChange(sections.map((s, i) => ({ ...s, heading: next[i]?.heading ?? s.heading, paragraphs: next[i]?.paragraphs ?? s.paragraphs })));
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className={labelClass}>Paradas / secciones</span>
      <div className="flex flex-col gap-3">
        {sections.map((section, si) => (
          <div key={si} className="flex flex-col gap-2.5 rounded-[10px] border border-border-soft bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <input
                value={section.heading}
                onChange={(e) => update(si, { heading: e.target.value })}
                placeholder="Encabezado — ej. Almanegra: para un espresso rápido"
                aria-label="Encabezado"
                className={`${fieldClass} flex-1`}
              />
              <div className="flex flex-none items-center gap-1">
                <button type="button" onClick={() => move(si, -1)} disabled={si === 0} className="rounded-md px-1.5 py-1 text-ink-faint hover:text-ink disabled:opacity-30">
                  ↑
                </button>
                <button type="button" onClick={() => move(si, 1)} disabled={si === sections.length - 1} className="rounded-md px-1.5 py-1 text-ink-faint hover:text-ink disabled:opacity-30">
                  ↓
                </button>
                <button type="button" onClick={() => remove(si)} className="rounded-md px-1.5 py-1 text-ink-faint hover:text-negative">
                  ×
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {section.paragraphs.map((p, pi) => (
                <div key={pi} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <RichTextarea value={p} onChange={(v) => updateParagraph(si, pi, v)} rows={3} placeholder="Párrafo…" />
                  </div>
                  <div className="mt-2 flex flex-none flex-col items-center gap-0.5">
                    <button type="button" onClick={() => moveParagraph(si, pi, -1)} disabled={pi === 0} className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-faint hover:text-ink disabled:opacity-30">
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveParagraph(si, pi, 1)}
                      disabled={pi === section.paragraphs.length - 1}
                      className="rounded-md px-1.5 py-0.5 text-[11px] text-ink-faint hover:text-ink disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeParagraph(si, pi)}
                      disabled={section.paragraphs.length === 1}
                      className="rounded-md px-1.5 py-0.5 text-ink-faint hover:text-negative disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => addParagraph(si)} className="self-start text-[12px] font-medium text-brand hover:text-brand-pressed">
                + Párrafo
              </button>
            </div>

            {editingImageFor === si ? (
              <div className="flex flex-col gap-2 rounded-[10px] border border-border-soft bg-card p-3">
                <ImageSearchPicker
                  initialQuery={section.heading}
                  onSelect={(img) => {
                    update(si, { image: { url: img.url, alt: section.heading || "", credit: img.credit } });
                    setEditingImageFor(null);
                  }}
                />
                <button type="button" onClick={() => setEditingImageFor(null)} className="self-start text-[12px] font-medium text-ink-soft hover:text-brand">
                  Cancelar
                </button>
              </div>
            ) : section.image ? (
              <div className="flex items-start gap-3 rounded-[10px] border border-border-soft bg-card p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
                <img src={section.image.url} alt="" className="h-16 w-24 flex-none rounded-[8px] object-cover" />
                <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                  <p className="truncate text-[11.5px] text-ink-soft">{section.image.credit}</p>
                  <div className="flex items-center gap-3">
                    <a href={section.image.url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] font-medium text-ink-soft hover:text-brand">
                      Abrir ↗
                    </a>
                    <button type="button" onClick={() => setEditingImageFor(si)} className="text-[11.5px] font-medium text-ink-soft hover:text-brand">
                      Reemplazar
                    </button>
                    <button type="button" onClick={() => update(si, { image: null })} className="text-[11.5px] font-medium text-ink-soft hover:text-negative">
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingImageFor(si)}
                className="self-start rounded-lg border border-dashed border-border bg-card px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
              >
                + Imagen en esta parada
              </button>
            )}

            <button
              type="button"
              onClick={() => improvePanelRef.current?.openFor(si, "expand")}
              className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-border bg-card px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
            >
              ✨ + Párrafos con IA
            </button>

            <select
              value={section.placeSlug}
              onChange={(e) => update(si, { placeSlug: e.target.value })}
              aria-label="Lugar o evento curado"
              className={fieldClass}
            >
              <option value="">Sin lugar/evento vinculado</option>
              {placeOptions.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="self-start rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint"
      >
        + Parada
      </button>

      <BlockImprovePanel ref={improvePanelRef} blocks={blocksView} onChange={handleBlocksChange} articleTitle={guideTitle} />
    </div>
  );
}
