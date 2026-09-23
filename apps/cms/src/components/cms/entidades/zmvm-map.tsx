"use client";

import { useState } from "react";
import { ZMVM_MAP_VIEWBOX, ZMVM_MUNICIPIO_SHAPES } from "@/data/zmvm-municipios-map";

// Mismo naranja de marca que MexicoMap, pero de un solo tono por estado
// padre (no hay dato real de Trends a nivel municipio/alcaldía — ver
// comentario en zmvm-municipios-map.ts) — cmx un poco más oscuro que mex
// solo para poder distinguirlos a simple vista en el mapa, no representa
// una diferencia de interés real.
const FILL_BY_STATE: Record<"cmx" | "mex", string> = {
  cmx: "#f6b58a",
  mex: "#fbdcc2",
};

export function ZmvmMap({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (code: string, name: string, parentState: "cmx" | "mex") => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredShape = ZMVM_MUNICIPIO_SHAPES.find((s) => s.code === hovered);

  return (
    <div>
      <div className="mb-1.5 h-[18px] text-[12.5px] font-medium text-ink-soft">
        {hoveredShape && (
          <>
            {hoveredShape.name}
            <span className="text-ink-faint"> · {hoveredShape.parentState === "cmx" ? "CDMX" : "Estado de México"}</span>
          </>
        )}
      </div>
      <svg viewBox={ZMVM_MAP_VIEWBOX} className="h-auto w-full" role="img" aria-label="Mapa de alcaldías de CDMX y municipios conurbados del Estado de México">
        {ZMVM_MUNICIPIO_SHAPES.map((s) => {
          const isSelected = selected === s.code;
          const isHovered = hovered === s.code;

          return (
            <path
              key={s.code}
              d={s.path}
              fill={FILL_BY_STATE[s.parentState]}
              stroke={isSelected ? "var(--color-brand)" : "var(--color-card, #fff)"}
              strokeWidth={isSelected ? 4 : 1.5}
              className="cursor-pointer transition-[stroke-width,opacity] duration-150"
              style={{ opacity: isHovered && !isSelected ? 0.82 : 1 }}
              onMouseEnter={() => setHovered(s.code)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(s.code, s.name, s.parentState)}
            />
          );
        })}
      </svg>
    </div>
  );
}
