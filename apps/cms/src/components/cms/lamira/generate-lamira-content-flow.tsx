"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { Category, CheckResult, AiDecision, Seo, AlertaStatus, EventoStatus, LugarKind } from "@planazo/types";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { ContentBlocksField, type ContentBlockValue } from "@/components/cms/content-blocks-field";
import { TagsField } from "@/components/cms/tags-field";
import { SeoPanel } from "@/components/cms/seo-panel";
import { buildToc, withBlockIds } from "@/components/cms/lamira/content-blocks-util";
import { LamiraPreviewCard } from "@/components/cms/lamira/lamira-preview-card";
import { ImageSearchPicker } from "@/components/cms/lamira/image-search-picker";
import { RichTextarea } from "@/components/cms/rich-textarea";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
type Step = "input" | "generating" | "review" | "creating";
type ProviderId = "openai" | "claude-cli";

// Duplicado a propósito de la-mira/src/data/mock/authors.ts (repos separados,
// sin paquete de tipos compartido — mismo patrón que api-types.ts allá).
// "redaccion-la-mira" y "angel-gonzalez" son bylines reales; los otros 4 son
// personas ficticias que quedaron del contenido mock migrado (Fase 6) — se
// listan por si se quiere reasignar algo a mano, pero NUNCA son el default
// ni se puede escribir un nombre nuevo aquí (antes era texto libre — un slug
// inventado o mal escrito rompía el byline en la página real, sin fallback
// visual).
const AUTHOR_OPTIONS: Array<{ slug: string; label: string }> = [
  { slug: "redaccion-la-mira", label: "Redacción La Mira" },
  { slug: "angel-gonzalez", label: "Angel González" },
  { slug: "mariana-robles", label: "Mariana Robles" },
  { slug: "jorge-villasenor", label: "Jorge Villaseñor" },
  { slug: "ana-lucia-prado", label: "Ana Lucía Prado" },
  { slug: "diego-marin", label: "Diego Marín" },
  { slug: "renata-sosa", label: "Renata Sosa" },
];

const PROVIDERS: Array<{ id: ProviderId; label: string; hint: string }> = [
  { id: "openai", label: "OpenAI", hint: "Salida estructurada garantizada · cuesta por token" },
  { id: "claude-cli", label: "Claude (tu sesión)", hint: "Usa tu suscripción Pro/Max ya conectada · más lento" },
];

const TYPE_META: Record<string, { label: string; nameLabel: string; namePlaceholder: string; endpoint: string; editPath: string; hasStatus: boolean }> = {
  noticia: { label: "Noticia", nameLabel: "Título de la noticia", namePlaceholder: "ej. Caos vial en CDMX por bloqueos en Reforma", endpoint: "noticias", editPath: "noticia", hasStatus: true },
  alerta: { label: "Alerta", nameLabel: "Título de la alerta", namePlaceholder: "ej. Cierre vial en Paseo de la Reforma", endpoint: "alertas", editPath: "alerta", hasStatus: false },
  guia: { label: "Guía", nameLabel: "Título de la guía", namePlaceholder: "ej. Cómo tramitar tu pasaporte en CDMX", endpoint: "guias", editPath: "guia", hasStatus: true },
  evento: { label: "Evento", nameLabel: "Título del evento", namePlaceholder: "ej. Festival de Jazz al aire libre", endpoint: "eventos", editPath: "evento", hasStatus: false },
  lugar: { label: "Lugar", nameLabel: "Nombre del lugar", namePlaceholder: "ej. Bosque de Chapultepec", endpoint: "lugares", editPath: "lugar", hasStatus: false },
  reportaje: { label: "Reportaje", nameLabel: "Título del reportaje", namePlaceholder: "ej. Un año de ciclovías nuevas", endpoint: "reportajes", editPath: "reportaje", hasStatus: true },
};

interface DraftResponse {
  draft: Record<string, unknown>;
  checksRun: CheckResult[];
  decision: AiDecision;
  image: { url: string; credit: string } | null;
  categoryId: string;
  site: "la-mira" | "planazo";
  contentType: string;
}

function parseDraftFields(draft: Record<string, unknown>) {
  const { title, dek, content, faq, description, seo, ...rest } = draft as {
    title?: string;
    dek?: string;
    content?: ContentBlockValue[];
    faq?: { question: string; answer: string }[];
    description?: string;
    seo?: Seo;
    [k: string]: unknown;
  };
  return {
    // Solo noticia/alerta/guia/evento/reportaje traen `title` (ver titleShape
    // en content-types.ts) — "lugar" no, ahí el nombre es un sustantivo propio
    // que ya escribió el humano, no un encabezado que reescribir.
    title: title ?? "",
    dek: dek ?? "",
    description: description ?? "",
    content: (content ?? []).map((b) => ({ heading: b.heading ?? null, paragraphs: b.paragraphs })),
    faq: faq ?? [],
    seo: seo ?? {},
    categoryData: rest,
  };
}

export function GenerateLamiraContentFlow({
  type,
  categories,
  initialName,
  initialHints,
  initialDraft,
}: {
  type: string;
  categories: Category[];
  initialName?: string;
  initialHints?: string;
  // Cuando viene de PublishFlow (Publicar desde content-radar sin sitio/tipo
  // fijo), el borrador ya se generó ahí — este componente arranca directo en
  // "review" con estos datos, sin pedirle al humano que genere de nuevo.
  initialDraft?: DraftResponse;
}) {
  const router = useRouter();
  const meta = TYPE_META[type];
  const initialParsed = initialDraft ? parseDraftFields(initialDraft.draft) : null;
  const [step, setStep] = useState<Step>(initialDraft ? "review" : "input");
  const [name, setName] = useState(initialName ?? "");
  const [hints, setHints] = useState(initialHints ?? "");
  const [provider, setProvider] = useState<ProviderId>("openai");
  // La categoría ya no la elige el humano de entrada — la clasifica la IA a
  // partir del tema (ver AiDraftService.classifyCategory), y llega aquí ya
  // resuelta en la respuesta del draft. Sigue siendo 100% editable en la
  // revisión, justo debajo, por si la IA se equivocó.
  const [categoryId, setCategoryId] = useState(initialDraft?.categoryId ?? "");
  const [categoryWasAiChosen, setCategoryWasAiChosen] = useState(!!initialDraft);
  const [error, setError] = useState("");

  // El encabezado publicado — para noticia/alerta/guia/evento/reportaje lo
  // escribe la IA (distinto del tema/semilla que se dio en `name`); para
  // "lugar" nunca llega de la IA, así que arranca igual a `name` y el humano
  // lo edita si quiere (es su propio nombre, no un titular).
  const [title, setTitle] = useState(initialParsed?.title || initialName || "");
  const [dek, setDek] = useState(initialParsed?.dek ?? "");
  const [description, setDescription] = useState(initialParsed?.description ?? "");
  const [content, setContent] = useState<ContentBlockValue[]>(initialParsed?.content ?? []);
  const [faq, setFaq] = useState<{ question: string; answer: string }[]>(initialParsed?.faq ?? []);
  const [seo, setSeo] = useState<Seo>(initialParsed?.seo ?? {});
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>(initialParsed?.categoryData ?? {});
  const [checksRun, setChecksRun] = useState<CheckResult[]>(initialDraft?.checksRun ?? []);
  const [decision, setDecision] = useState<AiDecision>(initialDraft?.decision ?? "needs-review");
  // Imagen de la fuente citada, con crédito — viene del scraping (Fase 4 del
  // plan), nunca la genera la IA. El humano puede quitarla, reemplazarla o
  // (si el scraping no encontró ninguna) agregar una a mano en la revisión.
  const [image, setImage] = useState<{ url: string; credit: string } | null>(initialDraft?.image ?? null);
  const [editingImage, setEditingImage] = useState(false);
  const [imageEditMode, setImageEditMode] = useState<"search" | "url">("search");
  const [imageDraft, setImageDraft] = useState({ url: "", credit: "" });

  function startEditImage() {
    setImageDraft(image ?? { url: "", credit: "" });
    setImageEditMode("search");
    setEditingImage(true);
  }
  function saveImage() {
    if (!imageDraft.url.trim()) return;
    setImage({ url: imageDraft.url.trim(), credit: imageDraft.credit.trim() });
    setEditingImage(false);
  }
  function selectSearchedImage(picked: { url: string; credit: string }) {
    setImage(picked);
    setEditingImage(false);
  }

  // Campos que la IA no genera (son datos verificables) — el humano los llena
  // en la revisión. Para alerta/evento/lugar son obligatorios de verdad
  // porque esos 3 tipos no tienen workflow de borrador (ver AiDraftService):
  // cualquier fila creada ahí es pública de inmediato, así que aquí no se
  // puede "completar después" como sí puede Place/noticia/guia/reportaje.
  const [extra, setExtra] = useState({
    authorSlug: "redaccion-la-mira",
    groupSlug: "documentos-e-identidad",
    tags: [] as string[],
    imageCaption: "",
    alertaStatus: "activa" as AlertaStatus,
    alcaldiaSlug: "",
    tag: "",
    eventoStatus: "proximo" as EventoStatus,
    date: "",
    time: "",
    location: "",
    price: "",
    organizer: "",
    kind: "parque" as LugarKind,
    colonia: "",
  });
  function setExtraField<K extends keyof typeof extra>(key: K, value: (typeof extra)[K]) {
    setExtra((e) => ({ ...e, [key]: value }));
  }

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const isRichContent = type === "noticia" || type === "guia" || type === "reportaje";

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStep("generating");

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/ai/draft`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // categoryId se omite a propósito: sin ella, el backend clasifica sola
        // la categoría (ver AiDraftService.classifyCategory) a partir del tema
        // + la fuente completa — es lo que llega en data.categoryId abajo.
        body: JSON.stringify({ site: "la-mira", contentType: type, name, hints: hints || undefined, provider }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar el borrador.");
        setStep("input");
        return;
      }

      const data: DraftResponse = await res.json();
      const parsed = parseDraftFields(data.draft);
      setTitle(parsed.title || name);
      setDek(parsed.dek);
      setDescription(parsed.description);
      setContent(parsed.content);
      setFaq(parsed.faq);
      setSeo(parsed.seo);
      setCategoryData(parsed.categoryData);
      setChecksRun(data.checksRun);
      setDecision(data.decision);
      setImage(data.image);
      setCategoryId(data.categoryId);
      setCategoryWasAiChosen(true);
      setStep("review");
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStep("input");
    }
  }

  async function handleCreate() {
    setStep("creating");
    setError("");

    const status = meta.hasStatus ? (decision === "auto-published" ? "published" : "draft") : undefined;
    const imageFields = { imageUrl: image?.url ?? null, imageCredit: image?.credit ?? null };
    let payload: Record<string, unknown>;

    switch (type) {
      case "noticia":
        payload = { title, dek, categoryId: categoryId || null, authorSlug: extra.authorSlug, status, toc: buildToc(content), content, categoryData, seo, ...imageFields };
        break;
      case "guia":
        payload = { title, dek, groupSlug: extra.groupSlug, categoryId: categoryId || null, status, content: withBlockIds(content), faq, categoryData, seo, ...imageFields };
        break;
      case "reportaje":
        payload = { title, dek, categoryId: categoryId || null, authorSlug: extra.authorSlug, status, tags: extra.tags.length ? extra.tags : ["Reportaje"], imageCaption: extra.imageCaption || "Pendiente", toc: buildToc(content), content, categoryData, seo, ...imageFields };
        break;
      case "alerta":
        payload = { title, alertaStatus: extra.alertaStatus, categoryId: categoryId || null, alcaldiaSlug: extra.alcaldiaSlug || null, description, categoryData, seo, ...imageFields };
        break;
      case "evento":
        payload = { title, tag: extra.tag || "Evento", categoryId: categoryId || null, eventoStatus: extra.eventoStatus, date: extra.date, time: extra.time, location: extra.location, alcaldiaSlug: extra.alcaldiaSlug || null, price: extra.price, description, organizer: extra.organizer, categoryData, seo, ...imageFields };
        break;
      case "lugar":
        payload = { name: title, kind: extra.kind, categoryId: categoryId || null, alcaldiaSlug: extra.alcaldiaSlug, colonia: extra.colonia || null, description, categoryData, seo, ...imageFields };
        break;
      default:
        payload = {};
    }

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/lamira/${meta.endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError("No se pudo crear — revisa que los campos requeridos abajo estén llenos.");
        setStep("review");
        return;
      }

      const created = await res.json();
      router.push(`/contenido/lamira/${meta.editPath}/${created.id}`);
    } catch {
      setError("No se pudo conectar con el servidor.");
      setStep("review");
    }
  }

  if (step === "input" || step === "generating") {
    return (
      <div className="mx-auto max-w-[620px] p-[26px] pb-[60px] text-center">
        <div className="mx-auto mb-4 grid size-[46px] place-items-center rounded-2xl border border-[#FFE2CC] bg-accent">
          <Icon d={SPARK_ICON} size={22} strokeWidth={1.6} className="text-brand" />
        </div>
        {initialName && (
          <span className="mx-auto mb-2.5 inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 font-mono text-[10px] font-medium tracking-[.04em] text-ink-faint uppercase">
            Se crea como {meta.label}
          </span>
        )}
        <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿Sobre qué escribimos?</h1>
        <p className="mx-auto mb-7 max-w-[46ch] text-[13.5px] leading-[1.6] text-ink-soft">
          Dame el tema y lo que ya sabes — por ejemplo, un titular y fuente de content-radar. Escribo el borrador; los
          datos verificables (fecha, ubicación, cifras) los completas tú.
        </p>

        <form
          onSubmit={handleGenerate}
          className="flex flex-col gap-5 rounded-[16px] border border-border bg-white p-6 text-left shadow-[0_1px_2px_rgba(23,20,17,.03)] sm:p-7"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lc-name" className={labelClass}>
              {meta.nameLabel}
            </label>
            <input id="lc-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={meta.namePlaceholder} className={fieldClass} disabled={step === "generating"} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="lc-hints" className={labelClass}>
                Lo que ya sabes (fuentes, contexto, etc.)
              </label>
              {initialHints && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-mono text-[10px] font-medium tracking-[.04em] text-accent-fg uppercase">
                  <Icon d={SPARK_ICON} size={10} strokeWidth={2} />
                  Desde Content Radar
                </span>
              )}
            </div>
            <textarea
              id="lc-hints"
              rows={4}
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder="ej. Fuente: MILENIO — 9 bloqueos en Reforma e Insurgentes hoy 25 de agosto…"
              className={`${fieldClass} resize-none`}
              disabled={step === "generating"}
            />
            <p className="text-[11.5px] text-ink-faint">La categoría la elige la IA a partir del tema — la revisas y puedes cambiarla después de generar.</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className={labelClass}>Proveedor de IA</span>
            <div className="flex gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  disabled={step === "generating"}
                  title={p.hint}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${provider === p.id ? "border-brand bg-accent" : "border-border bg-white hover:border-ink-faint"}`}
                >
                  <span className="block text-[13px] font-semibold">{p.label}</span>
                  <span className="block text-[11px] text-ink-faint">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

          <button
            type="submit"
            disabled={step === "generating"}
            className="mt-1 flex items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-3 text-[14.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-70"
          >
            {step === "generating" ? (
              <>
                <Icon d={SPARK_ICON} size={15} strokeWidth={1.8} className="animate-spin" />
                Investigando y escribiendo… {provider === "claude-cli" && "(puede tardar ~30s)"}
              </>
            ) : (
              <>
                <Icon d={SPARK_ICON} size={15} strokeWidth={1.8} />
                Generar con IA
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  // review / creating
  return (
    <div className="flex w-full flex-col lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="p-[26px] pb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 font-mono text-[10.5px] font-medium tracking-[.06em] text-accent-fg uppercase">
            Borrador IA · revisa antes de crear
          </span>

          <div className="mt-3 mb-5 flex flex-col gap-1">
            <label htmlFor="lc-title" className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">
              {type === "lugar" ? "Nombre" : "Encabezado"}
              {type !== "lugar" && (
                <span className="normal-case tracking-normal text-ink-faint">
                  — lo escribió la IA a partir de &quot;{name}&quot;, edítalo si quieres
                </span>
              )}
            </label>
            <input
              id="lc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-[8px] border border-transparent bg-transparent px-0 py-1 text-[22px] font-semibold tracking-tight text-ink transition-colors focus:border-border-soft focus:bg-white focus:px-3 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Imagen{image ? " (de la fuente citada)" : ""}</span>

          {editingImage ? (
            <div className="flex flex-col gap-3 rounded-[10px] border border-border-soft bg-background p-3">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setImageEditMode("search")}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${imageEditMode === "search" ? "bg-accent text-accent-fg" : "text-ink-soft hover:text-ink"}`}
                >
                  Buscar imágenes
                </button>
                <button
                  type="button"
                  onClick={() => setImageEditMode("url")}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${imageEditMode === "url" ? "bg-accent text-accent-fg" : "text-ink-soft hover:text-ink"}`}
                >
                  Pegar URL
                </button>
              </div>

              {imageEditMode === "search" ? (
                <ImageSearchPicker initialQuery={title || name} onSelect={selectSearchedImage} />
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="img-url" className="text-[11px] font-medium text-ink-faint">
                      URL de la imagen
                    </label>
                    <input id="img-url" value={imageDraft.url} onChange={(e) => setImageDraft((d) => ({ ...d, url: e.target.value }))} placeholder="https://…" className={fieldClass} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="img-credit" className="text-[11px] font-medium text-ink-faint">
                      Crédito
                    </label>
                    <input id="img-credit" value={imageDraft.credit} onChange={(e) => setImageDraft((d) => ({ ...d, credit: e.target.value }))} placeholder="ej. Foto: MILENIO" className={fieldClass} />
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={saveImage} disabled={!imageDraft.url.trim()} className="self-start rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-pressed disabled:opacity-50">
                      Guardar imagen
                    </button>
                  </div>
                </>
              )}

              <button type="button" onClick={() => setEditingImage(false)} className="self-start text-[12px] font-medium text-ink-soft hover:text-brand">
                Cancelar
              </button>
            </div>
          ) : image ? (
            <div className="flex items-start gap-3 rounded-[10px] border border-border-soft bg-background p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
              <img src={image.url} alt="" className="h-20 w-28 flex-none rounded-[8px] object-cover" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
                <p className="truncate text-[12px] text-ink-soft">{image.credit || "(sin crédito)"}</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={startEditImage} className="text-[12px] font-medium text-ink-soft hover:text-brand">
                    Reemplazar
                  </button>
                  <button type="button" onClick={() => setImage(null)} className="text-[12px] font-medium text-ink-soft hover:text-negative">
                    Quitar imagen
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditImage}
              className="self-start rounded-lg border border-dashed border-border bg-background px-3 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
            >
              + Agregar imagen
            </button>
          )}
        </div>
        {isRichContent ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lc-dek" className={labelClass}>
                Bajada (dek)
              </label>
              <RichTextarea id="lc-dek" rows={2} value={dek} onChange={setDek} />
            </div>
            <ContentBlocksField blocks={content} onChange={setContent} headingRequired={type === "guia"} />
            {type === "guia" && (
              <div className="rounded-[10px] border border-dashed border-border-soft p-3 text-[12px] text-ink-faint">
                Preguntas frecuentes: la IA no las generó en el borrador — agrégalas después de crear, en la pantalla de edición.
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lc-description" className={labelClass}>
              Descripción
            </label>
            <RichTextarea id="lc-description" rows={5} value={description} onChange={setDescription} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor="lc-review-category" className={labelClass}>
              Categoría
            </label>
            {categoryWasAiChosen && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-mono text-[9.5px] font-medium tracking-[.04em] text-accent-fg uppercase">
                <Icon d={SPARK_ICON} size={9} strokeWidth={2} />
                Elegida por IA
              </span>
            )}
          </div>
          <select
            id="lc-review-category"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setCategoryWasAiChosen(false);
            }}
            className={`${fieldClass} max-w-[280px]`}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        {/* Campos que la IA no genera — ver comentario en `extra` arriba. */}
        <div className="flex flex-col gap-4 rounded-[12px] border border-border-soft bg-background p-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Datos que tienes que completar tú</span>
            <p className="text-[11.5px] leading-[1.4] text-ink-faint">
              Son datos verificables (fecha, ubicación, estado actual…) que la IA nunca inventa a propósito — solo un
              humano puede confirmarlos. Los que ya traen un valor por default los puedes dejar tal cual.
            </p>
          </div>

          {(type === "noticia" || type === "reportaje") && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ex-author" className={labelClass}>
                Autor
              </label>
              <select id="ex-author" value={extra.authorSlug} onChange={(e) => setExtraField("authorSlug", e.target.value)} className={`${fieldClass} max-w-[260px]`}>
                {AUTHOR_OPTIONS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.label}
                  </option>
                ))}
              </select>
              <p className="text-[11.5px] leading-[1.4] text-ink-faint">
                &quot;Redacción La Mira&quot; es el byline genérico de la casa — el default recomendado para lo que
                genera la IA. Los demás nombres son personas ficticias que quedaron de contenido migrado antes de
                este flujo; evita elegirlos para notas nuevas. Ya no se puede escribir un nombre libre aquí — evita
                inventar una firma que no existe, y de paso evita romper la página real (que solo reconoce estos).
              </p>
            </div>
          )}
          {type === "reportaje" && (
            <>
              <TagsField label="Etiquetas" tags={extra.tags} onChange={(tags) => setExtraField("tags", tags)} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ex-caption" className={labelClass}>
                  Pie de foto
                </label>
                <input id="ex-caption" required value={extra.imageCaption} onChange={(e) => setExtraField("imageCaption", e.target.value)} className={fieldClass} />
              </div>
            </>
          )}
          {type === "guia" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ex-group" className={labelClass}>
                Grupo de trámite
              </label>
              <select id="ex-group" value={extra.groupSlug} onChange={(e) => setExtraField("groupSlug", e.target.value)} className={`${fieldClass} max-w-[260px]`}>
                <option value="documentos-e-identidad">Documentos e identidad</option>
                <option value="licencias-y-manejo">Licencias y manejo</option>
                <option value="vehiculos-y-placas">Vehículos y placas</option>
                <option value="multas-y-circulacion">Multas y circulación</option>
                <option value="transporte-publico">Transporte público</option>
                <option value="salud">Salud</option>
                <option value="apoyos-sociales">Apoyos sociales</option>
                <option value="vivienda-y-seguridad">Vivienda y seguridad</option>
              </select>
            </div>
          )}
          {type === "alerta" && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ex-alerta-status" className={labelClass}>
                    Estado <span className="normal-case font-normal text-ink-faint">(opcional)</span>
                  </label>
                  <select id="ex-alerta-status" value={extra.alertaStatus} onChange={(e) => setExtraField("alertaStatus", e.target.value as AlertaStatus)} className={fieldClass}>
                    <option value="activa">Activa</option>
                    <option value="en-seguimiento">En seguimiento</option>
                    <option value="resuelta">Resuelta</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ex-alcaldia" className={labelClass}>
                    Alcaldía (slug) <span className="normal-case font-normal text-ink-faint">(opcional)</span>
                  </label>
                  <input id="ex-alcaldia" value={extra.alcaldiaSlug} onChange={(e) => setExtraField("alcaldiaSlug", e.target.value)} placeholder="ej. cuauhtemoc" className={fieldClass} />
                </div>
              </div>
              <p className="text-[11.5px] leading-[1.4] text-ink-faint">
                &quot;Estado&quot; es si la alerta sigue activa ahora mismo, ya se está resolviendo, o ya se resolvió
                — dato que solo tú sabes, la IA nunca lo adivina. Ya viene en &quot;Activa&quot; por default; solo
                cámbialo si sabes que ya cambió.
              </p>
            </div>
          )}
          {type === "evento" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ex-tag" className={labelClass}>
                    Badge
                  </label>
                  <input id="ex-tag" value={extra.tag} onChange={(e) => setExtraField("tag", e.target.value)} placeholder="ej. GRATIS" className={fieldClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ex-evento-status" className={labelClass}>
                    Estado
                  </label>
                  <select id="ex-evento-status" value={extra.eventoStatus} onChange={(e) => setExtraField("eventoStatus", e.target.value as EventoStatus)} className={fieldClass}>
                    <option value="proximo">Próximo</option>
                    <option value="en-curso">En curso</option>
                    <option value="finalizado">Finalizado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ex-date" className={labelClass}>
                    Fecha
                  </label>
                  <input id="ex-date" required value={extra.date} onChange={(e) => setExtraField("date", e.target.value)} placeholder="2026-08-30" className={fieldClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ex-time" className={labelClass}>
                    Hora
                  </label>
                  <input id="ex-time" required value={extra.time} onChange={(e) => setExtraField("time", e.target.value)} placeholder="18:00" className={fieldClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ex-price" className={labelClass}>
                    Precio
                  </label>
                  <input id="ex-price" required value={extra.price} onChange={(e) => setExtraField("price", e.target.value)} placeholder="Gratis" className={fieldClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ex-location" className={labelClass}>
                    Ubicación
                  </label>
                  <input id="ex-location" required value={extra.location} onChange={(e) => setExtraField("location", e.target.value)} className={fieldClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ex-organizer" className={labelClass}>
                    Organizador
                  </label>
                  <input id="ex-organizer" required value={extra.organizer} onChange={(e) => setExtraField("organizer", e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ex-evt-alcaldia" className={labelClass}>
                  Alcaldía (slug)
                </label>
                <input id="ex-evt-alcaldia" value={extra.alcaldiaSlug} onChange={(e) => setExtraField("alcaldiaSlug", e.target.value)} placeholder="ej. cuauhtemoc" className={`${fieldClass} max-w-[260px]`} />
              </div>
            </>
          )}
          {type === "lugar" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ex-kind" className={labelClass}>
                  Tipo de lugar
                </label>
                <select id="ex-kind" value={extra.kind} onChange={(e) => setExtraField("kind", e.target.value as LugarKind)} className={fieldClass}>
                  <option value="parque">Parque</option>
                  <option value="plaza">Plaza</option>
                  <option value="museo">Museo</option>
                  <option value="monumento">Monumento</option>
                  <option value="colonia">Colonia</option>
                  <option value="estacion-metro">Estación de Metro</option>
                  <option value="estacion-metrobus">Estación de Metrobús</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ex-lugar-alcaldia" className={labelClass}>
                  Alcaldía (slug)
                </label>
                <input id="ex-lugar-alcaldia" required value={extra.alcaldiaSlug} onChange={(e) => setExtraField("alcaldiaSlug", e.target.value)} placeholder="ej. cuauhtemoc" className={fieldClass} />
              </div>
            </div>
          )}
        </div>

            <SeoPanel seo={seo} onChange={setSeo} checksRun={checksRun} decision={decision} />

            {meta.hasStatus ? (
              <p className="rounded-lg bg-background px-3 py-2.5 text-[12.5px] leading-[1.5] text-ink-soft">
                {decision === "auto-published"
                  ? "Este borrador pasó todos los checks automáticos — se creará como publicado."
                  : "Este borrador necesita revisión — se creará como borrador, no publicado."}
              </p>
            ) : (
              <p className="rounded-lg bg-[#FEF6E7] px-3 py-2.5 text-[12.5px] leading-[1.5] text-[#9A6B12]">
                Este tipo de contenido no tiene borrador — se publica de inmediato al crearlo. Revisa bien antes de continuar.
              </p>
            )}
          </div>
        </div>

        {/* Barra de acciones fija al fondo del viewport (sticky, no fixed) —
            siempre alcanzable sin tener que bajar hasta el final de un
            formulario que ahora puede ser bastante largo. */}
        <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-border-soft bg-white/95 px-[26px] py-3.5 backdrop-blur-sm">
          <button
            type="button"
            onClick={handleCreate}
            disabled={step === "creating"}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-60 disabled:shadow-none"
          >
            {step === "creating" ? "Creando…" : meta.hasStatus && decision === "auto-published" ? "Crear y publicar" : meta.hasStatus ? "Crear como borrador" : "Crear y publicar"}
          </button>
          <button type="button" onClick={() => setStep("input")} className="text-[13px] font-medium text-ink-soft hover:text-brand">
            Empezar de nuevo
          </button>
          {error && <span className="text-[12.5px] font-medium text-[#C4453A]">{error}</span>}
        </div>
      </div>

      {/* Vista previa — a la derecha en pantallas grandes, pegada mientras se
          hace scroll por el formulario (más largo ahora); abajo, apilada, en
          móvil. */}
      <div className="w-full flex-none border-t border-border-soft bg-white lg:w-[420px] lg:border-t-0 lg:border-l xl:w-[460px]">
        <div className="p-[26px] lg:sticky lg:top-0">
          <LamiraPreviewCard
            type={type}
            name={title}
            categoryName={category?.name ?? null}
            image={image}
            dek={dek}
            description={description}
            content={content}
            alertaStatus={extra.alertaStatus}
            alcaldiaSlug={extra.alcaldiaSlug}
            eventoStatus={extra.eventoStatus}
            date={extra.date}
            time={extra.time}
            location={extra.location}
            price={extra.price}
            organizer={extra.organizer}
            kind={extra.kind}
            colonia={extra.colonia}
          />
        </div>
      </div>
    </div>
  );
}
