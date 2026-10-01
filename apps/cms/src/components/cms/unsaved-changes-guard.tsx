"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_CANCEL_EVENT, NAV_START_EVENT } from "@/components/cms/global-activity";

/**
 * Avisa antes de perder cambios sin guardar:
 * - cerrar la pestaña / recargar → aviso nativo del navegador (beforeunload);
 * - salir por un enlace del CMS (menú, Contenido, siguiente en revisión…) →
 *   modal propio para seguir editando o salir sin guardar.
 * El App Router no tiene un evento para bloquear la navegación, así que se
 * interceptan los clics en enlaces internos en fase de captura.
 */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!when) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = ""; // Chrome/Edge aún lo piden para mostrar el aviso
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return; // se abre en otra pestaña: no se pierde nada
      if (anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return; // sitio externo en la misma pestaña: lo cubre beforeunload
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // mismo lugar (#ancla)
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
      dialogRef.current?.showModal();
      // La barra de carga global ya arrancó con este clic: se apaga mientras decide.
      window.dispatchEvent(new Event(NAV_CANCEL_EVENT));
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [when]);

  function leave() {
    const href = pendingHref;
    dialogRef.current?.close();
    if (href) {
      window.dispatchEvent(new Event(NAV_START_EVENT));
      router.push(href);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="unsaved-dialog-title"
      onClose={() => setPendingHref(null)}
      className="m-auto w-[min(420px,calc(100vw-32px))] rounded-[14px] border border-border bg-card p-0 text-ink shadow-[0_24px_60px_-20px_rgba(23,20,17,.45)] backdrop:bg-ink-solid/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-full bg-warning/14 text-warning" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="unsaved-dialog-title" className="text-[15px] font-semibold tracking-tight">
              Tienes cambios sin guardar
            </h2>
            <p className="mt-1 text-[13px] leading-[1.5] text-ink-soft">Si sales ahora, se pierde lo que cambiaste en esta pieza desde la última vez que guardaste.</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border-soft bg-background px-5 py-3">
        <button
          type="button"
          onClick={leave}
          className="rounded-[10px] px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-negative/10 hover:text-negative"
        >
          Salir sin guardar
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => dialogRef.current?.close()}
          className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-pressed"
        >
          Seguir editando
        </button>
      </div>
    </dialog>
  );
}
