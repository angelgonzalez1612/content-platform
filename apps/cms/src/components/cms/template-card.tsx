import { TemplateExamplePreview } from "@/components/cms/template-example-preview";
import { CategoryFieldsPreview } from "@/components/cms/category-fields-preview";
import type { ContentTemplate } from "@/data/templates";
import type { Category } from "@planazo/types";

// Las 3 plantillas sin borrador (alerta/evento/lugar de La Mira) publican de
// inmediato al crearse — vale la pena que se note de un vistazo, no solo en
// la descripción en prosa.
const NO_DRAFT_TYPES = new Set(["alerta", "evento", "lugar"]);

export function TemplateCard({ template, index, category }: { template: ContentTemplate; index: number; category?: Category | null }) {
  const instant = NO_DRAFT_TYPES.has(template.contentType);
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <div className="flex flex-col lg:flex-row">
        <div className="flex min-w-0 gap-4 p-5 lg:flex-[3]">
          <span className="grid size-8 flex-none place-items-center rounded-full bg-accent font-mono text-[12px] font-semibold text-accent-fg">
            {index + 1}
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">{template.label}</h3>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-ink-soft">{template.description}</p>
              </div>
              {instant && (
                <span className="flex-none rounded-full bg-[#FEF6E7] px-2.5 py-1 text-[10.5px] font-semibold whitespace-nowrap text-[#9A6B12]">
                  Sin borrador
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-border-soft pt-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] font-medium tracking-[.1em] text-ink-faint uppercase">La IA escribe</span>
                <ul className="flex flex-col gap-1">
                  {template.aiFields.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[12.5px] text-ink">
                      <span className="mt-[3px] size-[5px] flex-none rounded-full bg-brand" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] font-medium tracking-[.1em] text-ink-faint uppercase">Tú completas</span>
                {template.humanFields.length === 0 ? (
                  <p className="text-[12.5px] text-ink-faint italic">Nada — se puede crear directo con lo que escribe la IA.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {template.humanFields.map((f) => (
                      <li key={f.label} className="text-[12.5px] text-ink">
                        <div className="flex items-start gap-1.5">
                          <span className="mt-[3px] size-[5px] flex-none rounded-full bg-ink-faint" />
                          <span>
                            {f.label}
                            {f.optional && <span className="ml-1 text-ink-faint">(opcional)</span>}
                          </span>
                        </div>
                        {f.hint && <p className="mt-0.5 ml-[12.5px] text-[11.5px] leading-[1.4] text-ink-faint">{f.hint}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Campos de la categoría elegida en el selector de abajo — se
                suman a los de arriba, y cambian según la categoría porque
                cada una pide cosas distintas (ver CategoryFieldsSection en
                el editor real). */}
            {category && <CategoryFieldsPreview category={category} />}
          </div>
        </div>

        {/* Ejemplo de cómo se vería ya publicado — mismo componente de vista
            previa que usan el editor y el flujo de generación con IA, con
            datos inventados solo para ilustrar la plantilla. Se queda a la
            vista (`sticky`) con su propio scroll — nunca se corta, y no
            obliga a la columna de la izquierda a estirarse para igualarla. */}
        <div className="w-full min-w-0 border-t border-border-soft bg-background p-5 lg:flex-[2] lg:sticky lg:top-[120px] lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <TemplateExamplePreview contentType={template.contentType} categoryName={category?.name} />
        </div>
      </div>
    </div>
  );
}
