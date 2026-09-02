"use client";

import { useEffect, useState } from "react";
import { apiConfig } from "@planazo/config";
import type { Category, CheckResult, AiDecision } from "@planazo/types";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { GenerateLamiraContentFlow } from "@/components/cms/lamira/generate-lamira-content-flow";
import { GeneratePlaceFlow } from "@/components/cms/generate-place-flow";
import { GenerateEventFlow } from "@/components/cms/planazo/generate-event-flow";
import { useOpenAiAvailable } from "@/lib/use-openai-available";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
type ProviderId = "openai" | "claude-cli" | "codex-cli";

const PROVIDERS: Array<{ id: ProviderId; label: string; hint: string }> = [
  { id: "openai", label: "OpenAI", hint: "Salida estructurada garantizada · cuesta por token" },
  { id: "claude-cli", label: "Claude (tu sesión)", hint: "Usa tu suscripción Pro/Max ya conectada · más lento" },
  { id: "codex-cli", label: "Codex (tu sesión)", hint: "Usa tu sesión de ChatGPT ya conectada · más lento" },
];

const SITE_LABEL: Record<"la-mira" | "planazo", string> = { "la-mira": "La Mira", planazo: "Planazo" };
const TYPE_LABEL: Record<string, string> = {
  noticia: "Noticia",
  alerta: "Alerta",
  guia: "Guía",
  evento: "Evento",
  lugar: "Lugar",
  reportaje: "Reportaje",
  place: "Lugar",
  "evento-planazo": "Evento",
};

interface DraftResponse {
  draft: Record<string, unknown>;
  checksRun: CheckResult[];
  decision: AiDecision;
  image: { url: string; credit: string } | null;
  articleImages: { url: string; credit: string }[];
  imageSearchQuery: string;
  categoryId: string;
  site: "la-mira" | "planazo";
  contentType: string;
}

interface Resolved {
  name: string;
  categories: Category[];
  draftResponse: DraftResponse;
}

// Punto de entrada del botón "Publicar" de content-radar — a diferencia de
// Centro IA con un sitio ya elegido (SiteTabs), aquí NO se sabe todavía si
// esto va a La Mira o a Planazo, ni bajo qué tipo: se manda solo el tema +
// hints a AiDraftService, que clasifica sitio+tipo+categoría juntos (ver
// AiDraftService.classifyContentType) leyendo el artículo completo — señal
// mucho mejor que la categoría de content-radar sola. Una vez resuelto, se
// delega la revisión al flujo real de ese tipo (ya con el borrador listo,
// sin volver a generar).
export function PublishFlow({ initialName, initialHints }: { initialName?: string; initialHints?: string }) {
  const [name, setName] = useState(initialName ?? "");
  const [hints, setHints] = useState(initialHints ?? "");
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [generating, setGenerating] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const openaiAvailable = useOpenAiAvailable();
  const providers = PROVIDERS.filter((p) => p.id !== "openai" || openaiAvailable === true);

  useEffect(() => {
    if (openaiAvailable === false && provider === "openai") setProvider("claude-cli");
  }, [openaiAvailable, provider]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGenerating(true);

    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/ai/draft`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Sin site/contentType/categoryId a propósito: el backend clasifica
        // los tres juntos (ver AiDraftService.draft/classifyContentType).
        body: JSON.stringify({ name, hints: hints || undefined, provider }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar el borrador.");
        setGenerating(false);
        return;
      }

      const data: DraftResponse = await res.json();
      const catRes = await fetch(`${apiConfig.baseUrl}/cms/categories?site=${data.site}`, { credentials: "include" });
      const categories: Category[] = catRes.ok ? await catRes.json() : [];

      setResolved({ name, categories, draftResponse: data });
    } catch {
      setError("No se pudo conectar con el servidor.");
      setGenerating(false);
    }
  }

  // Vuelve a pedir el borrador, ahora con `site`/`contentType` fijos (la IA
  // no clasifica cuando ya vienen en el body, ver AiDraftService.draft) — se
  // usa cuando la IA clasificó mal y el humano ya sabe a qué sitio va de
  // verdad. Un tipo por default razonable por sitio (noticia/lugar); el
  // humano lo puede cambiar después, en la revisión, igual que siempre.
  async function switchSite(targetSite: "la-mira" | "planazo") {
    setSwitching(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/ai/draft`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          hints: hints || undefined,
          provider,
          site: targetSite,
          contentType: targetSite === "la-mira" ? "noticia" : "place",
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar el borrador para el otro sitio.");
        setSwitching(false);
        return;
      }

      const data: DraftResponse = await res.json();
      const catRes = await fetch(`${apiConfig.baseUrl}/cms/categories?site=${data.site}`, { credentials: "include" });
      const categories: Category[] = catRes.ok ? await catRes.json() : [];

      setResolved({ name, categories, draftResponse: data });
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSwitching(false);
    }
  }

  if (resolved) {
    const { site, contentType } = resolved.draftResponse;
    const otherSite = site === "la-mira" ? "planazo" : "la-mira";
    // Se manda a los 3 flujos por igual — solo ellos deciden si lo usan
    // (ver "publicado" ahí): al terminar de crear, en vez de navegar de
    // inmediato ofrecen generar TAMBIÉN una segunda pieza para `otherSite`,
    // reusando el mismo tema/hints ya escritos arriba.
    const crossSitePublish = {
      otherSiteLabel: SITE_LABEL[otherSite],
      onPublishOther: () => switchSite(otherSite),
      publishingOther: switching,
    };
    return (
      <div className="flex flex-col lg:h-full">
        {/* Franja angosta solo para el badge — el flujo de abajo NO hereda
            este ancho, usa toda la página (GenerateLamiraContentFlow trae su
            propia revisión de pantalla dividida). */}
        <div className="flex-none flex flex-wrap items-center gap-2.5 px-[26px] pt-[26px]">
          {/* La IA clasificó sitio+tipo+categoría leyendo el artículo — esto
              es solo informativo, no un selector: antes un clic aquí volvía a
              llamar a la IA y reescribía el borrador desde cero (título,
              descripción, todo), lo cual confundía porque se veía como un
              simple cambio de vista previa. Si la IA se equivocó de sitio, la
              corrección real es "Empezar de nuevo" (abajo) y regenerar ya con
              el tema/hints tal cual — no un botón que parece inofensivo. */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[12px] font-semibold text-ink">
            {SITE_LABEL[site]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 font-mono text-[10px] font-medium tracking-[.04em] text-ink-faint uppercase">
            <Icon d={SPARK_ICON} size={10} strokeWidth={2} />
            {TYPE_LABEL[contentType] ?? contentType}
          </span>
          {error && <span className="text-[12px] font-medium text-[#C4453A]">{error}</span>}
        </div>
        <div className="lg:min-h-0 lg:flex-1">
          {site === "la-mira" ? (
            <GenerateLamiraContentFlow
              type={contentType}
              categories={resolved.categories}
              initialName={resolved.name}
              initialDraft={resolved.draftResponse}
              crossSitePublish={crossSitePublish}
            />
          ) : contentType === "place" ? (
            <GeneratePlaceFlow
              categories={resolved.categories}
              initialName={resolved.name}
              initialDraft={resolved.draftResponse}
              crossSitePublish={crossSitePublish}
            />
          ) : (
            <GenerateEventFlow
              categories={resolved.categories}
              initialName={resolved.name}
              initialDraft={resolved.draftResponse}
              crossSitePublish={crossSitePublish}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[620px] p-[26px] pb-[60px] text-center">
      <div className="mx-auto mb-4 grid size-[46px] place-items-center rounded-2xl border border-[#FFE2CC] bg-accent">
        <Icon d={SPARK_ICON} size={22} strokeWidth={1.6} className="text-brand" />
      </div>
      {initialName && (
        <span className="mx-auto mb-2.5 inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 font-mono text-[10px] font-medium tracking-[.04em] text-ink-faint uppercase">
          <Icon d={SPARK_ICON} size={10} strokeWidth={2} />
          Desde Content Radar
        </span>
      )}
      <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿Sobre qué escribimos?</h1>
      {/* Mismo párrafo que la pantalla de "¿Sobre qué escribimos?" cuando el
          tipo ya está fijo (ver GenerateLamiraContentFlow) — para que ambos
          puntos de entrada se sientan como la misma pantalla. */}
      <p className="mx-auto mb-7 max-w-[46ch] text-[13.5px] leading-[1.6] text-ink-soft">
        Dame el tema y lo que ya sabes — por ejemplo, un titular y fuente de content-radar. Escribo el borrador; los
        datos verificables (fecha, ubicación, cifras) los completas tú.
      </p>

      <form onSubmit={handleGenerate} className="flex flex-col gap-5 rounded-[16px] border border-border bg-white p-6 text-left shadow-[0_1px_2px_rgba(23,20,17,.03)] sm:p-7">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pf-name" className={labelClass}>
            Tema / título
          </label>
          <input id="pf-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Bloqueo total en Eje Central por transportistas" className={fieldClass} disabled={generating} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pf-hints" className={labelClass}>
            Lo que ya sabes (fuentes, contexto, etc.)
          </label>
          <textarea
            id="pf-hints"
            rows={4}
            value={hints}
            onChange={(e) => setHints(e.target.value)}
            placeholder="ej. Fuente: MILENIO — 9 bloqueos en Reforma e Insurgentes hoy 25 de agosto…"
            className={`${fieldClass} resize-none`}
            disabled={generating}
          />
          <p className="text-[11.5px] text-ink-faint">
            La IA decide en qué sitio (La Mira o Planazo), bajo qué tipo de contenido y qué categoría — todo lo
            revisas después de generar.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className={labelClass}>Proveedor de IA</span>
          <div className="flex gap-2">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                disabled={generating}
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
          disabled={generating}
          className="mt-1 flex items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-3 text-[14.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-70"
        >
          {generating ? (
            <>
              <Icon d={SPARK_ICON} size={15} strokeWidth={1.8} className="animate-spin" />
              Decidiendo dónde va y escribiendo… {provider === "claude-cli" && "(puede tardar ~30s)"}
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
