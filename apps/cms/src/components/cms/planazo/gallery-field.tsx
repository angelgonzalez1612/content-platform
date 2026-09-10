"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { ImageSearchPicker } from "@/components/cms/lamira/image-search-picker";

export interface GalleryPhoto {
  url: string;
  alt?: string | null;
  credit?: string | null;
}

// Galería de un lugar (positions 1+) — separado de la portada (ImageField,
// position 0). Reemplazo completo al guardar: se dedupea por URL en el
// cliente (además del candado a nivel de base de datos,
// `photos_place_id_url_unique`) para no repetir la misma foto en varias
// filas, el bug que llevó a construir esto (ver fix-place-photos.ts).
export function GalleryField({
  photos,
  onChange,
  searchQuery,
}: {
  photos: GalleryPhoto[];
  onChange: (photos: GalleryPhoto[]) => void;
  searchQuery?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"search" | "url">("search");
  const [draft, setDraft] = useState({ url: "", credit: "" });
  const [duplicateNotice, setDuplicateNotice] = useState("");

  function addPhoto(photo: GalleryPhoto) {
    if (photos.some((p) => p.url === photo.url)) {
      setDuplicateNotice("Esa foto ya está en la galería — no se agregó de nuevo.");
      return;
    }
    setDuplicateNotice("");
    onChange([...photos, photo]);
    setAdding(false);
    setDraft({ url: "", credit: "" });
  }

  function removeAt(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClass}>Galería (fotos adicionales)</span>
      <p className="text-[11.5px] text-ink-faint">
        Aparte de la portada de arriba — solo agrega fotos genuinamente distintas del lugar, nunca repitas la misma.
      </p>

      {photos.length > 0 && (
        <div className="flex flex-col gap-2">
          {photos.map((photo, i) => (
            <div key={`${photo.url}-${i}`} className="flex items-center gap-3 rounded-[10px] border border-border-soft bg-background p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
              <img src={photo.url} alt="" className="h-14 w-20 flex-none rounded-[6px] object-cover" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[11.5px] text-ink-soft">{photo.credit || "(sin crédito)"}</span>
              </div>
              <div className="flex flex-none items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title="Subir"
                  className="rounded-md px-2 py-1 text-[13px] text-ink-soft hover:text-brand disabled:cursor-default disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === photos.length - 1}
                  title="Bajar"
                  className="rounded-md px-2 py-1 text-[13px] text-ink-soft hover:text-brand disabled:cursor-default disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="rounded-md px-2 py-1 text-[12px] font-medium text-ink-soft hover:text-negative"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {duplicateNotice && <p className="text-[11.5px] font-medium text-[#9A6B12]">{duplicateNotice}</p>}

      {adding ? (
        <div className="flex flex-col gap-3 rounded-[10px] border border-border-soft bg-background p-3">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode("search")}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${mode === "search" ? "bg-accent text-accent-fg" : "text-ink-soft hover:text-ink"}`}
            >
              Buscar imágenes
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${mode === "url" ? "bg-accent text-accent-fg" : "text-ink-soft hover:text-ink"}`}
            >
              Pegar URL
            </button>
          </div>

          {mode === "search" ? (
            <ImageSearchPicker initialQuery={searchQuery} onSelect={addPhoto} />
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="gallery-url" className="text-[11px] font-medium text-ink-faint">
                  URL de la imagen
                </label>
                <input
                  id="gallery-url"
                  value={draft.url}
                  onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                  placeholder="https://…"
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="gallery-credit" className="text-[11px] font-medium text-ink-faint">
                  Crédito
                </label>
                <input
                  id="gallery-credit"
                  value={draft.credit}
                  onChange={(e) => setDraft((d) => ({ ...d, credit: e.target.value }))}
                  placeholder="ej. Foto: Wikimedia Commons"
                  className={fieldClass}
                />
              </div>
              <button
                type="button"
                onClick={() => addPhoto({ url: draft.url.trim(), credit: draft.credit.trim() })}
                disabled={!draft.url.trim()}
                className="self-start rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-pressed disabled:opacity-50"
              >
                Agregar a la galería
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setDuplicateNotice("");
            }}
            className="self-start text-[12px] font-medium text-ink-soft hover:text-brand"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start rounded-lg border border-dashed border-border bg-background px-3 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
        >
          + Agregar foto a la galería
        </button>
      )}
    </div>
  );
}
