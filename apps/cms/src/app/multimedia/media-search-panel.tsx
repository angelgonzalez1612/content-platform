"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import type { Category, ImageSearchResult } from "@planazo/types";
import type { MediaAsset } from "@/lib/media-api";

const SOURCE_LABEL: Record<ImageSearchResult["source"], string> = {
  wikimedia: "Wikimedia",
  openverse: "Openverse",
};

/** Buscador de imágenes libres (Wikimedia/Openverse, ya usado en los
 * formularios de contenido) más "guardar en la biblioteca" — el resultado
 * elegido se comprime y sube al hosting FTP del cliente (ver
 * FtpStorageService), y solo la URL final queda en la base de datos. Vive
 * aparte de "En uso": estas imágenes no están ligadas a ninguna pieza
 * todavía, es acervo para cuando haga falta más variedad. */
export function MediaSearchPanel({
  assets,
  categories,
  onAssetsChange,
}: {
  assets: MediaAsset[];
  categories: Category[];
  onAssetsChange: (assets: MediaAsset[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ImageSearchResult[] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [savingUrl, setSavingUrl] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/search-images`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!res.ok) {
        setError("No se pudo buscar imágenes.");
        setResults([]);
        return;
      }
      setResults(await res.json());
    } catch {
      setError("No se pudo conectar con el servidor.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(result: ImageSearchResult) {
    setSavingUrl(result.url);
    setError("");
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
          categoryId: categoryId || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo guardar la imagen.");
        return;
      }
      const saved: MediaAsset = await res.json();
      onAssetsChange([saved, ...assets]);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSavingUrl(null);
    }
  }

  async function handleDelete(id: string) {
    const previous = assets;
    onAssetsChange(assets.filter((a) => a.id !== id));
    const res = await fetch(`${apiConfig.clientBaseUrl}/cms/media/assets/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) onAssetsChange(previous);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[14px] border border-border bg-white p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar imágenes libres (ej. terrazas cdmx, museo frida kahlo)…"
            className="min-w-[240px] flex-1 rounded-[10px] border border-border bg-white px-3.5 py-2 text-[13px] placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-[10px] border border-border bg-white px-3 py-2 text-[12.5px] text-ink-soft"
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-70"
          >
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </form>
        <p className="mt-2 text-[11.5px] text-ink-faint">La categoría elegida arriba se asigna a lo que guardes de esta búsqueda.</p>
        {error && <p className="mt-3 rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

        {results && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.length === 0 ? (
              <p className="col-span-full text-[13px] text-ink-faint">Sin resultados para esa búsqueda.</p>
            ) : (
              results.map((r) => (
                <div key={r.url} className="overflow-hidden rounded-[12px] border border-border-soft">
                  <div className="relative aspect-square overflow-hidden bg-[#F3F0EC]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.thumbUrl} alt={r.credit} loading="lazy" className="size-full object-cover" />
                  </div>
                  <div className="flex flex-col gap-1.5 p-2">
                    <span className="line-clamp-2 text-[10.5px] leading-tight text-ink-faint">{r.credit}</span>
                    <div className="flex items-center gap-1">
                      <span className="flex-none rounded font-mono text-[9px] text-[#8A837B]" style={{ background: "#F3F0EC", padding: "1px 4px" }}>
                        {SOURCE_LABEL[r.source]}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSave(r)}
                      disabled={savingUrl === r.url}
                      className="rounded-lg bg-brand px-2 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-70"
                    >
                      {savingUrl === r.url ? "Guardando…" : "Guardar en la biblioteca"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight">
          Guardadas sin usar <span className="font-mono text-[12px] font-normal text-ink-faint">({assets.length})</span>
        </h2>
        {assets.length === 0 ? (
          <div className="rounded-[14px] border border-border bg-white p-8 text-center text-[13px] text-ink-soft">
            Todavía no has guardado ninguna imagen de este acervo — búscalas arriba.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {assets.map((a) => (
              <div key={a.id} className="group relative overflow-hidden rounded-[12px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
                <div className="relative aspect-square overflow-hidden bg-[#F3F0EC]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.credit ?? "Imagen guardada"} loading="lazy" className="size-full object-cover" />
                </div>
                <div className="p-2">
                  <span className="line-clamp-2 text-[10.5px] leading-tight text-ink-faint">{a.credit ?? "Sin crédito"}</span>
                  {a.categoryName && (
                    <span className="mt-1 inline-block rounded font-mono text-[9px] text-accent-fg" style={{ background: "#FFF2E8", padding: "1px 4px" }}>
                      {a.categoryName}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  className="absolute top-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Borrar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
