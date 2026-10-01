"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { apiConfig } from "@planazo/config";

/** Eventos para quien navega o cancela una navegación por su cuenta (ver UnsavedChangesGuard). */
export const NAV_START_EVENT = "cms:navigation-start";
export const NAV_CANCEL_EVENT = "cms:navigation-cancel";

// Tras cuánto se muestra "Procesando…": las acciones rápidas no parpadean.
const SHOW_AFTER_MS = 400;
// Si una navegación nunca llega (error de red), la barra no se queda para siempre.
const NAV_TIMEOUT_MS = 15_000;

// ── Acciones en curso: fetch al API que no son GET (guardar, publicar, IA…) ──
let inFlight = 0;
let startedAt: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getStartedAt = () => startedAt;

function patchFetch() {
  const w = window as Window & { __cmsFetchPatched?: boolean };
  if (w.__cmsFetchPatched) return;
  w.__cmsFetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const tracked = method !== "GET" && url.startsWith(apiConfig.clientBaseUrl);
    if (!tracked) return original(input, init);
    inFlight++;
    if (inFlight === 1) startedAt = Date.now();
    emit();
    try {
      return await original(input, init);
    } finally {
      inFlight = Math.max(0, inFlight - 1);
      if (inFlight === 0) startedAt = null;
      emit();
    }
  };
}

/**
 * Indicador de actividad de todo el CMS:
 * - al cambiar de página (clic en un enlace interno), una barra arriba en
 *   cuanto se hace clic — el App Router no da ninguna señal hasta que llega
 *   la página nueva y se sentía como si el clic no hubiera servido;
 * - mientras una acción va al servidor (guardar, publicar, generar con IA…)
 *   y tarda, la misma barra y un aviso "Procesando…" con el tiempo que lleva.
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

  const actionStartedAt = useSyncExternalStore(subscribe, getStartedAt, () => null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    patchFetch();
  }, []);

  // Reloj solo mientras hay una acción en curso (para el "· 12 s").
  useEffect(() => {
    if (actionStartedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [actionStartedAt]);

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

  const actionElapsed = actionStartedAt === null ? 0 : Math.max(0, now - actionStartedAt);
  const showAction = actionStartedAt !== null && actionElapsed >= SHOW_AFTER_MS;
  const seconds = Math.floor(actionElapsed / 1000);

  return (
    <>
      {(navigating || showAction) && <div className="cms-progress" role="progressbar" aria-label={navigating ? "Cargando página" : "Procesando"} />}
      {showAction && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed top-2.5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink-solid px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(23,20,17,.5)]"
        >
          <span className="cms-spinner" aria-hidden />
          Procesando…
          {seconds >= 3 && <span className="font-normal tabular-nums opacity-70">· {seconds} s</span>}
        </div>
      )}
    </>
  );
}
