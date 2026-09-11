"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { ContentStatus, PlanazoGuide } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { ImageField } from "@/components/cms/lamira/image-field";
import { EditPreviewLayout } from "@/components/cms/lamira/edit-preview-layout";
import { GuideSectionsField, type GuideSectionValue, type PlaceOption } from "@/components/cms/planazo/guide-sections-field";

const STATUS_OPTIONS: Array<{ value: ContentStatus; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "in_review", label: "En revisión" },
  { value: "published", label: "Publicado" },
];

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "guia", label: "Guía / listicle" },
  { value: "lista", label: "Lista" },
  { value: "itinerario", label: "Itinerario" },
  { value: "comparacion", label: "Comparación" },
  { value: "agenda", label: "Agenda" },
  { value: "temporada", label: "Temporada" },
  { value: "plan", label: "Plan" },
];

export function GuideForm({ placeOptions, existing }: { placeOptions: PlaceOption[]; existing?: PlanazoGuide }) {
  const router = useRouter();
  const isEdit = !!existing;
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    type: existing?.type ?? "guia",
    intro: existing?.intro ?? "",
    categoryLabel: existing?.categoryLabel ?? "",
    readTime: existing?.readTime ?? "5 min de lectura",
    excerpt: existing?.excerpt ?? "",
    budget: existing?.budget ?? "",
    duration: existing?.duration ?? "",
    status: existing?.status ?? ("draft" as ContentStatus),
  });
  const [sections, setSections] = useState<GuideSectionValue[]>(
    existing?.sections.map((s) => ({ heading: s.heading, body: s.body, placeSlug: s.placeSlug ?? "" })) ?? [
      { heading: "", body: "", placeSlug: "" },
    ],
  );
  const [audience, setAudience] = useState<string[]>(existing?.audience ?? []);
  const [audienceInput, setAudienceInput] = useState("");
  const [image, setImage] = useState<{ url: string; credit: string } | null>(
    existing?.imageUrl ? { url: existing.imageUrl, credit: existing.imageCredit ?? "" } : null,
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  }

  function addAudience() {
    const value = audienceInput.trim();
    if (value && !audience.includes(value)) setAudience((a) => [...a, value]);
    setAudienceInput("");
  }

  async function save(status: ContentStatus) {
    setSaving(true);
    setError("");

    const payload = {
      title: form.title,
      description: form.description,
      type: form.type || null,
      intro: form.intro || null,
      sections: sections
        .filter((s) => s.heading.trim() && s.body.trim())
        .map((s) => ({ heading: s.heading, body: s.body, placeSlug: s.placeSlug || null })),
      categoryLabel: form.categoryLabel,
      readTime: form.readTime,
      imageUrl: image?.url ?? null,
      imageCredit: image?.credit ?? null,
      excerpt: form.excerpt || null,
      budget: form.budget || null,
      duration: form.duration || null,
      audience,
      status,
    };

    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/guides${isEdit ? `/${existing.id}` : ""}`, {
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
        setForm((f) => ({ ...f, status }));
        setSavedAt(Date.now());
        setSaving(false);
        router.refresh();
      } else {
        const created = await res.json();
        router.push(`/contenido/planazo-guia/${created.id}`);
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
    <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- preview de una URL externa arbitraria, mismo criterio que el resto del CMS
        <img src={image.url} alt="" className="h-[160px] w-full object-cover" />
      ) : (
        <div className="flex h-[160px] w-full items-center justify-center bg-background text-[12px] text-ink-faint">Sin imagen</div>
      )}
      <div className="flex flex-col gap-1.5 p-4">
        {form.categoryLabel && <span className="text-[11px] font-semibold tracking-wide text-brand uppercase">{form.categoryLabel}</span>}
        <span className="text-[15px] font-semibold tracking-tight text-ink">{form.title || "Título de la guía"}</span>
        <span className="text-[12.5px] text-ink-soft">{form.description || "Descripción corta…"}</span>
        <span className="mt-1 font-mono text-[11px] text-ink-faint">
          {form.readTime} · {sections.length} {sections.length === 1 ? "parada" : "paradas"}
        </span>
      </div>
    </div>
  );

  const left = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gu-title" className={labelClass}>
          Título
        </label>
        <input id="gu-title" required value={form.title} onChange={(e) => set("title", e.target.value)} className={fieldClass} />
      </div>

      <ImageField image={image} onChange={setImage} searchQuery={form.title} label="Portada" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gu-description" className={labelClass}>
          Descripción corta
        </label>
        <textarea
          id="gu-description"
          required
          rows={2}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gu-intro" className={labelClass}>
          Intro (párrafo de apertura, opcional)
        </label>
        <textarea id="gu-intro" rows={3} value={form.intro} onChange={(e) => set("intro", e.target.value)} className={`${fieldClass} resize-none`} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gu-type" className={labelClass}>
            Formato
          </label>
          <select id="gu-type" value={form.type} onChange={(e) => set("type", e.target.value)} className={fieldClass}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gu-category-label" className={labelClass}>
            Etiqueta de categoría
          </label>
          <input
            id="gu-category-label"
            required
            value={form.categoryLabel}
            onChange={(e) => set("categoryLabel", e.target.value)}
            placeholder="ej. Cafés, Barrios, Rooftops"
            className={fieldClass}
          />
        </div>
      </div>

      <GuideSectionsField sections={sections} onChange={setSections} placeOptions={placeOptions} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gu-reading" className={labelClass}>
            Tiempo de lectura
          </label>
          <input id="gu-reading" value={form.readTime} onChange={(e) => set("readTime", e.target.value)} className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gu-budget" className={labelClass}>
            Presupuesto (opcional)
          </label>
          <input id="gu-budget" value={form.budget} onChange={(e) => set("budget", e.target.value)} placeholder='ej. "$370 aprox."' className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gu-duration" className={labelClass}>
            Duración (opcional)
          </label>
          <input id="gu-duration" value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder='ej. "~4 horas"' className={fieldClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gu-audience" className={labelClass}>
          Para quién (opcional)
        </label>
        <div className="flex gap-2">
          <input
            id="gu-audience"
            value={audienceInput}
            onChange={(e) => setAudienceInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAudience();
              }
            }}
            placeholder="ej. En pareja — Enter para agregar"
            className={`${fieldClass} flex-1`}
          />
          <button type="button" onClick={addAudience} className="rounded-xl border border-border bg-background px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-[#F5F3F0]">
            Agregar
          </button>
        </div>
        {audience.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {audience.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[12px]">
                {a}
                <button type="button" onClick={() => setAudience((list) => list.filter((x) => x !== a))} aria-label={`Quitar ${a}`} className="text-ink-faint hover:text-negative">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gu-status" className={labelClass}>
          Estado
        </label>
        <select id="gu-status" value={form.status} onChange={(e) => set("status", e.target.value as ContentStatus)} className={`${fieldClass} max-w-[220px]`}>
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
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear guía"}
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
  );

  return <EditPreviewLayout left={left} preview={preview} />;
}
