"use client";

import { fieldClass, labelClass } from "@/components/cms/dynamic-field";

export interface GuideSectionValue {
  heading: string;
  body: string;
  placeSlug: string;
}

export interface PlaceOption {
  slug: string;
  label: string;
}

/**
 * Editor de las "paradas" de una guía — cada sección narra un Place/Evento
 * real por slug (ver GuideSection en @planazo/types). `placeSlugs` en el
 * PlanazoGuide final se deriva de estos slugs en el backend (guides.mapper.ts),
 * así que no hay un campo aparte que mantener sincronizado aquí. `eyebrow`,
 * `time`, `order` e `image` (solo relevantes para "itinerario"/"comparacion",
 * casi sin uso real todavía — ver Guide en planazo_fronted) se dejan fuera de
 * este formulario manual a propósito, para no complicar el caso común.
 */
export function GuideSectionsField({
  sections,
  onChange,
  placeOptions,
}: {
  sections: GuideSectionValue[];
  onChange: (sections: GuideSectionValue[]) => void;
  placeOptions: PlaceOption[];
}) {
  function update(i: number, patch: Partial<GuideSectionValue>) {
    onChange(sections.map((s, ii) => (ii === i ? { ...s, ...patch } : s)));
  }
  function add() {
    onChange([...sections, { heading: "", body: "", placeSlug: "" }]);
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

  return (
    <div className="flex flex-col gap-2.5">
      <span className={labelClass}>Paradas / secciones</span>
      <div className="flex flex-col gap-3">
        {sections.map((section, i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-[10px] border border-border-soft bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-ink-faint">Parada {i + 1}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-md px-1.5 py-1 text-ink-faint hover:text-ink disabled:opacity-30">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="rounded-md px-1.5 py-1 text-ink-faint hover:text-ink disabled:opacity-30">
                  ↓
                </button>
                <button type="button" onClick={() => remove(i)} className="rounded-md px-1.5 py-1 text-ink-faint hover:text-negative">
                  ×
                </button>
              </div>
            </div>

            <input
              value={section.heading}
              onChange={(e) => update(i, { heading: e.target.value })}
              placeholder="Encabezado — ej. Almanegra: para un espresso rápido"
              aria-label="Encabezado"
              className={fieldClass}
            />
            <textarea
              value={section.body}
              onChange={(e) => update(i, { body: e.target.value })}
              placeholder="Texto de esta parada"
              aria-label="Texto"
              rows={3}
              className={`${fieldClass} resize-none`}
            />
            <select
              value={section.placeSlug}
              onChange={(e) => update(i, { placeSlug: e.target.value })}
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
        className="self-start rounded-lg border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint"
      >
        + Parada
      </button>
    </div>
  );
}
