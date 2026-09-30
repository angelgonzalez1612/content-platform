"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { PlaceDetail, Category, CheckResult, AiDecision, Seo } from "@planazo/types";
import type { UpdatePlaceInput } from "@/lib/cms-api";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ImproveWithAiPanel, type ImproveWithAiHandle } from "@/components/cms/improve-with-ai-panel";
import { AlcaldiaSelect } from "@/components/cms/lamira/alcaldia-select";
import { ImageField } from "@/components/cms/lamira/image-field";
import { GalleryField, type GalleryPhoto } from "@/components/cms/planazo/gallery-field";
import { EditPreviewLayout } from "@/components/cms/lamira/edit-preview-layout";
import { PlanazoPreviewCard } from "@/components/cms/planazo/planazo-preview-card";
import { ContentBlocksField, type ContentBlockValue } from "@/components/cms/content-blocks-field";
import { SaveActions } from "@/components/cms/save-actions";
import { ImprovePreview, isFieldSelected, type ImproveResult, type ImproveSelection } from "@/components/cms/lamira/improve-preview";
import { summarizeBlocks } from "@/components/cms/lamira/content-blocks-util";
import { VideoField } from "@/components/cms/video-field";

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
    sourceUrl: place.sourceUrl ?? "",
    status: place.status,
    allowPhotoModal: place.allowPhotoModal,
  });
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>(place.categoryData ?? {});
  const [seo, setSeo] = useState<Seo>(place.seo ?? {});
  const sortedPhotos = [...place.photos].sort((a, b) => a.position - b.position);
  const cover = sortedPhotos[0];
  // Encuadre de la imagen principal (ver ImageFocusEditor); null = centrada.
  // Video de YouTube incrustado (ver VideoField); se llena solo al generar si la fuente lo trae.
  const [youtubeId, setYoutubeId] = useState<string | null>(place.youtubeId ?? null);
  const [imagePosition, setImagePosition] = useState<string | null>(place.imagePosition ?? null);
  const [image, setImage] = useState<{ url: string; credit: string } | null>(cover ? { url: cover.url, credit: cover.credit ?? "" } : null);
  const [gallery, setGallery] = useState<GalleryPhoto[]>(
    sortedPhotos.slice(1).map((p) => ({ url: p.url, alt: p.alt, credit: p.credit })),
  );
  const [content, setContent] = useState<ContentBlockValue[]>((place.content ?? []).map((b) => ({ ...b, heading: b.heading ?? null })));
  const [saving, setSaving] = useState(false);
  // Estado que ya tiene en la base (solo cambia con Publicar / Despublicar).
  const [savedStatus, setSavedStatus] = useState<string | null>(form.status);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  const [improving, setImproving] = useState(false);
  const [improveResult, setImproveResult] = useState<{ draft: ImproveDraft; checksRun: CheckResult[]; decision: AiDecision } | null>(null);
  const [improveMode, setImproveMode] = useState<"rewrite" | "expand">("rewrite");
  const improveRef = useRef<ImproveWithAiHandle>(null);
  const [regenerating, setRegenerating] = useState(false);

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
      sourceUrl: form.sourceUrl || null,
      status,
      categoryData,
      seo,
      photo: image,
      imagePosition: image ? imagePosition : null,
      youtubeId,
      gallery,
      content,
      allowPhotoModal: form.allowPhotoModal,
    };

    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/places/${place.id}`, {
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
      setSavedStatus(status);
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

  function applyImprovement(selection?: ImproveSelection) {
    if (!improveResult) return;
    if (improveMode === "expand") {
      // Actuales + nuevas, con solo los párrafos que el editor dejó marcados.
      const blocks = selection ? selection.blocks : (improveResult.draft.content as ContentBlockValue[] | undefined);
      if (blocks) setContent(blocks);
      setImproveResult(null);
      return;
    }
    const { description, seo: improvedSeo, ...rest } = improveResult.draft;
    if (description && isFieldSelected(selection, "description")) set("description", description);
    if (improvedSeo) setSeo(improvedSeo);
    setCategoryData((prev) => ({ ...prev, ...rest }));
    setImproveResult(null);
  }

  const preview = (
    <PlanazoPreviewCard
      kind="lugar"
      name={form.name}
      categoryLabel={category?.name ?? ""}
      image={image}
      imagePosition={imagePosition}
      youtubeId={youtubeId}
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
        ref={improveRef}
        contentType="place"
        contentId={place.id}
        expanded={improving}
        onToggle={() => setImproving((v) => !v)}
        onResult={(result, mode) => {
          setImproveResult(result);
          setImproveMode(mode);
        }}
        onLoadingChange={setRegenerating}
        supportsExpand
      />

      {improveResult && (
        <ImprovePreview
          result={improveResult as ImproveResult}
          fields={
            improveMode === "expand"
              ? [
                  {
                    key: "content",
                    label: "Contenido",
                    current: summarizeBlocks(content),
                    improved: summarizeBlocks((improveResult.draft.content as ContentBlockValue[] | undefined) ?? content),
                    blocks: { current: content, improved: (improveResult.draft.content as ContentBlockValue[] | undefined) ?? content },
                  },
                ]
              : [{ key: "description", label: "Descripción", current: form.description, improved: (improveResult.draft.description as string | undefined) ?? "" }]
          }
          onApply={applyImprovement}
          onDiscard={() => setImproveResult(null)}
          onRegenerate={() => improveRef.current?.regenerate()}
          regenerating={regenerating}
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={labelClass}>
            Nombre
          </label>
          <input id="name" required value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldClass} />
        </div>

        {/* Arriba de todo — es lo primero que se necesita para verificar el
            tema contra el artículo/tema original antes de revisar el resto
            del formulario, no algo que revisar hasta el final. Se llena solo
            cuando lo crea la automatización (ver AutomationRunnerService). */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="place-source-url" className={labelClass}>
            URL de la fuente
          </label>
          <div className="flex items-center gap-2">
            <input
              id="place-source-url"
              value={form.sourceUrl}
              onChange={(e) => set("sourceUrl", e.target.value)}
              placeholder="https://…"
              className={`${fieldClass} flex-1`}
            />
            {form.sourceUrl && (
              <a
                href={form.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-none rounded-lg border border-border bg-card px-3 py-2.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                Abrir ↗
              </a>
            )}
          </div>
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

        <ImageField image={image} onChange={setImage} position={imagePosition} onPositionChange={setImagePosition} />
        <VideoField videoId={youtubeId} onChange={setYoutubeId} sourceUrl={form.sourceUrl || null} />

        <GalleryField photos={gallery} onChange={setGallery} searchQuery={`${form.name} ${category?.name ?? ""} CDMX`.trim()} />

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
          <ContentBlocksField blocks={content} onChange={setContent} articleTitle={form.name} />
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <SeoPanel seo={seo} onChange={setSeo} contentTitle={form.name} />


        {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

        <SaveActions
          isEdit={true}
          saving={saving}
          createLabel="Guardar cambios"
          savedStatus={savedStatus}
          onUnpublish={() => save("draft")}
          savedAt={savedAt}
          onPublish={handlePublish}
          siteLabel="planazo.com.mx"
          deleteConfig={{ path: `/cms/places/${place.id}`, redirectTo: "/contenido", itemTitle: form.name || "(sin título)" }}
        />
      </form>
    </div>
  );

  return <EditPreviewLayout left={left} preview={preview} />;
}
