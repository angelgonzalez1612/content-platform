"use client";

import { useRef, useState } from "react";
import { MEXICO_MAP_VIEWBOX, MEXICO_STATE_SHAPES } from "@/data/mexico-states-map";
import { MapTooltip, type TooltipPosition } from "./map-tooltip";

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

// Únicos dos estados con vista de alcaldías/municipios (ver zmvm-map.tsx) —
// se marcan en el mapa nacional para que se note ANTES de hacer clic, no
// solo después (cuando ya aparece el botón "Ver alcaldías / municipios").
const DRILLDOWN_CODES = new Set(["cmx", "mex"]);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);

  const hoveredState = MEXICO_STATE_SHAPES.find((s) => s.code === hovered);
  const hoveredValue = hovered ? interest?.[hovered] : undefined;

  function handleMove(e: React.MouseEvent<SVGPathElement>, code: string) {
    setHovered(code);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div ref={containerRef} className="relative">
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
              onMouseEnter={(e) => handleMove(e, s.code)}
              onMouseMove={(e) => handleMove(e, s.code)}
              onMouseLeave={() => {
                setHovered(null);
                setTooltipPos(null);
              }}
              onClick={() => onSelect(s.code, s.name)}
            />
          );
        })}
      </svg>
      {hoveredState && tooltipPos && (
        <MapTooltip position={tooltipPos}>
          <span className="font-semibold">{hoveredState.name}</span>
          {hoveredValue != null && <span className="text-white/70"> — {hoveredValue}</span>}
          {DRILLDOWN_CODES.has(hoveredState.code) && (
            <span className="mt-0.5 block text-[10px] font-medium text-white/70">Alcaldías / municipios disponibles</span>
          )}
        </MapTooltip>
      )}
    </div>
  );
}
