"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { Noticia, ContentStatus, Category, Seo } from "@planazo/types";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { AlcaldiaSelect } from "@/components/cms/lamira/alcaldia-select";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { ContentBlocksField, type ContentBlockValue } from "@/components/cms/content-blocks-field";
import { TagsField } from "@/components/cms/tags-field";
import { SeoPanel } from "@/components/cms/seo-panel";
import { ensureSeo } from "@/lib/ensure-seo";
import { ImproveWithAiPanel, type ImproveWithAiHandle } from "@/components/cms/improve-with-ai-panel";
import { ImprovePreview, isFieldSelected, type ImproveResult, type ImproveSelection } from "@/components/cms/lamira/improve-preview";
import { buildToc, summarizeBlocks } from "@/components/cms/lamira/content-blocks-util";
import { ImageField } from "@/components/cms/lamira/image-field";
import { EditPreviewLayout } from "@/components/cms/lamira/edit-preview-layout";
import { LamiraPreviewCard } from "@/components/cms/lamira/lamira-preview-card";
import { SaveActions } from "@/components/cms/save-actions";
import { VideoField } from "@/components/cms/video-field";

export function NoticiaForm({ categories, existing }: { categories: Category[]; existing?: Noticia }) {
  const router = useRouter();
  const isEdit = !!existing;
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    dek: existing?.dek ?? "",
    categoryId: existing?.category?.id ?? categories[0]?.id ?? "",
    alcaldiaSlug: existing?.alcaldiaSlug ?? "",
    colonia: existing?.colonia ?? "",
    authorSlug: existing?.authorSlug ?? "",
    readingTime: existing?.readingTime ?? "3 min de lectura",
    status: existing?.status ?? ("draft" as ContentStatus),
    sourceKind: existing?.sourceKind ?? "",
    externalSource: existing?.externalSource ?? "",
    sourceUrl: existing?.sourceUrl ?? "",
    youtubeId: existing?.youtubeId ?? "",
    instagramUrl: existing?.instagramUrl ?? "",
    twitterUrl: existing?.twitterUrl ?? "",
    tiktokUrl: existing?.tiktokUrl ?? "",
    imageCaption: existing?.imageCaption ?? "",
    featured: existing?.featured ?? false,
    tag: existing?.tag ?? "",
  });
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [content, setContent] = useState<ContentBlockValue[]>(
    existing?.content.map((b) => ({ heading: b.heading ?? null, paragraphs: b.paragraphs })) ?? [{ heading: null, paragraphs: [""] }],
  );
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>(existing?.categoryData ?? {});
  const [seo, setSeo] = useState<Seo>(existing?.seo ?? {});
  // Encuadre de la imagen principal (ver ImageFocusEditor); null = centrada.
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

  const category = categories.find((c) => c.id === form.categoryId) ?? null;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  }

  function applyImprovement(selection?: ImproveSelection) {
    if (!improveResult) return;
    const { dek, content: improvedContent, seo: improvedSeo, ...rest } = improveResult.draft as {
      dek?: string;
      content?: ContentBlockValue[];
      seo?: Seo;
      [k: string]: unknown;
    };
    if (dek && isFieldSelected(selection, "dek")) set("dek", dek);
    const blocks = selection ? selection.blocks : improvedContent;
    if (blocks) setContent(blocks);
    if (improvedSeo) setSeo(improvedSeo);
    setCategoryData((prev) => ({ ...prev, ...rest }));
    setImproveResult(null);
  }

  async function save(status: ContentStatus) {
    setSaving(true);
    setError("");

    const finalSeo = await ensureSeo(seo, form.title, form.dek);
    if (finalSeo !== seo) setSeo(finalSeo);

    const payload = {
      title: form.title,
      dek: form.dek,
      categoryId: form.categoryId || null,
      alcaldiaSlug: form.alcaldiaSlug || null,
      colonia: form.colonia || null,
      authorSlug: form.authorSlug,
      readingTime: form.readingTime,
      status,
      sourceKind: form.sourceKind || null,
      externalSource: form.externalSource || null,
      sourceUrl: form.sourceUrl || null,
      youtubeId: form.youtubeId || null,
      instagramUrl: form.instagramUrl || null,
      twitterUrl: form.twitterUrl || null,
      tiktokUrl: form.tiktokUrl || null,
      tags,
      toc: buildToc(content),
      content,
      imageCaption: form.imageCaption || null,
      imageUrl: image?.url ?? null,
      imagePosition: image ? imagePosition : null,
      imageCredit: image?.credit ?? null,
      featured: form.featured,
      tag: form.tag || null,
      categoryData,
      seo: finalSeo,
    };

    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/lamira/noticias${isEdit ? `/${existing.id}` : ""}`, {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(isEdit ? "No se pudo guardar. Intenta de nuevo." : "No se pudo crear la noticia. Revisa los campos requeridos.");
        setSaving(false);
        return;
      }

      if (isEdit) {
        setForm((f) => ({ ...f, status }));
        setSavedStatus(status);
        setSavedAt(Date.now());
        setSaving(false);
        router.refresh();
      } else {
        const created = await res.json();
        router.push(`/contenido/lamira/noticia/${created.id}`);
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
    <LamiraPreviewCard
      type="noticia"
      name={form.title}
      categoryName={category?.name ?? null}
      image={image}
      imagePosition={imagePosition}
      youtubeId={form.youtubeId || null}
      dek={form.dek}
      description=""
      content={content}
      alertaStatus="activa"
      alcaldiaSlug={form.alcaldiaSlug}
      eventoStatus="proximo"
      date=""
      time=""
      location=""
      price=""
      organizer=""
      kind="parque"
      colonia={form.colonia}
    />
  );

  const left = (
    <div className="flex flex-col gap-4">
      {isEdit && (
        <ImproveWithAiPanel
          ref={improveRef}
          contentType="noticia"
          contentId={existing.id}
          expanded={improving}
          onToggle={() => setImproving((v) => !v)}
          onResult={setImproveResult}
          onLoadingChange={setRegenerating}
          supportsExpand
        />
      )}

      {improveResult && (
        <ImprovePreview
          result={improveResult}
          fields={[
            { key: "dek", label: "Bajada (dek)", current: form.dek, improved: (improveResult.draft.dek as string) ?? "" },
            {
              key: "content",
              label: "Cuerpo",
              current: summarizeBlocks(content),
              improved: summarizeBlocks((improveResult.draft.content as ContentBlockValue[]) ?? []),
              blocks: { current: content, improved: (improveResult.draft.content as ContentBlockValue[]) ?? [] },
            },
          ]}
          onApply={applyImprovement}
          onDiscard={() => setImproveResult(null)}
          onRegenerate={() => improveRef.current?.regenerate()}
          regenerating={regenerating}
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-[14px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="n-title" className={labelClass}>
            Título
          </label>
          <input id="n-title" required value={form.title} onChange={(e) => set("title", e.target.value)} className={fieldClass} />
        </div>

        {/* Arriba de todo — es lo primero que se necesita para verificar el
            tema contra el artículo real antes de revisar el resto del
            formulario, no algo que revisar hasta el final. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="n-source-url" className={labelClass}>
            URL de la fuente
          </label>
          <div className="flex items-center gap-2">
            <input
              id="n-source-url"
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
          <p className="text-[11.5px] leading-[1.4] text-ink-faint">
            El artículo original del que salió el tema — cuando la crea la automatización, se llena solo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-source-kind" className={labelClass}>
              Tipo de fuente
            </label>
            <input id="n-source-kind" value={form.sourceKind} onChange={(e) => set("sourceKind", e.target.value)} placeholder="demo / institucional / editorial" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-external-source" className={labelClass}>
              Fuente externa citada
            </label>
            <input id="n-external-source" value={form.externalSource} onChange={(e) => set("externalSource", e.target.value)} placeholder="ej. Con información de Reforma" className={fieldClass} />
          </div>
        </div>

        <ImageField image={image} onChange={setImage} position={imagePosition} onPositionChange={setImagePosition} searchQuery={form.title} />
        <VideoField videoId={form.youtubeId || null} onChange={(id) => set("youtubeId", id ?? "")} sourceUrl={form.sourceUrl || null} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="n-dek" className={labelClass}>
            Bajada (dek)
          </label>
          <textarea id="n-dek" required rows={2} value={form.dek} onChange={(e) => set("dek", e.target.value)} className={`${fieldClass} resize-none`} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-category" className={labelClass}>
              Categoría
            </label>
            <select id="n-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={fieldClass}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-alcaldia" className={labelClass}>
              Alcaldía / municipio
            </label>
            <AlcaldiaSelect id="n-alcaldia" value={form.alcaldiaSlug} onChange={(slug) => set("alcaldiaSlug", slug)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-colonia" className={labelClass}>
              Colonia (slug)
            </label>
            <input id="n-colonia" value={form.colonia} onChange={(e) => set("colonia", e.target.value)} placeholder="ej. condesa" className={fieldClass} />
          </div>
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <ContentBlocksField blocks={content} onChange={setContent} articleTitle={form.title} />

        <TagsField label="Etiquetas" tags={tags} onChange={setTags} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-author" className={labelClass}>
              Autor (slug)
            </label>
            <input id="n-author" required value={form.authorSlug} onChange={(e) => set("authorSlug", e.target.value)} placeholder="ej. mariana-robles" className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-reading" className={labelClass}>
              Tiempo de lectura
            </label>
            <input id="n-reading" value={form.readingTime} onChange={(e) => set("readingTime", e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-image-caption" className={labelClass}>
              Pie de foto
            </label>
            <input id="n-image-caption" value={form.imageCaption} onChange={(e) => set("imageCaption", e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-instagram" className={labelClass}>
              Liga de Instagram (opcional)
            </label>
            <input
              id="n-instagram"
              placeholder="https://www.instagram.com/p/..."
              value={form.instagramUrl}
              onChange={(e) => set("instagramUrl", e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-twitter" className={labelClass}>
              Liga de X/Twitter (opcional)
            </label>
            <input
              id="n-twitter"
              placeholder="https://x.com/usuario/status/..."
              value={form.twitterUrl}
              onChange={(e) => set("twitterUrl", e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-tiktok" className={labelClass}>
              Liga de TikTok (opcional)
            </label>
            <input
              id="n-tiktok"
              placeholder="https://www.tiktok.com/@usuario/video/..."
              value={form.tiktokUrl}
              onChange={(e) => set("tiktokUrl", e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-tag" className={labelClass}>
              Badge especial
            </label>
            <select id="n-tag" value={form.tag} onChange={(e) => set("tag", e.target.value)} className={`${fieldClass} max-w-[200px]`}>
              <option value="">Ninguno</option>
              <option value="CLIMA">CLIMA</option>
              <option value="DEPORTES">DEPORTES</option>
            </select>
          </div>
          <label className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-ink-soft">
            <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} className="size-4 rounded border-border accent-brand" />
            Destacada
          </label>
        </div>

        <SeoPanel seo={seo} onChange={setSeo} contentTitle={form.title} contentContext={form.dek} />


        {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

        <SaveActions
          isEdit={isEdit}
          saving={saving}
          createLabel="Crear noticia"
          savedStatus={savedStatus}
          onUnpublish={() => save("draft")}
          savedAt={savedAt}
          onPublish={handlePublish}
          siteLabel="lamira.mx"
          deleteConfig={existing ? { path: `/cms/lamira/noticias/${existing.id}`, redirectTo: "/contenido?site=lamira", itemTitle: form.title || "(sin título)" } : undefined}
        />
      </form>
    </div>
  );

  return <EditPreviewLayout left={left} preview={preview} />;
}
