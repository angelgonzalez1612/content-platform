"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { ContentStatus, PlanazoGuide, Seo } from "@planazo/types";
import { PlanazoPreviewCard } from "@/components/cms/planazo/planazo-preview-card";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ensureSeo } from "@/lib/ensure-seo";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { ImageField } from "@/components/cms/lamira/image-field";
import { EditPreviewLayout } from "@/components/cms/lamira/edit-preview-layout";
import { GuideSectionsField, type GuideSectionValue, type PlaceOption } from "@/components/cms/planazo/guide-sections-field";
import { ImproveWithAiPanel, type ImproveWithAiHandle } from "@/components/cms/improve-with-ai-panel";
import { ImprovePreview, isFieldSelected, type ImproveResult, type ImproveSelection } from "@/components/cms/lamira/improve-preview";
import { SaveActions } from "@/components/cms/save-actions";
import { VideoField } from "@/components/cms/video-field";
import { useDirty } from "@/lib/use-dirty";

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
  const [seo, setSeo] = useState<Seo>(existing?.seo ?? {});
  const [sections, setSections] = useState<GuideSectionValue[]>(
    existing?.sections.map((s) => {
      // planazo_fronted's <Prose> ya separa párrafos por línea en blanco
      // (\n{2,}) al mostrar `body` — mismo split aquí para editar cada
      // párrafo por separado, se vuelve a unir así mismo al guardar.
      const paragraphs = s.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      return { heading: s.heading, paragraphs: paragraphs.length ? paragraphs : [""], placeSlug: s.placeSlug ?? "", image: s.image ?? null };
    }) ?? [{ heading: "", paragraphs: [""], placeSlug: "" }],
  );
  const [audience, setAudience] = useState<string[]>(existing?.audience ?? []);
  const [audienceInput, setAudienceInput] = useState("");
  // Encuadre de la imagen principal (ver ImageFocusEditor); null = centrada.
  // Video de YouTube incrustado (ver VideoField); se llena solo al generar si la fuente lo trae.
  const [youtubeId, setYoutubeId] = useState<string | null>(existing?.youtubeId ?? null);
  const [imagePosition, setImagePosition] = useState<string | null>(existing?.imagePosition ?? null);
  const [image, setImage] = useState<{ url: string; credit: string } | null>(
    existing?.imageUrl ? { url: existing.imageUrl, credit: existing.imageCredit ?? "" } : null,
  );
  const [saving, setSaving] = useState(false);
  // Estado que ya tiene en la base (solo cambia con Publicar / Despublicar).
  const [savedStatus, setSavedStatus] = useState<string | null>((isEdit ? form.status : null));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [improving, setImproving] = useState(false);
  const [improveResult, setImproveResult] = useState<ImproveResult | null>(null);
  const improveRef = useRef<ImproveWithAiHandle>(null);
  const [regenerating, setRegenerating] = useState(false);
  // Cambios sin guardar: sin ellos, el botón de guardar queda apagado.
  const { isDirty, markSaved } = useDirty({ form, seo, sections, audience, youtubeId, imagePosition, image });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  }

  function applyImprovement(selection?: ImproveSelection) {
    if (!improveResult) return;
    const { description, intro } = improveResult.draft as { description?: string; intro?: string };
    if (description && isFieldSelected(selection, "description")) set("description", description);
    if (intro && isFieldSelected(selection, "intro")) set("intro", intro);
    setImproveResult(null);
  }

  function addAudience() {
    const value = audienceInput.trim();
    if (value && !audience.includes(value)) setAudience((a) => [...a, value]);
    setAudienceInput("");
  }

  async function save(status: ContentStatus) {
    setSaving(true);
    setError("");

    const finalSeo = await ensureSeo(seo, form.title, form.description);

    if (finalSeo !== seo) setSeo(finalSeo);


    const payload = {
      title: form.title,
      description: form.description,
      type: form.type || null,
      intro: form.intro || null,
      sections: sections
        .filter((s) => s.heading.trim() && s.paragraphs.some((p) => p.trim()))
        .map((s) => ({
          heading: s.heading,
          body: s.paragraphs.map((p) => p.trim()).filter(Boolean).join("\n\n"),
          placeSlug: s.placeSlug || null,
          image: s.image ?? null,
        })),
      categoryLabel: form.categoryLabel,
      readTime: form.readTime,
      imageUrl: image?.url ?? null,
      imagePosition: image ? imagePosition : null,
      youtubeId,
      imageCredit: image?.credit ?? null,
      excerpt: form.excerpt || null,
      seo: finalSeo,
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
        setSavedStatus(status);
        setSavedAt(Date.now());
        markSaved();
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

  const placeLabelBySlug = new Map(placeOptions.map((o) => [o.slug, o.label]));
  const preview = (
    <PlanazoPreviewCard
      kind="guia"
      name={form.title}
      categoryLabel={form.categoryLabel || "Guía"}
      image={image}
      imagePosition={imagePosition}
      youtubeId={youtubeId}
      description={form.description}
      intro={form.intro}
      readTime={form.readTime}
      sections={sections.map((section) => ({
        heading: section.heading,
        paragraphs: section.paragraphs,
        placeLabel: section.placeSlug ? (placeLabelBySlug.get(section.placeSlug) ?? section.placeSlug) : undefined,
        image: section.image ? { url: section.image.url, credit: section.image.credit } : null,
      }))}
    />
  );

  const left = (
    <div className="flex flex-col gap-4">
    {isEdit && (
      <ImproveWithAiPanel
        ref={improveRef}
        contentType="planazo-guia"
        contentId={existing.id}
        expanded={improving}
        onToggle={() => setImproving((v) => !v)}
        onResult={setImproveResult}
        onLoadingChange={setRegenerating}
      />
    )}

    {improveResult && (
      <ImprovePreview
        result={improveResult}
        fields={[
          { key: "description", label: "Descripción", current: form.description, improved: (improveResult.draft.description as string) ?? "" },
          { key: "intro", label: "Intro", current: form.intro, improved: (improveResult.draft.intro as string) ?? "" },
        ]}
        onApply={applyImprovement}
        onDiscard={() => setImproveResult(null)}
        onRegenerate={() => improveRef.current?.regenerate()}
        regenerating={regenerating}
      />
    )}

    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gu-title" className={labelClass}>
          Título
        </label>
        <input id="gu-title" required value={form.title} onChange={(e) => set("title", e.target.value)} className={fieldClass} />
      </div>

      <ImageField image={image} onChange={setImage} position={imagePosition} onPositionChange={setImagePosition} searchQuery={form.title} label="Portada" />
      <VideoField videoId={youtubeId} onChange={setYoutubeId} />

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

      <GuideSectionsField sections={sections} onChange={setSections} placeOptions={placeOptions} guideTitle={form.title} />

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
          <button type="button" onClick={addAudience} className="rounded-xl border border-border bg-background px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-hover">
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


      {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

      <SeoPanel seo={seo} onChange={setSeo} contentTitle={form.title} contentContext={form.description} />

      <SaveActions
        dirty={isDirty}
        isEdit={isEdit}
        saving={saving}
        createLabel="Crear guía"
        savedStatus={savedStatus}
        onUnpublish={() => save("draft")}
        savedAt={savedAt}
        onPublish={handlePublish}
        siteLabel="planazo.com.mx"
        deleteConfig={existing ? { path: `/cms/guides/${existing.id}`, redirectTo: "/contenido", itemTitle: form.title || "(sin título)" } : undefined}
      />
    </form>
    </div>
  );

  return <EditPreviewLayout left={left} preview={preview} />;
}
