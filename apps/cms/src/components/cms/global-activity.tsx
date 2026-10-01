"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { apiConfig } from "@planazo/config";

/** Eventos para quien navega o cancela una navegación por su cuenta (ver UnsavedChangesGuard). */
export const NAV_START_EVENT = "cms:navigation-start";
export const NAV_CANCEL_EVENT = "cms:navigation-cancel";
/** Header opcional con el nombre de la tarea ("Revisar con IA · <título>"); no se manda al API. */
export const TASK_LABEL_HEADER = "X-Task-Label";

// Tras cuánto aparece el aviso: las acciones rápidas no parpadean.
const SHOW_AFTER_MS = 400;
// Si una navegación nunca llega (error de red), la barra no se queda para siempre.
const NAV_TIMEOUT_MS = 15_000;
// Tareas de IA a la vez: cada una abre su propio proceso de Codex/Claude (o un navegador
// para leer notas) en la máquina — con muchas juntas se acababa la memoria.
const MAX_HEAVY = 3;
// Cuánto se quedan en la lista las tareas terminadas.
const KEEP_DONE_MS = 3 * 60_000;

// ── Qué es cada petición ─────────────────────────────────────────────────────
const KINDS: { match: RegExp; label: string; heavy: boolean }[] = [
  { match: /\/review-agent\/analyze/, label: "Revisar con IA", heavy: true },
  { match: /\/review-agent\/fix/, label: "Arreglar con IA", heavy: true },
  { match: /\/review-agent\/corrections\/apply/, label: "Guardar correcciones", heavy: false },
  { match: /\/review-agent\/corrections/, label: "Proponer correcciones", heavy: true },
  { match: /\/review-agent\/publish/, label: "Publicar", heavy: false },
  { match: /\/review-agent\/discard/, label: "Archivar", heavy: false },
  { match: /\/transfer\/suggest/, label: "Sugerir sitio con IA", heavy: true },
  { match: /\/transfer\/(planazo-to-lamira|lamira-to-planazo)/, label: "Cambiar de sitio", heavy: false },
  { match: /\/ai\/draft-expand/, label: "Agregar contenido con IA", heavy: true },
  { match: /\/ai\/draft/, label: "Generar con IA", heavy: true },
  { match: /\/ai\/improve-block/, label: "Mejorar bloque con IA", heavy: true },
  { match: /\/ai\/improve\//, label: "Mejorar con IA", heavy: true },
  { match: /\/ai\/generate-seo/, label: "Generar SEO", heavy: true },
  { match: /\/ai\/image-queries/, label: "Sugerir búsquedas de imágenes", heavy: true },
  { match: /\/ai\/news-images/, label: "Buscar fotos de notas", heavy: true },
  { match: /\/ai\/scrape-preview/, label: "Leer la nota fuente", heavy: true },
  { match: /\/ai\/(upload-image|fetch-image)/, label: "Subir imagen", heavy: false },
  { match: /\/media\/assets/, label: "Subir a la biblioteca", heavy: false },
  { match: /\/automation\/run-now/, label: "Correr automatización", heavy: false },
];

function describe(url: string, method: string): { label: string; heavy: boolean } {
  const kind = KINDS.find((k) => k.match.test(url));
  if (kind) return kind;
  return { label: method === "DELETE" ? "Eliminar" : method === "POST" ? "Procesando" : "Guardar cambios", heavy: false };
}

// ── Tareas: store de módulo (sobrevive al cambiar de página dentro del CMS) ──
export interface Task {
  id: number;
  label: string;
  heavy: boolean;
  status: "queued" | "running" | "done" | "error";
  queuedAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

let tasks: Task[] = [];
let nextId = 1;
const waiting: (() => void)[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getTasks = () => tasks;
const emptyTasks: Task[] = [];

function update(id: number, patch: Partial<Task>) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
  emit();
}

// Lugares ocupados por tareas de IA; se cuenta al dar el turno (no al marcarla
// "running"), para que dos clics en el mismo instante no se cuelen los dos.
let heavyActive = 0;

/** Espera turno si ya hay MAX_HEAVY tareas de IA trabajando. */
function acquireSlot(): Promise<void> {
  if (heavyActive < MAX_HEAVY && waiting.length === 0) {
    heavyActive++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
}

function releaseSlot() {
  heavyActive = Math.max(0, heavyActive - 1);
  // La siguiente en cola arranca con el lugar que se liberó.
  const next = waiting.shift();
  if (next) {
    heavyActive++;
    next();
  }
}

function prune() {
  const now = Date.now();
  const before = tasks.length;
  tasks = tasks.filter((t) => t.endedAt === null || now - t.endedAt < KEEP_DONE_MS);
  if (tasks.length !== before) emit();
}

function headerValue(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) return headers.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1] ?? null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? (headers as Record<string, string>)[key] : null;
}

function withoutHeader(headers: HeadersInit | undefined, name: string): HeadersInit | undefined {
  if (!headers) return headers;
  const h = new Headers(headers);
  h.delete(name);
  return h;
}

function patchFetch() {
  const w = window as Window & { __cmsFetchPatched?: boolean };
  if (w.__cmsFetchPatched) return;
  w.__cmsFetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method === "GET" || !url.startsWith(apiConfig.clientBaseUrl)) return original(input, init);

    const kind = describe(url, method);
    const custom = headerValue(init?.headers, TASK_LABEL_HEADER);
    const id = nextId++;
    tasks = [...tasks, { id, label: custom ?? kind.label, heavy: kind.heavy, status: kind.heavy ? "queued" : "running", queuedAt: Date.now(), startedAt: kind.heavy ? null : Date.now(), endedAt: null }];
    emit();
    const cleanInit = custom ? { ...init, headers: withoutHeader(init?.headers, TASK_LABEL_HEADER) } : init;

    if (kind.heavy) {
      await acquireSlot();
      update(id, { status: "running", startedAt: Date.now() });
    }
    try {
      const res = await original(input, cleanInit);
      update(id, { status: res.ok ? "done" : "error", endedAt: Date.now() });
      return res;
    } catch (err) {
      update(id, { status: "error", endedAt: Date.now() });
      throw err;
    } finally {
      if (kind.heavy) releaseSlot();
    }
  };
}

function seconds(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min`;
}

/**
 * Indicador de actividad de todo el CMS:
 * - al cambiar de página (clic en un enlace interno), una barra arriba;
 * - las acciones que van al servidor como una cola de tareas: "3 en proceso ·
 *   2 en cola", con panel para ver cada una. Las de IA corren de a
 *   MAX_HEAVY a la vez; las demás esperan su turno y arrancan solas.
 */
export function GlobalActivity() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [navigating, setNavigating] = useState(false);
  const [lastRoute, setLastRoute] = useState(routeKey);
  // Llegó la página nueva: se apaga la barra (actualización en render, no en efecto).
  if (lastRoute !== routeKey) {
    setLastRoute(routeKey);
    setNavigating(false);
  }

  const list = useSyncExternalStore(subscribe, getTasks, () => emptyTasks);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const active = list.filter((t) => t.status === "running" || t.status === "queued");
  const running = active.filter((t) => t.status === "running");
  const queued = active.filter((t) => t.status === "queued");
  // Solo se listan las terminadas que valían la pena seguir (IA) o que fallaron.
  const finished = list.filter((t) => (t.status === "done" && t.heavy) || t.status === "error").slice(-12).reverse();
  const oldestStart = Math.min(...active.map((t) => t.queuedAt));
  const busyFor = active.length ? now - oldestStart : 0;
  const showPill = (active.length > 0 && busyFor >= SHOW_AFTER_MS) || (open && list.length > 0);

  useEffect(() => {
    patchFetch();
  }, []);

  // Reloj mientras hay algo en curso o el panel está abierto (tiempos y limpieza).
  useEffect(() => {
    if (!active.length && !open) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      prune();
    }, 500);
    return () => window.clearInterval(timer);
  }, [active.length, open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setNavigating(true);
    }
    const start = () => setNavigating(true);
    const cancel = () => setNavigating(false);
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAV_START_EVENT, start);
    window.addEventListener(NAV_CANCEL_EVENT, cancel);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAV_START_EVENT, start);
      window.removeEventListener(NAV_CANCEL_EVENT, cancel);
    };
  }, []);

  useEffect(() => {
    if (!navigating) return;
    const timer = window.setTimeout(() => setNavigating(false), NAV_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [navigating]);

  // Cerrar el panel al hacer clic fuera o con Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pillText = active.length
    ? [running.length && `${running.length} en proceso`, queued.length && `${queued.length} en cola`].filter(Boolean).join(" · ")
    : "Sin tareas en curso";

  return (
    <>
      {(navigating || (active.length > 0 && busyFor >= SHOW_AFTER_MS)) && (
        <div className="cms-progress" role="progressbar" aria-label={navigating ? "Cargando página" : "Procesando"} />
      )}
      {showPill && (
        <div ref={panelRef} className="fixed top-2.5 left-1/2 z-[70] -translate-x-1/2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-live="polite"
            className="flex items-center gap-2 rounded-full bg-ink-solid px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(23,20,17,.5)]"
          >
            {active.length > 0 ? <span className="cms-spinner" aria-hidden /> : <span aria-hidden>✓</span>}
            {active.length === 1 ? running[0]?.label ?? "En cola" : pillText}
            {active.length === 1 && running[0]?.startedAt && now - running[0].startedAt >= 3000 && (
              <span className="font-normal tabular-nums opacity-70">· {seconds(now - running[0].startedAt)}</span>
            )}
            <span className="opacity-60" aria-hidden>
              {open ? "▴" : "▾"}
            </span>
          </button>

          {open && (
            <div
              role="dialog"
              aria-label="Tareas en curso"
              className="absolute top-[calc(100%+6px)] left-1/2 w-[min(380px,calc(100vw-24px))] -translate-x-1/2 rounded-[14px] border border-border bg-card p-2 text-ink shadow-[0_24px_60px_-20px_rgba(23,20,17,.45)]"
            >
              <p className="px-2 pt-1 pb-2 text-[11.5px] text-ink-faint">
                Las tareas de IA corren de {MAX_HEAVY} en {MAX_HEAVY}; las demás esperan su turno y arrancan solas. Si recargas o cierras la página, se cortan.
              </p>
              {list.length === 0 && <p className="px-2 py-3 text-center text-[12.5px] text-ink-faint">Sin tareas por ahora.</p>}
              <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
                {[...running, ...queued, ...finished].map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[12.5px]">
                    <span className="grid size-5 flex-none place-items-center" aria-hidden>
                      {t.status === "running" ? (
                        <span className="cms-spinner cms-spinner-dark" />
                      ) : t.status === "queued" ? (
                        <span className="size-2 rounded-full bg-ink-faint/50" />
                      ) : t.status === "done" ? (
                        <span className="text-positive">✓</span>
                      ) : (
                        <span className="text-negative">✕</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={t.label}>
                      {t.label}
                    </span>
                    <span className="flex-none text-[11.5px] text-ink-faint tabular-nums">
                      {t.status === "queued"
                        ? "en cola"
                        : t.status === "running"
                          ? seconds(now - (t.startedAt ?? now))
                          : t.status === "done"
                            ? `lista · ${seconds((t.endedAt ?? 0) - (t.startedAt ?? 0))}`
                            : "error"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
