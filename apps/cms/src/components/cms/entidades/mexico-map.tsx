"use client";

import { useState } from "react";
import { MEXICO_MAP_VIEWBOX, MEXICO_STATE_SHAPES } from "@/data/mexico-states-map";

// Interpola entre el neutro más claro de la paleta y el naranja de marca —
// mismo criterio que el heatmap de prospect-finder (más oscuro = más
// interés), pero como relleno de estado en vez de una capa de calor.
const COLD_RGB = { r: 0xf3, g: 0xf0, b: 0xec }; // --color-border-soft
const HOT_RGB = { r: 0xfd, g: 0x69, b: 0x0d }; // --color-brand

function interpolateColor(value: number): string {
  const t = Math.max(0, Math.min(1, value / 100));
  const r = Math.round(COLD_RGB.r + (HOT_RGB.r - COLD_RGB.r) * t);
  const g = Math.round(COLD_RGB.g + (HOT_RGB.g - COLD_RGB.g) * t);
  const b = Math.round(COLD_RGB.b + (HOT_RGB.b - COLD_RGB.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function MexicoMap({
  interest,
  selected,
  onSelect,
}: {
  /** null mientras carga o cuando Trends no está disponible — el mapa se ve "sin datos", nunca inventa un valor. */
  interest: Record<string, number> | null;
  selected: string | null;
  onSelect: (code: string, name: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Etiqueta controlada por React en vez de <title> nativo por <path> — un
  // <title> anidado en cada uno de los 32 <path> disparaba un mismatch de
  // hidratación en Next (server/cliente veían árboles distintos), además de
  // depender del tooltip nativo del navegador en vez de un estilo propio.
  const hoveredState = MEXICO_STATE_SHAPES.find((s) => s.code === hovered);
  const hoveredValue = hovered ? interest?.[hovered] : undefined;

  return (
    <div>
      <div className="mb-1.5 h-[18px] text-[12.5px] font-medium text-ink-soft">
        {hoveredState && (
          <>
            {hoveredState.name}
            {hoveredValue != null && <span className="text-ink-faint"> — {hoveredValue}</span>}
          </>
        )}
      </div>
      <svg viewBox={MEXICO_MAP_VIEWBOX} className="h-auto w-full" role="img" aria-label="Mapa de México por estados">
        {MEXICO_STATE_SHAPES.map((s) => {
          const value = interest?.[s.code];
          const isSelected = selected === s.code;
          const isHovered = hovered === s.code;
          const fill = interest === null ? "var(--color-border-soft)" : interpolateColor(value ?? 0);

          return (
            <path
              key={s.code}
              d={s.path}
              fill={fill}
              stroke={isSelected ? "var(--color-brand)" : "var(--color-card, #fff)"}
              strokeWidth={isSelected ? 1.6 : 0.6}
              className="cursor-pointer transition-[stroke-width,opacity] duration-150"
              style={{ opacity: isHovered && !isSelected ? 0.82 : 1 }}
              onMouseEnter={() => setHovered(s.code)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(s.code, s.name)}
            />
          );
        })}
      </svg>
    </div>
  );
}
