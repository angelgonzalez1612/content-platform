"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { LamiraLugar, LugarKind, Category, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ImproveWithAiPanel } from "@/components/cms/improve-with-ai-panel";
import { ImprovePreview, type ImproveResult } from "@/components/cms/lamira/improve-preview";
import { RichTextarea } from "@/components/cms/rich-textarea";

const KIND_OPTIONS: Array<{ value: LugarKind; label: string }> = [
  { value: "parque", label: "Parque" },
  { value: "plaza", label: "Plaza" },
  { value: "museo", label: "Museo" },
  { value: "monumento", label: "Monumento" },
  { value: "colonia", label: "Colonia" },
  { value: "estacion-metro", label: "Estación de Metro" },
  { value: "estacion-metrobus", label: "Estación de Metrobús" },
];

export function LamiraLugarForm({ categories, existing }: { categories: Category[]; existing?: LamiraLugar }) {
  const router = useRouter();
  const isEdit = !!existing;
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    kind: existing?.kind ?? ("parque" as LugarKind),
    categoryId: existing?.category?.id ?? categories[0]?.id ?? "",
    alcaldiaSlug: existing?.alcaldiaSlug ?? "",
    colonia: existing?.colonia ?? "",
    description: existing?.description ?? "",
  });
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
    const { description, seo: improvedSeo, ...rest } = improveResult.draft as { description?: string; seo?: Seo; [k: string]: unknown };
    if (description) set("description", description);
    if (improvedSeo) setSeo(improvedSeo);
    setCategoryData((prev) => ({ ...prev, ...rest }));
    setImproveResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      kind: form.kind,
      categoryId: form.categoryId || null,
      alcaldiaSlug: form.alcaldiaSlug,
      colonia: form.colonia || null,
      description: form.description,
      categoryData,
      seo,
    };

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/lamira/lugares${isEdit ? `/${existing.id}` : ""}`, {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(isEdit ? "No se pudo guardar. Intenta de nuevo." : "No se pudo crear el lugar. Revisa los campos requeridos.");
        setSaving(false);
        return;
      }

      if (isEdit) {
        setSavedAt(Date.now());
        setSaving(false);
        router.refresh();
      } else {
        const created = await res.json();
        router.push(`/contenido/lamira/lugar/${created.id}`);
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isEdit && (
        <ImproveWithAiPanel contentType="lugar" contentId={existing.id} expanded={improving} onToggle={() => setImproving((v) => !v)} onResult={setImproveResult} />
      )}

      {improveResult && (
        <ImprovePreview
          result={improveResult}
          fields={[{ label: "Descripción", current: form.description, improved: (improveResult.draft.description as string) ?? "" }]}
          onApply={applyImprovement}
          onDiscard={() => setImproveResult(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="l-name" className={labelClass}>
            Nombre
          </label>
          <input id="l-name" required value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="l-description" className={labelClass}>
            Descripción
          </label>
          <RichTextarea id="l-description" required rows={4} value={form.description} onChange={(v) => set("description", v)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="l-kind" className={labelClass}>
              Tipo de lugar
            </label>
            <select id="l-kind" value={form.kind} onChange={(e) => set("kind", e.target.value as LugarKind)} className={fieldClass}>
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="l-category" className={labelClass}>
              Categoría
            </label>
            <select id="l-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={fieldClass}>
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
            <label htmlFor="l-alcaldia" className={labelClass}>
              Alcaldía (slug)
            </label>
            <input id="l-alcaldia" required value={form.alcaldiaSlug} onChange={(e) => set("alcaldiaSlug", e.target.value)} placeholder="ej. cuauhtemoc" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="l-colonia" className={labelClass}>
              Colonia (slug)
            </label>
            <input id="l-colonia" value={form.colonia} onChange={(e) => set("colonia", e.target.value)} placeholder="ej. condesa" className={fieldClass} />
          </div>
        </div>

        <SeoPanel seo={seo} onChange={setSeo} />

        {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

        <div className="flex items-center gap-3 border-t border-border-soft pt-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-60 disabled:shadow-none"
          >
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear lugar"}
          </button>
          {savedAt && <span className="font-mono text-[12px] text-positive">Guardado ✓</span>}
        </div>
      </form>
    </div>
  );
}
