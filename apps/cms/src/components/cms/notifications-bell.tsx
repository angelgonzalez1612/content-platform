"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { timeAgo } from "@/lib/time-ago";
import type { CmsNotification } from "@/lib/automation-types";

const BELL_ICON = "M12 4a5.5 5.5 0 0 0-5.5 5.5c0 4-1.5 5.5-1.5 5.5h14s-1.5-1.5-1.5-5.5A5.5 5.5 0 0 0 12 4zM10 18.5a2 2 0 0 0 4 0";

const SEVERITY_META: Record<CmsNotification["severity"], { icon: string; tone: string; label: string }> = {
  critical: {
    icon: "M12 9v4M12 17h.01M10.3 4.3 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z",
    tone: "bg-negative/12 text-negative",
    label: "Crítico",
  },
  warning: {
    icon: "M12 8v5M12 16.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    tone: "bg-warning/14 text-warning",
    label: "Atención",
  },
  resolved: {
    icon: "M5 12.5l4.5 4.5L19 7.5",
    tone: "bg-positive/12 text-positive",
    label: "Resuelto",
  },
};

// "Leído" es una comodidad por navegador: si el storage no está disponible
// (modo privado, bloqueado), todo se ve como no leído y el panel sigue igual.
const READ_STORAGE_KEY = "cms-notifications-read";
const MAX_READ_IDS = 100;

function loadReadIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids].slice(-MAX_READ_IDS)));
  } catch {
    // Sin storage: el estado de leído dura solo esta visita.
  }
}

export function NotificationsBell({ notifications }: { notifications: CmsNotification[] }) {
  const [open, setOpen] = useState(false);
  // Sin riesgo de hydration mismatch: las notificaciones llegan después de
  // montar (fetch en el topbar), así que en SSR/hidratación no hay badge que
  // dependa de este estado.
  const [readIds, setReadIds] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : loadReadIds()));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const unread = useMemo(() => notifications.filter((n) => !readIds.has(n.id)), [notifications, readIds]);
  const hasUnreadCritical = unread.some((n) => n.severity === "critical");

  function markRead(ids: string[]) {
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveReadIds(next);
      return next;
    });
  }

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread.length ? `Notificaciones, ${unread.length} sin leer` : "Notificaciones"}
        title="Notificaciones"
        className={`relative grid size-8 place-items-center rounded-lg border bg-card transition-colors ${
          open ? "border-ink-faint text-ink" : "border-border text-ink-soft hover:border-[#E0DBD4]"
        }`}
      >
        <Icon d={BELL_ICON} />
        {unread.length > 0 && (
          <span
            className={`absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-card px-[3px] text-[9.5px] leading-none font-bold text-white tabular-nums ${
              hasUnreadCritical ? "bg-negative" : "bg-brand"
            }`}
          >
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute top-[calc(100%+8px)] right-0 z-50 w-[min(380px,calc(100vw-24px))] origin-top-right animate-[pz-in_.18s_cubic-bezier(.22,1,.36,1)] overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_16px_36px_-12px_rgba(23,20,17,.22)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[13.5px] font-semibold tracking-tight">Notificaciones</h2>
              {unread.length > 0 && <span className="text-[11.5px] text-ink-faint tabular-nums">{unread.length} sin leer</span>}
            </div>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => markRead(unread.map((n) => n.id))}
                className="rounded-md px-1.5 py-1 text-[11.5px] font-medium text-brand transition-colors hover:bg-accent"
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
              <span className="grid size-9 place-items-center rounded-full bg-positive/12 text-positive">
                <Icon d={SEVERITY_META.resolved.icon} size={16} strokeWidth={2} />
              </span>
              <p className="text-[13px] font-semibold text-ink">Todo en orden</p>
              <p className="max-w-[34ch] text-[12px] leading-[1.5] text-ink-soft">
                Aquí aparece un aviso si un proveedor de IA se queda sin tokens, si la automatización deja de revisar o si fallan temas al
                generarse.
              </p>
            </div>
          ) : (
            <ul className="max-h-[min(440px,70vh)] overflow-y-auto py-1">
              {notifications.map((n) => {
                const meta = SEVERITY_META[n.severity];
                const isUnread = !readIds.has(n.id);
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => {
                        markRead([n.id]);
                        setOpen(false);
                      }}
                      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-hover ${isUnread ? "" : "opacity-70"}`}
                    >
                      <span className={`mt-0.5 grid size-7 flex-none place-items-center rounded-full ${meta.tone}`} title={meta.label}>
                        <Icon d={meta.icon} size={14} strokeWidth={2} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`text-[13px] leading-[1.35] text-ink ${isUnread ? "font-semibold" : "font-medium"}`}>{n.title}</span>
                          {isUnread && <span className="mt-1.5 size-[7px] flex-none rounded-full bg-brand" aria-label="Sin leer" />}
                        </span>
                        <span className="line-clamp-2 text-[12px] leading-[1.45] text-ink-soft">{n.detail}</span>
                        <span className="text-[11px] text-ink-faint">{timeAgo(n.at)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
