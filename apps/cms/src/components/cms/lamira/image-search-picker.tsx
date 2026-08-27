"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import type { ImageSearchResult } from "@planazo/types";
import { fieldClass } from "@/components/cms/dynamic-field";

// Buscador de imágenes de uso libre (Wikimedia Commons, vía /cms/ai/search-images)
// — alternativa a pegar una URL a mano o a la imagen scrapeada de la fuente.
// El crédito siempre viene de metadata real (autor + licencia), nunca se
// inventa. Reusado tanto para la imagen principal como para imágenes dentro
// de un bloque de contenido.
export function ImageSearchPicker({ initialQuery, onSelect }: { initialQuery?: string; onSelect: (image: { url: string; credit: string }) => void }) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ImageSearchResult[] | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/ai/search-images`, {
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
      const data: ImageSearchResult[] = await res.json();
      setResults(data);
    } catch {
      setError("No se pudo conectar con el servidor.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ej. tráfico Ciudad de México"
          className={`${fieldClass} flex-1`}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="flex-none rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>
      <p className="text-[11px] text-ink-faint">Busca en Wikimedia Commons — solo imágenes de uso libre, con autor y licencia reales.</p>

      {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[12px] font-medium text-[#C4453A]">{error}</p>}

      {results && results.length === 0 && !error && <p className="text-[12px] text-ink-faint italic">Sin resultados para &quot;{query}&quot; — prueba con otras palabras.</p>}

      {results && results.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {results.map((r) => (
            <button
              key={r.url}
              type="button"
              onClick={() => onSelect({ url: r.url, credit: r.credit })}
              title={r.credit}
              className="group flex flex-col gap-1 overflow-hidden rounded-[8px] border border-border-soft bg-background text-left transition-colors hover:border-brand"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa (Wikimedia), dominio variable */}
              <img src={r.thumbUrl} alt="" className="aspect-square w-full object-cover" />
              <span className="truncate px-1.5 pb-1.5 text-[10px] text-ink-faint group-hover:text-brand">{r.credit}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
