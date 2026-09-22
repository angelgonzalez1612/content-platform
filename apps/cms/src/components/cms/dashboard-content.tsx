"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AuthUser } from "@planazo/types";
import { apiConfig } from "@planazo/config";
import { Icon } from "@/components/icon";
import { AutomationActivityCard } from "@/components/cms/automation-activity-card";
import type { DashboardStats, LastDeploy } from "@/lib/dashboard-api";
import {
  contentEditHref,
  contentTypeIcon,
  contentTypeLabel,
  daysAgoLabel,
  relativeTimeLabel,
  deployStateLabel,
} from "@/lib/dashboard-api";
import type { AutomationQueue } from "@/lib/automation-types";

function greeting(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

interface Kpi {
  label: string;
  value: string;
  delta?: string;
}

export function DashboardContent({ user }: { user: AuthUser }) {
  const now = new Date();
  const firstName = user.name.split(" ")[0];
  const rawDateLabel = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const dateLabel =
    rawDateLabel.charAt(0).toUpperCase() + rawDateLabel.slice(1);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queue, setQueue] = useState<AutomationQueue | null>(null);
  const [deploys, setDeploys] = useState<LastDeploy[] | null>(null);
  const [deployingProject, setDeployingProject] = useState<string | null>(null);
  const [deployFeedback, setDeployFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiConfig.clientBaseUrl}/cms/dashboard/stats`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DashboardStats | null) => {
        if (!cancelled && data) setStats(data);
      })
      .catch(() => {});
    fetch(`${apiConfig.clientBaseUrl}/cms/automation/queue`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AutomationQueue | null) => {
        if (!cancelled && data) setQueue(data);
      })
      .catch(() => {});
    fetch(`${apiConfig.clientBaseUrl}/cms/dashboard/deploys`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LastDeploy[] | null) => {
        if (!cancelled && data) setDeploys(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis: Kpi[] = stats
    ? [
        {
          label: "Publicados",
          value: stats.counts.published.toLocaleString("es-MX"),
        },
        {
          label: "Borradores",
          value: stats.counts.draft.toLocaleString("es-MX"),
        },
        {
          label: "En revisión",
          value: stats.counts.inReview.toLocaleString("es-MX"),
        },
        {
          label: "Programados",
          value: stats.counts.scheduled.toLocaleString("es-MX"),
        },
        {
          label: "Generados por IA",
          value: stats.aiGeneratedTotal.toLocaleString("es-MX"),
          delta: `${stats.aiGeneratedLast30Days} en 30 días`,
        },
        {
          label: "Temas pendientes",
          value: queue ? queue.pending.length.toLocaleString("es-MX") : "…",
          delta: queue ? `de ${queue.totalTopics} hoy` : undefined,
        },
      ]
    : [];

  const subtitle = stats
    ? `${dateLabel} · ${stats.counts.published} piezas publicadas${stats.counts.inReview > 0 ? ` · ${stats.counts.inReview} esperan tu revisión` : ""}.`
    : dateLabel;

  async function triggerDeploy(deploy: LastDeploy) {
    const confirmed = window.confirm(
      `¿Subir a producción ${deploy.label}? Vercel reconstruirá la versión más reciente que ya esté enviada a su rama de producción.`,
    );
    if (!confirmed) return;

    setDeployingProject(deploy.project);
    setDeployFeedback(null);
    try {
      const res = await fetch(
        `${apiConfig.clientBaseUrl}/cms/dashboard/deploys/${encodeURIComponent(deploy.project)}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!res.ok)
        throw new Error(data?.message ?? "No se pudo iniciar la publicación.");

      setDeployFeedback({
        tone: "success",
        message: `${deploy.label} se envió a Vercel. La tarjeta se actualizará al terminar.`,
      });
      setDeploys(
        (current) =>
          current?.map((item) =>
            item.project === deploy.project
              ? { ...item, state: "QUEUED" }
              : item,
          ) ?? current,
      );
    } catch (error) {
      setDeployFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la publicación.",
      });
    } finally {
      setDeployingProject(null);
    }
  }

  return (
    <div className="p-[26px] pb-[60px]">
      <div className="mb-[22px] flex items-end gap-4">
        <div>
          <h1 className="mb-1 text-[25px] font-semibold tracking-tight">
            {greeting(now.getHours())}, {firstName}
          </h1>
          <p className="text-[13.5px] text-ink-soft">{subtitle}</p>
        </div>
        <div className="flex-1" />
        <Link
          href="/centro-ia"
          className="flex items-center gap-2 rounded-[10px] bg-brand px-[15px] py-2.5 font-sans text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
        >
          <Icon
            d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z"
            size={15}
            strokeWidth={1.8}
          />
          Nuevo con IA
        </Link>
      </div>

      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px overflow-hidden rounded-[14px] border border-border bg-border">
        {(stats ? kpis : Array.from<Kpi | null>({ length: 6 })).map((k, i) => (
          <div
            key={k?.label ?? i}
            className="flex min-w-0 flex-col gap-2 bg-card px-4 pt-[15px] pb-3.5 transition-colors hover:bg-hover"
          >
            {k ? (
              <>
                <span className="text-[11.5px] text-[#8A837B]">{k.label}</span>
                <div className="flex flex-wrap items-baseline gap-[7px]">
                  <span className="text-[23px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">
                    {k.value}
                  </span>
                  {k.delta && (
                    <span className="font-mono text-[10.5px] font-medium text-[#8A837B]">
                      {k.delta}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="h-[13px] w-16 animate-pulse rounded bg-[#F3F0EC]" />
                <span className="h-[23px] w-10 animate-pulse rounded bg-[#F3F0EC]" />
              </>
            )}
          </div>
        ))}
      </div>

      <AutomationActivityCard />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(420px,1fr))] items-start gap-4">
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="flex items-center gap-2.5 border-b border-border-soft px-4 py-3.5">
              <span className="text-[13.5px] font-semibold tracking-tight">
                Publicado recientemente
              </span>
              <div className="flex-1" />
              <Link
                href="/contenido"
                className="text-[12px] text-ink-soft hover:text-brand"
              >
                Ver todo
              </Link>
            </div>
            {!stats ? (
              <p className="p-6 text-center text-[13px] text-ink-faint">
                Cargando…
              </p>
            ) : stats.recentlyCreated.length === 0 ? (
              <p className="p-6 text-center text-[13px] text-ink-faint">
                Todavía no hay contenido publicado.
              </p>
            ) : (
              stats.recentlyCreated.map((item) => (
                <Link
                  key={`${item.contentType}-${item.contentId}`}
                  href={contentEditHref(item.contentType, item.contentId)}
                  className="flex items-center gap-2.5 border-t border-border-soft px-4 py-2.5 transition-colors first:border-t-0 hover:bg-hover"
                >
                  <span aria-hidden="true">
                    {contentTypeIcon(item.contentType)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-tight">
                    {item.title}
                  </span>
                  <span
                    className="flex-none rounded font-mono text-[9.5px] text-[#8A837B]"
                    style={{ background: "#F3F0EC", padding: "1px 5px" }}
                  >
                    {contentTypeLabel(item.contentType)}
                  </span>
                  <span className="flex-none font-mono text-[10.5px] text-ink-faint">
                    {daysAgoLabel(item.at)}
                  </span>
                </Link>
              ))
            )}
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            <div className="rounded-[14px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[13.5px] font-semibold tracking-tight">
                  Sin actualizar hace más tiempo
                </span>
                {stats && (
                  <span
                    className="rounded font-mono text-[9.5px] text-warning"
                    style={{ background: "#FEF6E7", padding: "1px 5px" }}
                  >
                    {stats.staleContent.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                {!stats ? (
                  <p className="text-[12.5px] text-ink-faint">Cargando…</p>
                ) : stats.staleContent.length === 0 ? (
                  <p className="text-[12.5px] text-ink-faint">
                    Todo se ha actualizado recientemente.
                  </p>
                ) : (
                  stats.staleContent.map((u) => (
                    <Link
                      key={`${u.contentType}-${u.contentId}`}
                      href={contentEditHref(u.contentType, u.contentId)}
                      className="flex items-center gap-2.5"
                    >
                      <span className="h-[26px] w-[3px] flex-none rounded-sm bg-[#E0A020]" />
                      <div className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className="truncate text-[12.5px] font-medium">
                          {u.title}
                        </span>
                        <span className="text-[10.5px] text-ink-faint">
                          Sin actualizar hace {u.daysSinceUpdate}{" "}
                          {u.daysSinceUpdate === 1 ? "día" : "días"}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[14px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[13.5px] font-semibold tracking-tight">
                  Qué busca la gente
                </span>
                <div className="flex-1" />
                <Link
                  href="/automatizaciones"
                  className="text-[11.5px] text-ink-soft hover:text-brand"
                >
                  Ver todo
                </Link>
              </div>
              <div className="flex flex-col gap-2.5">
                {!queue ? (
                  <p className="text-[12.5px] text-ink-faint">Cargando…</p>
                ) : queue.pending.length === 0 ? (
                  <p className="text-[12.5px] text-ink-faint">
                    Sin temas pendientes por ahora.
                  </p>
                ) : (
                  queue.pending.slice(0, 4).map((o, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-[9px] border border-border-soft px-2.5 py-2"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[12.5px] font-medium">
                          {o.title}
                        </span>
                        <span className="font-mono text-[9.5px] text-ink-faint">
                          {o.categoryLabel}
                        </span>
                      </div>
                      {!o.hasCandidateRule && (
                        <span
                          className="flex-none rounded font-mono text-[9.5px] text-ink-faint"
                          style={{ background: "#F3F0EC", padding: "1px 5px" }}
                        >
                          sin regla
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-[14px] bg-ink-solid p-4 text-white">
            <div
              className="absolute -right-[30px] -bottom-10 size-[150px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(253,105,13,.5), transparent 65%)",
              }}
            />
            <div className="relative">
              <div className="mb-[11px] flex items-center gap-1.5">
                <Icon
                  d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z"
                  size={14}
                  strokeWidth={1.8}
                  className="text-brand"
                />
                <span className="text-[12.5px] font-semibold tracking-tight">
                  Resumen
                </span>
              </div>
              <p className="mb-[13px] text-[13px] leading-[1.55] text-white/78">
                {stats ? (
                  stats.counts.inReview > 0 ? (
                    <>
                      Tienes{" "}
                      <strong className="font-semibold text-white">
                        {stats.counts.inReview}{" "}
                        {stats.counts.inReview === 1 ? "pieza" : "piezas"}
                      </strong>{" "}
                      esperando tu revisión antes de publicarse — no salieron
                      solas porque no pasaron alguna checada automática
                      (longitud, SEO, foto, etc).
                    </>
                  ) : (
                    <>
                      No hay nada pendiente de revisión ahora mismo — todo lo
                      que se generó pasó las checadas automáticas.
                    </>
                  )
                ) : (
                  "Cargando…"
                )}
              </p>
              <div className="flex gap-1.5">
                <Link
                  href="/contenido"
                  className="rounded-lg bg-brand px-3 py-[7px] font-sans text-[12px] font-semibold text-white"
                >
                  Ver contenido
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <span className="mb-3 block text-[13.5px] font-semibold tracking-tight">
              Alertas
            </span>
            <div className="flex flex-col gap-2.5">
              {!stats ? (
                <p className="text-[12.5px] text-ink-faint">Cargando…</p>
              ) : stats.alerts.length === 0 ? (
                <p className="text-[12.5px] text-ink-faint">
                  Sin alertas por ahora.
                </p>
              ) : (
                stats.alerts.map((al, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span
                      className="mt-px flex size-4 flex-none items-center justify-center rounded-[5px] text-[10px] font-bold"
                      style={{ background: "#FEF6E7", color: "#9A6B12" }}
                    >
                      !
                    </span>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-[12.5px] leading-[1.35] font-medium">
                        {al.title}
                      </span>
                      <span className="text-[11px] leading-[1.4] text-ink-faint">
                        {al.meta}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[13.5px] font-semibold tracking-tight">
                Última subida a prod
              </span>
              <span className="flex-1" />
              <span className="text-[10.5px] text-ink-faint">
                Publica la rama prod
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {!deploys ? (
                <p className="text-[12.5px] text-ink-faint">Cargando…</p>
              ) : deploys.every(
                  (d) => d.deployedAt === null && d.state === null,
                ) ? (
                <p className="text-[12.5px] text-ink-faint">
                  No configurado — falta{" "}
                  <code className="font-mono text-[11px]">
                    VERCEL_API_TOKEN
                  </code>{" "}
                  en el servidor.
                </p>
              ) : (
                deploys.map((d) => (
                  <div key={d.project} className="flex items-center gap-2.5">
                    <span
                      className="size-1.5 flex-none rounded-full"
                      style={{
                        background:
                          d.state === "READY"
                            ? "#2E9B4F"
                            : d.state === "ERROR" || d.state === "error"
                              ? "#D14343"
                              : "#8A837B",
                      }}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="text-[12.5px] font-medium">
                        {d.label}
                      </span>
                      <span className="text-[10.5px] text-ink-faint">
                        {deployStateLabel(d.state)}
                      </span>
                    </div>
                    <span className="flex-none font-mono text-[10.5px] text-ink-faint">
                      {d.deployedAt ? relativeTimeLabel(d.deployedAt) : "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => triggerDeploy(d)}
                      disabled={deployingProject !== null}
                      className="flex-none rounded-md border border-border px-2 py-1 text-[10.5px] font-semibold text-ink-soft transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-50"
                    >
                      {deployingProject === d.project
                        ? "Enviando…"
                        : "Subir cambios"}
                    </button>
                  </div>
                ))
              )}
            </div>
            {deployFeedback && (
              <p
                role="status"
                className={`mt-3 text-[11px] leading-[1.4] ${deployFeedback.tone === "success" ? "text-positive" : "text-negative"}`}
              >
                {deployFeedback.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
