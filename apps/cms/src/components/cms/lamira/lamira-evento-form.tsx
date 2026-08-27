"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { LamiraEvento, EventoStatus, Category, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ImproveWithAiPanel } from "@/components/cms/improve-with-ai-panel";
import { ImprovePreview, type ImproveResult } from "@/components/cms/lamira/improve-preview";
import { RichTextarea } from "@/components/cms/rich-textarea";

const STATUS_OPTIONS: Array<{ value: EventoStatus; label: string }> = [
  { value: "proximo", label: "Próximo" },
  { value: "en-curso", label: "En curso" },
  { value: "finalizado", label: "Finalizado" },
  { value: "cancelado", label: "Cancelado" },
];

export function LamiraEventoForm({ categories, existing }: { categories: Category[]; existing?: LamiraEvento }) {
  const router = useRouter();
  const isEdit = !!existing;
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    tag: existing?.tag ?? "",
    categoryId: existing?.category?.id ?? categories[0]?.id ?? "",
    eventoStatus: existing?.eventoStatus ?? ("proximo" as EventoStatus),
    date: existing?.date ?? "",
    time: existing?.time ?? "",
    location: existing?.location ?? "",
    alcaldiaSlug: existing?.alcaldiaSlug ?? "",
    price: existing?.price ?? "",
    description: existing?.description ?? "",
    organizer: existing?.organizer ?? "",
    officialUrl: existing?.officialUrl ?? "",
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
      title: form.title,
      tag: form.tag,
      categoryId: form.categoryId || null,
      eventoStatus: form.eventoStatus,
      date: form.date,
      time: form.time,
      location: form.location,
      alcaldiaSlug: form.alcaldiaSlug || null,
      price: form.price,
      description: form.description,
      organizer: form.organizer,
      officialUrl: form.officialUrl || null,
      categoryData,
      seo,
    };

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/lamira/eventos${isEdit ? `/${existing.id}` : ""}`, {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(isEdit ? "No se pudo guardar. Intenta de nuevo." : "No se pudo crear el evento. Revisa los campos requeridos.");
        setSaving(false);
        return;
      }

      if (isEdit) {
        setSavedAt(Date.now());
        setSaving(false);
        router.refresh();
      } else {
        const created = await res.json();
        router.push(`/contenido/lamira/evento/${created.id}`);
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isEdit && (
        <ImproveWithAiPanel contentType="evento" contentId={existing.id} expanded={improving} onToggle={() => setImproving((v) => !v)} onResult={setImproveResult} />
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
        <div className="grid grid-cols-[1fr_140px] gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="e-title" className={labelClass}>
              Título
            </label>
            <input id="e-title" required value={form.title} onChange={(e) => set("title", e.target.value)} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="e-tag" className={labelClass}>
              Badge
            </label>
            <input id="e-tag" required value={form.tag} onChange={(e) => set("tag", e.target.value)} placeholder="ej. GRATIS" className={fieldClass} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-description" className={labelClass}>
            Descripción
          </label>
          <RichTextarea id="e-description" required rows={4} value={form.description} onChange={(v) => set("description", v)} className={`${fieldClass} resize-none`} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-category" className={labelClass}>
            Categoría
          </label>
          <select id="e-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={`${fieldClass} max-w-[280px]`}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="e-date" className={labelClass}>
              Fecha
            </label>
            <input id="e-date" required value={form.date} onChange={(e) => set("date", e.target.value)} placeholder="ej. 2026-08-30" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="e-time" className={labelClass}>
              Hora
            </label>
            <input id="e-time" required value={form.time} onChange={(e) => set("time", e.target.value)} placeholder="ej. 18:00" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="e-price" className={labelClass}>
              Precio
            </label>
            <input id="e-price" required value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="ej. Gratis, $250" className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="e-location" className={labelClass}>
              Ubicación
            </label>
            <input id="e-location" required value={form.location} onChange={(e) => set("location", e.target.value)} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="e-alcaldia" className={labelClass}>
              Alcaldía (slug)
            </label>
            <input id="e-alcaldia" value={form.alcaldiaSlug} onChange={(e) => set("alcaldiaSlug", e.target.value)} placeholder="ej. cuauhtemoc" className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="e-organizer" className={labelClass}>
              Organizador
            </label>
            <input id="e-organizer" required value={form.organizer} onChange={(e) => set("organizer", e.target.value)} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="e-url" className={labelClass}>
              URL oficial
            </label>
            <input id="e-url" value={form.officialUrl} onChange={(e) => set("officialUrl", e.target.value)} className={fieldClass} />
          </div>
        </div>

        <SeoPanel seo={seo} onChange={setSeo} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="e-status" className={labelClass}>
            Estado del evento
          </label>
          <select id="e-status" value={form.eventoStatus} onChange={(e) => set("eventoStatus", e.target.value as EventoStatus)} className={`${fieldClass} max-w-[220px]`}>
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
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear evento"}
          </button>
          {savedAt && <span className="font-mono text-[12px] text-positive">Guardado ✓</span>}
        </div>
      </form>
    </div>
  );
}
