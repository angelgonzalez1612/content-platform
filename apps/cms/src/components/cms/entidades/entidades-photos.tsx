"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiConfig } from "@planazo/config";
import type { ImageSearchResult } from "@planazo/types";

interface PhotosState {
  key: string;
  results: ImageSearchResult[] | null;
  error: string | null;
}

type SaveState = "saving" | "saved" | { error: string };

// Resultados por búsqueda para toda la sesión de la página: al ir y volver
// entre "Notas reales" y "Fotos" el panel se desmonta, y las fotos de notas
// tardan ~30 s en leerse — no se vuelven a pedir.
const sessionCache = new Map<string, ImageSearchResult[]>();

async function searchPhotos(endpoint: "news-images" | "search-images", query: string): Promise<{ results: ImageSearchResult[] | null; error: string | null }> {
  const cacheKey = `${endpoint}:${query.toLowerCase()}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return { results: cached, error: null };
  try {
    const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { results: null, error: "No se pudieron buscar fotos." };
    const results = (await res.json()) as ImageSearchResult[];
    if (results.length > 0) sessionCache.set(cacheKey, results);
    return { results, error: null };
  } catch {
    return { results: null, error: "No se pudo conectar con el servidor." };
  }
}

/**
 * "Fotos" de Entidades: igual que "Notas reales" busca fuera (Google News) por
 * lugar + tema, pero se queda con la foto principal de cada nota (con crédito
 * al medio), más fotos libres del lugar (Wikimedia/Openverse). Cada una se
 * puede subir a la biblioteca de Multimedia (se comprime y se sube al hosting).
 */
export function EntidadesPhotos({ place, term }: { place: string; term: string }) {
  const newsQuery = `${place} ${term}`.trim();
  const newsKey = newsQuery;
  const freeKey = place;

  const [news, setNews] = useState<PhotosState>({ key: "", results: null, error: null });
  const [free, setFree] = useState<PhotosState>({ key: "", results: null, error: null });
  const [saves, setSaves] = useState<Record<string, SaveState>>({});

  const newsLoading = news.key !== newsKey;
  const freeLoading = free.key !== freeKey;

  useEffect(() => {
    let cancelled = false;
    searchPhotos("news-images", newsKey).then(({ results, error }) => {
      if (!cancelled) setNews({ key: newsKey, results, error });
    });
    return () => {
      cancelled = true;
    };
  }, [newsKey]);

  useEffect(() => {
    let cancelled = false;
    searchPhotos("search-images", freeKey).then(({ results, error }) => {
      if (!cancelled) setFree({ key: freeKey, results, error });
    });
    return () => {
      cancelled = true;
    };
  }, [freeKey]);

  async function save(result: ImageSearchResult) {
    setSaves((s) => ({ ...s, [result.url]: "saving" }));
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/media/assets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.url,
          credit: result.credit,
          source: result.source,
          sourcePageUrl: result.sourcePageUrl,
          categoryId: null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setSaves((s) => ({ ...s, [result.url]: { error: body?.message ?? "No se pudo subir." } }));
        return;
      }
      setSaves((s) => ({ ...s, [result.url]: "saved" }));
    } catch {
      setSaves((s) => ({ ...s, [result.url]: { error: "Sin conexión con el servidor." } }));
    }
  }

  const savedCount = Object.values(saves).filter((v) => v === "saved").length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] leading-[1.5] text-ink-faint">
        Fotos reales de <span className="font-semibold text-ink-soft">{term || "todo"}</span> en {place}, buscadas fuera. Súbelas a tu biblioteca para usarlas en cualquier pieza.
      </p>

      {savedCount > 0 && (
        <Link
          href="/multimedia"
          className="flex items-center justify-between rounded-[10px] border border-positive/30 bg-positive/10 px-3 py-2 text-[12px] font-semibold text-positive transition-colors hover:border-positive/60"
        >
          <span>
            {savedCount} {savedCount === 1 ? "foto subida" : "fotos subidas"} a la biblioteca
          </span>
          <span aria-hidden>Ver →</span>
        </Link>
      )}

      <PhotoSection
        title="De notas de medios"
        hint="Se leen las notas del lugar; tarda unos 30 s. El crédito es del medio."
        loading={newsLoading}
        error={news.error}
        results={news.results}
        empty="Las notas de este lugar no traían foto utilizable."
        saves={saves}
        onSave={save}
      />
      <PhotoSection
        title="Libres del lugar"
        hint="Wikimedia y Openverse: uso comercial permitido."
        loading={freeLoading}
        error={free.error}
        results={free.results}
        empty={`Sin fotos libres de ${place}.`}
        saves={saves}
        onSave={save}
      />
    </div>
  );
}

function PhotoSection({
  title,
  hint,
  loading,
  error,
  results,
  empty,
  saves,
  onSave,
}: {
  title: string;
  hint: string;
  loading: boolean;
  error: string | null;
  results: ImageSearchResult[] | null;
  empty: string;
  saves: Record<string, SaveState>;
  onSave: (result: ImageSearchResult) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[12.5px] font-semibold text-ink">{title}</h3>
        {!loading && results && results.length > 0 && <span className="font-mono text-[10.5px] text-ink-faint">{results.length}</span>}
      </div>
      <p className="-mt-1 text-[10.5px] text-ink-faint">{hint}</p>

      {loading ? (
        <div className="grid grid-cols-2 gap-2" aria-busy="true" aria-label={`Buscando ${title.toLowerCase()}`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/3] rounded-[10px] bg-hover motion-safe:animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-lg bg-negative/10 px-3 py-2 text-[12px] font-medium text-negative">{error}</p>
      ) : !results || results.length === 0 ? (
        <p className="py-3 text-center text-[12px] text-ink-faint">{empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {results.map((r) => (
            <PhotoCard key={r.url} result={r} save={saves[r.url]} onSave={() => onSave(r)} />
          ))}
        </div>
      )}
    </section>
  );
}

function PhotoCard({ result, save, onSave }: { result: ImageSearchResult; save: SaveState | undefined; onSave: () => void }) {
  const [broken, setBroken] = useState(false);
  // Una foto que no carga (hotlink bloqueado, URL caída) tampoco se podría subir.
  if (broken) return null;

  const saved = save === "saved";
  const saving = save === "saving";
  const error = typeof save === "object" ? save.error : null;

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-[10px] border border-border-soft bg-card">
      <a href={result.sourcePageUrl} target="_blank" rel="noopener noreferrer" className="group relative block aspect-[4/3] overflow-hidden bg-hover" title={result.title ?? result.credit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.thumbUrl}
          alt={result.title ?? result.credit}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        <span className="absolute top-1 right-1 rounded bg-black/55 px-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">↗</span>
      </a>
      <div className="flex flex-col gap-1.5 p-1.5">
        <span className="line-clamp-1 text-[10.5px] leading-tight text-ink-faint" title={result.credit}>
          {result.credit}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || saved}
          className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors disabled:cursor-default ${
            saved ? "bg-positive/10 text-positive" : "border border-border text-ink hover:border-brand hover:text-brand disabled:opacity-70"
          }`}
        >
          {saved ? "En la biblioteca ✓" : saving ? "Subiendo…" : "Subir a biblioteca"}
        </button>
        {error && <span className="text-[10.5px] leading-tight text-negative">{error}</span>}
      </div>
    </div>
  );
}
