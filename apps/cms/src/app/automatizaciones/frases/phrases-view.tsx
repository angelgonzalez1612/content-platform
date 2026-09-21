"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiConfig, siteConfig } from "@planazo/config";
import { Icon } from "@/components/icon";
import { ViewPublishedLink } from "@/components/cms/view-published-link";
import { timeAgo } from "@/lib/time-ago";
import { LAMIRA_TYPE_PATH } from "@/lib/lamira-paths";
import type { AutomatableContentType, AutomationRule, AutomationRun, SearchPhrase } from "@/lib/automation-types";
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

const STATUS_META: Record<SearchPhrase["status"], { label: string; bg: string; fg: string }> = {
  pending: { label: "Sin buscar ligas", bg: "#F3F0EC", fg: "#8A837B" },
  researched: { label: "Con ligas", bg: "#EAF7EF", fg: "#2E9E5B" },
  used: { label: "Usada", bg: "#F3F0EC", fg: "#8A837B" },
  discarded: { label: "Descartada", bg: "#F3F0EC", fg: "#8A837B" },
};

/** Fila de una frase guardada — buscar ligas reales (Google Programmable
 * Search) y, si el humano elige una, mandarla a Centro IA con esa liga como
 * fuente citada (mismo flujo exacto que el botón "Publicar" de Content
 * Radar, ver PublishFlow) — la IA nunca decide sola qué fuente usar. */
function PhraseRow({ phrase, onChanged }: { phrase: SearchPhrase; onChanged: (updated: SearchPhrase) => void }) {
  const router = useRouter();
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState("");

  async function handleResearch() {
    setResearching(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/automation/search-phrases/${phrase.id}/research`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo buscar.");
        return;
      }
      onChanged(await res.json());
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setResearching(false);
    }
  }

  async function handleUse(link: SearchPhrase["candidateLinks"][number]) {
    await fetch(`${apiConfig.clientBaseUrl}/cms/automation/search-phrases/${phrase.id}/use`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: link.url }),
    });
    // Mismo formato que content-radar deja en `hints` (— Fuente (url)) — así
    // AiDraftService.scrapeSourceFromHints/sourceLabelFromHints lo reconoce
    // igual que un tema con artículo real (ver ai-draft.service.ts).
    const hints = `${link.snippet ? `${link.snippet} ` : ""}— ${link.title} (${link.url})`;
    router.push(`/centro-ia?name=${encodeURIComponent(phrase.phrase)}&hints=${encodeURIComponent(hints)}`);
  }

  async function handleDiscard() {
    await fetch(`${apiConfig.clientBaseUrl}/cms/automation/search-phrases/${phrase.id}/discard`, { method: "POST", credentials: "include" });
    onChanged({ ...phrase, status: "discarded" });
  }

  const meta = STATUS_META[phrase.status];

  return (
    <div className="flex flex-col gap-2 border-b border-border-soft px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{phrase.phrase}</p>
        <span className="flex-none rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium" style={{ background: meta.bg, color: meta.fg }}>
          {meta.label}
        </span>
        {phrase.status === "pending" && (
          <button
            type="button"
            onClick={handleResearch}
            disabled={researching}
            className="flex flex-none items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-70"
          >
            <Icon d={SPARK_ICON} size={11} strokeWidth={1.8} className={researching ? "animate-spin" : ""} />
            {researching ? "Buscando…" : "Buscar ligas"}
          </button>
        )}
        <button type="button" onClick={handleDiscard} className="flex-none text-[11.5px] font-medium text-ink-faint hover:text-negative">
          Descartar
        </button>
      </div>

      {error && <p className="text-[11.5px] font-medium text-[#C4453A]">{error}</p>}

      {phrase.status === "researched" && (
        <div className="flex flex-col gap-1.5 pl-1">
          {phrase.candidateLinks.length === 0 ? (
            <p className="text-[11.5px] text-ink-faint">
              La búsqueda no encontró ligas reales para esta frase.{" "}
              <button type="button" onClick={handleResearch} className="font-medium text-brand hover:text-brand-pressed">
                Reintentar
              </button>
            </p>
          ) : (
            phrase.candidateLinks.map((link) => (
              <div key={link.url} className="flex items-start gap-2 rounded-lg border border-border-soft bg-background p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-ink">{link.title}</p>
                  <p className="truncate text-[11px] text-ink-faint">{link.url}</p>
                  {link.snippet && <p className="line-clamp-2 text-[11px] text-ink-soft">{link.snippet}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleUse(link)}
                  className="flex-none rounded-lg bg-brand px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-pressed"
                >
                  Usar esta liga →
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Sección separada de Reglas (ver /automatizaciones) — "Qué busca la gente"
 * es una fuente de contenido más arriesgada (sin artículo que citar), así
 * que vive en su propia pantalla en vez de compartir una con las reglas de
 * la automatización normal. "Ejecutar ahora" dispara la misma corrida que en
 * Reglas — incluye las frases si alguna regla activa las tiene marcadas. */
export function PhrasesView({
  initialRules,
  initialRuns,
  initialStatus,
  initialSearchPhrases,
}: {
  initialRules: AutomationRule[];
  initialRuns: AutomationRun[];
  initialStatus: { lastCheckedAt: string | null; checkIntervalMinutes: number };
  initialSearchPhrases: SearchPhrase[];
}) {
  const [rules] = useState(initialRules);
  const [runs, setRuns] = useState(initialRuns);
  const [status, setStatus] = useState(initialStatus);
  const [searchPhrases, setSearchPhrases] = useState(initialSearchPhrases);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ evaluated: number; created: number } | null>(null);
  const [siteFilter, setSiteFilter] = useState<"all" | "la-mira" | "planazo">("all");

  async function refreshAll() {
    const [runsRes, statusRes, phrasesRes] = await Promise.all([
      fetch(`${apiConfig.clientBaseUrl}/cms/automation/runs`, { credentials: "include" }),
      fetch(`${apiConfig.clientBaseUrl}/cms/automation/status`, { credentials: "include" }),
      fetch(`${apiConfig.clientBaseUrl}/cms/automation/search-phrases`, { credentials: "include" }),
    ]);
    if (runsRes.ok) setRuns(await runsRes.json());
    if (statusRes.ok) setStatus(await statusRes.json());
    if (phrasesRes.ok) setSearchPhrases(await phrasesRes.json());
  }

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

  function updatePhrase(updated: SearchPhrase) {
    setSearchPhrases((prev) => prev.map((p) => (p.id === updated.id ? updated : p)).filter((p) => p.status !== "discarded"));
  }

  const visiblePhrases = searchPhrases.filter((p) => p.status !== "used" && p.status !== "discarded");
  const rulesWithPhrases = rules.filter((r) => r.includeSearchPhrases);
  const phraseRunsAll = runs.filter((r) => r.source === "search-phrase");

  const siteTabs = [
    { key: "all" as const, label: "Todos", count: phraseRunsAll.length },
    { key: "la-mira" as const, label: "La Mira", count: phraseRunsAll.filter((r) => r.site === "la-mira").length },
    { key: "planazo" as const, label: "Planazo", count: phraseRunsAll.filter((r) => r.site === "planazo").length },
  ].filter((t) => t.key === "all" || t.count > 0);

  const phraseRuns = siteFilter === "all" ? phraseRunsAll : phraseRunsAll.filter((r) => r.site === siteFilter);

  return (
    <div className="p-[26px] pb-[60px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          <div className="border-b border-border-soft px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Frases guardadas <span className="font-mono text-[12px] font-normal text-ink-faint">({visiblePhrases.length})</span>
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-[1.4] text-ink-faint">
              Frases reales de autocompletado de Google, tomadas del reporte de Content Radar. Búscales ligas reales
              y elige una para generar contenido citándola — aplica para La Mira o Planazo, lo decide la IA al
              clasificar.{" "}
              {rulesWithPhrases.length === 0
                ? "Ninguna regla las incluye todavía para publicarse solas."
                : `${rulesWithPhrases.length} regla(s) también las incluye(n) para publicarse solas: ${rulesWithPhrases.map((r) => r.name).join(", ")}.`}
            </p>
          </div>

          {visiblePhrases.length === 0 ? (
            <p className="px-4 py-3.5 text-[12px] text-ink-faint">
              Sin frases guardadas todavía — se acumulan solas cada vez que corre la automatización.
            </p>
          ) : (
            <div className="max-h-[560px] overflow-y-auto">
              {visiblePhrases.map((phrase) => (
                <PhraseRow key={phrase.id} phrase={phrase} onChanged={updatePhrase} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          <div className="flex items-center justify-between border-b border-border-soft px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight">Ya procesadas (automático)</h2>
            {phraseRunsAll.length > 0 && <span className="font-mono text-[11px] text-ink-faint">{phraseRunsAll.length}</span>}
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

          {phraseRuns.length === 0 ? (
            <p className="px-4 py-3.5 text-[12px] text-ink-faint">Todavía no se ha generado contenido automático a partir de estas frases.</p>
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
    </div>
  );
}
