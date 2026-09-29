"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

// Anchos de referencia para ver cómo queda la pieza en cada tipo de pantalla.
const PRESETS = [
  { label: "Celular", width: 375 },
  { label: "Tablet", width: 768 },
  { label: "Escritorio", width: 1024 },
] as const;

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 320;
// El formulario nunca queda más angosto que esto al agrandar la vista previa.
const MIN_FORM_WIDTH = 380;
const GAP_AND_HANDLE = 24;
const KEY_STEP = 16;

// El ancho elegido es una comodidad por navegador (se recuerda entre piezas).
// Si el storage no está disponible, se usa el ancho por defecto.
const STORAGE_KEY = "cms-preview-width";
const listeners = new Set<() => void>();

function readStoredWidth(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredWidth(width: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
  } catch {
    // Sin storage: el ancho dura solo esta visita.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Layout de 2 columnas para los formularios de edición manual: formulario a la
// izquierda (scroll normal de la página, vía CmsShell) y vista previa a la
// derecha, pegada arriba (`sticky`) con su propio scroll. En pantallas anchas
// la vista previa se puede redimensionar (arrastrando la barra o con los
// botones Celular/Tablet/Escritorio) para ver cómo se vería en cada pantalla —
// las tarjetas de vista previa usan container queries, así que responden al
// ancho del panel, no al de la ventana.
export function EditPreviewLayout({ left, preview }: { left: ReactNode; preview: ReactNode }) {
  const storedWidth = useSyncExternalStore(subscribe, readStoredWidth, () => null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxWidth = containerWidth ? Math.max(MIN_WIDTH, containerWidth - MIN_FORM_WIDTH - GAP_AND_HANDLE) : 1024;
  const clamp = (w: number) => Math.min(maxWidth, Math.max(MIN_WIDTH, w));
  const width = clamp(storedWidth ?? DEFAULT_WIDTH);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, width };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    // La vista previa está a la derecha: arrastrar hacia la izquierda la agranda.
    writeStoredWidth(clamp(dragStart.current.width + (dragStart.current.x - e.clientX)));
  }

  function onPointerUp() {
    dragStart.current = null;
    setDragging(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") writeStoredWidth(clamp(width + KEY_STEP));
    else if (e.key === "ArrowRight") writeStoredWidth(clamp(width - KEY_STEP));
    else if (e.key === "Home") writeStoredWidth(MIN_WIDTH);
    else if (e.key === "End") writeStoredWidth(maxWidth);
    else return;
    e.preventDefault();
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-0 ${dragging ? "cursor-col-resize select-none" : ""}`}
    >
      <div className="min-w-0 flex-1">{left}</div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Ancho de la vista previa"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={Math.round(maxWidth)}
        aria-valuenow={Math.round(width)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        title="Arrastra para cambiar el ancho de la vista previa"
        className="group hidden w-6 flex-none cursor-col-resize touch-none justify-center self-stretch outline-none lg:flex"
      >
        <span
          className={`mt-[26px] h-[calc(100vh-52px)] max-h-full w-[3px] rounded-full transition-colors duration-150 group-hover:bg-brand/50 group-focus-visible:bg-brand ${
            dragging ? "bg-brand" : "bg-border"
          }`}
        />
      </div>

      <div className="w-full flex-none lg:sticky lg:top-[26px] lg:w-[var(--preview-width)]" style={{ "--preview-width": `${width}px` } as React.CSSProperties}>
        <div className="mb-2.5 hidden flex-wrap items-center justify-between gap-2 lg:flex">
          <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
            {PRESETS.map((p) => {
              const fits = p.width <= maxWidth;
              const active = Math.round(width) === Math.min(p.width, Math.round(maxWidth));
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => writeStoredWidth(clamp(p.width))}
                  title={fits ? `${p.width} px` : `${p.width} px no cabe en esta ventana — se usa el máximo (${Math.round(maxWidth)} px)`}
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    active ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <span className="font-mono text-[11px] text-ink-faint tabular-nums">{Math.round(width)} px</span>
        </div>
        <div className="@container lg:max-h-[calc(100vh-90px)] lg:overflow-y-auto">{preview}</div>
      </div>
    </div>
  );
}
