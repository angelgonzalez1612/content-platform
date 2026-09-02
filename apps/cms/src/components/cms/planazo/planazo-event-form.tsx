"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { PlanazoEvent, Category, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ImproveWithAiPanel } from "@/components/cms/improve-with-ai-panel";
import { ImprovePreview, type ImproveResult } from "@/components/cms/lamira/improve-preview";
import { AlcaldiaSelect } from "@/components/cms/lamira/alcaldia-select";
import { ImageField } from "@/components/cms/lamira/image-field";
import { EditPreviewLayout } from "@/components/cms/lamira/edit-preview-layout";
import { PlanazoPreviewCard } from "@/components/cms/planazo/planazo-preview-card";

// `startDate` es el valor crudo de un <input type="datetime-local"> ("2026-09-01T18:00") — para la vista previa.
function toDateLabelPreview(startDate: string): string {
  if (!startDate) return "";
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return "";
  const label = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date);
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

const STATUS_OPTIONS: Array<{ value: PlanazoEvent["status"]; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "in_review", label: "En revisión" },
  { value: "scheduled", label: "Programado" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Archivado" },
];

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
    status: existing.status,
  });
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>(existing.categoryData ?? {});
  const [seo, setSeo] = useState<Seo>(existing.seo ?? {});
  const [image, setImage] = useState<{ url: string; credit: string } | null>(
    existing.imageUrl ? { url: existing.imageUrl, credit: existing.imageCredit ?? "" } : null,
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
      imageCredit: image?.credit ?? null,
      status,
      categoryData,
      seo,
    };

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/events/${existing.id}`, {
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
      locationName={form.locationName}
      dateLabel={toDateLabelPreview(form.startDate)}
      description={form.description}
    />
  );

  const left = (
    <div className="flex flex-col gap-4">
      <ImproveWithAiPanel contentType="evento-planazo" contentId={existing.id} expanded={improving} onToggle={() => setImproving((v) => !v)} onResult={setImproveResult} />

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
          <label htmlFor="pe-name" className={labelClass}>
            Nombre
          </label>
          <input id="pe-name" required value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldClass} />
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

        <ImageField image={image} onChange={setImage} />

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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

        <SeoPanel seo={seo} onChange={setSeo} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-status" className={labelClass}>
            Estado
          </label>
          <select id="pe-status" value={form.status} onChange={(e) => set("status", e.target.value as PlanazoEvent["status"])} className={`${fieldClass} max-w-[220px]`}>
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
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          {form.status !== "published" && (
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
