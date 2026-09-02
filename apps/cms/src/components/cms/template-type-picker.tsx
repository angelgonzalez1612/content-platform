"use client";

import { useState } from "react";
import type { ContentTemplate } from "@/data/templates";
import type { Category } from "@planazo/types";
import { SiteTabs } from "@/components/cms/site-tabs";
import { TemplateCard } from "@/components/cms/template-card";

// Selector de proyecto + tipo de contenido + categoría para /plantillas —
// antes se apilaban todas las plantillas del sitio, y por separado todas las
// categorías, una debajo de otra (mucho scroll). Ahora se elige un tipo (
// pestañas) y una categoría (select, hay hasta 20) y solo esa combinación se
// muestra. Los controles (pestañas de sitio, tipo y categoría) son poca
// información — se quedan fijos arriba (`sticky`) mientras la tarjeta de
// abajo (info + vista previa, que sí puede crecer bastante) hace scroll.
export function TemplateTypePicker({
  site,
  templates,
  categories,
}: {
  site: "lamira" | "planazo";
  templates: ContentTemplate[];
  categories: Category[];
}) {
  const [selectedType, setSelectedType] = useState(templates[0]?.contentType ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id ?? "");

  const activeIndex = Math.max(
    0,
    templates.findIndex((t) => t.contentType === selectedType),
  );
  const active = templates[activeIndex];
  const activeCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;

  if (!active) return null;

  // `siteId: null` = compartida entre La Mira y Planazo (ver Category en
  // packages/types) — se agrupan aparte en el selector para que se note de
  // un vistazo cuáles aplican también en el otro sitio.
  const sharedCategories = categories.filter((c) => c.siteId === null);
  const exclusiveCategories = categories.filter((c) => c.siteId !== null);
  const siteLabel = site === "lamira" ? "La Mira" : "Planazo";

  return (
    <div className="flex flex-col gap-4">
      {/* Barra compacta: todo en 2 filas cortas (antes eran 4, con
          encabezado y una frase de ayuda de línea completa) — es poca
          información real, no debe empujar la tarjeta de abajo fuera de
          vista. */}
      <div className="sticky top-0 z-10 -mx-[26px] flex flex-col gap-2.5 bg-background px-[26px] pb-3">
        <SiteTabs site={site} basePath="/plantillas" />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Tipo</span>
            <div role="tablist" aria-label="Tipo de contenido" className="flex flex-wrap gap-1.5">
              {templates.map((t) => {
                const isActive = t.contentType === active.contentType;
                return (
                  <button
                    key={t.contentType}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedType(t.contentType)}
                    className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${
                      isActive ? "bg-brand text-white shadow-[0_1px_2px_rgba(253,105,13,.35)]" : "border border-border bg-white text-ink-soft hover:border-ink-faint hover:text-ink"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="plantillas-category" className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">
                Categoría
              </label>
              <select
                id="plantillas-category"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                title="Cada categoría agrega sus propios campos — cámbiala para ver cuáles."
                className="rounded-lg border border-border bg-white px-3 py-1 text-[12.5px] font-medium text-ink"
              >
                {exclusiveCategories.length > 0 && (
                  <optgroup label={`Exclusivas de ${siteLabel}`}>
                    {exclusiveCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {sharedCategories.length > 0 && (
                  <optgroup label="Compartidas (La Mira + Planazo)">
                    {sharedCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      <TemplateCard template={active} index={activeIndex} category={activeCategory} />
    </div>
  );
}
