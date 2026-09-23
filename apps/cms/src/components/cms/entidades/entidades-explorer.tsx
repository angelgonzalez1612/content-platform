"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiConfig } from "@planazo/config";
import { Icon } from "@/components/icon";
import { MexicoMap } from "./mexico-map";
import { ZmvmMap } from "./zmvm-map";
import { MEXICO_STATE_SHAPES } from "@/data/mexico-states-map";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
const PIN_ICON = "M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z";
const ARROW_ICON = "M5 12h14M13 6l6 6-6 6";
const SEARCH_ICON = "M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z";

// Google Trends no tiene datos confiables a nivel municipio/alcaldía (se
// probó en vivo, ver zmvm-municipios-map.ts) — el drill-down de la Zona
// Metropolitana solo existe para estos dos estados, cuyas frases/valor
// siguen siendo los del estado completo.
const ZMVM_STATE_CODES = new Set(["cmx", "mex"]);

// Mismos 5 ids/keywords que apps/api/src/modules/entidades/entidades-categories.ts
// — sin paquete compartido entre api/cms para una lista tan chica, igual que
// MODE_LABEL en publish-flow.tsx duplica sus propias categorías fijas.
const CATEGORIES = [
  { id: "noticias", label: "Noticias" },
  { id: "que-hacer", label: "Qué hacer" },
  { id: "eventos", label: "Eventos" },
  { id: "clima", label: "Clima" },
  { id: "trafico", label: "Tráfico" },
];

interface RelatedQuery {
  query: string;
  value: number;
  breakout: boolean;
}

interface StatePhrases {
  top: RelatedQuery[];
  rising: RelatedQuery[];
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function fetchJson<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(`${apiConfig.clientBaseUrl}${path}`, { credentials: "include" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { data: null, error: body?.message ?? "No se pudo cargar la información." };
    }
    return { data: (await res.json()) as T, error: null };
  } catch {
    return { data: null, error: "No se pudo conectar con el servidor." };
  }
}

interface InterestState {
  key: string;
  interest: Record<string, number> | null;
  error: string | null;
}

interface PhrasesState {
  key: string;
  phrases: StatePhrases | null;
  error: string | null;
}

interface LocalSearchState {
  key: string;
  results: WebSearchResult[] | null;
  error: string | null;
}

export function EntidadesExplorer() {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [retryToken, setRetryToken] = useState(0);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [municipio, setMunicipio] = useState<{ code: string; name: string } | null>(null);
  const [showZmvm, setShowZmvm] = useState(false);

  // `key` guarda para qué categoría (o estado+categoría) es el resultado
  // guardado — mientras no coincida con el pedido actual, se considera
  // "cargando". Evita llamar setState de forma síncrona en el cuerpo del
  // efecto (ver regla react-hooks/set-state-in-effect): el estado solo se
  // actualiza dentro del callback async, nunca antes de pedir el fetch.
  const interestKey = `${categoryId}:${retryToken}`;
  const [interestState, setInterestState] = useState<InterestState>({ key: "", interest: null, error: null });
  const interestLoading = interestState.key !== interestKey;
  const interest = interestState.key === interestKey ? interestState.interest : null;
  const interestError = interestState.key === interestKey ? interestState.error : null;

  const phrasesKey = selected ? `${selected.code}:${categoryId}` : "";
  const [phrasesState, setPhrasesState] = useState<PhrasesState>({ key: "", phrases: null, error: null });
  const phrasesLoading = !!selected && phrasesState.key !== phrasesKey;
  const phrases = phrasesState.key === phrasesKey ? phrasesState.phrases : null;
  const phrasesError = phrasesState.key === phrasesKey ? phrasesState.error : null;

  // "Búsquedas locales" — a diferencia de Trends (que no distingue fino), un
  // buscador real sí puede acotar por nombre de lugar (ver LocalSearchService),
  // así que aplica tanto a nivel estado como municipio/alcaldía: se usa el
  // municipio si hay uno seleccionado, si no el estado completo.
  const localPlace = municipio ?? selected;
  const localSearchKey = localPlace ? `${localPlace.code}:${categoryId}` : "";
  const [localSearchState, setLocalSearchState] = useState<LocalSearchState>({ key: "", results: null, error: null });
  const localSearchLoading = !!localPlace && localSearchState.key !== localSearchKey;
  const localSearchResults = localSearchState.key === localSearchKey ? localSearchState.results : null;
  const localSearchError = localSearchState.key === localSearchKey ? localSearchState.error : null;

  // Notas reales de una FRASE de Trends — cuando el editor hace clic en una
  // frase ("noticias hoy"), en vez de mandarla al generador como "tema" (que
  // producía un meta-artículo sobre la tendencia), se busca esa frase en un
  // buscador real acotada al lugar (ver /local-search?q=…) y se muestran notas
  // reales para elegir cuál convertir en artículo.
  const [activePhrase, setActivePhrase] = useState<string | null>(null);
  // El panel derecho tiene dos caras: las notas reales (lo que genera contenido
  // = protagonista, tab por default) y las tendencias de Trends (descubrimiento).
  // Separarlas en un segmented control evita el scroll largo de apilar ambas.
  const [panelTab, setPanelTab] = useState<"notas" | "tendencias">("notas");
  const phraseNotesKey = activePhrase && localPlace ? `${localPlace.code}:${activePhrase}` : "";
  const [phraseNotesState, setPhraseNotesState] = useState<LocalSearchState>({ key: "", results: null, error: null });
  const phraseNotesLoading = !!phraseNotesKey && phraseNotesState.key !== phraseNotesKey;
  const phraseNotesResults = phraseNotesState.key === phraseNotesKey ? phraseNotesState.results : null;
  const phraseNotesError = phraseNotesState.key === phraseNotesKey ? phraseNotesState.error : null;

  const categoryLabel = CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;

  // Notas UNIFICADAS: antes había dos listas separadas (notas de una frase y
  // "búsquedas locales" de la categoría) que eran lo mismo y duplicaban scroll.
  // Ahora es una sola lista cuya fuente es la frase activa si hay una, si no la
  // categoría del lugar.
  const notesLoading = activePhrase ? phraseNotesLoading : localSearchLoading;
  const notesResults = activePhrase ? phraseNotesResults : localSearchResults;
  const notesError = activePhrase ? phraseNotesError : localSearchError;

  // Recomendación de lugares: los estados con más interés de búsqueda (Google
  // Trends) para la categoría actual — atajo para saber dónde hay tema sin
  // escanear el choropleth a ojo. Se recalcula al cambiar de categoría.
  const topStates = interest
    ? MEXICO_STATE_SHAPES.map((s) => ({ code: s.code, name: s.name, value: interest[s.code] ?? 0 }))
        .filter((s) => s.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    : [];

  useEffect(() => {
    let cancelled = false;
    const key = interestKey;
    fetchJson<{ code: string; name: string; value: number }[]>(`/cms/entidades/interest?category=${categoryId}`).then(({ data, error }) => {
      if (cancelled) return;
      setInterestState({
        key,
        interest: error ? null : Object.fromEntries((data ?? []).map((s) => [s.code, s.value])),
        error,
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- interestKey ya deriva de [categoryId, retryToken]
  }, [interestKey]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const key = phrasesKey;
    fetchJson<StatePhrases>(`/cms/entidades/phrases?category=${categoryId}&state=${selected.code}`).then(({ data, error }) => {
      if (cancelled) return;
      setPhrasesState({ key, phrases: error ? null : data, error });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phrasesKey ya deriva de [selected, categoryId]
  }, [phrasesKey]);

  useEffect(() => {
    if (!localPlace) return;
    let cancelled = false;
    const key = localSearchKey;
    fetchJson<WebSearchResult[]>(`/cms/entidades/local-search?category=${categoryId}&place=${encodeURIComponent(localPlace.name)}`).then(({ data, error }) => {
      if (cancelled) return;
      setLocalSearchState({ key, results: error ? null : data, error });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- localSearchKey ya deriva de [localPlace, categoryId]
  }, [localSearchKey]);

  useEffect(() => {
    if (!activePhrase || !localPlace) return;
    let cancelled = false;
    const key = phraseNotesKey;
    fetchJson<WebSearchResult[]>(`/cms/entidades/local-search?q=${encodeURIComponent(activePhrase)}&place=${encodeURIComponent(localPlace.name)}`).then(({ data, error }) => {
      if (cancelled) return;
      setPhraseNotesState({ key, results: error ? null : data, error });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phraseNotesKey ya deriva de [activePhrase, localPlace]
  }, [phraseNotesKey]);

  function selectState(code: string, name: string) {
    setSelected({ code, name });
    setMunicipio(null);
  }

  function selectMunicipio(code: string, name: string, parentState: "cmx" | "mex") {
    const parentName = parentState === "cmx" ? "Ciudad de México" : "Estado de México";
    setSelected({ code: parentState, name: parentName });
    setMunicipio({ code, name });
  }

  const locationLabel = municipio ? `${municipio.name}, ${selected?.name}` : (selected?.name ?? "");

  // Tocar una frase de tendencias fija esa frase como fuente de las notas y
  // salta al tab de notas — el usuario ve las notas reales de inmediato.
  function pickPhrase(query: string) {
    setActivePhrase(query);
    setPanelTab("notas");
  }

  // Una nota REAL encontrada (búsqueda local o por frase) se manda al generador
  // como cita "— FUENTE (url)", el mismo formato que el modo "Por liga" de
  // Centro IA, para que el backend scrapee el artículo de verdad (ver
  // AiDraftService.scrapeSourceFromHints)
  // en vez de que la IA escriba solo a partir de un título.
  function centroIaLocalHref(result: WebSearchResult) {
    // El medio real ("El Sol de México", "MILENIO"...) viene en el snippet
    // como "MEDIO · fecha" (ver WebSearchService, feed de Google News). Se
    // prefiere sobre el hostname de la URL porque las ligas de Google News son
    // de redirección (news.google.com) y no identifican al medio real — así el
    // crédito de la nota sale correcto (ver sourceLabelFromHints en el backend).
    const outletFromSnippet = result.snippet.split("·")[0]?.trim();
    const siteName =
      outletFromSnippet ||
      (() => {
        try {
          return new URL(result.url).hostname.replace(/^www\./, "");
        } catch {
          return "fuente externa";
        }
      })();
    const hints = `— ${siteName} (${result.url})`;
    const params = new URLSearchParams({ name: result.title, hints, source: "entidades" });
    if (municipio) params.set("alcaldiaSlug", municipio.code);
    return `/centro-ia?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5 p-[26px] pb-[60px] lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div>
          <h1 className="mb-1 text-[20px] font-semibold tracking-tight">Entidades</h1>
          <p className="max-w-[62ch] text-[13px] leading-[1.55] text-ink-soft">
            Interés real de búsqueda por estado (Google Trends) — un vistazo geográfico a qué busca la gente, para encontrar temas antes de escribir.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-full border border-border bg-background p-0.5" style={{ width: "fit-content" }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                categoryId === c.id ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {!interestError && !showZmvm && topStates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-ink-faint">Con más actividad:</span>
            {topStates.map((s) => {
              const isActive = selected?.code === s.code;
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => selectState(s.code, s.name)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                    isActive ? "border-brand bg-brand/10 text-brand" : "border-border text-ink-soft hover:border-brand/50 hover:text-ink"
                  }`}
                  title={`Interés ${s.value}/100 — ver ${s.name}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-[16px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          {interestError ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-[13px] font-medium text-ink-soft">Datos de tendencia no disponibles ahora mismo.</p>
              <p className="max-w-[40ch] text-[12px] text-ink-faint">{interestError}</p>
              <button
                type="button"
                onClick={() => setRetryToken((n) => n + 1)}
                className="mt-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-faint"
              >
                Reintentar
              </button>
            </div>
          ) : showZmvm ? (
            <>
              <button
                type="button"
                onClick={() => setShowZmvm(false)}
                className="mb-2 flex items-center gap-1 text-[12px] font-semibold text-ink-soft transition-colors hover:text-ink"
              >
                <Icon d={ARROW_ICON} size={12} strokeWidth={2} className="rotate-180" />
                Volver al mapa nacional
              </button>
              <ZmvmMap selected={municipio?.code ?? null} onSelect={selectMunicipio} />
            </>
          ) : (
            <MexicoMap interest={interestLoading ? null : interest} selected={selected?.code ?? null} onSelect={selectState} />
          )}
        </div>

        {!interestError && (
          <div className="flex items-center gap-2 text-[11.5px] text-ink-faint">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-border-soft)" }} />
            Menos interés
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-brand)" }} />
            Más interés
          </div>
        )}
      </div>

      <div className="flex w-full flex-none flex-col gap-3 rounded-[16px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(23,20,17,.03)] lg:w-[340px]">
        {!selected ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Icon d={PIN_ICON} size={22} strokeWidth={1.4} className="text-ink-faint" />
            <p className="text-[13px] text-ink-faint">Elige un estado en el mapa para ver qué busca la gente ahí.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Icon d={PIN_ICON} size={16} strokeWidth={1.6} className="text-brand" />
              <h2 className="text-[15px] font-semibold tracking-tight">{locationLabel}</h2>
            </div>

            {ZMVM_STATE_CODES.has(selected.code) && (
              <button
                type="button"
                onClick={() => setShowZmvm(true)}
                className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                <Icon d={PIN_ICON} size={12} strokeWidth={1.8} />
                {municipio ? `Cambiar alcaldía/municipio (${municipio.name})` : "Ver alcaldías / municipios"}
              </button>
            )}

            {/* Segmented control: notas reales (protagonista) vs tendencias (descubrimiento) */}
            <div className="flex gap-1 rounded-full border border-border bg-background p-0.5">
              {([["notas", "Notas reales"], ["tendencias", "Tendencias"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPanelTab(id)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    panelTab === id ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {panelTab === "notas" ? (
              <div className="flex flex-col gap-2">
                {/* Fuente de las notas: categoría por default, o la frase activa (removible) */}
                {activePhrase ? (
                  <button
                    type="button"
                    onClick={() => setActivePhrase(null)}
                    className="flex w-fit max-w-full items-center gap-1.5 rounded-full border border-brand/40 bg-brand/5 px-2.5 py-1 text-[11.5px] font-medium text-brand transition-colors hover:bg-brand/10"
                    title="Quitar la frase y volver a las notas de la categoría"
                  >
                    <Icon d={SEARCH_ICON} size={11} strokeWidth={2} />
                    <span className="min-w-0 flex-1 truncate">{activePhrase}</span>
                    <span className="flex-none text-[13px] leading-none">×</span>
                  </button>
                ) : (
                  <p className="text-[11px] text-ink-faint">
                    Notas reales de <span className="font-semibold text-ink-soft">{categoryLabel.toLowerCase()}</span> en {localPlace?.name}.
                  </p>
                )}

                {notesLoading && <PanelSkeleton />}
                {notesError && <PanelError message={notesError} />}
                {notesResults && !notesLoading && !notesError && (
                  <>
                    {notesResults.length > 0 && (
                      <Link
                        href={centroIaLocalHref(notesResults[0])}
                        className="flex w-fit items-center gap-1 rounded-md border border-brand/40 bg-brand/5 px-2 py-1 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/10"
                        title="Generar directo desde la nota más relevante"
                      >
                        <Icon d={SPARK_ICON} size={10} strokeWidth={2} />
                        Generar de la 1ª nota
                      </Link>
                    )}
                    <LocalSearchResults results={notesResults} centroIaLocalHref={centroIaLocalHref} />
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-ink-faint">
                  Qué busca la gente en {selected.name} (Google Trends){municipio ? ", a nivel estado" : ""}. Toca una frase para ver sus notas reales.
                </p>
                {phrasesLoading && <PanelSkeleton />}
                {phrasesError && <PanelError message={phrasesError} />}
                {phrases && !phrasesLoading && !phrasesError && (
                  <PhraseLists phrases={phrases} activePhrase={activePhrase} onPhrasePick={pickPhrase} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Skeleton en vez de spinner/texto (patrón del register product) — tres filas
// que insinúan el shape de las notas mientras cargan.
function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-2.5 w-24 rounded bg-hover motion-safe:animate-pulse" />
          <div className="h-3 w-full rounded bg-hover motion-safe:animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-hover motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function PanelError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-4 text-center">
      <p className="text-[12.5px] font-medium text-ink-soft">No disponible ahora mismo.</p>
      <p className="text-[11.5px] text-ink-faint">{message}</p>
    </div>
  );
}

function LocalSearchResults({ results, centroIaLocalHref }: { results: WebSearchResult[]; centroIaLocalHref: (result: WebSearchResult) => string }) {
  if (results.length === 0) {
    return <p className="py-4 text-center text-[12.5px] text-ink-faint">Sin notas reales para esta combinación todavía.</p>;
  }

  return (
    <div className="flex flex-col">
      {results.map((r) => {
        // El snippet viene como "MEDIO · fecha" (ver WebSearchService); se separa
        // para dar al medio jerarquía de badge y a la fecha un tono secundario.
        const [source, ...rest] = r.snippet.split(" · ");
        const date = rest.join(" · ");
        return (
          <div key={r.url} className="group flex flex-col gap-1.5 border-b border-border-soft py-2.5 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                {source && <span className="max-w-[150px] truncate rounded bg-hover px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">{source}</span>}
                {date && <span className="flex-none text-[10px] text-ink-faint">{date}</span>}
              </div>
              <Link
                href={centroIaLocalHref(r)}
                className="flex flex-none items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
                title="Generar contenido a partir de esta nota real en Centro IA"
              >
                <Icon d={SPARK_ICON} size={10} strokeWidth={2} />
                Generar
              </Link>
            </div>
            <a href={r.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-[12.5px] font-medium leading-snug text-ink transition-colors hover:text-brand hover:underline">
              {r.title}
            </a>
          </div>
        );
      })}
    </div>
  );
}

function PhraseLists({ phrases, activePhrase, onPhrasePick }: { phrases: StatePhrases; activePhrase: string | null; onPhrasePick: (query: string) => void }) {
  if (phrases.top.length === 0 && phrases.rising.length === 0) {
    return <p className="py-6 text-center text-[12.5px] text-ink-faint">Sin frases suficientes para esta combinación todavía.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {phrases.top.length > 0 && (
        <PhraseGroup title="Más buscadas" items={phrases.top} activePhrase={activePhrase} onPhrasePick={onPhrasePick} />
      )}
      {phrases.rising.length > 0 && (
        <PhraseGroup title="En crecimiento" items={phrases.rising} activePhrase={activePhrase} onPhrasePick={onPhrasePick} />
      )}
    </div>
  );
}

function PhraseGroup({ title, items, activePhrase, onPhrasePick }: { title: string; items: RelatedQuery[]; activePhrase: string | null; onPhrasePick: (query: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-semibold tracking-[.02em] text-ink-faint uppercase">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 8).map((item) => {
          const isActive = activePhrase === item.query;
          return (
            <button
              key={item.query}
              type="button"
              onClick={() => onPhrasePick(item.query)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                isActive ? "border-brand bg-brand/10 text-brand" : "border-border text-ink-soft hover:border-brand/50 hover:text-ink"
              }`}
              title="Ver notas reales de esta frase"
            >
              {item.query}
              {item.breakout && <span className="text-[9px] font-bold text-brand" title="Breakout">↑</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
