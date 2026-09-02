"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { Alerta, AlertaStatus, Category, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { AlcaldiaSelect } from "@/components/cms/lamira/alcaldia-select";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { PairListField } from "@/components/cms/pair-list-field";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ImproveWithAiPanel } from "@/components/cms/improve-with-ai-panel";
import { ImprovePreview, type ImproveResult } from "@/components/cms/lamira/improve-preview";
import { RichTextarea } from "@/components/cms/rich-textarea";
import { ImageField } from "@/components/cms/lamira/image-field";
import { EditPreviewLayout } from "@/components/cms/lamira/edit-preview-layout";
import { LamiraPreviewCard } from "@/components/cms/lamira/lamira-preview-card";

const STATUS_OPTIONS: Array<{ value: AlertaStatus; label: string }> = [
  { value: "activa", label: "Activa" },
  { value: "en-seguimiento", label: "En seguimiento" },
  { value: "resuelta", label: "Resuelta" },
];

export function AlertaForm({ categories, existing }: { categories: Category[]; existing?: Alerta }) {
  const router = useRouter();
  const isEdit = !!existing;
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    alertaStatus: existing?.alertaStatus ?? ("activa" as AlertaStatus),
    categoryId: existing?.category?.id ?? categories[0]?.id ?? "",
    alcaldiaSlug: existing?.alcaldiaSlug ?? "",
    description: existing?.description ?? "",
  });
  const [updates, setUpdates] = useState(existing?.updates ?? []);
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
      title: form.title,
      alertaStatus: form.alertaStatus,
      categoryId: form.categoryId || null,
      alcaldiaSlug: form.alcaldiaSlug || null,
      description: form.description,
      updates,
      imageUrl: image?.url ?? null,
      imageCredit: image?.credit ?? null,
      categoryData,
      seo,
    };

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/lamira/alertas${isEdit ? `/${existing.id}` : ""}`, {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(isEdit ? "No se pudo guardar. Intenta de nuevo." : "No se pudo crear la alerta. Revisa los campos requeridos.");
        setSaving(false);
        return;
      }

      if (isEdit) {
        setSavedAt(Date.now());
        setSaving(false);
        router.refresh();
      } else {
        const created = await res.json();
        router.push(`/contenido/lamira/alerta/${created.id}`);
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
      setSaving(false);
    }
  }

  const preview = (
    <LamiraPreviewCard
      type="alerta"
      name={form.title}
      categoryName={category?.name ?? null}
      image={image}
      dek=""
      description={form.description}
      content={[]}
      alertaStatus={form.alertaStatus}
      alcaldiaSlug={form.alcaldiaSlug}
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
        <ImproveWithAiPanel contentType="alerta" contentId={existing.id} expanded={improving} onToggle={() => setImproving((v) => !v)} onResult={setImproveResult} />
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
          <label htmlFor="a-title" className={labelClass}>
            Título
          </label>
          <input id="a-title" required value={form.title} onChange={(e) => set("title", e.target.value)} className={fieldClass} />
        </div>

        <ImageField image={image} onChange={setImage} searchQuery={form.title} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="a-description" className={labelClass}>
            Descripción
          </label>
          <RichTextarea id="a-description" required rows={4} value={form.description} onChange={(v) => set("description", v)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="a-category" className={labelClass}>
              Categoría
            </label>
            <select id="a-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={fieldClass}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="a-alcaldia" className={labelClass}>
              Alcaldía / municipio
            </label>
            <AlcaldiaSelect id="a-alcaldia" value={form.alcaldiaSlug} onChange={(slug) => set("alcaldiaSlug", slug)} />
          </div>
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <PairListField
          label="Actualizaciones"
          items={updates}
          onChange={setUpdates}
          keyA="time"
          keyB="text"
          labelA="Hora"
          labelB="Texto"
          placeholderA="ej. 11:32"
          placeholderB="Qué pasó a esa hora"
          multilineB
          addLabel="+ Actualización"
        />

        <SeoPanel seo={seo} onChange={setSeo} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="a-status" className={labelClass}>
            Estado de la alerta
          </label>
          <select id="a-status" value={form.alertaStatus} onChange={(e) => set("alertaStatus", e.target.value as AlertaStatus)} className={`${fieldClass} max-w-[220px]`}>
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
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear alerta"}
          </button>
          {savedAt && <span className="font-mono text-[12px] text-positive">Guardado ✓</span>}
        </div>
      </form>
    </div>
  );

  return <EditPreviewLayout left={left} preview={preview} />;
}
