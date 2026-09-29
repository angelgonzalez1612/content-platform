"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { PlanazoEvent, Category, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ImproveWithAiPanel, type ImproveWithAiHandle } from "@/components/cms/improve-with-ai-panel";
import { ImprovePreview, isFieldSelected, type ImproveResult, type ImproveSelection } from "@/components/cms/lamira/improve-preview";
import { AlcaldiaSelect } from "@/components/cms/lamira/alcaldia-select";
import { ImageField } from "@/components/cms/lamira/image-field";
import { EditPreviewLayout } from "@/components/cms/lamira/edit-preview-layout";
import { PlanazoPreviewCard } from "@/components/cms/planazo/planazo-preview-card";
import { ContentBlocksField, type ContentBlockValue } from "@/components/cms/content-blocks-field";
import { summarizeBlocks } from "@/components/cms/lamira/content-blocks-util";
import { SaveActions } from "@/components/cms/save-actions";

// `startDate` es el valor crudo de un <input type="datetime-local"> ("2026-09-01T18:00") — para la vista previa.
function toDateLabelPreview(startDate: string): string {
  if (!startDate) return "";
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return "";
  const label = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date);
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

// Trunca un ISO completo a lo que acepta <input type="datetime-local">
// ("2026-08-30T18:00"), y viceversa al guardar.
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

export function PlanazoEventForm({ categories, existing }: { categories: Category[]; existing: PlanazoEvent }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: existing.name,
    description: existing.description ?? "",
    startDate: toLocalInput(existing.startDate),
    endDate: toLocalInput(existing.endDate),
    locationName: existing.locationName ?? "",
    alcaldiaSlug: existing.alcaldiaSlug ?? "",
    categoryId: existing.categoryId ?? categories[0]?.id ?? "",
    sourceUrl: existing.sourceUrl ?? "",
    status: existing.status,
  });
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>(existing.categoryData ?? {});
  const [seo, setSeo] = useState<Seo>(existing.seo ?? {});
  const [content, setContent] = useState<ContentBlockValue[]>(
    existing.content.map((b) => ({ heading: b.heading ?? null, paragraphs: b.paragraphs })),
  );
  // Encuadre de la imagen principal (ver ImageFocusEditor); null = centrada.
  const [imagePosition, setImagePosition] = useState<string | null>(existing.imagePosition ?? null);
  const [image, setImage] = useState<{ url: string; credit: string } | null>(
    existing.imageUrl ? { url: existing.imageUrl, credit: existing.imageCredit ?? "" } : null,
  );
  const [saving, setSaving] = useState(false);
  // Estado que ya tiene en la base (solo cambia con Publicar / Despublicar).
  const [savedStatus, setSavedStatus] = useState<string | null>(form.status);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [improving, setImproving] = useState(false);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);
  const improveRef = useRef<ImproveWithAiHandle>(null);
  const [regenerating, setRegenerating] = useState(false);

  const category = categories.find((c) => c.id === form.categoryId) ?? null;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  }

  function applyImprovement(selection?: ImproveSelection) {
    if (!improveResult) return;
    const { description, content: improvedContent, seo: improvedSeo, ...rest } = improveResult.draft as {
      description?: string;
      content?: ContentBlockValue[];
      seo?: Seo;
      [k: string]: unknown;
    };
    if (description && isFieldSelected(selection, "description")) set("description", description);
    const blocks = selection ? selection.blocks : improvedContent;
    if (blocks) setContent(blocks);
    if (improvedSeo) setSeo(improvedSeo);
    setCategoryData((prev) => ({ ...prev, ...rest }));
    setImproveResult(null);
  }

  async function save(status: PlanazoEvent["status"]) {
    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      description: form.description,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      locationName: form.locationName || null,
      alcaldiaSlug: form.alcaldiaSlug || null,
      categoryId: form.categoryId || null,
      imageUrl: image?.url ?? null,
      imagePosition: image ? imagePosition : null,
      imageCredit: image?.credit ?? null,
      sourceUrl: form.sourceUrl || null,
      status,
      categoryData,
      seo,
      content,
    };

    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/events/${existing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError("No se pudo guardar. Intenta de nuevo.");
        setSaving(false);
        return;
      }

      setForm((f) => ({ ...f, status }));
      setSavedStatus(status);
      setSavedAt(Date.now());
      setSaving(false);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    save(form.status);
  }

  function handlePublish() {
    save("published");
  }

  const preview = (
    <PlanazoPreviewCard
      kind="evento"
      name={form.name}
      categoryLabel={category?.name ?? ""}
      image={image}
      imagePosition={imagePosition}
      locationName={form.locationName}
      dateLabel={toDateLabelPreview(form.startDate)}
      description={form.description}
    />
  );

  const left = (
    <div className="flex flex-col gap-4">
      <ImproveWithAiPanel
        ref={improveRef}
        contentType="evento-planazo"
        contentId={existing.id}
        expanded={improving}
        onToggle={() => setImproving((v) => !v)}
        onResult={setImproveResult}
        onLoadingChange={setRegenerating}
        supportsExpand
      />

      {improveResult && (
        <ImprovePreview
          result={improveResult}
          fields={[
            { key: "description", label: "Descripción", current: form.description, improved: (improveResult.draft.description as string) ?? "" },
            improveResult.draft.content
              ? {
                  key: "content",
                  label: "Cuerpo",
                  current: summarizeBlocks(content),
                  improved: summarizeBlocks(improveResult.draft.content as ContentBlockValue[]),
                  blocks: { current: content, improved: improveResult.draft.content as ContentBlockValue[] },
                }
              : { key: "content", label: "Cuerpo", current: summarizeBlocks(content), improved: "" },
          ]}
          onApply={applyImprovement}
          onDiscard={() => setImproveResult(null)}
          onRegenerate={() => improveRef.current?.regenerate()}
          regenerating={regenerating}
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-name" className={labelClass}>
            Nombre
          </label>
          <input id="pe-name" required value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldClass} />
        </div>

        {/* Arriba de todo — se llena solo cuando lo crea la automatización
            (ver AutomationRunnerService), mismo patrón que noticia/reportaje
            de La Mira y Lugares de Planazo. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-source-url" className={labelClass}>
            URL de la fuente
          </label>
          <div className="flex items-center gap-2">
            <input
              id="pe-source-url"
              value={form.sourceUrl}
              onChange={(e) => set("sourceUrl", e.target.value)}
              placeholder="https://…"
              className={`${fieldClass} flex-1`}
            />
            {form.sourceUrl && (
              <a
                href={form.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-none rounded-lg border border-border bg-card px-3 py-2.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                Abrir ↗
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-description" className={labelClass}>
            Descripción
          </label>
          <textarea id="pe-description" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} className={`${fieldClass} resize-none`} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-category" className={labelClass}>
            Categoría
          </label>
          <select id="pe-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={`${fieldClass} max-w-[280px]`}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <ImageField image={image} onChange={setImage} position={imagePosition} onPositionChange={setImagePosition} />

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <ContentBlocksField blocks={content} onChange={setContent} articleTitle={form.name} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pe-start" className={labelClass}>
              Fecha y hora de inicio <span className="normal-case font-normal text-ink-faint">(opcional)</span>
            </label>
            <input id="pe-start" type="datetime-local" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pe-end" className={labelClass}>
              Fecha y hora de fin (opcional)
            </label>
            <input id="pe-end" type="datetime-local" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pe-location" className={labelClass}>
              Lugar <span className="normal-case font-normal text-ink-faint">(opcional)</span>
            </label>
            <input id="pe-location" value={form.locationName} onChange={(e) => set("locationName", e.target.value)} placeholder="ej. Foro Indie Rocks, Condesa" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pe-alcaldia" className={labelClass}>
              Alcaldía / municipio
            </label>
            <AlcaldiaSelect id="pe-alcaldia" value={form.alcaldiaSlug} onChange={(slug) => set("alcaldiaSlug", slug)} />
          </div>
        </div>

        <SeoPanel seo={seo} onChange={setSeo} contentTitle={form.name} />


        {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

        <SaveActions
          isEdit={true}
          saving={saving}
          createLabel="Guardar cambios"
          savedStatus={savedStatus}
          onUnpublish={() => save("draft")}
          savedAt={savedAt}
          onPublish={handlePublish}
          siteLabel="planazo.com.mx"
        />
      </form>
    </div>
  );

  return <EditPreviewLayout left={left} preview={preview} />;
}
