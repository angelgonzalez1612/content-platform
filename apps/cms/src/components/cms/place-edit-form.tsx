"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { PlaceDetail, Category, CheckResult, AiDecision, Seo } from "@planazo/types";
import type { UpdatePlaceInput } from "@/lib/cms-api";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ImproveWithAiPanel } from "@/components/cms/improve-with-ai-panel";
import { AlcaldiaSelect } from "@/components/cms/lamira/alcaldia-select";
import { ImageField } from "@/components/cms/lamira/image-field";
import { EditPreviewLayout } from "@/components/cms/lamira/edit-preview-layout";
import { PlanazoPreviewCard } from "@/components/cms/planazo/planazo-preview-card";
import { ContentBlocksField, type ContentBlockValue } from "@/components/cms/content-blocks-field";

const STATUS_OPTIONS: Array<{ value: PlaceDetail["status"]; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "in_review", label: "En revisión" },
  { value: "scheduled", label: "Programado" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Archivado" },
];

interface ImproveDraft {
  description?: string;
  seo?: Seo;
  [key: string]: unknown;
}

export function PlaceEditForm({ place, category }: { place: PlaceDetail; category: Category | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: place.name,
    description: place.description ?? "",
    zone: place.zone ?? "",
    alcaldiaSlug: place.alcaldiaSlug ?? "",
    address: place.address ?? "",
    priceLevel: place.priceLevel,
    price: place.price,
    rating: place.rating,
    phone: place.phone ?? "",
    website: place.website ?? "",
    status: place.status,
    allowPhotoModal: place.allowPhotoModal,
  });
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>(place.categoryData ?? {});
  const [seo, setSeo] = useState<Seo>(place.seo ?? {});
  const cover = place.photos[0];
  const [image, setImage] = useState<{ url: string; credit: string } | null>(cover ? { url: cover.url, credit: cover.credit ?? "" } : null);
  const [content, setContent] = useState<ContentBlockValue[]>((place.content ?? []).map((b) => ({ ...b, heading: b.heading ?? null })));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [improving, setImproving] = useState(false);
  const [improveResult, setImproveResult] = useState<{ draft: ImproveDraft; checksRun: CheckResult[]; decision: AiDecision } | null>(null);
  const [improveMode, setImproveMode] = useState<"rewrite" | "expand">("rewrite");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  }

  async function save(status: PlaceDetail["status"]) {
    setSaving(true);
    setError("");

    const payload: UpdatePlaceInput = {
      name: form.name,
      description: form.description || null,
      zone: form.zone || null,
      alcaldiaSlug: form.alcaldiaSlug || null,
      address: form.address || null,
      priceLevel: form.priceLevel,
      price: form.price,
      rating: form.rating,
      phone: form.phone || null,
      website: form.website || null,
      status,
      categoryData,
      seo,
      photo: image,
      content,
      allowPhotoModal: form.allowPhotoModal,
    };

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/places/${place.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError("No se pudo guardar. Intenta de nuevo.");
        return;
      }

      setForm((f) => ({ ...f, status }));
      setSavedAt(Date.now());
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
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

  function applyImprovement() {
    if (!improveResult) return;
    if (improveMode === "expand") {
      const newContent = improveResult.draft.content as ContentBlockValue[] | undefined;
      if (newContent) setContent(newContent);
      setImproveResult(null);
      return;
    }
    const { description, seo: improvedSeo, ...rest } = improveResult.draft;
    if (description) set("description", description);
    if (improvedSeo) setSeo(improvedSeo);
    setCategoryData((prev) => ({ ...prev, ...rest }));
    if (improveResult.decision === "auto-published") set("status", "published");
    setImproveResult(null);
  }

  const preview = (
    <PlanazoPreviewCard
      kind="lugar"
      name={form.name}
      categoryLabel={category?.name ?? ""}
      image={image}
      address={form.address}
      zone={form.zone}
      price={form.price}
      tags={place.tags.map((t) => t.name)}
      description={form.description}
      content={content}
    />
  );

  const left = (
    <div className="flex flex-col gap-4">
      <ImproveWithAiPanel
        contentType="place"
        contentId={place.id}
        expanded={improving}
        onToggle={() => setImproving((v) => !v)}
        onResult={(result, mode) => {
          setImproveResult(result);
          setImproveMode(mode);
        }}
        supportsExpand
      />

      {improveResult && (
        <div className="flex flex-col gap-4 rounded-[14px] border border-brand bg-accent p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium tracking-[.1em] text-accent-fg uppercase">
              {improveMode === "expand" ? "Contenido nuevo — revisa antes de aplicar" : "Borrador mejorado — revisa antes de aplicar"}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-medium ${
                improveResult.decision === "auto-published" ? "bg-[#EAF7EF] text-[#2E9E5B]" : "bg-[#FEF6E7] text-[#9A6B12]"
              }`}
            >
              {improveResult.decision === "auto-published" ? "Pasa todos los checks" : "Necesita revisión"}
            </span>
          </div>

          {improveMode === "expand" ? (
            <div className="flex flex-col gap-3 text-[13px]">
              {((improveResult.draft.content as ContentBlockValue[] | undefined) ?? []).slice(content.length).map((block, i) => (
                <div key={i} className="rounded-[10px] border border-[#FFE2CC] bg-white p-3">
                  {block.heading && <p className="font-semibold text-ink">{block.heading}</p>}
                  {block.paragraphs.map((p, pi) => (
                    <p key={pi} className="mt-1.5 text-ink-soft">
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <span className={labelClass}>Descripción actual</span>
                <p className="mt-1 text-ink-soft">{form.description || "(vacía)"}</p>
              </div>
              <div>
                <span className={labelClass}>Descripción mejorada</span>
                <p className="mt-1 text-ink">{improveResult.draft.description as string}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {improveResult.checksRun.map((c) => (
              <div key={c.name} className="flex items-start gap-2 text-[12px]">
                <span className={c.passed ? "text-[#2E9E5B]" : c.blocking ? "text-[#C4453A]" : "text-[#9A6B12]"}>
                  {c.passed ? "✓" : c.blocking ? "✕" : "△"}
                </span>
                <span className="text-ink-soft">
                  {c.name}
                  {c.detail && <span className="text-ink-faint"> — {c.detail}</span>}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t border-[#FFE2CC] pt-4">
            <button
              type="button"
              onClick={applyImprovement}
              className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-pressed"
            >
              Aplicar al formulario
            </button>
            <button type="button" onClick={() => setImproveResult(null)} className="text-[13px] font-medium text-ink-soft hover:text-brand">
              Descartar
            </button>
          </div>
          <p className="text-[11.5px] text-ink-faint">
            Aplicar solo llena el formulario de abajo — nada se guarda hasta que presiones &quot;Guardar cambios&quot;.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={labelClass}>
            Nombre
          </label>
          <input id="name" required value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className={labelClass}>
            Descripción
          </label>
          <textarea
            id="description"
            rows={4}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={`${fieldClass} resize-none`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Categoría</span>
          <p className="text-[13.5px] text-ink">{category?.name ?? "Sin categoría"}</p>
        </div>

        <ImageField image={image} onChange={setImage} />

        <label className="flex items-start gap-2.5 rounded-[10px] border border-border-soft bg-background p-3">
          <input
            type="checkbox"
            checked={form.allowPhotoModal}
            onChange={(e) => set("allowPhotoModal", e.target.checked)}
            className="mt-0.5 size-4 accent-brand"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-ink">Foto ampliable</span>
            <span className="text-[11.5px] text-ink-faint">
              Apagado por defecto — actívalo solo si la foto real del lugar amerita verse en pantalla completa. Si está apagado, la foto en el sitio no es clickeable.
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Contenido extendido (opcional)</span>
          <p className="text-[11.5px] text-ink-faint">
            Secciones adicionales que se muestran debajo de la descripción — pueden agregarse a mano o con &quot;Agregar contenido&quot; en Mejorar con IA, arriba.
          </p>
          <ContentBlocksField blocks={content} onChange={setContent} />
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="zone" className={labelClass}>
              Zona / colonia
            </label>
            <input id="zone" value={form.zone} onChange={(e) => set("zone", e.target.value)} placeholder="ej. Roma Norte" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="place-alcaldia" className={labelClass}>
              Alcaldía / municipio
            </label>
            <AlcaldiaSelect id="place-alcaldia" value={form.alcaldiaSlug} onChange={(slug) => set("alcaldiaSlug", slug)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="address" className={labelClass}>
              Dirección
            </label>
            <input id="address" value={form.address} onChange={(e) => set("address", e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="priceLevel" className={labelClass}>
              Nivel de precio
            </label>
            <select
              id="priceLevel"
              value={form.priceLevel ?? ""}
              onChange={(e) => set("priceLevel", e.target.value ? Number(e.target.value) : null)}
              className={fieldClass}
            >
              <option value="">Sin definir</option>
              <option value="1">$</option>
              <option value="2">$$</option>
              <option value="3">$$$</option>
              <option value="4">$$$$</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="price" className={labelClass}>
              Precio (MXN)
            </label>
            <input
              id="price"
              type="number"
              min={0}
              value={form.price ?? ""}
              onChange={(e) => set("price", e.target.value ? Number(e.target.value) : null)}
              placeholder="Vacío = gratis"
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rating" className={labelClass}>
              Rating
            </label>
            <input
              id="rating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={form.rating ?? ""}
              onChange={(e) => set("rating", e.target.value ? Number(e.target.value) : null)}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className={labelClass}>
              Teléfono
            </label>
            <input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="website" className={labelClass}>
              Sitio web
            </label>
            <input id="website" value={form.website} onChange={(e) => set("website", e.target.value)} className={fieldClass} />
          </div>
        </div>

        <SeoPanel seo={seo} onChange={setSeo} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className={labelClass}>
            Estado
          </label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => set("status", e.target.value as PlaceDetail["status"])}
            className={`${fieldClass} max-w-[220px]`}
          >
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
