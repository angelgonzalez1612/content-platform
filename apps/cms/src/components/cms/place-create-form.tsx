"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { ContentStatus, Category, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { SeoPanel } from "@/components/cms/seo-panel";
import { AlcaldiaSelect } from "@/components/cms/lamira/alcaldia-select";
import { ImageField } from "@/components/cms/lamira/image-field";
import { EditPreviewLayout } from "@/components/cms/lamira/edit-preview-layout";
import { PlanazoPreviewCard } from "@/components/cms/planazo/planazo-preview-card";

const STATUS_OPTIONS: Array<{ value: ContentStatus; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "in_review", label: "En revisión" },
  { value: "published", label: "Publicado" },
];

export function PlaceCreateForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    categoryId: categories[0]?.id ?? "",
    zone: "",
    alcaldiaSlug: "",
    address: "",
    priceLevel: null as number | null,
    price: null as number | null,
    rating: null as number | null,
    phone: "",
    website: "",
    status: "draft" as ContentStatus,
    allowPhotoModal: false,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>({});
  const [seo, setSeo] = useState<Seo>({});
  const [image, setImage] = useState<{ url: string; credit: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const category = categories.find((c) => c.id === form.categoryId) ?? null;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addTag() {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) setTags((t) => [...t, tag]);
    setTagInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/places`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          zone: form.zone || null,
          alcaldiaSlug: form.alcaldiaSlug || null,
          address: form.address || null,
          priceLevel: form.priceLevel,
          price: form.price,
          rating: form.rating,
          categorySlug: category?.slug,
          tags,
          status: form.status,
          categoryData,
          seo,
          photo: image,
          allowPhotoModal: form.allowPhotoModal,
        }),
      });

      if (!res.ok) {
        setError("No se pudo crear el lugar. Revisa los campos requeridos.");
        setCreating(false);
        return;
      }

      const created = await res.json();
      router.push(`/contenido/${created.id}`);
    } catch {
      setError("No se pudo conectar con el servidor.");
      setCreating(false);
    }
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
      tags={tags}
      description={form.description}
    />
  );

  const left = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-name" className={labelClass}>
          Nombre
        </label>
        <input
          id="c-name"
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="ej. Café Nin"
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-description" className={labelClass}>
          Descripción
        </label>
        <textarea
          id="c-description"
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-category" className={labelClass}>
          Categoría
        </label>
        <select
          id="c-category"
          value={form.categoryId}
          onChange={(e) => set("categoryId", e.target.value)}
          className={`${fieldClass} max-w-[220px]`}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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

      <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-zone" className={labelClass}>
            Zona / colonia
          </label>
          <input id="c-zone" value={form.zone} onChange={(e) => set("zone", e.target.value)} placeholder="ej. Roma Norte" className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-alcaldia" className={labelClass}>
            Alcaldía / municipio
          </label>
          <AlcaldiaSelect id="c-alcaldia" value={form.alcaldiaSlug} onChange={(slug) => set("alcaldiaSlug", slug)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-address" className={labelClass}>
            Dirección
          </label>
          <input id="c-address" value={form.address} onChange={(e) => set("address", e.target.value)} className={fieldClass} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-priceLevel" className={labelClass}>
            Nivel de precio
          </label>
          <select
            id="c-priceLevel"
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
          <label htmlFor="c-price" className={labelClass}>
            Precio (MXN)
          </label>
          <input
            id="c-price"
            type="number"
            min={0}
            value={form.price ?? ""}
            onChange={(e) => set("price", e.target.value ? Number(e.target.value) : null)}
            placeholder="Vacío = gratis"
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-rating" className={labelClass}>
            Rating
          </label>
          <input
            id="c-rating"
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
          <label htmlFor="c-phone" className={labelClass}>
            Teléfono
          </label>
          <input id="c-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-website" className={labelClass}>
            Sitio web
          </label>
          <input id="c-website" value={form.website} onChange={(e) => set("website", e.target.value)} className={fieldClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-tags" className={labelClass}>
          Etiquetas
        </label>
        <div className="flex gap-2">
          <input
            id="c-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Escribe y presiona Enter"
            className={`${fieldClass} flex-1`}
          />
          <button type="button" onClick={addTag} className="rounded-xl border border-border bg-background px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-[#F5F3F0]">
            Agregar
          </button>
        </div>
        {tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[12px]">
                {tag}
                <button
                  type="button"
                  onClick={() => setTags((t) => t.filter((x) => x !== tag))}
                  aria-label={`Quitar ${tag}`}
                  className="text-ink-faint hover:text-negative"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <SeoPanel seo={seo} onChange={setSeo} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-status" className={labelClass}>
          Estado
        </label>
        <select
          id="c-status"
          value={form.status}
          onChange={(e) => set("status", e.target.value as ContentStatus)}
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
          disabled={creating}
          className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-60 disabled:shadow-none"
        >
          {creating ? "Creando…" : "Crear lugar"}
        </button>
      </div>
    </form>
  );

  return <EditPreviewLayout left={left} preview={preview} />;
}
