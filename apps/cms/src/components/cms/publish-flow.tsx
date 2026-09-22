"use client";

import { useEffect, useMemo, useState } from "react";
import { apiConfig } from "@planazo/config";
import type { Category, CheckResult, AiDecision } from "@planazo/types";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { GenerateLamiraContentFlow } from "@/components/cms/lamira/generate-lamira-content-flow";
import { GeneratePlaceFlow } from "@/components/cms/generate-place-flow";
import { GenerateEventFlow } from "@/components/cms/planazo/generate-event-flow";
import { useOpenAiAvailable } from "@/lib/use-openai-available";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
const TRASH_ICON = "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7";
const PLUS_ICON = "M12 5v14M5 12h14";
const SEARCH_ICON = "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5L21 21";
const CLOSE_ICON = "M6 6l12 12M18 6L6 18";
const PIN_ICON = "M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z";
type ProviderId = "openai" | "claude-cli" | "codex-cli";
type Mode = "tema" | "liga" | "texto" | "frases" | "radar" | "zona";

/** Tema pendiente del reporte más reciente de content-radar (ver
 * extractTopics en @planazo/content-radar/render) — modo "Content Radar" de
 * este formulario, para elegir uno sin salir de Centro IA. */
export interface RadarTopic {
  title: string;
  hints: string;
  categoryLabel: string;
}

/** Frase guardada en /automatizaciones/frases (SearchPhrasesService) con
 * resultados de búsqueda reales ya investigados — modo "Frases guardadas"
 * de este formulario (ver buildSavedPhrases en centro-ia/page.tsx). */
export interface SavedPhrase {
  phrase: string;
  categoryLabel: string | null;
  hints: string;
}

interface NearbyPlace {
  name: string;
  rating: number | null;
  userRatingsTotal: number | null;
  address: string | null;
}

interface NearbyPlaceCategory {
  type: string;
  label: string;
  places: NearbyPlace[];
}

interface NearbyPlacesResult {
  zoneName: string;
  categories: NearbyPlaceCategory[];
}

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

const MODE_LABEL: Record<Mode, string> = {
  tema: "Por tema",
  liga: "Por liga",
  texto: "Texto libre",
  frases: "Frases guardadas",
  radar: "Content Radar",
  zona: "Zona",
};

const MODE_INTRO: Record<Mode, string> = {
  tema: "Dame el tema y lo que ya sabes — por ejemplo, un titular y fuente de content-radar. Escribo el borrador; los datos verificables (fecha, ubicación, cifras) los completas tú.",
  liga: "Pega el link (o varios) de la nota original — leo el artículo completo y escribo el borrador. Los datos verificables (fecha, ubicación, cifras) los completas tú.",
  texto: "Pega el texto completo que ya tengas — un comunicado, notas de una llamada, un boletín. Lo reestructuro como nota, sin inventar nada que no esté ahí.",
  frases: "Elige una frase guardada en Frases de búsqueda — uso las fuentes que ya se investigaron para esa frase.",
  radar: "Elige un tema pendiente del reporte más reciente de Content Radar, sin salir de aquí.",
  zona: "Escribe una zona (\"Coacalco\", \"Polanco\") y busco los lugares mejor calificados cerca de ahí — un proxy de lo más popular, no búsquedas reales.",
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

// Punto de entrada del botón "Publicar" de content-radar — NO se sabe
// todavía si esto va a La Mira o a Planazo, ni bajo qué tipo: se manda solo
// el tema + hints a AiDraftService, que clasifica sitio+tipo+categoría
// juntos (ver AiDraftService.classifyContentType) leyendo el artículo
// completo — señal mucho mejor que la categoría de content-radar sola. Una
// vez resuelto, se delega la revisión al flujo real de ese tipo (ya con el
// borrador listo, sin volver a generar).
//
// `fixedSite`: mismo componente, reusado por Centro IA cuando el editor ya
// eligió sitio a mano (SiteTabs/CrearSteps) pero todavía no tipo — el sitio
// se manda fijo (classifyContentType solo elige tipo DENTRO de ese sitio,
// nunca lo cambia) y se ocultan el pill de sitio y "publicar también en
// [otro sitio]" (no aplica: ya se está en ese sitio a propósito).
// Fuentes que llegan con `initialName` ya puesto (deep link con tema
// pre-llenado) — el badge de arriba dice de dónde salió. "content-radar" es
// el default por compatibilidad: los links viejos del botón "Publicar" de
// content-radar no mandan `source` explícito.
const SOURCE_LABEL: Record<string, string> = {
  "content-radar": "Content Radar",
  entidades: "Entidades",
};

export function PublishFlow({
  initialName,
  initialHints,
  fixedSite,
  source = "content-radar",
  radarTopics = [],
  savedPhrases = [],
}: {
  initialName?: string;
  initialHints?: string;
  fixedSite?: "la-mira" | "planazo";
  source?: string;
  radarTopics?: RadarTopic[];
  savedPhrases?: SavedPhrase[];
}) {
  const [name, setName] = useState(initialName ?? "");
  const [hints, setHints] = useState(initialHints ?? "");
  const [mode, setMode] = useState<Mode>("tema");

  // Modo "Por liga" — una o varias URLs (content-radar solo manda una nota
  // sobre 2-3 fuentes distintas del mismo tema); cada una se manda como su
  // propia línea "— FUENTE (url)" y el backend las scrapea todas (ver
  // AiDraftService.urlsFromHints/scrapeSourceFromHints).
  const [sourceUrls, setSourceUrls] = useState<string[]>([""]);
  const [urlSiteNames, setUrlSiteNames] = useState<(string | null)[]>([null]);
  const [scrapingIndex, setScrapingIndex] = useState<number | null>(null);

  // Modo "Frases guardadas"
  const [phraseFilter, setPhraseFilter] = useState("");
  const [selectedPhraseText, setSelectedPhraseText] = useState<string | null>(null);
  const selectedPhrase = savedPhrases.find((p) => p.phrase === selectedPhraseText) ?? null;
  const filteredPhrases = useMemo(() => {
    const q = phraseFilter.trim().toLowerCase();
    const list = q ? savedPhrases.filter((p) => p.phrase.toLowerCase().includes(q) || p.categoryLabel?.toLowerCase().includes(q)) : savedPhrases;
    return list.slice(0, 40);
  }, [savedPhrases, phraseFilter]);

  // Modo "Zona"
  const [zoneQuery, setZoneQuery] = useState("");
  const [zoneSearching, setZoneSearching] = useState(false);
  const [zoneError, setZoneError] = useState("");
  const [zoneResult, setZoneResult] = useState<NearbyPlacesResult | null>(null);

  // Modo "Content Radar"
  const [radarFilter, setRadarFilter] = useState("");
  const [radarTitle, setRadarTitle] = useState<string | null>(null);
  const selectedRadarTopic = radarTopics.find((t) => t.title === radarTitle) ?? null;
  const filteredRadarTopics = useMemo(() => {
    const q = radarFilter.trim().toLowerCase();
    const list = q ? radarTopics.filter((t) => t.title.toLowerCase().includes(q) || t.categoryLabel.toLowerCase().includes(q)) : radarTopics;
    return list.slice(0, 40);
  }, [radarTopics, radarFilter]);

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

  const effectiveHints = useMemo(() => {
    const extra = hints.trim();
    if (mode === "liga") {
      const lines = sourceUrls
        .map((u, i) => (u.trim() ? `— ${urlSiteNames[i] ?? "fuente externa"} (${u.trim()})` : ""))
        .filter(Boolean);
      return [...lines, extra].filter(Boolean).join("\n");
    }
    if (mode === "frases") return [selectedPhrase?.hints ?? "", extra].filter(Boolean).join("\n\n");
    if (mode === "radar") return [selectedRadarTopic?.hints ?? "", extra].filter(Boolean).join("\n\n");
    if (mode === "zona") {
      if (!zoneResult) return extra;
      const lines = [
        `Lugares mejor calificados cerca de ${zoneResult.zoneName} (proxy de popularidad por rating y número de reseñas — no son datos de búsquedas reales, acláralo si lo mencionas):`,
        ...zoneResult.categories.map((c) =>
          [`${c.label}:`, ...c.places.map((p) => `- ${p.name}${p.rating ? ` (${p.rating}★, ${p.userRatingsTotal} reseñas)` : ""}${p.address ? ` — ${p.address}` : ""}`)].join("\n"),
        ),
      ];
      return [lines.join("\n\n"), extra].filter(Boolean).join("\n\n");
    }
    // "tema" y "texto" mandan tal cual — el texto libre pegado ES el hints,
    // no necesita formato especial (AiDraftService ya lo trata como
    // "Notas del editor", igual que cualquier otro contexto).
    return hints;
  }, [mode, hints, sourceUrls, urlSiteNames, selectedPhrase, selectedRadarTopic, zoneResult]);

  async function handleScrapeUrlAt(index: number, url: string) {
    const trimmed = url.trim();
    if (!/^https?:\/\//.test(trimmed)) return;
    setScrapingIndex(index);
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/scrape-preview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data: { title: string | null; siteName: string } | null = res.ok ? await res.json() : null;
      if (data) {
        setUrlSiteNames((prev) => prev.map((n, i) => (i === index ? data.siteName : n)));
        if (index === 0 && data.title && !name.trim()) setName(data.title);
      }
    } catch {
      // Silencioso — sin preview el editor igual puede escribir el tema a
      // mano y generar (el backend vuelve a intentar leer la URL él solo).
    } finally {
      setScrapingIndex(null);
    }
  }

  function addSourceUrl() {
    setSourceUrls((prev) => [...prev, ""]);
    setUrlSiteNames((prev) => [...prev, null]);
  }

  function removeSourceUrl(index: number) {
    setSourceUrls((prev) => prev.filter((_, i) => i !== index));
    setUrlSiteNames((prev) => prev.filter((_, i) => i !== index));
  }

  function pickPhrase(p: SavedPhrase) {
    setSelectedPhraseText(p.phrase);
    setName(p.phrase);
  }

  function pickRadarTopic(topic: RadarTopic) {
    setRadarTitle(topic.title);
    setName(topic.title);
  }

  async function searchZone() {
    const q = zoneQuery.trim();
    if (!q) return;
    setZoneSearching(true);
    setZoneError("");
    setZoneResult(null);
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/nearby-places`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setZoneError(body?.message ?? "No se pudo buscar esa zona.");
        return;
      }
      const data: NearbyPlacesResult = await res.json();
      if (data.categories.length === 0) {
        setZoneError(`No se encontraron lugares con suficientes reseñas cerca de ${data.zoneName}.`);
        return;
      }
      setZoneResult(data);
      if (!name.trim()) setName(`Lo más popular en ${data.zoneName}`);
    } catch {
      setZoneError("No se pudo conectar con el servidor.");
    } finally {
      setZoneSearching(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "frases" && !selectedPhrase) {
      setError("Elige una frase de la lista.");
      return;
    }
    if (mode === "radar" && !selectedRadarTopic) {
      setError("Elige un tema de la lista.");
      return;
    }
    if (mode === "zona" && !zoneResult) {
      setError("Busca una zona primero.");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/draft`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Sin contentType/categoryId a propósito: el backend los clasifica
        // (ver AiDraftService.draft/classifyContentType) — con site fijo,
        // solo entre los tipos de ese sitio; sin él, sitio+tipo juntos.
        body: JSON.stringify({ name, hints: effectiveHints || undefined, provider, site: fixedSite }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo generar el borrador.");
        setGenerating(false);
        return;
      }

      const data: DraftResponse = await res.json();
      const catRes = await fetch(`${apiConfig.clientBaseUrl}/cms/categories?site=${data.site}`, { credentials: "include" });
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
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/draft`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          hints: effectiveHints || undefined,
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
      const catRes = await fetch(`${apiConfig.clientBaseUrl}/cms/categories?site=${data.site}`, { credentials: "include" });
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
          {/* Con fixedSite este pill sería redundante — ya se ve en el
              ProjectPill de CrearSteps arriba de este componente. */}
          {!fixedSite && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[12px] font-semibold text-ink">
              {SITE_LABEL[site]}
            </span>
          )}
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
              crossSitePublish={fixedSite ? undefined : crossSitePublish}
            />
          ) : contentType === "place" ? (
            <GeneratePlaceFlow
              categories={resolved.categories}
              initialName={resolved.name}
              initialDraft={resolved.draftResponse}
              crossSitePublish={fixedSite ? undefined : crossSitePublish}
            />
          ) : (
            <GenerateEventFlow
              categories={resolved.categories}
              initialName={resolved.name}
              initialDraft={resolved.draftResponse}
              crossSitePublish={fixedSite ? undefined : crossSitePublish}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[680px] p-[26px] pb-[60px] text-center">
      <div className="mx-auto mb-4 grid size-[46px] place-items-center rounded-2xl border border-[#FFE2CC] bg-accent">
        <Icon d={SPARK_ICON} size={22} strokeWidth={1.6} className="text-brand" />
      </div>
      {initialName && (
        <span className="mx-auto mb-2.5 inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 font-mono text-[10px] font-medium tracking-[.04em] text-ink-faint uppercase">
          <Icon d={SPARK_ICON} size={10} strokeWidth={2} />
          Desde {SOURCE_LABEL[source] ?? SOURCE_LABEL["content-radar"]}
        </span>
      )}
      <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿Sobre qué escribimos?</h1>
      <p className="mx-auto mb-5 max-w-[50ch] text-[13.5px] leading-[1.6] text-ink-soft">{MODE_INTRO[mode]}</p>

      <div className="mx-auto mb-6 flex flex-wrap items-center justify-center gap-1 rounded-full border border-border bg-background p-0.5">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
              mode === m ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
            }`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      <form onSubmit={handleGenerate} className="flex flex-col gap-5 rounded-[16px] border border-border bg-card p-6 text-left shadow-[0_1px_2px_rgba(23,20,17,.03)] sm:p-7">
        {mode === "liga" && (
          <div className="flex flex-col gap-3">
            {sourceUrls.map((url, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={`pf-url-${i}`} className={labelClass}>
                    {i === 0 ? "Link de la nota original" : `Fuente adicional ${i + 1}`}
                  </label>
                  {i > 0 && (
                    <button type="button" onClick={() => removeSourceUrl(i)} className="text-ink-faint transition-colors hover:text-negative" title="Quitar esta fuente">
                      <Icon d={TRASH_ICON} size={13} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
                <input
                  id={`pf-url-${i}`}
                  type="url"
                  required={i === 0}
                  value={url}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSourceUrls((prev) => prev.map((u, ui) => (ui === i ? next : u)));
                    setUrlSiteNames((prev) => prev.map((n, ni) => (ni === i ? null : n)));
                  }}
                  onBlur={(e) => handleScrapeUrlAt(i, e.target.value)}
                  placeholder="https://www.milenio.com/..."
                  className={fieldClass}
                  disabled={generating}
                />
                <p className="text-[11.5px] text-ink-faint">
                  {scrapingIndex === i ? "Leyendo el artículo…" : urlSiteNames[i] ? `Fuente detectada: ${urlSiteNames[i]}.` : i === 0 ? "Al salir del campo intento sugerir el título abajo." : ""}
                </p>
              </div>
            ))}
            {sourceUrls.length < 4 && (
              <button
                type="button"
                onClick={addSourceUrl}
                className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
              >
                <Icon d={PLUS_ICON} size={12} strokeWidth={2} />
                Agregar otra fuente
              </button>
            )}
          </div>
        )}

        {mode === "frases" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pf-phrase-filter" className={labelClass}>
              Frase guardada
            </label>
            {selectedPhrase ? (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-brand bg-accent px-3 py-2.5">
                <div className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-accent-fg">{selectedPhrase.phrase}</span>
                  {selectedPhrase.categoryLabel && <span className="block text-[11px] text-ink-faint">{selectedPhrase.categoryLabel}</span>}
                </div>
                <button type="button" onClick={() => setSelectedPhraseText(null)} className="flex-none text-ink-faint transition-colors hover:text-ink" title="Elegir otra frase">
                  <Icon d={CLOSE_ICON} size={14} strokeWidth={1.8} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Icon d={SEARCH_ICON} size={13} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
                  <input
                    id="pf-phrase-filter"
                    value={phraseFilter}
                    onChange={(e) => setPhraseFilter(e.target.value)}
                    placeholder="Buscar por frase o categoría…"
                    className={`${fieldClass} pl-8`}
                    disabled={generating}
                  />
                </div>
                <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto rounded-lg border border-border-soft p-1.5">
                  {savedPhrases.length === 0 ? (
                    <p className="p-2 text-[12.5px] text-ink-faint">No hay frases guardadas todavía — agrégalas en Frases de búsqueda.</p>
                  ) : filteredPhrases.length === 0 ? (
                    <p className="p-2 text-[12.5px] text-ink-faint">Ninguna frase coincide con &quot;{phraseFilter}&quot;.</p>
                  ) : (
                    filteredPhrases.map((p) => (
                      <button
                        key={p.phrase}
                        type="button"
                        onClick={() => pickPhrase(p)}
                        className="flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-hover"
                      >
                        <span className="truncate text-[12.5px] font-medium text-ink">{p.phrase}</span>
                        {p.categoryLabel && <span className="text-[10.5px] text-ink-faint">{p.categoryLabel}</span>}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {mode === "radar" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pf-radar-filter" className={labelClass}>
              Tema de Content Radar
            </label>
            {selectedRadarTopic ? (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-brand bg-accent px-3 py-2.5">
                <div className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-accent-fg">{selectedRadarTopic.title}</span>
                  <span className="block text-[11px] text-ink-faint">{selectedRadarTopic.categoryLabel}</span>
                </div>
                <button type="button" onClick={() => setRadarTitle(null)} className="flex-none text-ink-faint transition-colors hover:text-ink" title="Elegir otro tema">
                  <Icon d={CLOSE_ICON} size={14} strokeWidth={1.8} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Icon d={SEARCH_ICON} size={13} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
                  <input
                    id="pf-radar-filter"
                    value={radarFilter}
                    onChange={(e) => setRadarFilter(e.target.value)}
                    placeholder="Buscar por título o categoría…"
                    className={`${fieldClass} pl-8`}
                    disabled={generating}
                  />
                </div>
                <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto rounded-lg border border-border-soft p-1.5">
                  {radarTopics.length === 0 ? (
                    <p className="p-2 text-[12.5px] text-ink-faint">No hay temas pendientes en el reporte más reciente.</p>
                  ) : filteredRadarTopics.length === 0 ? (
                    <p className="p-2 text-[12.5px] text-ink-faint">Ningún tema coincide con &quot;{radarFilter}&quot;.</p>
                  ) : (
                    filteredRadarTopics.map((t) => (
                      <button
                        key={t.title}
                        type="button"
                        onClick={() => pickRadarTopic(t)}
                        className="flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-hover"
                      >
                        <span className="truncate text-[12.5px] font-medium text-ink">{t.title}</span>
                        <span className="text-[10.5px] text-ink-faint">{t.categoryLabel}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {mode === "zona" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pf-zone" className={labelClass}>
              Zona
            </label>
            <div className="flex gap-2">
              <input
                id="pf-zone"
                value={zoneQuery}
                onChange={(e) => setZoneQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchZone();
                  }
                }}
                placeholder="ej. Coacalco, Estado de México"
                className={fieldClass}
                disabled={generating || zoneSearching}
              />
              <button
                type="button"
                onClick={searchZone}
                disabled={generating || zoneSearching || !zoneQuery.trim()}
                className="flex flex-none items-center gap-1.5 rounded-[10px] border border-border bg-background px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink-faint disabled:opacity-60"
              >
                <Icon d={zoneSearching ? SPARK_ICON : SEARCH_ICON} size={13} strokeWidth={2} className={zoneSearching ? "animate-spin" : ""} />
                Buscar
              </button>
            </div>
            {zoneError && <p className="text-[11.5px] font-medium text-[#C4453A]">{zoneError}</p>}
            {zoneResult && (
              <div className="flex flex-col gap-2 rounded-lg border border-brand bg-accent p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-fg">
                    <Icon d={PIN_ICON} size={13} strokeWidth={1.8} />
                    {zoneResult.zoneName}
                  </span>
                  <button type="button" onClick={() => setZoneResult(null)} className="flex-none text-ink-faint transition-colors hover:text-ink" title="Buscar otra zona">
                    <Icon d={CLOSE_ICON} size={14} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="flex max-h-[220px] flex-col gap-2.5 overflow-y-auto">
                  {zoneResult.categories.map((c) => (
                    <div key={c.type}>
                      <span className="mb-1 block text-[10.5px] font-semibold tracking-[.02em] text-ink-faint uppercase">{c.label}</span>
                      <div className="flex flex-col gap-0.5">
                        {c.places.map((p) => (
                          <span key={p.name} className="text-[12.5px] text-ink">
                            {p.name}
                            {p.rating && <span className="text-ink-faint"> · {p.rating}★ ({p.userRatingsTotal})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10.5px] text-ink-faint">Ordenado por rating y número de reseñas — un proxy de popularidad, no datos reales de búsquedas.</p>
              </div>
            )}
          </div>
        )}

        {mode === "texto" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pf-hints" className={labelClass}>
              Texto completo
            </label>
            <textarea
              id="pf-hints"
              required
              rows={9}
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder="Pega aquí el comunicado, las notas de la llamada, el boletín…"
              className={`${fieldClass} resize-none`}
              disabled={generating}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pf-name" className={labelClass}>
              {mode === "liga" ? "Título sugerido" : mode === "frases" || mode === "radar" || mode === "zona" ? "Título" : "Tema / título"}
            </label>
            <input id="pf-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Bloqueo total en Eje Central por transportistas" className={fieldClass} disabled={generating} />
          </div>
        )}

        {mode !== "texto" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pf-hints" className={labelClass}>
              {mode === "tema" ? "Lo que ya sabes (fuentes, contexto, etc.)" : "Contexto extra (opcional)"}
            </label>
            <textarea
              id="pf-hints"
              rows={mode === "tema" ? 4 : 2}
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder={mode === "tema" ? "ej. Fuente: MILENIO — 9 bloqueos en Reforma e Insurgentes hoy 25 de agosto…" : "ej. Enfócate en el impacto para vecinos de la zona…"}
              className={`${fieldClass} resize-none`}
              disabled={generating}
            />
            <p className="text-[11.5px] text-ink-faint">
              {fixedSite
                ? "La IA decide bajo qué tipo de contenido y qué categoría — los revisas y puedes cambiarlos después de generar."
                : "La IA decide en qué sitio (La Mira o Planazo), bajo qué tipo de contenido y qué categoría — todo lo revisas después de generar."}
            </p>
          </div>
        )}

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
                className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${provider === p.id ? "border-brand bg-accent" : "border-border bg-card hover:border-ink-faint"}`}
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
              {fixedSite ? "Decidiendo el tipo y escribiendo…" : "Decidiendo dónde va y escribiendo…"} {provider === "claude-cli" && "(puede tardar ~30s)"}
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
