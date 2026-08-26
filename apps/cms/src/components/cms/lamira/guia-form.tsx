"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { Guia, ContentStatus, Category, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { ContentBlocksField, type ContentBlockValue } from "@/components/cms/content-blocks-field";
import { PairListField } from "@/components/cms/pair-list-field";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ImproveWithAiPanel } from "@/components/cms/improve-with-ai-panel";
import { ImprovePreview, type ImproveResult } from "@/components/cms/lamira/improve-preview";
import { withBlockIds, summarizeBlocks } from "@/components/cms/lamira/content-blocks-util";

const STATUS_OPTIONS: Array<{ value: ContentStatus; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "in_review", label: "En revisión" },
  { value: "scheduled", label: "Programado" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Archivado" },
];

// Catálogo fijo de la-mira (GuideGroup) — no tiene su propio endpoint, no vale
// la pena construir uno solo para 8 valores que casi nunca cambian.
const GROUP_OPTIONS = [
  { value: "documentos-e-identidad", label: "Documentos e identidad" },
  { value: "licencias-y-manejo", label: "Licencias y manejo" },
  { value: "vehiculos-y-placas", label: "Vehículos y placas" },
  { value: "multas-y-circulacion", label: "Multas y circulación" },
  { value: "transporte-publico", label: "Transporte público" },
  { value: "salud", label: "Salud" },
  { value: "apoyos-sociales", label: "Apoyos sociales" },
  { value: "vivienda-y-seguridad", label: "Vivienda y seguridad" },
];

export function GuiaForm({ categories, existing }: { categories: Category[]; existing?: Guia }) {
  const router = useRouter();
  const isEdit = !!existing;
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    dek: existing?.dek ?? "",
    groupSlug: existing?.groupSlug ?? GROUP_OPTIONS[0].value,
    categoryId: existing?.category?.id ?? "",
    readingTime: existing?.readingTime ?? "5 min de lectura",
    status: existing?.status ?? ("draft" as ContentStatus),
    officialSourceLabel: existing?.officialSource?.label ?? "",
    officialSourceUrl: existing?.officialSource?.url ?? "",
  });
  const [quickFacts, setQuickFacts] = useState(existing?.quickFacts ?? []);
  const [faq, setFaq] = useState(existing?.faq ?? []);
  const [content, setContent] = useState<ContentBlockValue[]>(
    existing?.content.map((b) => ({ heading: b.heading, paragraphs: b.paragraphs })) ?? [{ heading: "", paragraphs: [""] }],
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
    const { dek, content: improvedContent, faq: improvedFaq, seo: improvedSeo, ...rest } = improveResult.draft as {
      dek?: string;
      content?: { id: string; heading: string; paragraphs: string[] }[];
      faq?: { question: string; answer: string }[];
      seo?: Seo;
      [k: string]: unknown;
    };
    if (dek) set("dek", dek);
    if (improvedContent) setContent(improvedContent.map((b) => ({ heading: b.heading, paragraphs: b.paragraphs })));
    if (improvedFaq) setFaq(improvedFaq);
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
      groupSlug: form.groupSlug,
      categoryId: form.categoryId || null,
      readingTime: form.readingTime,
      status: form.status,
      officialSource: form.officialSourceLabel && form.officialSourceUrl ? { label: form.officialSourceLabel, url: form.officialSourceUrl } : null,
      quickFacts,
      content: withBlockIds(content),
      faq,
      categoryData,
      seo,
    };

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/lamira/guias${isEdit ? `/${existing.id}` : ""}`, {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(isEdit ? "No se pudo guardar. Intenta de nuevo." : "No se pudo crear la guía. Revisa los campos requeridos.");
        setSaving(false);
        return;
      }

      if (isEdit) {
        setSavedAt(Date.now());
        setSaving(false);
        router.refresh();
      } else {
        const created = await res.json();
        router.push(`/contenido/lamira/guia/${created.id}`);
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isEdit && (
        <ImproveWithAiPanel contentType="guia" contentId={existing.id} expanded={improving} onToggle={() => setImproving((v) => !v)} onResult={setImproveResult} />
      )}

      {improveResult && (
        <ImprovePreview
          result={improveResult}
          fields={[
            { label: "Bajada (dek)", current: form.dek, improved: (improveResult.draft.dek as string) ?? "" },
            { label: "Cuerpo", current: summarizeBlocks(content), improved: summarizeBlocks(((improveResult.draft.content as { heading: string; paragraphs: string[] }[]) ?? []).map((b) => ({ heading: b.heading, paragraphs: b.paragraphs }))) },
          ]}
          onApply={applyImprovement}
          onDiscard={() => setImproveResult(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="g-title" className={labelClass}>
            Título
          </label>
          <input id="g-title" required value={form.title} onChange={(e) => set("title", e.target.value)} className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="g-dek" className={labelClass}>
            Bajada (dek)
          </label>
          <textarea id="g-dek" required rows={2} value={form.dek} onChange={(e) => set("dek", e.target.value)} className={`${fieldClass} resize-none`} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="g-group" className={labelClass}>
              Grupo de trámite
            </label>
            <select id="g-group" value={form.groupSlug} onChange={(e) => set("groupSlug", e.target.value)} className={fieldClass}>
              {GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="g-category" className={labelClass}>
              Categoría (opcional — casi ninguna guía tiene una hoy)
            </label>
            <select id="g-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={fieldClass}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="g-source-label" className={labelClass}>
              Fuente oficial — nombre
            </label>
            <input id="g-source-label" value={form.officialSourceLabel} onChange={(e) => set("officialSourceLabel", e.target.value)} placeholder="ej. SEMOVI CDMX" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="g-source-url" className={labelClass}>
              Fuente oficial — URL
            </label>
            <input id="g-source-url" value={form.officialSourceUrl} onChange={(e) => set("officialSourceUrl", e.target.value)} placeholder="https://…" className={fieldClass} />
          </div>
        </div>

        <PairListField
          label="Datos rápidos"
          items={quickFacts}
          onChange={setQuickFacts}
          keyA="label"
          keyB="value"
          labelA="Etiqueta"
          labelB="Valor"
          placeholderA="ej. Costo"
          placeholderB="ej. Varía según vigencia"
          addLabel="+ Dato rápido"
        />

        <ContentBlocksField blocks={content} onChange={setContent} headingRequired />

        <PairListField
          label="Preguntas frecuentes"
          items={faq}
          onChange={setFaq}
          keyA="question"
          keyB="answer"
          labelA="Pregunta"
          labelB="Respuesta"
          multilineB
          addLabel="+ Pregunta"
        />

        <SeoPanel seo={seo} onChange={setSeo} />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="g-reading" className={labelClass}>
              Tiempo de lectura
            </label>
            <input id="g-reading" value={form.readingTime} onChange={(e) => set("readingTime", e.target.value)} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="g-status" className={labelClass}>
              Estado
            </label>
            <select id="g-status" value={form.status} onChange={(e) => set("status", e.target.value as ContentStatus)} className={fieldClass}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

        <div className="flex items-center gap-3 border-t border-border-soft pt-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-60 disabled:shadow-none"
          >
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear guía"}
          </button>
          {savedAt && <span className="font-mono text-[12px] text-positive">Guardado ✓</span>}
        </div>
      </form>
    </div>
  );
}
