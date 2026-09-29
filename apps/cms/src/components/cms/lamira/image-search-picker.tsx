"use client";

import { useEffect, useRef, useState } from "react";
import { apiConfig } from "@planazo/config";
import type { ImageSearchResult } from "@planazo/types";
import { fieldClass } from "@/components/cms/dynamic-field";

type Picked = { url: string; credit: string };
type Tab = "search" | "news" | "article" | "link" | "upload";

const SOURCE_LABEL: Record<ImageSearchResult["source"], string> = {
  wikimedia: "Wikimedia",
  openverse: "Openverse",
  pexels: "Pexels",
  news: "Nota",
};

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${apiConfig.clientBaseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Segundos desde `startedAt` (null = detenido) — para búsquedas lentas (notas, IA). */
function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
}

function Spark({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={SPARK_ICON} />
    </svg>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-negative/10 px-3 py-2 text-[12px] font-medium text-negative">{children}</p>;
}

function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="aspect-square animate-[pz-pulse_1.6s_ease-in-out_infinite] rounded-[8px] bg-hover" />
      ))}
    </div>
  );
}

/** Cuadrícula de resultados: miniatura, fuente y crédito; clic = elegir. */
function ResultGrid({ results, onSelect, showTitles = false }: { results: ImageSearchResult[]; onSelect: (image: Picked) => void; showTitles?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {results.map((r) => (
        <button
          key={r.url}
          type="button"
          onClick={() => onSelect({ url: r.url, credit: r.credit })}
          title={r.title ? `${r.title}\n${r.credit}` : r.credit}
          className="group flex flex-col overflow-hidden rounded-[8px] border border-border-soft bg-card text-left transition-[border-color,box-shadow] duration-150 hover:border-brand hover:shadow-[0_6px_16px_-10px_rgba(23,20,17,.35)] focus-visible:border-brand focus-visible:outline-none"
        >
          <span className="relative block">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
            <img src={r.thumbUrl} alt="" loading="lazy" className="aspect-square w-full bg-hover object-cover" />
            <span className="absolute top-1 left-1 rounded bg-ink-solid/70 px-1.5 py-px text-[9.5px] font-semibold text-white">{SOURCE_LABEL[r.source]}</span>
            <span className="absolute inset-0 flex items-center justify-center bg-brand/0 text-[11.5px] font-semibold text-white opacity-0 transition-[opacity,background-color] duration-150 group-hover:bg-brand/35 group-hover:opacity-100">
              Usar
            </span>
          </span>
          <span className="flex flex-col gap-0.5 px-1.5 py-1.5">
            {showTitles && r.title && <span className="line-clamp-2 text-[10.5px] leading-[1.3] font-medium text-ink">{r.title}</span>}
            <span className="truncate text-[10px] text-ink-faint group-hover:text-brand">{r.credit}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Vista previa de una imagen suelta (enlace o subida) con crédito editable antes de usarla. */
function ConfirmImage({ image, onSelect, creditHint }: { image: Picked; onSelect: (image: Picked) => void; creditHint: string }) {
  const [credit, setCredit] = useState(image.credit);
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-border-soft bg-card p-2.5 sm:flex-row sm:items-start">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
      <img src={image.url} alt="" className="aspect-video w-full rounded-[6px] bg-hover object-cover sm:w-44" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label className="text-[11px] font-medium text-ink-faint">
          Crédito
          <input value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="ej. Foto: MILENIO" className={`${fieldClass} mt-1`} />
        </label>
        <p className="text-[11px] text-ink-faint">{creditHint}</p>
        <button
          type="button"
          onClick={() => onSelect({ url: image.url, credit: credit.trim() })}
          className="self-start rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-pressed"
        >
          Usar esta imagen
        </button>
      </div>
    </div>
  );
}

// Buscador/selector de imágenes — reusado para la imagen principal, las
// imágenes de bloques, la galería y las paradas de guías. Nunca genera
// imágenes: todas salen de fuentes reales, con crédito real.
// - Buscar: bancos libres (Wikimedia Commons, Openverse; Pexels si hay key),
//   con sugerencias de búsqueda hechas por la IA.
// - Fotos de notas: la foto principal de notas reales del tema (Google News),
//   crédito al medio.
// - Del artículo: imágenes del artículo fuente (si se generó desde uno).
// - Desde un enlace: link de una nota (se toma su foto principal) o de una
//   imagen directa; crédito editable.
// - Subir: archivo propio; crédito editable.
export function ImageSearchPicker({
  initialQuery,
  articleImages,
  onSelect,
}: {
  initialQuery?: string;
  articleImages?: Picked[];
  onSelect: (image: Picked) => void;
}) {
  const [tab, setTab] = useState<Tab>("search");
  const hasArticleImages = !!articleImages && articleImages.length > 0;

  // Buscar
  const [query, setQuery] = useState(initialQuery ?? "");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<ImageSearchResult[] | null>(null);
  const [sourceFilter, setSourceFilter] = useState<ImageSearchResult["source"] | "all">("all");
  const [pexelsActive, setPexelsActive] = useState<boolean | null>(null);
  const [suggestStartedAt, setSuggestStartedAt] = useState<number | null>(null);
  const suggesting = suggestStartedAt !== null;
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [suggestError, setSuggestError] = useState("");
  const suggestElapsed = useElapsed(suggestStartedAt);

  // Fotos de notas
  const [newsQuery, setNewsQuery] = useState(initialQuery ?? "");
  const [newsStartedAt, setNewsStartedAt] = useState<number | null>(null);
  const newsLoading = newsStartedAt !== null;
  const [newsError, setNewsError] = useState("");
  const [newsResults, setNewsResults] = useState<ImageSearchResult[] | null>(null);
  const newsElapsed = useElapsed(newsStartedAt);

  // Desde un enlace
  const [link, setLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkResult, setLinkResult] = useState<Picked | null>(null);

  // Subir
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploaded, setUploaded] = useState<Picked | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiConfig.clientBaseUrl}/cms/ai/image-sources`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { pexels?: boolean } | null) => {
        if (!cancelled) setPexelsActive(!!data?.pexels);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function runSearch(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setSearching(true);
    setSearchError("");
    setSourceFilter("all");
    const data = await postJson<ImageSearchResult[]>("/cms/ai/search-images", { query: text });
    if (data) setResults(data);
    else {
      setSearchError("No se pudo buscar imágenes.");
      setResults([]);
    }
    setSearching(false);
  }

  async function suggestQueries() {
    const title = (initialQuery || query).trim();
    if (!title) return;
    setSuggestStartedAt(Date.now());
    setSuggestError("");
    const data = await postJson<{ queries: string[] }>("/cms/ai/image-queries", { title });
    if (data?.queries.length) setSuggestions(data.queries);
    else setSuggestError("La IA no pudo sugerir búsquedas. Revisa el proveedor en Configuración.");
    setSuggestStartedAt(null);
  }

  async function runNewsSearch() {
    const text = newsQuery.trim();
    if (!text) return;
    setNewsStartedAt(Date.now());
    setNewsError("");
    setNewsResults(null);
    const data = await postJson<ImageSearchResult[]>("/cms/ai/news-images", { query: text });
    if (data) setNewsResults(data);
    else setNewsError("No se pudieron buscar fotos en notas.");
    setNewsStartedAt(null);
  }

  async function fetchFromLink() {
    const url = link.trim();
    if (!url) return;
    setLinkLoading(true);
    setLinkError("");
    setLinkResult(null);
    const data = await postJson<Picked | null>("/cms/ai/fetch-image", { url });
    if (data) setLinkResult(data);
    else setLinkError("No encontramos una imagen en ese enlace (puede tener paywall o bloquear lectores automáticos).");
    setLinkLoading(false);
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setUploaded(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/upload-image`, { method: "POST", credentials: "include", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setUploadError(body?.message ?? "No se pudo subir el archivo.");
        return;
      }
      const data: { url: string } = await res.json();
      setUploaded({ url: data.url, credit: "" });
    } catch {
      setUploadError("No se pudo conectar con el servidor.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const tabs: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: "search", label: "Buscar" },
    { id: "news", label: "Fotos de notas" },
    { id: "article", label: `Del artículo (${articleImages?.length ?? 0})`, hidden: !hasArticleImages },
    { id: "link", label: "Desde un enlace" },
    { id: "upload", label: "Subir" },
  ];

  const sourceCounts = (results ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.source]: (acc[r.source] ?? 0) + 1 }), {});
  const visibleResults = (results ?? []).filter((r) => sourceFilter === "all" || r.source === sourceFilter);

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="De dónde sacar la imagen" className="flex flex-wrap gap-0.5 rounded-[10px] border border-border bg-card p-0.5">
        {tabs
          .filter((t) => !t.hidden)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                tab === t.id ? "bg-accent text-accent-fg" : "text-ink-faint hover:bg-hover hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "search" && (
        <div className="flex flex-col gap-2.5">
          {/* div, no <form> — este picker vive dentro de un <form> real (el
              formulario de edición); un <form> anidado es HTML inválido y el
              botón "Buscar" disparaba el submit del formulario de afuera. */}
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch(query);
                }
              }}
              placeholder="ej. tráfico Ciudad de México"
              aria-label="Buscar imágenes"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => runSearch(query)}
              disabled={searching || !query.trim()}
              className="flex-none rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
            >
              {searching ? "Buscando…" : "Buscar"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {suggestions ? (
              <>
                <span className="flex items-center gap-1 text-[11.5px] font-medium text-accent-fg">
                  <Spark /> Sugerencias:
                </span>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => runSearch(s)}
                    disabled={searching}
                    className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-colors disabled:opacity-60 ${
                      query === s ? "border-brand bg-accent text-accent-fg" : "border-border bg-card text-ink-soft hover:border-brand hover:text-brand"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </>
            ) : (
              <button
                type="button"
                onClick={suggestQueries}
                disabled={suggesting || !(initialQuery || query).trim()}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-accent/60 px-2.5 py-1 text-[11.5px] font-semibold text-accent-fg transition-colors hover:border-brand disabled:cursor-default disabled:opacity-70"
              >
                <Spark className={suggesting ? "animate-spin" : ""} />
                {suggesting ? `La IA está pensando qué buscar… ${suggestElapsed}s` : "Sugerir búsquedas con IA"}
              </button>
            )}
          </div>
          {suggestError && <ErrorNote>{suggestError}</ErrorNote>}

          <p className="text-[11px] text-ink-faint">
            Bancos de uso libre, con autor y licencia reales: Wikimedia Commons · Openverse
            {pexelsActive ? " · Pexels" : pexelsActive === false ? " · (Pexels inactivo: falta PEXELS_API_KEY en la API)" : ""}
          </p>

          {searchError && <ErrorNote>{searchError}</ErrorNote>}
          {searching && <SkeletonGrid />}

          {!searching && results && results.length === 0 && !searchError && (
            <p className="text-[12px] text-ink-faint">
              Sin resultados para &quot;{query}&quot;. Prueba en inglés, con palabras más generales, o pide sugerencias a la IA.
            </p>
          )}

          {!searching && results && results.length > 0 && (
            <>
              {Object.keys(sourceCounts).length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {(["all", ...Object.keys(sourceCounts)] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSourceFilter(s as typeof sourceFilter)}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                        sourceFilter === s ? "bg-ink-solid text-white" : "text-ink-faint hover:text-ink"
                      }`}
                    >
                      {s === "all" ? `Todas ${results.length}` : `${SOURCE_LABEL[s as ImageSearchResult["source"]]} ${sourceCounts[s]}`}
                    </button>
                  ))}
                </div>
              )}
              <ResultGrid results={visibleResults} onSelect={onSelect} />
            </>
          )}
        </div>
      )}

      {tab === "news" && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11.5px] leading-[1.45] text-ink-soft">
            Busca notas reales sobre el tema (Google News) y trae la foto principal de cada una, con el crédito del medio. Solo la foto, nunca el texto.
          </p>
          <div className="flex gap-2">
            <input
              value={newsQuery}
              onChange={(e) => setNewsQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runNewsSearch();
                }
              }}
              placeholder="ej. Metro CDMX Línea 3"
              aria-label="Tema de las notas"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="button"
              onClick={runNewsSearch}
              disabled={newsLoading || !newsQuery.trim()}
              className="flex-none rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
            >
              {newsLoading ? "Buscando…" : "Buscar fotos"}
            </button>
          </div>

          {newsLoading && (
            <div role="status" aria-live="polite" className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[12px] text-ink-soft">
                <span>Leyendo notas del tema… suele tardar unos 30 segundos.</span>
                <span className="font-mono tabular-nums">{newsElapsed}s</span>
              </div>
              <div className="relative h-1 overflow-hidden rounded-full bg-brand/15" aria-hidden>
                <span className="absolute inset-y-0 w-1/3 animate-[pz-progress_1.4s_cubic-bezier(.65,0,.35,1)_infinite] rounded-full bg-brand motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
              </div>
              <SkeletonGrid count={4} />
            </div>
          )}
          {newsError && <ErrorNote>{newsError}</ErrorNote>}
          {!newsLoading && newsResults && newsResults.length === 0 && !newsError && (
            <p className="text-[12px] text-ink-faint">No encontramos fotos en notas sobre &quot;{newsQuery}&quot;. Prueba con menos palabras.</p>
          )}
          {!newsLoading && newsResults && newsResults.length > 0 && <ResultGrid results={newsResults} onSelect={onSelect} showTitles />}
        </div>
      )}

      {tab === "article" && hasArticleImages && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11.5px] text-ink-soft">Imágenes del artículo fuente, con el mismo crédito que su imagen principal.</p>
          <ResultGrid
            results={articleImages!.map((img) => ({ url: img.url, thumbUrl: img.url, credit: img.credit, sourcePageUrl: img.url, source: "news" as const }))}
            onSelect={onSelect}
          />
        </div>
      )}

      {tab === "link" && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11.5px] leading-[1.45] text-ink-soft">
            Pega el link de una nota (tomamos su foto principal, nunca el texto) o el link directo de una imagen.
          </p>
          <div className="flex gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  fetchFromLink();
                }
              }}
              placeholder="https://…"
              aria-label="Enlace de la nota o de la imagen"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="button"
              onClick={fetchFromLink}
              disabled={linkLoading || !link.trim()}
              className="flex-none rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
            >
              {linkLoading ? "Leyendo…" : "Obtener"}
            </button>
          </div>
          {linkError && <ErrorNote>{linkError}</ErrorNote>}
          {linkResult && (
            <ConfirmImage
              key={linkResult.url}
              image={linkResult}
              onSelect={onSelect}
              creditHint="Revisa el crédito: si es una nota, va el nombre del medio; si es una foto directa, su autor o sitio."
            />
          )}
        </div>
      )}

      {tab === "upload" && (
        <div className="flex flex-col gap-2.5">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              uploadFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver ? "border-brand bg-accent/60" : "border-border bg-card hover:border-ink-faint"
            } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-ink-faint" aria-hidden>
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            <span className="text-[12.5px] font-semibold text-ink">{uploading ? "Subiendo…" : "Arrastra una imagen o haz clic para elegirla"}</span>
            <span className="text-[11px] text-ink-faint">JPEG, PNG, WEBP o GIF · hasta 8 MB</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => uploadFile(e.target.files?.[0])}
              disabled={uploading}
              className="sr-only"
            />
          </label>
          {uploadError && <ErrorNote>{uploadError}</ErrorNote>}
          {uploaded && (
            <ConfirmImage key={uploaded.url} image={uploaded} onSelect={onSelect} creditHint="Si la foto es tuya o de tu equipo, pon quién la tomó (ej. Foto: La Mira)." />
          )}
        </div>
      )}
    </div>
  );
}
