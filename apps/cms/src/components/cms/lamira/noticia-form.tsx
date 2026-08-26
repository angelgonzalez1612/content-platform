"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { Noticia, ContentStatus, Category, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { ContentBlocksField, type ContentBlockValue } from "@/components/cms/content-blocks-field";
import { TagsField } from "@/components/cms/tags-field";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ImproveWithAiPanel } from "@/components/cms/improve-with-ai-panel";
import { ImprovePreview, type ImproveResult } from "@/components/cms/lamira/improve-preview";
import { buildToc, summarizeBlocks } from "@/components/cms/lamira/content-blocks-util";

const STATUS_OPTIONS: Array<{ value: ContentStatus; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "in_review", label: "En revisión" },
  { value: "scheduled", label: "Programado" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Archivado" },
];

export function NoticiaForm({ categories, existing }: { categories: Category[]; existing?: Noticia }) {
  const router = useRouter();
  const isEdit = !!existing;
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    dek: existing?.dek ?? "",
    categoryId: existing?.category?.id ?? categories[0]?.id ?? "",
    alcaldiaSlug: existing?.alcaldiaSlug ?? "",
    colonia: existing?.colonia ?? "",
    authorSlug: existing?.authorSlug ?? "",
    readingTime: existing?.readingTime ?? "3 min de lectura",
    status: existing?.status ?? ("draft" as ContentStatus),
    sourceKind: existing?.sourceKind ?? "",
    externalSource: existing?.externalSource ?? "",
    youtubeId: existing?.youtubeId ?? "",
    imageCaption: existing?.imageCaption ?? "",
    featured: existing?.featured ?? false,
    tag: existing?.tag ?? "",
  });
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [content, setContent] = useState<ContentBlockValue[]>(
    existing?.content.map((b) => ({ heading: b.heading ?? null, paragraphs: b.paragraphs })) ?? [{ heading: null, paragraphs: [""] }],
  );
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>(existing?.categoryData ?? {});
  const [seo, setSeo] = useState<Seo>(existing?.seo ?? {});
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      title: form.title,
      dek: form.dek,
      categoryId: form.categoryId || null,
      alcaldiaSlug: form.alcaldiaSlug || null,
      colonia: form.colonia || null,
      authorSlug: form.authorSlug,
      readingTime: form.readingTime,
      status: form.status,
      sourceKind: form.sourceKind || null,
      externalSource: form.externalSource || null,
      youtubeId: form.youtubeId || null,
      tags,
      toc: buildToc(content),
      content,
      imageCaption: form.imageCaption || null,
      featured: form.featured,
      tag: form.tag || null,
      categoryData,
      seo,
    };

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/lamira/noticias${isEdit ? `/${existing.id}` : ""}`, {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(isEdit ? "No se pudo guardar. Intenta de nuevo." : "No se pudo crear la noticia. Revisa los campos requeridos.");
        setSaving(false);
        return;
      }

      if (isEdit) {
        setSavedAt(Date.now());
        setSaving(false);
        router.refresh();
      } else {
        const created = await res.json();
        router.push(`/contenido/lamira/noticia/${created.id}`);
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isEdit && (
        <ImproveWithAiPanel contentType="noticia" contentId={existing.id} expanded={improving} onToggle={() => setImproving((v) => !v)} onResult={setImproveResult} />
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
          <label htmlFor="n-title" className={labelClass}>
            Título
          </label>
          <input id="n-title" required value={form.title} onChange={(e) => set("title", e.target.value)} className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="n-dek" className={labelClass}>
            Bajada (dek)
          </label>
          <textarea id="n-dek" required rows={2} value={form.dek} onChange={(e) => set("dek", e.target.value)} className={`${fieldClass} resize-none`} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-category" className={labelClass}>
              Categoría
            </label>
            <select id="n-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={fieldClass}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-alcaldia" className={labelClass}>
              Alcaldía (slug)
            </label>
            <input id="n-alcaldia" value={form.alcaldiaSlug} onChange={(e) => set("alcaldiaSlug", e.target.value)} placeholder="ej. cuauhtemoc" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-colonia" className={labelClass}>
              Colonia (slug)
            </label>
            <input id="n-colonia" value={form.colonia} onChange={(e) => set("colonia", e.target.value)} placeholder="ej. condesa" className={fieldClass} />
          </div>
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <ContentBlocksField blocks={content} onChange={setContent} />

        <TagsField label="Etiquetas" tags={tags} onChange={setTags} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-author" className={labelClass}>
              Autor (slug)
            </label>
            <input id="n-author" required value={form.authorSlug} onChange={(e) => set("authorSlug", e.target.value)} placeholder="ej. mariana-robles" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-reading" className={labelClass}>
              Tiempo de lectura
            </label>
            <input id="n-reading" value={form.readingTime} onChange={(e) => set("readingTime", e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-source-kind" className={labelClass}>
              Tipo de fuente
            </label>
            <input id="n-source-kind" value={form.sourceKind} onChange={(e) => set("sourceKind", e.target.value)} placeholder="demo / institucional / editorial" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-external-source" className={labelClass}>
              Fuente externa citada
            </label>
            <input id="n-external-source" value={form.externalSource} onChange={(e) => set("externalSource", e.target.value)} placeholder="ej. Con información de Reforma" className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-image-caption" className={labelClass}>
              Pie de foto
            </label>
            <input id="n-image-caption" value={form.imageCaption} onChange={(e) => set("imageCaption", e.target.value)} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-youtube" className={labelClass}>
              ID de YouTube (opcional)
            </label>
            <input id="n-youtube" value={form.youtubeId} onChange={(e) => set("youtubeId", e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-tag" className={labelClass}>
              Badge especial
            </label>
            <select id="n-tag" value={form.tag} onChange={(e) => set("tag", e.target.value)} className={`${fieldClass} max-w-[200px]`}>
              <option value="">Ninguno</option>
              <option value="CLIMA">CLIMA</option>
              <option value="DEPORTES">DEPORTES</option>
            </select>
          </div>
          <label className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-ink-soft">
            <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} className="size-4 rounded border-border accent-brand" />
            Destacada
          </label>
        </div>

        <SeoPanel seo={seo} onChange={setSeo} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="n-status" className={labelClass}>
            Estado
          </label>
          <select id="n-status" value={form.status} onChange={(e) => set("status", e.target.value as ContentStatus)} className={`${fieldClass} max-w-[220px]`}>
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
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear noticia"}
          </button>
          {savedAt && <span className="font-mono text-[12px] text-positive">Guardado ✓</span>}
        </div>
      </form>
    </div>
  );
}
