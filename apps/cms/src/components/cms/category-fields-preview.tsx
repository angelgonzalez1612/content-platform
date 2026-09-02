import type { Category } from "@planazo/types";

const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

// Campos propios de UNA categoría — cada categoría del sitio agrega los
// suyos encima de la plantilla del tipo de contenido (ver CategoryFieldsSection
// en el editor real). Usado en /plantillas junto al selector de categoría,
// para que se note de un vistazo que cada una pide cosas distintas. Acordeón
// plano (sin caja/borde propio, solo una línea divisoria arriba) — no otra
// tarjeta más dentro de la tarjeta de la plantilla.
export function CategoryFieldsPreview({ category }: { category: Category }) {
  // `siteId: null` = compartida entre La Mira y Planazo — vale la pena que
  // se note aquí también, no solo en el selector de arriba, porque cambia
  // el radio de acción de estos campos: editarlos afecta al otro sitio.
  const isShared = category.siteId === null;

  return (
    <details className="group border-t border-border-soft pt-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[9.5px] font-medium tracking-[.1em] text-ink-faint uppercase">Campos de &quot;{category.name}&quot;</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold whitespace-nowrap normal-case ${
              isShared ? "bg-[#FEF6E7] text-[#9A6B12]" : "bg-background text-ink-faint"
            }`}
          >
            {isShared ? "Compartida" : "Exclusiva"}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] text-ink-faint">
            {category.fieldSchema.length} {category.fieldSchema.length === 1 ? "campo" : "campos"}
          </span>
          <span className="text-ink-faint transition-transform group-open:rotate-180" dangerouslySetInnerHTML={{ __html: CHEVRON_ICON }} />
        </span>
      </summary>

      <div className="mt-2.5">
        {category.fieldSchema.length === 0 ? (
          <p className="text-[12.5px] text-ink-faint italic">Sin campos propios — solo lo editorial de la plantilla de arriba.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {category.fieldSchema.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-background px-2.5 py-1 text-[11.5px] text-ink-soft"
                title={f.type + (f.options ? `: ${f.options.join(", ")}` : "")}
              >
                {f.label}
                {f.isFact && <span className="text-[10px] text-accent-fg">· dato verificable</span>}
                {f.required && <span className="text-[10px] text-ink-faint">· requerido</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
