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

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
type Step = "input" | "generating" | "review" | "creating";
type ProviderId = "openai" | "claude-cli";

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
}

export function GenerateLamiraContentFlow({
  type,
  categories,
  initialName,
  initialHints,
}: {
  type: string;
  categories: Category[];
  initialName?: string;
  initialHints?: string;
}) {
  const router = useRouter();
  const meta = TYPE_META[type];
  const [step, setStep] = useState<Step>("input");
  const [name, setName] = useState(initialName ?? "");
  const [hints, setHints] = useState(initialHints ?? "");
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [error, setError] = useState("");

  const [dek, setDek] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState<ContentBlockValue[]>([]);
  const [faq, setFaq] = useState<{ question: string; answer: string }[]>([]);
  const [seo, setSeo] = useState<Seo>({});
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>({});
  const [checksRun, setChecksRun] = useState<CheckResult[]>([]);
  const [decision, setDecision] = useState<AiDecision>("needs-review");

  // Campos que la IA no genera (son datos verificables) — el humano los llena
  // en la revisión. Para alerta/evento/lugar son obligatorios de verdad
  // porque esos 3 tipos no tienen workflow de borrador (ver AiDraftService):
  // cualquier fila creada ahí es pública de inmediato, así que aquí no se
  // puede "completar después" como sí puede Place/noticia/guia/reportaje.
  const [extra, setExtra] = useState({
    authorSlug: "",
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
        body: JSON.stringify({ site: "la-mira", contentType: type, categoryId, name, hints: hints || undefined, provider }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar el borrador.");
        setStep("input");
        return;
      }

      const data: DraftResponse = await res.json();
      const { dek: draftDek, content: draftContent, faq: draftFaq, description: draftDescription, seo: draftSeo, ...rest } = data.draft as {
        dek?: string;
        content?: ContentBlockValue[];
        faq?: { question: string; answer: string }[];
        description?: string;
        seo?: Seo;
        [k: string]: unknown;
      };
      setDek(draftDek ?? "");
      setDescription(draftDescription ?? "");
      setContent((draftContent ?? []).map((b) => ({ heading: b.heading ?? null, paragraphs: b.paragraphs })));
      setFaq(draftFaq ?? []);
      setSeo(draftSeo ?? {});
      setCategoryData(rest);
      setChecksRun(data.checksRun);
      setDecision(data.decision);
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
    let payload: Record<string, unknown>;

    switch (type) {
      case "noticia":
        payload = { title: name, dek, categoryId: categoryId || null, authorSlug: extra.authorSlug, status, toc: buildToc(content), content, categoryData, seo };
        break;
      case "guia":
        payload = { title: name, dek, groupSlug: extra.groupSlug, categoryId: categoryId || null, status, content: withBlockIds(content), faq, categoryData, seo };
        break;
      case "reportaje":
        payload = { title: name, dek, categoryId: categoryId || null, authorSlug: extra.authorSlug, status, tags: extra.tags.length ? extra.tags : ["Reportaje"], imageCaption: extra.imageCaption || "Pendiente", toc: buildToc(content), content, categoryData, seo };
        break;
      case "alerta":
        payload = { title: name, alertaStatus: extra.alertaStatus, categoryId: categoryId || null, alcaldiaSlug: extra.alcaldiaSlug || null, description, categoryData, seo };
        break;
      case "evento":
        payload = { title: name, tag: extra.tag || "Evento", categoryId: categoryId || null, eventoStatus: extra.eventoStatus, date: extra.date, time: extra.time, location: extra.location, alcaldiaSlug: extra.alcaldiaSlug || null, price: extra.price, description, organizer: extra.organizer, categoryData, seo };
        break;
      case "lugar":
        payload = { name, kind: extra.kind, categoryId: categoryId || null, alcaldiaSlug: extra.alcaldiaSlug, colonia: extra.colonia || null, description, categoryData, seo };
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
            <label htmlFor="lc-category" className={labelClass}>
              Categoría
            </label>
            <select id="lc-category" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${fieldClass} max-w-[280px]`} disabled={step === "generating"}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
    <div className="mx-auto max-w-[680px] p-[26px] pb-[60px]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 font-mono text-[10.5px] font-medium tracking-[.06em] text-accent-fg uppercase">
        Borrador IA · revisa antes de crear
      </span>
      <h1 className="mt-3 mb-5 text-[22px] font-semibold tracking-tight">{name}</h1>

      <div className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        {isRichContent ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lc-dek" className={labelClass}>
                Bajada (dek)
              </label>
              <textarea id="lc-dek" rows={2} value={dek} onChange={(e) => setDek(e.target.value)} className={`${fieldClass} resize-none`} />
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
            <textarea id="lc-description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className={`${fieldClass} resize-none`} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Categoría</span>
          <p className="text-[13.5px] text-ink">{category?.name}</p>
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        {/* Campos que la IA no genera — ver comentario en `extra` arriba. */}
        <div className="flex flex-col gap-4 rounded-[12px] border border-border-soft bg-background p-4">
          <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Datos que tienes que completar tú</span>

          {(type === "noticia" || type === "reportaje") && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ex-author" className={labelClass}>
                Autor (slug)
              </label>
              <input id="ex-author" required value={extra.authorSlug} onChange={(e) => setExtraField("authorSlug", e.target.value)} placeholder="ej. mariana-robles" className={fieldClass} />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ex-alerta-status" className={labelClass}>
                  Estado
                </label>
                <select id="ex-alerta-status" value={extra.alertaStatus} onChange={(e) => setExtraField("alertaStatus", e.target.value as AlertaStatus)} className={fieldClass}>
                  <option value="activa">Activa</option>
                  <option value="en-seguimiento">En seguimiento</option>
                  <option value="resuelta">Resuelta</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ex-alcaldia" className={labelClass}>
                  Alcaldía (slug)
                </label>
                <input id="ex-alcaldia" value={extra.alcaldiaSlug} onChange={(e) => setExtraField("alcaldiaSlug", e.target.value)} placeholder="ej. cuauhtemoc" className={fieldClass} />
              </div>
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

        {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

        <div className="flex items-center gap-3 border-t border-border-soft pt-5">
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
        </div>
      </div>
    </div>
  );
}
