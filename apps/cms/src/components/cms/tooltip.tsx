import type { ReactNode } from "react";

// Tooltip genérico, 100% CSS (`group-hover`) — sin estado ni "use client",
// para poder usarse desde componentes de servidor (ej. ViewPublishedLink en
// /contenido). Mismo tono oscuro que el resto del CMS (--color-ink).
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 shadow-[0_4px_12px_rgba(23,20,17,.18)] transition-opacity duration-150 group-hover/tooltip:opacity-100 motion-reduce:transition-none"
      >
        {label}
      </span>
    </span>
  );
}
