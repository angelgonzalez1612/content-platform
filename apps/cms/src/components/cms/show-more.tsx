"use client";

import { useState } from "react";

// Filas que se pintan de inicio en las tablas largas de Contenido — pintar
// las ~300 de golpe generaba ~760 KB de HTML y hacía lenta cada visita.
export const ROWS_PER_PAGE = 50;

/**
 * Cuántas filas mostrar de una lista filtrada. `resetKey` = los filtros
 * activos: al cambiar, se vuelve a la primera página (sin useEffect, se
 * compara contra la clave guardada durante el render).
 */
export function useVisibleRows<T>(rows: T[], resetKey: string) {
  const [state, setState] = useState({ key: resetKey, limit: ROWS_PER_PAGE });
  const limit = state.key === resetKey ? state.limit : ROWS_PER_PAGE;
  return {
    visible: rows.slice(0, limit),
    remaining: Math.max(0, rows.length - limit),
    showMore: () => setState({ key: resetKey, limit: limit + ROWS_PER_PAGE }),
  };
}

export function ShowMoreRow({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  if (remaining <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 border-t border-border-soft px-4 py-2.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-hover hover:text-ink"
    >
      Mostrar {Math.min(remaining, ROWS_PER_PAGE)} más
      <span className="font-normal text-ink-faint">· quedan {remaining}</span>
    </button>
  );
}
