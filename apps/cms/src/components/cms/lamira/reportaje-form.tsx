"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { Reportaje, ContentStatus, Category, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { ContentBlocksField, type ContentBlockValue } from "@/components/cms/content-blocks-field";
import { TagsField } from "@/components/cms/tags-field";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ImproveWithAiPanel } from "@/components/cms/improve-with-ai-panel";
import { ImprovePreview, type ImproveResult } from "@/components/cms/lamira/improve-preview";
import { buildToc, summarizeBlocks } from "@/components/cms/lamira/content-blocks-util";
import { ImageField } from "@/components/cms/lamira/image-field";
import { EditPreviewLayout } from "@/components/cms/lamira/edit-preview-layout";
import { LamiraPreviewCard } from "@/components/cms/lamira/lamira-preview-card";

const STATUS_OPTIONS: Array<{ value: ContentStatus; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "in_review", label: "En revisión" },
  { value: "scheduled", label: "Programado" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Archivado" },
];

export function ReportajeForm({ categories, existing }: { categories: Category[]; existing?: Reportaje }) {
  const router = useRouter();
  const isEdit = !!existing;
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    dek: existing?.dek ?? "",
    categoryId: existing?.category?.id ?? "",
    authorSlug: existing?.authorSlug ?? "",
    readingTime: existing?.readingTime ?? "5 min de lectura",
    status: existing?.status ?? ("draft" as ContentStatus),
    sourceKind: existing?.sourceKind ?? "",
    sourceUrl: existing?.sourceUrl ?? "",
    imageCaption: existing?.imageCaption ?? "",
  });
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [content, setContent] = useState<ContentBlockValue[]>(
    existing?.content.map((b) => ({ heading: b.heading ?? null, paragraphs: b.paragraphs })) ?? [{ heading: null, paragraphs: [""] }],
  );
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>(existing?.categoryData ?? {});
  const [seo, setSeo] = useState<Seo>(existing?.seo ?? {});
  const [image, setImage] = useState<{ url: string; credit: string } | null>(
    existing?.imageUrl ? { url: existing.imageUrl, credit: existing.imageCredit ?? "" } : null,
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [improving, setImproving] = useState(false);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);

  const category = categories.find((c) => c.id === form.categoryId) ?? null;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  }

  function applyImprovement() {
    if (!improveResult) return;
    const { dek, content: improvedContent, seo: improvedSeo, ...rest } = improveResult.draft as {
      dek?: string;
      content?: ContentBlockValue[];
      seo?: Seo;
      [k: string]: unknown;
    };
    if (dek) set("dek", dek);
    if (improvedContent) setContent(improvedContent);
    if (improvedSeo) setSeo(improvedSeo);
    setCategoryData((prev) => ({ ...prev, ...rest }));
    setImproveResult(null);
  }

  async function save(status: ContentStatus) {
    setSaving(true);
    setError("");

    const payload = {
      title: form.title,
      dek: form.dek,
      categoryId: form.categoryId || null,
      authorSlug: form.authorSlug,
      readingTime: form.readingTime,
      status,
      tags,
      sourceKind: form.sourceKind || null,
      sourceUrl: form.sourceUrl || null,
      imageCaption: form.imageCaption,
      imageUrl: image?.url ?? null,
      imageCredit: image?.credit ?? null,
      toc: buildToc(content),
      content,
      categoryData,
      seo,
    };

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/lamira/reportajes${isEdit ? `/${existing.id}` : ""}`, {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(isEdit ? "No se pudo guardar. Intenta de nuevo." : "No se pudo crear el reportaje. Revisa los campos requeridos (etiquetas y pie de foto son obligatorios).");
        setSaving(false);
        return;
      }

      if (isEdit) {
        setForm((f) => ({ ...f, status }));
        setSavedAt(Date.now());
        setSaving(false);
        router.refresh();
      } else {
        const created = await res.json();
        router.push(`/contenido/lamira/reportaje/${created.id}`);
      }
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
    <LamiraPreviewCard
      type="reportaje"
      name={form.title}
      categoryName={category?.name ?? null}
      image={image}
      dek={form.dek}
      description=""
      content={content}
      alertaStatus="activa"
      alcaldiaSlug=""
      eventoStatus="proximo"
      date=""
      time=""
      location=""
      price=""
      organizer=""
      kind="parque"
      colonia=""
    />
  );

  const left = (
    <div className="flex flex-col gap-4">
      {isEdit && (
        <ImproveWithAiPanel contentType="reportaje" contentId={existing.id} expanded={improving} onToggle={() => setImproving((v) => !v)} onResult={setImproveResult} />
      )}

      {improveResult && (
        <ImprovePreview
          result={improveResult}
          fields={[
            { label: "Bajada (dek)", current: form.dek, improved: (improveResult.draft.dek as string) ?? "" },
            { label: "Cuerpo", current: summarizeBlocks(content), improved: summarizeBlocks((improveResult.draft.content as ContentBlockValue[]) ?? []) },
          ]}
          onApply={applyImprovement}
          onDiscard={() => setImproveResult(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-title" className={labelClass}>
            Título
          </label>
          <input id="r-title" required value={form.title} onChange={(e) => set("title", e.target.value)} className={fieldClass} />
        </div>

        <ImageField image={image} onChange={setImage} searchQuery={form.title} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-dek" className={labelClass}>
            Bajada (dek)
          </label>
          <textarea id="r-dek" required rows={2} value={form.dek} onChange={(e) => set("dek", e.target.value)} className={`${fieldClass} resize-none`} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-category" className={labelClass}>
            Categoría (opcional — los reportajes no siempre tienen una)
          </label>
          <select id="r-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={`${fieldClass} max-w-[280px]`}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <ContentBlocksField blocks={content} onChange={setContent} />

        <TagsField label="Etiquetas (mínimo 1)" tags={tags} onChange={setTags} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="r-author" className={labelClass}>
              Autor (slug)
            </label>
            <input id="r-author" required value={form.authorSlug} onChange={(e) => set("authorSlug", e.target.value)} placeholder="ej. renata-sosa" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="r-reading" className={labelClass}>
              Tiempo de lectura
            </label>
            <input id="r-reading" value={form.readingTime} onChange={(e) => set("readingTime", e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="r-source-kind" className={labelClass}>
              Tipo de fuente
            </label>
            <input id="r-source-kind" value={form.sourceKind} onChange={(e) => set("sourceKind", e.target.value)} placeholder="demo / institucional / editorial" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="r-image-caption" className={labelClass}>
              Pie de foto
            </label>
            <input id="r-image-caption" required value={form.imageCaption} onChange={(e) => set("imageCaption", e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-source-url" className={labelClass}>
            URL de la fuente
          </label>
          <div className="flex items-center gap-2">
            <input
              id="r-source-url"
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
                className="flex-none rounded-lg border border-border bg-white px-3 py-2.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                Abrir ↗
              </a>
            )}
          </div>
          <p className="text-[11.5px] leading-[1.4] text-ink-faint">
            El artículo original del que salió el tema — cuando lo crea la automatización, se llena solo.
          </p>
        </div>

        <SeoPanel seo={seo} onChange={setSeo} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-status" className={labelClass}>
            Estado
          </label>
          <select id="r-status" value={form.status} onChange={(e) => set("status", e.target.value as ContentStatus)} className={`${fieldClass} max-w-[220px]`}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

        <div className="flex items-center gap-3 border-t border-border-soft pt-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-60 disabled:shadow-none"
          >
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear reportaje"}
          </button>
          {isEdit && form.status !== "published" && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={saving}
              className="rounded-[10px] border border-[#B7E4C7] bg-[#EAF7EF] px-4 py-2.5 text-[13.5px] font-semibold text-[#2E9E5B] transition-colors hover:bg-[#DFF3E6] disabled:cursor-default disabled:opacity-60"
            >
              Publicar
            </button>
          )}
          {savedAt && <span className="font-mono text-[12px] text-positive">Guardado ✓</span>}
        </div>
      </form>
    </div>
  );

  return <EditPreviewLayout left={left} preview={preview} />;
}
