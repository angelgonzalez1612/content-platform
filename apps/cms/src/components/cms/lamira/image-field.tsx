"use client";

import { useState } from "react";
import { labelClass } from "@/components/cms/dynamic-field";
import { ImageSearchPicker } from "@/components/cms/lamira/image-search-picker";
import { ImageFocusEditor } from "@/components/cms/lamira/image-focus-editor";

// Campo de imagen reusado en el flujo de generación con IA y en los 6
// formularios de edición manual de la-mira — agregar/reemplazar/quitar, por
// búsqueda (Wikimedia/Openverse/subida) o pegando una URL a mano. El crédito
// siempre es editable porque no todas las fuentes (URL manual, subida) traen
// uno real que reportar.
export function ImageField({
  image,
  onChange,
  searchQuery,
  articleImages,
  label = "Imagen",
  position,
  onPositionChange,
}: {
  image: { url: string; credit: string } | null;
  onChange: (image: { url: string; credit: string } | null) => void;
  searchQuery?: string;
  articleImages?: { url: string; credit: string }[];
  label?: string;
  /** Encuadre (CSS object-position, "X% Y%"); si se pasa onPositionChange, se puede ajustar. */
  position?: string | null;
  onPositionChange?: (position: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  // Una imagen nueva empieza centrada: el encuadre de la anterior no aplica.
  function changeImage(next: { url: string; credit: string } | null) {
    if (next?.url !== image?.url) onPositionChange?.(null);
    onChange(next);
  }
  function startEdit() {
    setAdjusting(false);
    setEditing(true);
  }
  function selectSearched(picked: { url: string; credit: string }) {
    changeImage(picked);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>

      {editing ? (
        <div className="flex flex-col gap-3 rounded-[10px] border border-brand/40 bg-background p-3">
          {/* "Cancelar" conserva la imagen actual — reemplazar nunca la pierde
              hasta que se elige otra. */}
          <div className="flex items-center gap-2.5">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente
              <img src={image.url} alt="" title="Imagen actual" className="h-9 w-12 flex-none rounded-[6px] object-cover" />
            )}
            <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-ink">{image ? "Elegir otra imagen" : "Agregar imagen"}</span>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-none rounded-md px-2 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:bg-hover hover:text-ink"
            >
              {image ? "Cancelar y mantener la actual" : "Cancelar"}
            </button>
          </div>

          <ImageSearchPicker initialQuery={searchQuery} articleImages={articleImages} onSelect={selectSearched} />
        </div>
      ) : image ? (
        <div className={`overflow-hidden rounded-[10px] border bg-background transition-colors ${adjusting ? "border-brand/40" : "border-border-soft"}`}>
          <div className="flex items-start gap-3 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
            <img src={image.url} alt="" className="h-20 w-28 flex-none rounded-[8px] object-cover" style={position ? { objectPosition: position } : undefined} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <p className="min-w-0 truncate text-[12px] text-ink-soft" title={image.credit || undefined}>
                  {image.credit || "(sin crédito)"}
                </p>
                {position && !adjusting && (
                  <span className="inline-flex flex-none items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-accent-fg" title={`Encuadre: ${position}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                    </svg>
                    Encuadre ajustado
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {onPositionChange && (
                  <button
                    type="button"
                    onClick={() => setAdjusting((v) => !v)}
                    aria-expanded={adjusting}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                      adjusting
                        ? "bg-brand text-white hover:bg-brand-pressed"
                        : "border border-border bg-card text-ink hover:border-brand hover:text-brand"
                    }`}
                  >
                    {adjusting ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                        Listo
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4M12 9v6M9 12h6" />
                        </svg>
                        Ajustar encuadre
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
                >
                  Reemplazar
                </button>
                <span className="ml-auto flex items-center gap-0.5">
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md px-2 py-1.5 text-[12px] font-medium text-ink-faint transition-colors hover:bg-hover hover:text-ink"
                  >
                    Abrir ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => changeImage(null)}
                    className="rounded-md px-2 py-1.5 text-[12px] font-medium text-ink-faint transition-colors hover:bg-negative/10 hover:text-negative"
                  >
                    Quitar
                  </button>
                </span>
              </div>
            </div>
          </div>
          {adjusting && onPositionChange && (
            <div className="border-t border-border-soft">
              <ImageFocusEditor url={image.url} position={position ?? null} onChange={onPositionChange} embedded />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="self-start rounded-lg border border-dashed border-border bg-background px-3 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
        >
          + Agregar imagen
        </button>
      )}
    </div>
  );
}
