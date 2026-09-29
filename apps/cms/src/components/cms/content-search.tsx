"use client";

import { useEffect, useRef } from "react";

/** Minúsculas y sin acentos, para buscar "mexico" y encontrar "México". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * ¿La pieza coincide con la búsqueda? Cada palabra de la búsqueda tiene que
 * aparecer en alguno de los campos (en cualquier orden): "metro linea 3"
 * encuentra "Línea 3 del Metro".
 */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(fields.filter(Boolean).join(" "));
  return words.every((w) => haystack.includes(w));
}

/**
 * Buscador de la tabla de Contenido: filtra al escribir (sin ir al servidor,
 * los datos ya están cargados). "/" lo enfoca desde cualquier parte de la
 * página; Esc lo limpia.
 */
export function ContentSearch({
  value,
  onChange,
  placeholder,
  resultCount,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Resultados con la búsqueda + filtros actuales (se muestra solo si hay búsqueda). */
  resultCount: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-[460px]">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
          aria-hidden
        >
          <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.8-3.8" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value) {
              e.preventDefault();
              onChange("");
            }
          }}
          placeholder={placeholder}
          aria-label="Buscar en el contenido"
          className="w-full rounded-[10px] border border-border bg-card py-2 pr-16 pl-9 text-[13.5px] text-ink transition-colors placeholder:text-ink-faint hover:border-ink-faint focus:border-brand focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Borrar búsqueda"
            className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-faint transition-colors hover:bg-hover hover:text-ink"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : (
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-border bg-background px-1.5 font-mono text-[10.5px] text-ink-faint">
            /
          </kbd>
        )}
      </div>
      {value.trim() && (
        <span className="text-[12.5px] text-ink-soft" role="status">
          {resultCount === 0 ? "Sin resultados" : `${resultCount} ${resultCount === 1 ? "resultado" : "resultados"}`}
        </span>
      )}
    </div>
  );
}
