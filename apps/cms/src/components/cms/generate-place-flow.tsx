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
}

export function GeneratePlaceFlow({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [name, setName] = useState("");
  const [hints, setHints] = useState("");
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [error, setError] = useState("");

  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [seo, setSeo] = useState<Seo>({});
  const [categoryData, setCategoryData] = useState<Record<string, unknown>>({});
  const [checksRun, setChecksRun] = useState<CheckResult[]>([]);
  const [decision, setDecision] = useState<AiDecision>("needs-review");

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
        body: JSON.stringify({ site: "planazo", contentType: "place", categoryId, name, hints: hints || undefined, provider }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar el borrador.");
        setStep("input");
        return;
      }

      const data: DraftResponse = await res.json();
      const { seo: draftSeo, description: draftDescription, suggestedTags, ...rest } = data.draft as {
        seo?: Seo;
        description?: string;
        suggestedTags?: string[];
        [key: string]: unknown;
      };
      setDescription(draftDescription ?? "");
      setTags(suggestedTags ?? []);
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

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/places`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          categorySlug: category?.slug,
          tags,
          status: decision === "auto-published" ? "published" : "draft",
          categoryData,
          seo,
        }),
      });

      if (!res.ok) {
        setError("No se pudo crear el lugar.");
        setStep("review");
        return;
      }

      const created = await res.json();
      router.push(`/contenido/${created.id}`);
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
        <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿Sobre qué lugar escribimos?</h1>
        <p className="mx-auto mb-7 max-w-[46ch] text-[13.5px] leading-[1.6] text-ink-soft">
          Dame el nombre de un lugar real, la categoría y lo que ya sabes de él. Escribo la descripción y los campos
          propios de la categoría — la dirección, teléfono y precio los completas tú, para no inventar datos que
          puedan estar mal.
        </p>

        <form onSubmit={handleGenerate} className="flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="place-name" className={labelClass}>
              Nombre del lugar
            </label>
            <input
              id="place-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Café Nin, Roma Norte"
              className={fieldClass}
              disabled={step === "generating"}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="place-category" className={labelClass}>
              Categoría
            </label>
            <select
              id="place-category"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`${fieldClass} max-w-[280px]`}
              disabled={step === "generating"}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="place-hints" className={labelClass}>
              Lo que ya sabes (opcional)
            </label>
            <textarea
              id="place-hints"
              rows={3}
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder="ej. cafetería de especialidad, terraza chica, buena para trabajar"
              className={`${fieldClass} resize-none`}
              disabled={step === "generating"}
            />
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
          <label htmlFor="gen-description" className={labelClass}>
            Descripción
          </label>
          <textarea
            id="gen-description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${fieldClass} resize-none`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Categoría</span>
          <p className="text-[13.5px] text-ink">{category?.name}</p>
        </div>

        <CategoryFieldsSection category={category} data={categoryData} onChange={setCategoryData} />

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Etiquetas sugeridas</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[12px]"
              >
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
        </div>

        <SeoPanel seo={seo} onChange={setSeo} checksRun={checksRun} decision={decision} />

        <p className="rounded-lg bg-background px-3 py-2.5 text-[12.5px] leading-[1.5] text-ink-soft">
          Dirección, teléfono y precio quedan en blanco a propósito — la IA no los inventó. Complétalos en la
          pantalla de edición después de crear el borrador.
          {decision === "auto-published"
            ? " Este borrador pasó todos los checks automáticos — se creará como publicado."
            : " Este borrador necesita revisión — se creará como borrador, no publicado."}
        </p>

        {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

        <div className="flex items-center gap-3 border-t border-border-soft pt-5">
          <button
            type="button"
            onClick={handleCreate}
            disabled={step === "creating"}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-60 disabled:shadow-none"
          >
            {step === "creating" ? "Creando…" : decision === "auto-published" ? "Crear y publicar" : "Crear como borrador"}
          </button>
          <button
            type="button"
            onClick={() => setStep("input")}
            className="text-[13px] font-medium text-ink-soft hover:text-brand"
          >
            Empezar de nuevo
          </button>
        </div>
      </div>
    </div>
  );
}
