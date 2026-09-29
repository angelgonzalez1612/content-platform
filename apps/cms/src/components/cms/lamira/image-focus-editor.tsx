"use client";

import { useRef, useState } from "react";

/** "X% Y%" ↔ números. null / inválido = centrada. */
export function parseImagePosition(position: string | null | undefined): { x: number; y: number } {
  const match = position?.match(/^(\d{1,3})% (\d{1,3})%$/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 50, y: 50 };
}

function formatImagePosition(x: number, y: number): string | null {
  const rx = Math.round(x);
  const ry = Math.round(y);
  return rx === 50 && ry === 50 ? null : `${rx}% ${ry}%`;
}

const clampPct = (v: number) => Math.min(100, Math.max(0, v));

const PRESETS = [
  { label: "Arriba", x: 50, y: 0 },
  { label: "Centro", x: 50, y: 50 },
  { label: "Abajo", x: 50, y: 100 },
] as const;

const KEY_STEP = 5;

/**
 * Elegir qué parte de la imagen se ve dentro de su recuadro (CSS
 * object-position) sin recortarla ni deformarla: se arrastra la foto dentro
 * del marco 16:9 (como en el sitio) y se ve al lado cómo queda en tarjetas
 * cuadradas y 4:3. El valor se guarda como "X% Y%" (null = centrada).
 */
export function ImageFocusEditor({
  url,
  position,
  onChange,
  embedded = false,
}: {
  url: string;
  position: string | null;
  onChange: (position: string | null) => void;
  /** Dentro de otra tarjeta (ImageField): sin borde propio. */
  embedded?: boolean;
}) {
  const { x, y } = parseImagePosition(position);
  const frameRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const objectPosition = `${x}% ${y}%`;

  /** Cuánto sobra de la imagen (en px) fuera del marco, por eje — lo que se puede desplazar. */
  function overflow(): { x: number; y: number } {
    const frame = frameRef.current;
    if (!frame || !natural) return { x: 0, y: 0 };
    const { width: fw, height: fh } = frame.getBoundingClientRect();
    const scale = Math.max(fw / natural.w, fh / natural.h);
    return { x: natural.w * scale - fw, y: natural.h * scale - fh };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, x, y };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const over = overflow();
    // Arrastrar la foto hacia abajo muestra más de arriba (Y% baja), igual que moverla con la mano.
    const nx = over.x > 0 ? drag.current.x - ((e.clientX - drag.current.startX) / over.x) * 100 : x;
    const ny = over.y > 0 ? drag.current.y - ((e.clientY - drag.current.startY) / over.y) * 100 : y;
    onChange(formatImagePosition(clampPct(nx), clampPct(ny)));
  }

  function onPointerUp() {
    drag.current = null;
    setDragging(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    onChange(formatImagePosition(clampPct(x + move[0]), clampPct(y + move[1])));
  }

  // El marco es 16:9: si la foto tiene otra proporción, sobra algo que mover.
  const canMove = natural ? Math.abs(natural.w / natural.h - 16 / 9) > 0.01 : true;

  return (
    <div className={`flex flex-col gap-2.5 p-3 ${embedded ? "" : "rounded-[10px] border border-border-soft bg-background"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-ink">Encuadre</span>
        <span className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
          {PRESETS.map((p) => {
            const active = Math.round(x) === p.x && Math.round(y) === p.y;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(formatImagePosition(p.x, p.y))}
                className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold transition-colors ${
                  active ? "bg-accent text-accent-fg" : "text-ink-faint hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div
          ref={frameRef}
          role="slider"
          tabIndex={0}
          aria-label="Encuadre de la imagen: arrastra o usa las flechas"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(y)}
          aria-valuetext={`Horizontal ${Math.round(x)}%, vertical ${Math.round(y)}%`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={`relative aspect-video w-full touch-none overflow-hidden rounded-[8px] bg-hover outline-none select-none focus-visible:ring-2 focus-visible:ring-brand sm:flex-1 ${
            canMove ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="pointer-events-none size-full object-cover"
            style={{ objectPosition }}
          />
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-ink-solid/70 px-1.5 py-0.5 text-[10.5px] font-medium text-white">
            Portada 16:9
          </span>
        </div>

        <div className="flex gap-2 sm:w-[112px] sm:flex-col">
          {[
            { label: "Tarjeta 4:3", aspect: "aspect-[4/3]" },
            { label: "Cuadrada", aspect: "aspect-square" },
          ].map((f) => (
            <div key={f.label} className="flex flex-1 flex-col gap-1">
              <div className={`${f.aspect} overflow-hidden rounded-[6px] bg-hover`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente */}
                <img src={url} alt="" className="size-full object-cover" style={{ objectPosition }} />
              </div>
              <span className="text-center text-[10.5px] text-ink-faint">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11.5px] text-ink-faint">
        {canMove
          ? "Arrastra la foto (o usa las flechas) para elegir qué parte se ve. La imagen no se recorta ni se deforma."
          : "Esta imagen ya cabe completa en el recuadro; no hay nada que mover."}
        {position && (
          <button type="button" onClick={() => onChange(null)} className="ml-2 font-medium text-ink-soft hover:text-brand">
            Restablecer
          </button>
        )}
      </p>
    </div>
  );
}
