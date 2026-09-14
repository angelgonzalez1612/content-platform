"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiConfig, siteConfig } from "@planazo/config";
import { Icon } from "@/components/icon";
import { ViewPublishedLink } from "@/components/cms/view-published-link";
import { timeAgo } from "@/lib/time-ago";
import { LAMIRA_TYPE_PATH } from "@/lib/lamira-paths";
import type { AutomatableContentType, AutomationRule, AutomationRun, AutomationQueue } from "@/lib/automation-types";
import { OUTCOME_META } from "@/lib/automation-types";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

const EDIT_PATH: Partial<Record<AutomatableContentType, string>> = {
  noticia: "lamira/noticia",
  alerta: "lamira/alerta",
  reportaje: "lamira/reportaje",
  "evento-planazo": "planazo-evento",
};
// Segmento de ruta pública de Planazo por tipo — equivalente a LAMIRA_TYPE_PATH
// pero solo cubre los 2 tipos de Planazo que la automatización puede crear.
const PLANAZO_TYPE_PATH: Partial<Record<AutomatableContentType, string>> = {
  place: "lugares",
  "evento-planazo": "eventos",
};

function contentHref(contentType: string | null, contentId: string | null): string | null {
  if (!contentType || !contentId) return null;
  if (contentType === "place") return `/contenido/${contentId}`;
  const path = EDIT_PATH[contentType as AutomatableContentType];
  return path ? `/contenido/${path}/${contentId}` : null;
}

// URL pública real (La Mira/Planazo en vivo) para una corrida ya publicada —
// distinto de contentHref, que apunta al editor del CMS. Solo aplica cuando
// outcome === 'published' (un borrador todavía no está vivo en el sitio).
function publicUrl(run: AutomationRun): string | null {
  if (!run.contentType || !run.contentSlug) return null;
  const type = run.contentType as AutomatableContentType;
  if (run.site === "la-mira") {
    const path = LAMIRA_TYPE_PATH[type];
    return path ? `${siteConfig.lamiraUrl}/${path}/${run.contentSlug}` : null;
  }
  if (run.site === "planazo") {
    const path = PLANAZO_TYPE_PATH[type];
    return path ? `${siteConfig.planazoUrl}/${path}/${run.contentSlug}` : null;
  }
  return null;
}

/** Sección separada de Reglas (ver /automatizaciones) — "Qué busca la gente"
 * es una fuente de contenido más arriesgada (sin artículo que citar, la IA
 * redacta directo respondiendo la intención de búsqueda), así que vive en su
 * propia pantalla en vez de compartir una con las reglas de la automatización
 * normal. "Ejecutar ahora" dispara la misma corrida que en Reglas — incluye
 * las frases si alguna regla activa las tiene marcadas. */
export function PhrasesView({
  initialRules,
  initialRuns,
  initialStatus,
}: {
  initialRules: AutomationRule[];
  initialRuns: AutomationRun[];
  initialStatus: { lastCheckedAt: string | null; checkIntervalMinutes: number };
}) {
  const [rules, setRules] = useState(initialRules);
  const [runs, setRuns] = useState(initialRuns);
  const [status, setStatus] = useState(initialStatus);
  const [queue, setQueue] = useState<AutomationQueue | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ evaluated: number; created: number } | null>(null);
  const [siteFilter, setSiteFilter] = useState<"all" | "la-mira" | "planazo">("all");
  const [tab, setTab] = useState<"pending" | "processed">("pending");

  async function refreshAll() {
    const [rulesRes, runsRes, statusRes, queueRes] = await Promise.all([
      fetch(`${apiConfig.clientBaseUrl}/cms/automation/rules`, { credentials: "include" }),
      fetch(`${apiConfig.clientBaseUrl}/cms/automation/runs`, { credentials: "include" }),
      fetch(`${apiConfig.clientBaseUrl}/cms/automation/status`, { credentials: "include" }),
      fetch(`${apiConfig.clientBaseUrl}/cms/automation/queue`, { credentials: "include" }),
    ]);
    if (rulesRes.ok) setRules(await rulesRes.json());
    if (runsRes.ok) setRuns(await runsRes.json());
    if (statusRes.ok) setStatus(await statusRes.json());
    if (queueRes.ok) setQueue(await queueRes.json());
  }

  useEffect(() => {
    fetch(`${apiConfig.clientBaseUrl}/cms/automation/queue`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setQueue(data));
  }, []);

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/automation/run-now`, { method: "POST", credentials: "include" });
      if (res.ok) setRunResult(await res.json());
      await refreshAll();
    } finally {
      setRunning(false);
    }
  }

  const phrasePendingAll = queue?.pending.filter((p) => p.source === "search-phrase") ?? [];
  const phraseRunsAll = runs.filter((r) => r.source === "search-phrase");
  const rulesWithPhrases = rules.filter((r) => r.includeSearchPhrases);

  const siteTabs = [
    { key: "all" as const, label: "Todos", count: phraseRunsAll.length },
    { key: "la-mira" as const, label: "La Mira", count: phraseRunsAll.filter((r) => r.site === "la-mira").length },
    { key: "planazo" as const, label: "Planazo", count: phraseRunsAll.filter((r) => r.site === "planazo").length },
  ].filter((t) => t.key === "all" || t.count > 0);

  const phrasePending = phrasePendingAll;
  const phraseRuns = siteFilter === "all" ? phraseRunsAll : phraseRunsAll.filter((r) => r.site === siteFilter);

  return (
    <div className="p-[26px] pb-[60px]">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Frases de búsqueda</h1>
          <p className="flex items-center gap-1.5 text-[12px] text-ink-faint">
            <span className={`size-[6px] rounded-full ${status.lastCheckedAt && Date.now() - new Date(status.lastCheckedAt).getTime() < 30 * 60 * 1000 ? "bg-positive" : "bg-ink-faint"}`} />
            Última revisión: {timeAgo(status.lastCheckedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={running}
          className="flex flex-none items-center gap-2 rounded-[10px] border border-border bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-colors hover:border-ink-faint disabled:cursor-default disabled:opacity-60"
        >
          <Icon d={SPARK_ICON} size={14} strokeWidth={1.8} className={running ? "animate-spin text-brand" : "text-brand"} />
          {running ? "Ejecutando…" : "Ejecutar ahora"}
        </button>
      </div>

      {runResult && (
        <p className="mb-5 rounded-lg bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-fg">
          Corrida terminada: {runResult.evaluated} tema(s) evaluados, {runResult.created} pieza(s) creada(s).
        </p>
      )}

      <div className="max-w-[720px] flex flex-col overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
        <div className="border-b border-border-soft px-5 py-3.5">
          <h2 className="text-[15px] font-semibold tracking-tight">Qué busca la gente (frases reales)</h2>
          <p className="mt-0.5 text-[11.5px] leading-[1.4] text-ink-faint">
            Frases reales de autocompletado de Google, tomadas del reporte de Content Radar — sin artículo que citar, la IA redacta
            directo respondiendo la intención de búsqueda.{" "}
            {rulesWithPhrases.length === 0
              ? "Ninguna regla las incluye todavía — actívalo en Reglas de automatización."
              : `${rulesWithPhrases.length} regla(s) las incluye(n): ${rulesWithPhrases.map((r) => r.name).join(", ")}.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-border-soft px-3 py-2.5">
          {siteTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSiteFilter(t.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                siteFilter === t.key ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 font-mono text-[10.5px] ${siteFilter === t.key ? "bg-white/60" : "bg-background text-ink-faint"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 border-b border-border-soft px-4 py-2.5">
          <button
            type="button"
            onClick={() => setTab("pending")}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
              tab === "pending" ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
            }`}
          >
            Pendientes de hoy
            <span className={`rounded-full px-1.5 font-mono text-[10.5px] ${tab === "pending" ? "bg-white/60" : "bg-background text-ink-faint"}`}>
              {phrasePending.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("processed")}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
              tab === "processed" ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
            }`}
          >
            Ya procesadas
            <span className={`rounded-full px-1.5 font-mono text-[10.5px] ${tab === "processed" ? "bg-white/60" : "bg-background text-ink-faint"}`}>
              {phraseRuns.length}
            </span>
          </button>
        </div>

        {tab === "pending" ? (
          !queue ? (
            <p className="px-4 py-3.5 text-[12px] text-ink-faint">Cargando…</p>
          ) : phrasePending.length === 0 ? (
            <p className="px-4 py-3.5 text-[12px] text-ink-faint">
              Sin frases pendientes hoy — o ya se evaluaron todas, o ninguna regla activa las incluye.
            </p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {phrasePending.map((p) => (
                <div key={p.title} className="flex items-center gap-2 border-b border-border-soft px-4 py-2 last:border-b-0">
                  <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{p.title}</p>
                  {!p.hasCandidateRule && (
                    <span className="flex-none rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">sin regla</span>
                  )}
                </div>
              ))}
            </div>
          )
        ) : phraseRuns.length === 0 ? (
          <p className="px-4 py-3.5 text-[12px] text-ink-faint">Todavía no se ha generado contenido a partir de estas frases.</p>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {phraseRuns.slice(0, 30).map((run) => {
              const meta = OUTCOME_META[run.outcome];
              const live = run.outcome === "published" ? publicUrl(run) : null;
              const href = !live ? contentHref(run.contentType, run.contentId) : null;
              return (
                <div key={run.id} className="flex items-center gap-2 border-b border-border-soft px-4 py-2 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">{run.topic}</p>
                    <p className="truncate text-[11px] text-ink-faint">{run.ruleName ?? "—"}</p>
                  </div>
                  <span className="flex-none rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium" style={{ background: meta.bg, color: meta.fg }}>
                    {meta.label}
                  </span>
                  {live ? (
                    <ViewPublishedLink compact href={live} available />
                  ) : (
                    href && (
                      <Link href={href} className="flex-none text-[12px] font-medium text-brand hover:text-brand-pressed">
                        Ver →
                      </Link>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
