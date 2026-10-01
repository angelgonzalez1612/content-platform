"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { apiConfig } from "@planazo/config";
import type { AiReview, Readiness, ReviewQueueItem, ReviewableType } from "@/lib/review-agent-types";
import { useAiSettings } from "@/lib/use-openai-available";
import { CorrectionsPanel } from "./corrections-panel";

type ProviderId = "codex-cli" | "claude-cli" | "openai";
const PROVIDER_LABEL: Record<ProviderId, string> = { "codex-cli": "Codex", "claude-cli": "Claude", openai: "OpenAI" };

const TYPE_LABEL: Record<ReviewableType, string> = {
  noticia: "Noticia",
  reportaje: "Reportaje",
  guia: "Guía",
  place: "Lugar",
  "evento-planazo": "Evento",
  "planazo-guia": "Guía",
};

const READINESS: Record<Readiness, { label: string; hint: string; className: string; dot: string }> = {
  lista: { label: "Lista", hint: "Cumple todo lo importante", className: "bg-positive/12 text-positive", dot: "bg-positive" },
  casi: { label: "Casi", hint: "Publicable, con detalles por mejorar", className: "bg-warning/14 text-warning", dot: "bg-warning" },
  falta: { label: "Le falta", hint: "No cumple algo bloqueante", className: "bg-negative/10 text-negative", dot: "bg-negative" },
};

const VERDICT: Record<AiReview["veredicto"], { label: string; className: string }> = {
  publicar: { label: "IA: publicar", className: "border-positive/30 bg-positive/10 text-positive" },
  corregir: { label: "IA: corregir", className: "border-warning/30 bg-warning/10 text-warning" },
  descartar: { label: "IA: descartar", className: "border-negative/30 bg-negative/10 text-negative" },
};

// Tope del análisis en lote: con Codex/Claude cada pieza tarda ~10-30 s.
const BATCH_LIMIT = 25;

interface SavedAi {
  review: AiReview;
  reviewedAt: string;
  /** La pieza cambió después de esta revisión. */
  stale: boolean;
}
type AiState = SavedAi | { error: string };
type SiteFilter = "all" | "la-mira" | "planazo";

const keyOf = (item: { type: string; id: string }) => `${item.type}:${item.id}`;
const isAiReview = (s: AiState | undefined): s is SavedAi => !!s && typeof s === "object" && "review" in s;
const publishable = (item: ReviewQueueItem) => item.checks.every((c) => !c.blocking || c.passed);

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

async function analyzeOne(item: ReviewQueueItem, provider: ProviderId): Promise<AiState> {
  try {
    const res = await fetch(`${apiConfig.clientBaseUrl}/cms/review-agent/analyze`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: item.type, id: item.id, provider }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { error: body?.message ?? "La IA no pudo revisarla." };
    }
    const data = (await res.json()) as AiReview & { reviewedAt: string };
    return { review: data, reviewedAt: data.reviewedAt, stale: false };
  } catch {
    return { error: "Sin conexión con el servidor." };
  }
}

/**
 * Revisor: la cola de borradores/en revisión de los dos sitios, revisada
 * contra criterios medibles (imagen, largo, idioma, encaje, fuente, SEO…) y,
 * a pedido, por la IA. Publicar siempre es un clic del editor.
 */
export function ReviewerView({ initialQueue }: { initialQueue: ReviewQueueItem[] | null }) {
  const [queue, setQueue] = useState<ReviewQueueItem[]>(initialQueue ?? []);
  // Proveedor de IA del Revisor: el predeterminado de Configuración hasta que el
  // editor elija otro. Elegido a mano = solo ese, sin pasar al de respaldo.
  const settings = useAiSettings();
  const [chosenProvider, setChosenProvider] = useState<ProviderId | null>(null);
  const providers: ProviderId[] = (["codex-cli", "claude-cli", "openai"] as const).filter((p) => p !== "openai" || settings?.openaiAvailable === true);
  const provider: ProviderId = chosenProvider ?? settings?.defaultProvider ?? "codex-cli";
  const [site, setSite] = useState<SiteFilter>("all");
  const [readiness, setReadiness] = useState<Readiness | "all">("lista");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  // Arranca con las revisiones guardadas en el servidor: no se pierden al salir de la página.
  const [ai, setAi] = useState<Record<string, AiState>>(() =>
    Object.fromEntries((initialQueue ?? []).filter((i) => i.ai).map((i) => [keyOf(i), { ...i.ai! }])),
  );
  // Cargando / error van aparte: si un reintento falla, la revisión anterior se conserva.
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const cancelBatch = useRef(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string; details?: string[] } | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  // "Arreglar": qué criterio se está arreglando en cada pieza, y qué se hizo.
  const [fixing, setFixing] = useState<Record<string, string>>({});
  const [fixNotes, setFixNotes] = useState<Record<string, { tone: "ok" | "error"; text: string }>>({});
  // Pieza con el panel "Aplicar correcciones" abierto.
  const [correctingFor, setCorrectingFor] = useState<string | null>(null);

  const bySite = queue.filter((i) => site === "all" || i.site === site);
  const counts = { lista: 0, casi: 0, falta: 0 } as Record<Readiness, number>;
  bySite.forEach((i) => counts[i.readiness]++);
  const visible = bySite.filter((i) => readiness === "all" || i.readiness === readiness);
  const selectedItems = queue.filter((i) => selected.has(keyOf(i)));
  // Pendientes de IA: sin revisión, o con una revisión de antes de que la pieza cambiara.
  const pendingAi = visible
    .filter((i) => {
      const state = ai[keyOf(i)];
      return !isAiReview(state) || state.stale;
    })
    .slice(0, BATCH_LIMIT);
  const selectableVisible = visible.filter(publishable);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((i) => selected.has(keyOf(i)));

  function toggle(item: ReviewQueueItem) {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = keyOf(item);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  // "Solo las de 100": cumplen TODOS los criterios (también los opcionales) y
  // la IA no las descartó (si ya las revisó y la revisión sigue vigente).
  const perfectVisible = selectableVisible.filter((i) => {
    const state = ai[keyOf(i)];
    return i.score === 100 && !(isAiReview(state) && !state.stale && state.review.veredicto === "descartar");
  });

  function selectOnlyPerfect() {
    setSelected(new Set(perfectVisible.map(keyOf)));
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      selectableVisible.forEach((i) => (allVisibleSelected ? next.delete(keyOf(i)) : next.add(keyOf(i))));
      return next;
    });
  }

  async function analyze(item: ReviewQueueItem): Promise<boolean> {
    const k = keyOf(item);
    setAiLoading((prev) => ({ ...prev, [k]: true }));
    setAiErrors((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    const result = await analyzeOne(item, provider);
    setAiLoading((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    if (isAiReview(result)) setAi((prev) => ({ ...prev, [k]: result }));
    else setAiErrors((prev) => ({ ...prev, [k]: result.error }));
    // Si la IA la descarta, se desmarca para no publicarla por inercia.
    if (isAiReview(result) && result.review.veredicto === "descartar") {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
    return isAiReview(result);
  }

  async function fix(item: ReviewQueueItem, checkId: string) {
    const k = keyOf(item);
    setFixing((prev) => ({ ...prev, [k]: checkId }));
    setFixNotes((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/review-agent/fix`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, id: item.id, check: checkId, provider }),
      });
      const body = (await res.json().catch(() => null)) as { item?: ReviewQueueItem; message?: string } | null;
      if (!res.ok || !body?.item) {
        setFixNotes((prev) => ({ ...prev, [k]: { tone: "error", text: body?.message ?? "No se pudo arreglar." } }));
        return;
      }
      const updated = body.item;
      setQueue((prev) => prev.map((i) => (keyOf(i) === k ? updated : i)));
      // La revisión de IA guardada queda marcada como de antes del cambio.
      if (updated.ai) setAi((prev) => ({ ...prev, [k]: { ...updated.ai! } }));
      setFixNotes((prev) => ({ ...prev, [k]: { tone: "ok", text: `✓ ${body.message ?? "Arreglado."}` } }));
    } catch {
      setFixNotes((prev) => ({ ...prev, [k]: { tone: "error", text: "Sin conexión con el servidor." } }));
    } finally {
      setFixing((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  async function analyzeBatch() {
    const items = pendingAi;
    if (!items.length) return;
    cancelBatch.current = false;
    setBatch({ done: 0, total: items.length });
    let failuresInARow = 0;
    for (let i = 0; i < items.length; i++) {
      if (cancelBatch.current) break;
      failuresInARow = (await analyze(items[i])) ? 0 : failuresInARow + 1;
      setBatch({ done: i + 1, total: items.length });
      // Si la IA falla dos veces seguidas (sin tokens, CLI caído, poca memoria), no tiene caso seguir.
      if (failuresInARow >= 2) {
        setNotice({ tone: "error", text: "Se detuvo la revisión en lote: la IA falló dos veces seguidas. Mira el error en la pieza y vuelve a intentar cuando se resuelva." });
        break;
      }
    }
    setBatch(null);
  }

  async function publishSelected() {
    confirmRef.current?.close();
    setPublishing(true);
    setNotice(null);
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/review-agent/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: selectedItems.map((i) => ({ type: i.type, id: i.id })) }),
      });
      if (!res.ok) {
        setNotice({ tone: "error", text: res.status === 403 ? "No tienes permiso para publicar." : "No se pudo publicar. Intenta de nuevo." });
        return;
      }
      const data = (await res.json()) as { published: { type: string; id: string }[]; skipped: { type: string; id: string; reason: string }[] };
      const done = new Set(data.published.map(keyOf));
      const titleOf = (k: string) => queue.find((i) => keyOf(i) === k)?.title ?? k;
      setQueue((prev) => prev.filter((i) => !done.has(keyOf(i))));
      setSelected(new Set());
      setNotice({
        tone: data.skipped.length ? "warn" : "ok",
        text: `${data.published.length} ${data.published.length === 1 ? "pieza publicada" : "piezas publicadas"} ✓ · ya se ven en los sitios${
          data.skipped.length ? ` · ${data.skipped.length} no se publicaron` : ""
        }`,
        details: data.skipped.map((s) => `«${titleOf(keyOf(s))}»: ${s.reason}`),
      });
    } catch {
      setNotice({ tone: "error", text: "Sin conexión con el servidor." });
    } finally {
      setPublishing(false);
    }
  }

  if (!initialQueue) {
    return (
      <div className="p-[26px]">
        <p className="rounded-[12px] border border-border bg-card p-6 text-[13px] text-ink-soft">No se pudo cargar la cola de revisión. Recarga la página en un momento.</p>
      </div>
    );
  }

  return (
    <div className="p-[26px] pb-[120px]">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="max-w-[68ch]">
          <h1 className="mb-1 text-[25px] font-semibold tracking-tight">Revisor</h1>
          <p className="text-[13.5px] leading-[1.55] text-ink-soft">
            Revisa los borradores y las piezas en revisión antes de publicar: que tengan imagen, largo suficiente, estén en español, encajen en su sitio y citen fuente. La IA da una
            segunda opinión cuando se la pides. Nada se publica solo.
          </p>
        </div>
        <div className="flex-1" />
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
          {(
            [
              ["all", "Los dos sitios"],
              ["la-mira", "La Mira"],
              ["planazo", "Planazo"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSite(id)}
              className={`rounded-full px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                site === id ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen = filtros: cuántas hay en cada estado */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(["lista", "casi", "falta"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReadiness(readiness === r ? "all" : r)}
            aria-pressed={readiness === r}
            className={`flex items-center gap-3 rounded-[12px] border px-4 py-3 text-left transition-colors ${
              readiness === r ? "border-ink-faint bg-card shadow-[0_1px_2px_rgba(23,20,17,.06)]" : "border-border-soft bg-background hover:border-border"
            }`}
          >
            <span className={`size-2.5 flex-none rounded-full ${READINESS[r].dot}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-ink">
                {READINESS[r].label} <span className="font-mono text-[12.5px] font-normal text-ink-soft tabular-nums">{counts[r]}</span>
              </span>
              <span className="block text-[11.5px] text-ink-faint">{READINESS[r].hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={!selectableVisible.length} className="size-4 rounded border-border accent-brand" />
          Seleccionar las {selectableVisible.length} publicables de esta vista
        </label>
        <button
          type="button"
          onClick={selectOnlyPerfect}
          disabled={!perfectVisible.length}
          title="Marca solo las que cumplen todos los criterios (100/100) y que la IA no haya descartado; desmarca las demás"
          className="rounded-full border border-positive/30 bg-positive/10 px-3 py-1 text-[12px] font-semibold text-positive transition-colors hover:border-positive/60 disabled:cursor-default disabled:opacity-40"
        >
          ✓ Solo las de 100 ({perfectVisible.length})
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5" role="group" aria-label="Proveedor de IA">
          <span className="text-[11.5px] font-medium text-ink-faint">IA:</span>
          <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
            {providers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setChosenProvider(p)}
                disabled={!!batch}
                aria-pressed={provider === p}
                title={settings?.defaultProvider === p ? "Predeterminado en Configuración" : undefined}
                className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
                  provider === p ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
                }`}
              >
                {PROVIDER_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        {batch ? (
          <span className="flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-accent-fg">
            {PROVIDER_LABEL[provider]} está revisando {batch.done}/{batch.total}…
            <button type="button" onClick={() => (cancelBatch.current = true)} className="rounded px-1.5 text-[11.5px] font-medium text-ink-soft hover:text-ink">
              Detener
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={analyzeBatch}
            disabled={!pendingAi.length}
            title={`Una segunda opinión de la IA para cada pieza de esta vista (hasta ${BATCH_LIMIT} a la vez)`}
            className="flex items-center gap-1.5 rounded-[10px] border border-brand/40 bg-card px-3 py-1.5 text-[12.5px] font-semibold text-accent-fg transition-colors hover:border-brand disabled:cursor-default disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" />
            </svg>
            {pendingAi.length ? `Revisar con IA (${pendingAi.length})` : "Todo revisado por la IA"}
          </button>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className={`mb-3 rounded-[10px] border px-3 py-2.5 text-[12.5px] ${
            notice.tone === "ok" ? "border-positive/30 bg-positive/10 text-positive" : notice.tone === "warn" ? "border-warning/30 bg-warning/10 text-ink" : "border-negative/30 bg-negative/10 text-negative"
          }`}
        >
          <p className="font-semibold">{notice.text}</p>
          {notice.details && notice.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-ink-soft">
              {notice.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card p-10 text-center text-[13px] text-ink-soft">
          {queue.length === 0 ? "No hay borradores ni piezas en revisión. Todo al día." : "Nada en esta vista."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => {
            const k = keyOf(item);
            const failed = item.checks.filter((c) => !c.passed);
            const aiState = ai[k];
            const canPublish = publishable(item);
            const isOpen = expanded === k;
            return (
              <li key={k} className="rounded-[12px] border border-border bg-card">
                <div className="flex items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(k)}
                    onChange={() => toggle(item)}
                    disabled={!canPublish}
                    title={canPublish ? "Seleccionar para publicar" : "No se puede publicar: le falta algo bloqueante"}
                    aria-label={`Seleccionar «${item.title}»`}
                    className="mt-1 size-4 flex-none rounded border-border accent-brand disabled:opacity-30"
                  />
                  <div className="h-12 w-[72px] flex-none overflow-hidden rounded-[8px] bg-hover">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente
                      <img src={item.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-[10px] font-medium text-ink-faint">Sin imagen</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={item.editHref} className="line-clamp-2 text-[13.5px] leading-snug font-semibold text-ink hover:text-brand">
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-[11.5px] text-ink-faint">
                      {item.site === "la-mira" ? "La Mira" : "Planazo"} · {TYPE_LABEL[item.type]}
                      {item.categoryName ? ` · ${item.categoryName}` : ""} · {item.words} palabras · {item.status === "draft" ? "Borrador" : "En revisión"}
                      {item.createdAt ? ` · ${formatDate(item.createdAt)}` : ""}
                    </p>
                    {failed.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {failed.map((c) => {
                          const busy = fixing[k] === c.id;
                          return (
                            <span
                              key={c.id}
                              title={c.detail}
                              className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-0.5 pl-2 text-[10.5px] font-semibold ${
                                c.blocking ? "bg-negative/10 text-negative" : "bg-warning/14 text-warning"
                              } ${c.fix || c.id === "encaje" ? "" : "pr-2"}`}
                            >
                              {c.blocking ? "✕" : "△"} {c.label}
                              {c.fix && (
                                <button
                                  type="button"
                                  onClick={() => fix(item, c.id)}
                                  disabled={!!fixing[k] || !!batch}
                                  title={`Arreglar: ${c.fix}. Se guarda en la pieza (sigue en revisión) y queda en su historial.`}
                                  className="rounded-full bg-card px-2 py-0.5 text-[10.5px] font-semibold text-ink shadow-[0_1px_1px_rgba(23,20,17,.08)] transition-colors hover:text-brand disabled:opacity-50"
                                >
                                  {busy ? "Arreglando…" : `🔧 ${c.fix}`}
                                </button>
                              )}
                              {c.id === "encaje" && (
                                <Link
                                  href={item.editHref}
                                  title="Abre la pieza: arriba está «Mover a La Mira» (con «Que la IA decida»)"
                                  className="rounded-full bg-card px-2 py-0.5 text-[10.5px] font-semibold text-ink shadow-[0_1px_1px_rgba(23,20,17,.08)] transition-colors hover:text-brand"
                                >
                                  Mover a La Mira →
                                </Link>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {fixNotes[k] && (
                      <p className={`mt-1.5 text-[11.5px] ${fixNotes[k].tone === "ok" ? "text-positive" : "text-negative"}`}>{fixNotes[k].text}</p>
                    )}
                    {isAiReview(aiState) && (
                      <div
                        className={`mt-2 rounded-[8px] border px-2.5 py-2 text-[12px] ${VERDICT[aiState.review.veredicto].className} ${aiState.stale ? "opacity-70" : ""}`}
                      >
                        <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
                          <span>
                            {VERDICT[aiState.review.veredicto].label}
                            {aiState.review.encaja !== (item.site === "la-mira" ? "la-mira" : "planazo") &&
                              ` · encaja mejor en ${aiState.review.encaja === "ninguno" ? "ninguno de los dos" : aiState.review.encaja === "la-mira" ? "La Mira" : "Planazo"}`}
                          </span>
                          <span className="text-[11px] font-normal text-ink-faint" suppressHydrationWarning>Revisada {timeAgo(aiState.reviewedAt)}</span>
                        </p>
                        {aiState.stale && (
                          <p className="mt-1 rounded bg-card/70 px-1.5 py-0.5 text-[11.5px] font-medium text-ink">
                            △ La pieza cambió después de esta revisión — vuelve a revisarla con la IA.
                          </p>
                        )}
                        <p className="mt-0.5 text-ink-soft">{aiState.review.resumen}</p>
                        {aiState.review.problemas.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 text-ink-soft">
                            {aiState.review.problemas.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        )}
                        {aiState.review.veredicto !== "publicar" && aiState.review.problemas.length > 0 && correctingFor !== k && (
                          <button
                            type="button"
                            onClick={() => setCorrectingFor(k)}
                            title="La IA reescribe la pieza siguiendo esta lista; tú eliges qué guardar"
                            className="mt-2 rounded-[8px] border border-brand/40 bg-card px-2.5 py-1 text-[11.5px] font-semibold text-accent-fg transition-colors hover:border-brand"
                          >
                            ✨ Aplicar correcciones{aiState.stale ? " (revisión de antes de tus cambios)" : ""}
                          </button>
                        )}
                      </div>
                    )}
                    {correctingFor === k && (
                      <CorrectionsPanel
                        item={item}
                        provider={provider}
                        providerLabel={PROVIDER_LABEL[provider]}
                        onClose={() => setCorrectingFor(null)}
                        onApplied={(updated, message) => {
                          setQueue((prev) => prev.map((i) => (keyOf(i) === k ? updated : i)));
                          if (updated.ai) setAi((prev) => ({ ...prev, [k]: { ...updated.ai! } }));
                          setFixNotes((prev) => ({ ...prev, [k]: { tone: "ok", text: `✓ ${message}` } }));
                          setCorrectingFor(null);
                        }}
                      />
                    )}
                    {aiErrors[k] && (
                      <p className="mt-1.5 text-[11.5px] text-negative">
                        {isAiReview(aiState) ? "No se pudo volver a revisar (se conserva la revisión anterior): " : ""}
                        {aiErrors[k]}
                      </p>
                    )}
                    {isOpen && (
                      <ul className="mt-2 flex flex-col gap-1 border-t border-border-soft pt-2">
                        {item.checks.map((c) => (
                          <li key={c.id} className="flex items-start gap-2 text-[12px]">
                            <span className={c.passed ? "text-positive" : c.blocking ? "text-negative" : "text-warning"}>{c.passed ? "✓" : c.blocking ? "✕" : "△"}</span>
                            <span className="text-ink-soft">
                              {c.label}
                              {c.detail && <span className="text-ink-faint"> — {c.detail}</span>}
                              {!c.passed && !c.fix && c.id !== "encaje" && (
                                <Link href={item.editHref} className="ml-1.5 font-medium text-accent-fg hover:underline">
                                  Corregir en la pieza →
                                </Link>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${READINESS[item.readiness].className}`} title={`${item.score}/100`}>
                      {READINESS[item.readiness].label} · {item.score}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : k)}
                        className="rounded-md px-1.5 py-1 text-[11.5px] font-medium text-ink-soft hover:bg-hover hover:text-ink"
                      >
                        {isOpen ? "Ocultar" : "Detalle"}
                      </button>
                      <button
                        type="button"
                        onClick={() => analyze(item)}
                        disabled={!!aiLoading[k] || !!batch}
                        className="rounded-md px-1.5 py-1 text-[11.5px] font-medium text-accent-fg hover:bg-accent disabled:opacity-50"
                      >
                        {aiLoading[k] ? "Revisando…" : isAiReview(aiState) ? (aiState.stale ? "✨ Revisar de nuevo" : "Otra vez") : "✨ IA"}
                      </button>
                      <Link href={item.editHref} className="rounded-md px-1.5 py-1 text-[11.5px] font-medium text-ink-soft hover:bg-hover hover:text-ink">
                        Abrir →
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Barra fija abajo cuando hay algo seleccionado */}
      {selectedItems.length > 0 && (
        <div className="sticky bottom-3 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-border bg-card/95 px-4 py-2.5 shadow-[0_12px_32px_-14px_rgba(23,20,17,.35)] backdrop-blur-sm">
          <span className="text-[13px] font-semibold text-ink">
            {selectedItems.length} {selectedItems.length === 1 ? "seleccionada" : "seleccionadas"}
          </span>
          <button type="button" onClick={() => setSelected(new Set())} className="text-[12.5px] font-medium text-ink-soft hover:text-ink">
            Quitar selección
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => confirmRef.current?.showModal()}
            disabled={publishing}
            className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:opacity-60"
          >
            {publishing ? "Publicando…" : `Publicar ${selectedItems.length}`}
          </button>
        </div>
      )}

      <dialog
        ref={confirmRef}
        aria-labelledby="publish-confirm-title"
        className="m-auto w-[min(460px,calc(100vw-32px))] rounded-[14px] border border-border bg-card p-0 text-ink shadow-[0_24px_60px_-20px_rgba(23,20,17,.45)] backdrop:bg-ink-solid/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-5">
          <h2 id="publish-confirm-title" className="text-[15px] font-semibold tracking-tight">
            ¿Publicar {selectedItems.length} {selectedItems.length === 1 ? "pieza" : "piezas"}?
          </h2>
          <p className="text-[12.5px] leading-[1.5] text-ink-soft">
            Se publican ya en su sitio; las noticias y reportajes salen con la fecha de hoy. Antes de publicar se vuelven a revisar: las que no cumplan algo bloqueante se saltan.
          </p>
          {selectedItems.some((i) => {
            const state = ai[keyOf(i)];
            return isAiReview(state) && state.review.veredicto !== "publicar";
          }) && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-[12px] text-ink">△ La IA sugirió corregir o descartar alguna de las seleccionadas.</p>
          )}
          <ul className="flex flex-col gap-1 text-[12.5px] text-ink">
            {selectedItems.slice(0, 12).map((i) => (
              <li key={keyOf(i)} className="truncate">
                · {i.title}
              </li>
            ))}
            {selectedItems.length > 12 && <li className="text-ink-faint">…y {selectedItems.length - 12} más</li>}
          </ul>
        </div>
        <div className="flex justify-end gap-2 border-t border-border-soft bg-background px-5 py-3">
          <button
            type="button"
            autoFocus
            onClick={() => confirmRef.current?.close()}
            className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink-faint"
          >
            Cancelar
          </button>
          <button type="button" onClick={publishSelected} className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-pressed">
            Sí, publicar
          </button>
        </div>
      </dialog>
    </div>
  );
}
