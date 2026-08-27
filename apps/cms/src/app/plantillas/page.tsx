import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { CONTENT_TEMPLATES, type ContentTemplate } from "@/data/templates";
import type { Category } from "@planazo/types";

const SITE_LABEL: Record<"la-mira" | "planazo", string> = { "la-mira": "La Mira", planazo: "Planazo" };

const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

function TemplateCard({ template }: { template: ContentTemplate }) {
  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-border bg-white p-5 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{template.label}</h3>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-ink-soft">{template.description}</p>
        </div>
        <span className="flex-none rounded-full bg-background px-2.5 py-1 font-mono text-[10px] font-medium tracking-[.04em] text-ink-faint uppercase">
          {SITE_LABEL[template.site]}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    </div>
  );
}

function CategoryRow({ category }: { category: Category }) {
  return (
    <details className="group border-b border-border-soft last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#FEFCFA]">
        <span className="text-[13px] font-medium tracking-tight">{category.name}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] text-ink-faint">
            {category.fieldSchema.length} {category.fieldSchema.length === 1 ? "campo" : "campos"}
          </span>
          <span className="text-ink-faint transition-transform group-open:rotate-180" dangerouslySetInnerHTML={{ __html: CHEVRON_ICON }} />
        </span>
      </summary>
      <div className="flex flex-wrap gap-1.5 px-4 pb-3.5">
        {category.fieldSchema.length === 0 ? (
          <span className="text-[12px] text-ink-faint italic">Sin campos propios — solo lo editorial de la plantilla.</span>
        ) : (
          category.fieldSchema.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-background px-2.5 py-1 text-[11.5px] text-ink-soft"
              title={f.type + (f.options ? `: ${f.options.join(", ")}` : "")}
            >
              {f.label}
              {f.isFact && <span className="text-[10px] text-accent-fg">· dato verificable</span>}
              {f.required && <span className="text-[10px] text-ink-faint">· requerido</span>}
            </span>
          ))
        )}
      </div>
    </details>
  );
}

export default async function PlantillasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [lamiraCategories, planazoCategories] = await Promise.all([getCmsCategories("la-mira"), getCmsCategories("planazo")]);
  const lamiraTemplates = CONTENT_TEMPLATES.filter((t) => t.site === "la-mira");
  const planazoTemplates = CONTENT_TEMPLATES.filter((t) => t.site === "planazo");

  return (
    <CmsShell user={session} title="Plantillas">
      <div className="mx-auto max-w-[880px] p-[26px] pb-[60px]">
        <h1 className="mb-1.5 text-[22px] font-semibold tracking-tight">Plantillas</h1>
        <p className="mb-7 max-w-[68ch] text-[13.5px] leading-[1.6] text-ink-soft">
          Qué pide cada tipo de contenido antes de poder crearlo: lo que redacta la IA sola, y lo que tienes que
          completar tú porque son datos verificables que la IA nunca inventa. Las categorías de cada sitio agregan
          sus propios campos encima — ábrelas abajo para ver cuáles.
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-semibold tracking-tight text-ink-soft">Tipos de contenido — La Mira</h2>
          <div className="flex flex-col gap-3">
            {lamiraTemplates.map((t) => (
              <TemplateCard key={t.contentType} template={t} />
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-semibold tracking-tight text-ink-soft">Tipos de contenido — Planazo</h2>
          <div className="flex flex-col gap-3">
            {planazoTemplates.map((t) => (
              <TemplateCard key={t.contentType} template={t} />
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-1 text-[13px] font-semibold tracking-tight text-ink-soft">Categorías — La Mira</h2>
          <p className="mb-3 text-[12px] text-ink-faint">
            Aplican a cualquiera de los tipos de arriba — la categoría se elige aparte del tipo.
          </p>
          <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            {lamiraCategories.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-[13px] font-semibold tracking-tight text-ink-soft">Categorías — Planazo</h2>
          <p className="mb-3 text-[12px] text-ink-faint">
            Aplican a cualquiera de los tipos de arriba — la categoría se elige aparte del tipo.
          </p>
          <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            {planazoCategories.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
          </div>
        </section>
      </div>
    </CmsShell>
  );
}
