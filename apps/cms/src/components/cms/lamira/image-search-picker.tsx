"use client";

import { useRef, useState } from "react";
import { apiConfig } from "@planazo/config";
import type { ImageSearchResult } from "@planazo/types";
import { fieldClass } from "@/components/cms/dynamic-field";

const SOURCE_LABEL: Record<ImageSearchResult["source"], string> = {
  wikimedia: "Wikimedia",
  openverse: "Openverse",
};

type Tab = "search" | "article" | "fromUrl" | "upload";

// Buscador/selector de imágenes de uso libre — combina Wikimedia Commons y
// Openverse (vía /cms/ai/search-images), permite elegir entre las imágenes
// que ya traía el artículo scrapeado (`articleImages`), traer solo la imagen
// de OTRA fuente pegando su URL (/cms/ai/fetch-image, sin leer su texto), o
// subir un archivo propio (/cms/ai/upload-image). El crédito de búsqueda
// siempre viene de metadata real (autor + licencia, o el nombre del sitio
// para "Desde otra fuente"), nunca se inventa; para subida manual se deja un
// crédito editable porque no hay autor/licencia que reportar.
// Reusado tanto para la imagen principal como para imágenes dentro de un
// bloque de contenido.
export function ImageSearchPicker({
  initialQuery,
  articleImages,
  onSelect,
}: {
  initialQuery?: string;
  articleImages?: { url: string; credit: string }[];
  onSelect: (image: { url: string; credit: string }) => void;
}) {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ImageSearchResult[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [sourceResult, setSourceResult] = useState<{ url: string; credit: string } | null | undefined>(undefined);

  async function handleSearch() {
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${apiConfig.baseUrl}/cms/ai/upload-image`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setUploadError(body?.message ?? "No se pudo subir el archivo.");
        return;
      }
      const data: { url: string } = await res.json();
      onSelect({ url: data.url, credit: "" });
    } catch {
      setUploadError("No se pudo conectar con el servidor.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // "Desde otra fuente": el editor pega el link de OTRA nota que hable del
  // mismo tema (no el artículo ya citado) y solo se saca su imagen principal
  // — nunca se lee/parafrasea su texto, el crédito queda como el nombre de
  // ese sitio (ver AiDraftService.fetchImageFromUrl).
  async function handleFetchFromUrl() {
    if (!sourceUrl.trim()) return;
    setSourceLoading(true);
    setSourceError("");
    setSourceResult(undefined);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/ai/fetch-image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl.trim() }),
      });
      if (!res.ok) {
        setSourceError("No se pudo leer esa página.");
        return;
      }
      const data: { url: string; credit: string } | null = await res.json();
      setSourceResult(data);
    } catch {
      setSourceError("No se pudo conectar con el servidor.");
    } finally {
      setSourceLoading(false);
    }
  }

  const hasArticleImages = !!articleImages && articleImages.length > 0;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTab("search")}
          className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${tab === "search" ? "bg-accent text-accent-fg" : "text-ink-soft hover:text-ink"}`}
        >
          Buscar
        </button>
        {hasArticleImages && (
          <button
            type="button"
            onClick={() => setTab("article")}
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${tab === "article" ? "bg-accent text-accent-fg" : "text-ink-soft hover:text-ink"}`}
          >
            Del artículo ({articleImages!.length})
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab("fromUrl")}
          className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${tab === "fromUrl" ? "bg-accent text-accent-fg" : "text-ink-soft hover:text-ink"}`}
        >
          Desde otra fuente
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${tab === "upload" ? "bg-accent text-accent-fg" : "text-ink-soft hover:text-ink"}`}
        >
          Subir archivo
        </button>
      </div>

      {tab === "search" && (
        <>
          {/* div, no <form> — este picker vive dentro de un <form> real (el
              formulario de edición/creación); un <form> anidado es HTML
              inválido y hacía que el botón "Buscar" (type=submit) disparara
              el submit del formulario de afuera en vez de solo buscar,
              recargando la página. */}
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="ej. tráfico Ciudad de México"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="flex-none rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
            >
              {loading ? "Buscando…" : "Buscar"}
            </button>
          </div>
          <p className="text-[11px] text-ink-faint">Busca en Wikimedia Commons y Openverse — solo imágenes de uso libre, con autor y licencia reales.</p>

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
                  {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa (Wikimedia/Openverse), dominio variable */}
                  <img src={r.thumbUrl} alt="" className="aspect-square w-full object-cover" />
                  <span className="flex flex-col px-1.5 pb-1.5">
                    <span className="truncate text-[10px] text-ink-faint group-hover:text-brand">{r.credit}</span>
                    <span className="text-[9.5px] text-ink-faint/70">{SOURCE_LABEL[r.source]}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "article" && hasArticleImages && (
        <>
          <p className="text-[11px] text-ink-faint">Imágenes encontradas en el cuerpo del artículo de la fuente — mismo crédito que la imagen principal.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {articleImages!.map((img) => (
              <button
                key={img.url}
                type="button"
                onClick={() => onSelect(img)}
                title={img.credit}
                className="group flex flex-col gap-1 overflow-hidden rounded-[8px] border border-border-soft bg-background text-left transition-colors hover:border-brand"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa (fuente del artículo), dominio variable */}
                <img src={img.url} alt="" className="aspect-square w-full object-cover" />
                <span className="truncate px-1.5 pb-1.5 text-[10px] text-ink-faint group-hover:text-brand">{img.credit}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "fromUrl" && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-ink-faint">
            Pega el link de otra nota que hable del tema — solo se toma su imagen principal, nunca su texto. El
            crédito queda como el nombre de ese sitio.
          </p>
          <div className="flex gap-2">
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleFetchFromUrl();
                }
              }}
              placeholder="https://otra-fuente.com/nota…"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="button"
              onClick={handleFetchFromUrl}
              disabled={sourceLoading || !sourceUrl.trim()}
              className="flex-none rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
            >
              {sourceLoading ? "Buscando…" : "Obtener imagen"}
            </button>
          </div>

          {sourceError && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[12px] font-medium text-[#C4453A]">{sourceError}</p>}

          {sourceResult === null && !sourceError && (
            <p className="text-[12px] text-ink-faint italic">Esa página no tiene una imagen que se pueda usar.</p>
          )}

          {sourceResult && (
            <button
              type="button"
              onClick={() => onSelect(sourceResult)}
              title={sourceResult.credit}
              className="group flex w-full max-w-[220px] flex-col gap-1 overflow-hidden rounded-[8px] border border-border-soft bg-background text-left transition-colors hover:border-brand"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
              <img src={sourceResult.url} alt="" className="aspect-square w-full object-cover" />
              <span className="flex flex-col px-1.5 pb-1.5">
                <span className="truncate text-[10px] text-ink-faint group-hover:text-brand">{sourceResult.credit}</span>
                <span className="text-[9.5px] text-ink-faint/70">Usar esta imagen</span>
              </span>
            </button>
          )}
        </div>
      )}

      {tab === "upload" && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-ink-faint">JPEG, PNG, WEBP o GIF — hasta 8MB. Se guarda en el servidor y queda disponible de inmediato.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleUpload}
            disabled={uploading}
            className="text-[12.5px] text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold file:text-white hover:file:bg-brand-pressed disabled:opacity-60"
          />
          {uploading && <p className="text-[12px] text-ink-faint">Subiendo…</p>}
          {uploadError && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[12px] font-medium text-[#C4453A]">{uploadError}</p>}
        </div>
      )}
    </div>
  );
}
