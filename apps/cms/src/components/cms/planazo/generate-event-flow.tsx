"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";
import type { Category, CheckResult, AiDecision, Seo } from "@planazo/types";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { CategoryFieldsSection } from "@/components/cms/category-fields-section";
import { SeoPanel } from "@/components/cms/seo-panel";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

type Step = "input" | "generating" | "review" | "creating";
type ProviderId = "openai" | "claude-cli";

const PROVIDERS: Array<{ id: ProviderId; label: string; hint: string }> = [
  { id: "openai", label: "OpenAI", hint: "Salida estructurada garantizada · cuesta por token" },
  { id: "claude-cli", label: "Claude (tu sesión)", hint: "Usa tu suscripción Pro/Max ya conectada · más lento" },
];

interface DraftResponse {
  draft: Record<string, unknown>;
  checksRun: CheckResult[];
  decision: AiDecision;
  categoryId: string;
  site: "la-mira" | "planazo";
  contentType: string;
}

function parseEventDraft(draft: Record<string, unknown>) {
  const { seo, description, ...rest } = draft as { seo?: Seo; description?: string; [key: string]: unknown };
  return { seo: seo ?? {}, description: description ?? "", categoryData: rest };
}

// Evento de Planazo — recomendación de plan ligada (opcionalmente) a un lugar
// recurrente, distinto del "evento" de la-mira (cobertura noticiosa, ver
// content-types.ts). Antes de este cambio Planazo no tenía NINGÚN flujo de
// creación de eventos con IA — solo `place` — así que este componente es
// nuevo por completo, calcado de GeneratePlaceFlow.
export function GenerateEventFlow({
  categories,
  initialName,
  initialDraft,
}: {
  categories: Category[];
  initialName?: string;
  // Cuando viene de PublishFlow (Publicar desde content-radar sin sitio/tipo
  // fijo), el borrador ya se generó ahí — este componente arranca directo en
  // "review" con estos datos, sin pedirle al humano que genere de nuevo.
  initialDraft?: DraftResponse;
}) {
  const router = useRouter();
  const initialParsed = initialDraft ? parseEventDraft(initialDraft.draft) : null;
  const [step, setStep] = useState<Step>(initialDraft ? "review" : "input");
  const [name, setName] = useState(initialName ?? "");
  const [hints, setHints] = useState("");
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [categoryId, setCategoryId] = useState(initialDraft?.categoryId ?? "");
  const [categoryWasAiChosen, setCategoryWasAiChosen] = useState(!!initialDraft);
  const [error, setError] = useState("");

  const [description, setDescription] = useState(initialParsed?.description ?? "");
  const [seo, setSeo] = useState<Seo>(initialParsed?.seo ?? {});
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>(initialParsed?.categoryData ?? {});
  const [checksRun, setChecksRun] = useState<CheckResult[]>(initialDraft?.checksRun ?? []);
  const [decision, setDecision] = useState<AiDecision>(initialDraft?.decision ?? "needs-review");

  // Datos verificables — la IA nunca los inventa, los completa el humano
  // aquí antes de crear (los eventos de Planazo no tienen workflow de
  // borrador: se publican de inmediato al crearse, igual que alerta/evento/
  // lugar de la-mira).
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationName, setLocationName] = useState("");

  const category = categories.find((c) => c.id === categoryId) ?? null;

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
        // la categoría (ver AiDraftService.classifyCategory) — llega en data.categoryId abajo.
        body: JSON.stringify({ site: "planazo", contentType: "evento-planazo", name, hints: hints || undefined, provider }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar el borrador.");
        setStep("input");
        return;
      }

      const data: DraftResponse = await res.json();
      const parsed = parseEventDraft(data.draft);
      setDescription(parsed.description);
      setSeo(parsed.seo);
      setCategoryData(parsed.categoryData);
      setChecksRun(data.checksRun);
      setDecision(data.decision);
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

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/events`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          startDate,
          endDate: endDate || null,
          locationName: locationName || null,
          categoryId: categoryId || null,
          status: "published",
          categoryData,
          seo,
        }),
      });

      if (!res.ok) {
        setError("No se pudo crear el evento — revisa que la fecha esté llena.");
        setStep("review");
        return;
      }

      const created = await res.json();
      router.push(`/contenido/planazo-evento/${created.id}`);
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
        <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿Sobre qué evento escribimos?</h1>
        <p className="mx-auto mb-7 max-w-[46ch] text-[13.5px] leading-[1.6] text-ink-soft">
          Dame el nombre del evento y lo que ya sabes de él. Escribo la descripción — la fecha, hora y lugar los
          completas tú, para no inventar datos que puedan estar mal.
        </p>

        <form onSubmit={handleGenerate} className="flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="event-name" className={labelClass}>
              Nombre del evento
            </label>
            <input
              id="event-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Noche de jazz en Foro Indie Rocks"
              className={fieldClass}
              disabled={step === "generating"}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="event-hints" className={labelClass}>
              Lo que ya sabes (opcional)
            </label>
            <textarea
              id="event-hints"
              rows={3}
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder="ej. entrada libre, cupo limitado, ambiente relajado"
              className={`${fieldClass} resize-none`}
              disabled={step === "generating"}
            />
            <p className="text-[11.5px] text-ink-faint">La categoría la elige la IA a partir del nombre y notas — la revisas y puedes cambiarla después de generar.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Proveedor de IA</span>
            <div className="flex gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  disabled={step === "generating"}
                  title={p.hint}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    provider === p.id ? "border-brand bg-accent" : "border-border bg-white hover:border-ink-faint"
                  }`}
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
    <div className="mx-auto max-w-[640px] p-[26px] pb-[60px]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 font-mono text-[10.5px] font-medium tracking-[.06em] text-accent-fg uppercase">
        Borrador IA · revisa antes de crear
      </span>
      <h1 className="mt-3 mb-5 text-[22px] font-semibold tracking-tight">{name}</h1>

      <div className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="event-description" className={labelClass}>
            Descripción
          </label>
          <textarea
            id="event-description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${fieldClass} resize-none`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor="event-review-category" className={labelClass}>
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
            id="event-review-category"
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

        {/* Campos verificables — la IA no los genera, ver comentario arriba. */}
        <div className="flex flex-col gap-4 rounded-[12px] border border-border-soft bg-background p-4">
          <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Datos que tienes que completar tú</span>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ev-start" className={labelClass}>
                Fecha y hora de inicio
              </label>
              <input id="ev-start" type="datetime-local" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ev-end" className={labelClass}>
                Fecha y hora de fin (opcional)
              </label>
              <input id="ev-end" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldClass} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ev-location" className={labelClass}>
              Lugar
            </label>
            <input id="ev-location" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="ej. Foro Indie Rocks, Condesa" className={fieldClass} />
          </div>
        </div>

        <SeoPanel seo={seo} onChange={setSeo} checksRun={checksRun} decision={decision} />

        <p className="rounded-lg bg-[#FEF6E7] px-3 py-2.5 text-[12.5px] leading-[1.5] text-[#9A6B12]">
          Este tipo de contenido no tiene borrador — se publica de inmediato al crearlo. Revisa bien antes de continuar.
        </p>

        {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

        <div className="flex items-center gap-3 border-t border-border-soft pt-5">
          <button
            type="button"
            onClick={handleCreate}
            disabled={step === "creating"}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-60 disabled:shadow-none"
          >
            {step === "creating" ? "Creando…" : "Crear y publicar"}
          </button>
          <button type="button" onClick={() => setStep("input")} className="text-[13px] font-medium text-ink-soft hover:text-brand">
            Empezar de nuevo
          </button>
        </div>
      </div>
    </div>
  );
}
