"use client";

export interface TooltipPosition {
  x: number;
  y: number;
}

// Tooltip que sigue el cursor, posicionado dentro del contenedor relativo
// del mapa (no `fixed` como el de Sidebar — aquí no hay que salir del
// scroll de la página, solo del propio SVG). Un poco desplazado del cursor
// para no taparlo con el propio puntero.
export function MapTooltip({ position, children }: { position: TooltipPosition; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md bg-ink-solid px-2.5 py-1.5 text-[12px] whitespace-nowrap text-white shadow-[0_6px_16px_-4px_rgba(23,20,17,.32)]"
      style={{ left: position.x, top: position.y }}
    >
      {children}
    </div>
  );
}
