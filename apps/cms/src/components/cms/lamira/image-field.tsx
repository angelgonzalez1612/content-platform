"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { ImageSearchPicker } from "@/components/cms/lamira/image-search-picker";

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
}: {
  image: { url: string; credit: string } | null;
  onChange: (image: { url: string; credit: string } | null) => void;
  searchQuery?: string;
  articleImages?: { url: string; credit: string }[];
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"search" | "url">("search");
  const [draft, setDraft] = useState({ url: "", credit: "" });

  function startEdit() {
    setDraft(image ?? { url: "", credit: "" });
    setMode("search");
    setEditing(true);
  }
  function saveUrl() {
    if (!draft.url.trim()) return;
    onChange({ url: draft.url.trim(), credit: draft.credit.trim() });
    setEditing(false);
  }
  function selectSearched(picked: { url: string; credit: string }) {
    onChange(picked);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>

      {editing ? (
        <div className="flex flex-col gap-3 rounded-[10px] border border-border-soft bg-background p-3">
          {/* Reemplazar no debe hacer perder la imagen que ya había — se deja
              fija arriba, fuera de las pestañas de búsqueda, para poder
              recuperarla con un clic aunque ya se haya elegido otra. */}
          {image && (
            <div className="flex items-center gap-3 rounded-[8px] border border-border-soft bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
              <img src={image.url} alt="" className="h-14 w-20 flex-none rounded-[6px] object-cover" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-mono text-[9.5px] font-semibold tracking-[.04em] text-ink-faint uppercase">Imagen actual</span>
                <span className="truncate text-[11.5px] text-ink-soft">{image.credit || "(sin crédito)"}</span>
              </div>
              <button
                type="button"
                onClick={() => selectSearched(image)}
                className="flex-none rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-medium text-ink-soft hover:border-brand hover:text-brand"
              >
                Mantener esta
              </button>
            </div>
          )}

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
            <ImageSearchPicker initialQuery={searchQuery} articleImages={articleImages} onSelect={selectSearched} />
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="img-field-url" className="text-[11px] font-medium text-ink-faint">
                  URL de la imagen
                </label>
                <input id="img-field-url" value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} placeholder="https://…" className={fieldClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="img-field-credit" className="text-[11px] font-medium text-ink-faint">
                  Crédito
                </label>
                <input id="img-field-credit" value={draft.credit} onChange={(e) => setDraft((d) => ({ ...d, credit: e.target.value }))} placeholder="ej. Foto: MILENIO" className={fieldClass} />
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={saveUrl} disabled={!draft.url.trim()} className="self-start rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-pressed disabled:opacity-50">
                  Guardar imagen
                </button>
              </div>
            </>
          )}

          <button type="button" onClick={() => setEditing(false)} className="self-start text-[12px] font-medium text-ink-soft hover:text-brand">
            Cancelar
          </button>
        </div>
      ) : image ? (
        <div className="flex items-start gap-3 rounded-[10px] border border-border-soft bg-background p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
          <img src={image.url} alt="" className="h-20 w-28 flex-none rounded-[8px] object-cover" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
            <p className="truncate text-[12px] text-ink-soft">{image.credit || "(sin crédito)"}</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={startEdit} className="text-[12px] font-medium text-ink-soft hover:text-brand">
                Reemplazar
              </button>
              <button type="button" onClick={() => onChange(null)} className="text-[12px] font-medium text-ink-soft hover:text-negative">
                Quitar imagen
              </button>
            </div>
          </div>
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
