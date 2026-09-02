"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiConfig } from "@planazo/config";
import { Icon } from "@/components/icon";
import { timeAgo } from "@/lib/time-ago";
import { OUTCOME_META, type AutomationRun, type AutomationQueue } from "@/lib/automation-types";

const REFRESH_ICON = "M4 4v6h6M20 20v-6h-6M4.5 15a8 8 0 0 0 14.5 3.5M19.5 9A8 8 0 0 0 5 5.5";

interface Status {
  lastCheckedAt: string | null;
  checkIntervalMinutes: number;
  activeRulesCount: number;
  isRunning: boolean;
}

/** Único bloque "real" del Dashboard (el resto son datos de ejemplo) — trae
 * el estado en vivo del motor de Automatizaciones: última revisión, la cola
 * de temas de hoy que todavía no se evalúan, y las corridas más recientes.
 * Se actualiza al montar y con el botón "Actualizar" — no hace polling solo,
 * para no generar tráfico de fondo cada vez que alguien deja el Dashboard
 * abierto. */
export function AutomationActivityCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [queue, setQueue] = useState<AutomationQueue | null>(null);
  const [runs, setRuns] = useState<AutomationRun[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, queueRes, runsRes] = await Promise.all([
        fetch(`${apiConfig.baseUrl}/cms/automation/status`, { credentials: "include" }),
        fetch(`${apiConfig.baseUrl}/cms/automation/queue`, { credentials: "include" }),
        fetch(`${apiConfig.baseUrl}/cms/automation/runs`, { credentials: "include" }),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (queueRes.ok) setQueue(await queueRes.json());
      if (runsRes.ok) setRuns(await runsRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mb-[18px] overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border-soft px-4 py-3.5">
        <span
          className={`size-[6px] flex-none rounded-full ${status?.isRunning ? "animate-[pz-pulse_1.2s_ease-in-out_infinite] bg-brand" : status?.lastCheckedAt && Date.now() - new Date(status.lastCheckedAt).getTime() < 30 * 60 * 1000 ? "bg-positive" : "bg-ink-faint"}`}
        />
        <span className="text-[13.5px] font-semibold tracking-tight">Automatizaciones en tiempo real</span>
        {status && (
          <span className="text-[11.5px] text-ink-faint">
            {status.isRunning
              ? "Ejecutando ahora…"
              : `Última revisión: ${timeAgo(status.lastCheckedAt)} · revisa cada ${status.checkIntervalMinutes} min · ${status.activeRulesCount} reglas activas`}
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Actualizar"
          className="grid size-7 flex-none place-items-center rounded-md border border-border bg-white text-ink-soft transition-colors hover:border-ink-faint disabled:cursor-default disabled:opacity-60"
        >
          <Icon d={REFRESH_ICON} size={13} strokeWidth={1.8} className={loading ? "animate-spin" : ""} />
        </button>
        <Link href="/automatizaciones" className="text-[12px] font-medium text-ink-soft hover:text-brand">
          Ver todo →
        </Link>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border-soft lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
            <span className="text-[12px] font-semibold text-ink">Cola pendiente</span>
            {queue && <span className="font-mono text-[10.5px] text-ink-faint">{queue.pending.length}</span>}
          </div>
          {!queue ? (
            <p className="px-4 pb-3.5 text-[12px] text-ink-faint">Cargando…</p>
          ) : queue.pending.length === 0 ? (
            <p className="px-4 pb-3.5 text-[12px] text-ink-faint">
              Sin temas pendientes — los {queue.alreadyHandled} de hoy ya se evaluaron.
            </p>
          ) : (
            <div className="max-h-[240px] overflow-y-auto">
              {queue.pending.slice(0, 8).map((t) => (
                <div key={t.title} className="flex items-center gap-2 border-t border-border-soft px-4 py-2 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">{t.title}</p>
                    <p className="truncate text-[11px] text-ink-faint">{t.categoryLabel}</p>
                  </div>
                  {!t.hasCandidateRule && (
                    <span className="flex-none rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">sin regla</span>
                  )}
                </div>
              ))}
              {queue.pending.length > 8 && (
                <p className="border-t border-border-soft px-4 py-2 text-[11px] text-ink-faint">+{queue.pending.length - 8} más</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
            <span className="text-[12px] font-semibold text-ink">Actividad reciente</span>
          </div>
          {!runs ? (
            <p className="px-4 pb-3.5 text-[12px] text-ink-faint">Cargando…</p>
          ) : runs.length === 0 ? (
            <p className="px-4 pb-3.5 text-[12px] text-ink-faint">Todavía no hay corridas registradas.</p>
          ) : (
            <div className="max-h-[240px] overflow-y-auto">
              {runs.slice(0, 8).map((run) => {
                const meta = OUTCOME_META[run.outcome];
                return (
                  <div key={run.id} className="flex items-center gap-2 border-t border-border-soft px-4 py-2 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-ink">{run.topic}</p>
                      <p className="truncate text-[11px] text-ink-faint">{run.ruleName ?? "—"}</p>
                    </div>
                    <span
                      className="flex-none rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium"
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
