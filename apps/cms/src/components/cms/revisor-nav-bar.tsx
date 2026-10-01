"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

/** Parámetro que marca que la pieza se abrió desde el Revisor. */
export const FROM_REVISOR = "desde=revisor";
const STORAGE_KEY = "cms-revisor-nav";

export interface RevisorNavItem {
  href: string;
  title: string;
  label: string;
}

interface RevisorNavList {
  items: RevisorNavItem[];
  /** Filtros con los que se armó la lista (ej. "Listas para publicar · Planazo"). */
  filter: string;
}

/**
 * El Revisor guarda la lista que se está viendo (con sus filtros y en su
 * orden) al abrir una pieza, para que la ficha pueda ofrecer anterior /
 * siguiente. Es una comodidad de esta pestaña: si el storage no está
 * disponible, la barra simplemente no aparece.
 */
export function saveRevisorNav(list: RevisorNavList): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Sin storage: no hay anterior/siguiente, la pieza se abre igual.
  }
}

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const subscribe = () => () => {};

export const withFromRevisor = (href: string) => `${href}?${FROM_REVISOR}`;

/** Barra de la ficha cuando se llegó desde el Revisor: posición, anterior/siguiente y volver. */
export function RevisorNavBar({ currentHref }: { currentHref: string }) {
  // El texto crudo (string) es estable entre renders; se parsea después.
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  let list: RevisorNavList | null = null;
  try {
    list = raw ? (JSON.parse(raw) as RevisorNavList) : null;
  } catch {
    list = null;
  }

  const items = list?.items ?? [];
  const index = items.findIndex((i) => i.href === currentHref);
  const prev = index > 0 ? items[index - 1] : undefined;
  const next = index >= 0 ? items[index + 1] : items[0];

  const navClass =
    "inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-card px-2.5 py-1 text-[12px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand";
  const disabledClass = "inline-flex items-center gap-1 rounded-lg border border-border-soft px-2.5 py-1 text-[12px] font-semibold text-ink-faint/60";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-brand/25 bg-accent/70 px-3 py-1.5">
      <span className="text-[12.5px] font-semibold text-accent-fg">
        <span aria-hidden>🛡 </span>
        Revisor
        {index >= 0 ? (
          <>
            {" "}
            · <span className="tabular-nums">{index + 1}</span> de <span className="tabular-nums">{items.length}</span>
          </>
        ) : items.length ? (
          " · esta pieza ya no está en la lista"
        ) : null}
        {list?.filter && <span className="font-normal text-ink-soft"> · {list.filter}</span>}
      </span>
      {items.length > 0 && (
        <span className="flex items-center gap-1.5">
          {index >= 0 &&
            (prev ? (
              <Link href={withFromRevisor(prev.href)} className={navClass} title={`Anterior: ${prev.label} · ${prev.title}`}>
                <span aria-hidden>‹</span> Anterior
              </Link>
            ) : (
              <span className={disabledClass}>
                <span aria-hidden>‹</span> Anterior
              </span>
            ))}
          {next ? (
            <Link href={withFromRevisor(next.href)} className={navClass} title={`Siguiente: ${next.label} · ${next.title}`}>
              Siguiente <span aria-hidden>›</span>
            </Link>
          ) : (
            <span className={disabledClass}>
              Siguiente <span aria-hidden>›</span>
            </span>
          )}
        </span>
      )}
      <span className="ml-auto flex items-center gap-3 text-[12px]">
        <Link href="/revisor" className="font-medium text-ink-soft hover:text-brand">
          ← Volver al Revisor
        </Link>
        <Link href={currentHref} className="font-medium text-ink-faint hover:text-ink" title="Quitar la barra del Revisor">
          Salir
        </Link>
      </span>
    </div>
  );
}
