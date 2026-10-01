"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiConfig } from "@planazo/config";
import type { AiReview, Readiness, ReviewQueueItem } from "@/lib/review-agent-types";
import { useAiSettings } from "@/lib/use-openai-available";
import { saveRevisorNav } from "@/components/cms/revisor-nav-bar";
import { CorrectionsPanel } from "./corrections-panel";
import { READINESS, ReviewCard, SITE_META, TYPE_LABEL, publicUrl, type MoveSuggestion, type SavedAi } from "./review-card";

type ProviderId = "codex-cli" | "claude-cli" | "openai";
const PROVIDER_LABEL: Record<ProviderId, string> = { "codex-cli": "Codex", "claude-cli": "Claude", openai: "OpenAI" };

// Tope del análisis en lote: con Codex/Claude cada pieza tarda ~10-40 s.
const BATCH_LIMIT = 25;

type AiState = SavedAi | { error: string };
type SiteFilter = "all" | "la-mira" | "planazo";
/** Filtro por la opinión de la IA. */
type AiFilter = "all" | "sin-revisar" | AiReview["veredicto"] | "corregidas";

const AI_FILTERS: { id: AiFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "sin-revisar", label: "Sin revisar" },
  { id: "publicar", label: "IA: publicar" },
  { id: "corregir", label: "IA: corregir" },
  { id: "descartar", label: "IA: no publicar" },
  { id: "corregidas", label: "Corregidas" },
];

const keyOf = (item: { type: string; id: string }) => `${item.type}:${item.id}`;
const isAiReview = (s: AiState | undefined): s is SavedAi => !!s && typeof s === "object" && "review" in s;
const publishable = (item: ReviewQueueItem) => item.checks.every((c) => !c.blocking || c.passed);

async function postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(`${apiConfig.clientBaseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, data: (await res.json().catch(() => null)) as T | null };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

async function analyzeOne(item: ReviewQueueItem, provider: ProviderId): Promise<AiState> {
  const res = await postJson<AiReview & { reviewedAt: string; message?: string }>("/cms/review-agent/analyze", { type: item.type, id: item.id, provider });
  if (!res.ok || !res.data) return { error: res.status === 0 ? "Sin conexión con el servidor." : (res.data?.message ?? "La IA no pudo revisarla.") };
  return { review: res.data, reviewedAt: res.data.reviewedAt, stale: false };
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
  // Estado de cada proveedor (sin tokens, fallando…): si el predeterminado no tiene uso, se arranca con otro.
  const [health, setHealth] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiConfig.clientBaseUrl}/cms/automation/status`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { providerHealth?: { provider: string; state: string }[] } | null) => {
        if (!cancelled && data?.providerHealth) setHealth(Object.fromEntries(data.providerHealth.map((h) => [h.provider, h.state])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const noQuota = (p: ProviderId) => health[p] === "sin-tokens";
  const defaultProvider: ProviderId = settings?.defaultProvider ?? "codex-cli";
  const provider: ProviderId = chosenProvider ?? (noQuota(defaultProvider) ? (providers.find((p) => !noQuota(p)) ?? defaultProvider) : defaultProvider);
  const [site, setSite] = useState<SiteFilter>("all");
  const [readiness, setReadiness] = useState<Readiness | "all">("all");
  const [aiFilter, setAiFilter] = useState<AiFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
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
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string; details?: string[]; link?: { href: string; label: string } } | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  // "Arreglar": qué criterio se está arreglando en cada pieza, y qué se hizo.
  const [fixing, setFixing] = useState<Record<string, string>>({});
  const [fixNotes, setFixNotes] = useState<Record<string, { tone: "ok" | "error"; text: string }>>({});
  // Piezas con una acción de fondo en curso (archivar, mover).
  const [acting, setActing] = useState<Record<string, boolean>>({});
  // Pieza con el panel "Aplicar correcciones" abierto.
  const [correctingFor, setCorrectingFor] = useState<string | null>(null);

  const aiOf = (i: ReviewQueueItem) => {
    const state = ai[keyOf(i)];
    return isAiReview(state) ? state : undefined;
  };
  const isCorrected = (i: ReviewQueueItem) => {
    const saved = aiOf(i);
    return !!i.lastFix && (!saved || new Date(i.lastFix.at) > new Date(saved.reviewedAt));
  };
  const matchesAi = (i: ReviewQueueItem) => {
    const saved = aiOf(i);
    if (aiFilter === "all") return true;
    if (aiFilter === "sin-revisar") return !saved;
    if (aiFilter === "corregidas") return isCorrected(i);
    return saved?.review.veredicto === aiFilter;
  };

  const bySite = queue.filter((i) => site === "all" || i.site === site);
  const counts = { lista: 0, casi: 0, falta: 0 } as Record<Readiness, number>;
  bySite.forEach((i) => counts[i.readiness]++);
  const aiCounts = Object.fromEntries(AI_FILTERS.map((f) => [f.id, 0])) as Record<AiFilter, number>;
  bySite.forEach((i) => {
    const saved = aiOf(i);
    aiCounts.all++;
    if (!saved) aiCounts["sin-revisar"]++;
    else aiCounts[saved.review.veredicto]++;
    if (isCorrected(i)) aiCounts.corregidas++;
  });
  const visible = bySite.filter((i) => (readiness === "all" || i.readiness === readiness) && matchesAi(i));
  const selectedItems = queue.filter((i) => selected.has(keyOf(i)));
  // Pendientes de IA: sin revisión, o con una revisión de antes de que la pieza cambiara.
  const pendingAi = visible
    .filter((i) => {
      const saved = aiOf(i);
      return !saved || saved.stale;
    })
    .slice(0, BATCH_LIMIT);
  const selectableVisible = visible.filter(publishable);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((i) => selected.has(keyOf(i)));
  // "Solo las de 100": cumplen TODOS los criterios y la IA no las descartó (si su revisión sigue vigente).
  const perfectVisible = selectableVisible.filter((i) => {
    const saved = aiOf(i);
    return i.score === 100 && !(saved && !saved.stale && saved.review.veredicto === "descartar");
  });

  const removeKey = <T,>(record: Record<string, T>, k: string) => {
    const next = { ...record };
    delete next[k];
    return next;
  };

  function toggle(item: ReviewQueueItem) {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = keyOf(item);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      selectableVisible.forEach((i) => (allVisibleSelected ? next.delete(keyOf(i)) : next.add(keyOf(i))));
      return next;
    });
  }

  function replaceItem(k: string, updated: ReviewQueueItem) {
    setQueue((prev) => prev.map((i) => (keyOf(i) === k ? updated : i)));
    // La revisión de IA guardada queda marcada como de antes del cambio.
    if (updated.ai) setAi((prev) => ({ ...prev, [k]: { ...updated.ai! } }));
  }

  function dropItem(k: string) {
    setQueue((prev) => prev.filter((i) => keyOf(i) !== k));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(k);
      return next;
    });
  }

  async function analyze(item: ReviewQueueItem): Promise<boolean> {
    const k = keyOf(item);
    setAiLoading((prev) => ({ ...prev, [k]: true }));
    setAiErrors((prev) => removeKey(prev, k));
    const result = await analyzeOne(item, provider);
    setAiLoading((prev) => removeKey(prev, k));
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
    setFixNotes((prev) => removeKey(prev, k));
    const res = await postJson<{ item?: ReviewQueueItem; message?: string }>("/cms/review-agent/fix", { type: item.type, id: item.id, check: checkId, provider });
    if (res.ok && res.data?.item) {
      replaceItem(k, res.data.item);
      setFixNotes((prev) => ({ ...prev, [k]: { tone: "ok", text: `✓ ${res.data!.message ?? "Arreglado."}` } }));
    } else {
      setFixNotes((prev) => ({ ...prev, [k]: { tone: "error", text: res.status === 0 ? "Sin conexión con el servidor." : (res.data?.message ?? "No se pudo arreglar.") } }));
    }
    setFixing((prev) => removeKey(prev, k));
  }

  /** Archivar: no se publica y sale de la cola; queda como archivada en Contenido. */
  async function discard(item: ReviewQueueItem) {
    const k = keyOf(item);
    setActing((prev) => ({ ...prev, [k]: true }));
    const res = await postJson<{ message?: string }>("/cms/review-agent/discard", { type: item.type, id: item.id });
    setActing((prev) => removeKey(prev, k));
    if (!res.ok) {
      setFixNotes((prev) => ({ ...prev, [k]: { tone: "error", text: res.data?.message ?? "No se pudo archivar." } }));
      return;
    }
    dropItem(k);
    setNotice({ tone: "ok", text: `«${item.title}» se archivó: no se publica. Sigue en Contenido como archivada por si la quieres recuperar.` });
  }

  const TYPE_NAME: Record<string, string> = { noticia: "Noticia", reportaje: "Reportaje", alerta: "Alerta", place: "Lugar", "evento-planazo": "Evento" };

  /** Cómo quedaría en el otro sitio: tipo y categoría que sugiere la IA. */
  async function suggestMove(item: ReviewQueueItem): Promise<MoveSuggestion | { error: string }> {
    const toLamira = item.site === "planazo";
    const res = toLamira
      ? await postJson<{ belongsIn?: string; targetType?: string; categoryId?: string | null; categoryName?: string | null; reason?: string; message?: string }>("/cms/transfer/suggest", {
          sourceType: item.type,
          sourceId: item.id,
        })
      : await postJson<{ fits?: boolean; targetType?: string; categoryId?: string; categoryName?: string; reason?: string; message?: string }>("/cms/transfer/suggest-planazo", {
          sourceType: item.type,
          sourceId: item.id,
        });
    if (!res.ok || !res.data?.targetType) return { error: res.status === 0 ? "Sin conexión con el servidor." : (res.data?.message ?? "La IA no pudo sugerir cómo pasarla.") };
    const d = res.data as { belongsIn?: string; fits?: boolean; targetType: string; categoryId?: string | null; categoryName?: string | null; reason?: string };
    return {
      site: toLamira ? "la-mira" : "planazo",
      label: [TYPE_NAME[d.targetType] ?? d.targetType, d.categoryName].filter(Boolean).join(" · "),
      reason: d.reason ?? "",
      fits: toLamira ? d.belongsIn !== "planazo" : d.fits !== false,
      targetType: d.targetType,
      categoryId: d.categoryId ?? null,
    };
  }

  /** Cambia la pieza de sitio (La Mira ↔ Planazo); el original se elimina (solo admin). */
  async function movePiece(item: ReviewQueueItem, s: MoveSuggestion) {
    const k = keyOf(item);
    setActing((prev) => ({ ...prev, [k]: true }));
    const path = s.site === "la-mira" ? "/cms/transfer/planazo-to-lamira" : "/cms/transfer/lamira-to-planazo";
    const res = await postJson<{ editPath?: string; message?: string }>(path, {
      sourceType: item.type,
      sourceId: item.id,
      targetType: s.targetType,
      categoryId: s.categoryId,
      original: "delete",
    });
    setActing((prev) => removeKey(prev, k));
    if (!res.ok || !res.data?.editPath) {
      setFixNotes((prev) => ({
        ...prev,
        [k]: {
          tone: "error",
          text: res.status === 403 ? "Solo un administrador puede cambiar de sitio (se elimina el original)." : (res.data?.message ?? "No se pudo cambiar de sitio."),
        },
      }));
      return;
    }
    dropItem(k);
    setNotice({ tone: "ok", text: `«${item.title}» ahora es ${s.label} de ${SITE_META[s.site].label} (en revisión).`, link: { href: res.data.editPath, label: "Abrirla →" } });
  }

  /** Publicar una sola pieza desde su tarjeta (el API vuelve a revisar lo bloqueante). */
  async function publishOne(item: ReviewQueueItem) {
    const k = keyOf(item);
    setActing((prev) => ({ ...prev, [k]: true }));
    const res = await postJson<{ published: { type: string; id: string }[]; skipped: { reason: string }[] }>("/cms/review-agent/publish", {
      items: [{ type: item.type, id: item.id }],
    });
    setActing((prev) => removeKey(prev, k));
    if (!res.ok || !res.data) {
      setFixNotes((prev) => ({ ...prev, [k]: { tone: "error", text: res.status === 403 ? "No tienes permiso para publicar." : "No se pudo publicar. Intenta de nuevo." } }));
      return;
    }
    if (!res.data.published.length) {
      setFixNotes((prev) => ({ ...prev, [k]: { tone: "error", text: `No se publicó: ${res.data!.skipped[0]?.reason ?? "no cumple lo bloqueante"}.` } }));
      return;
    }
    dropItem(k);
    setNotice({ tone: "ok", text: `«${item.title}» ya está publicada en ${SITE_META[item.site].label} ✓`, link: { href: publicUrl(item).href, label: "Verla ↗" } });
  }

  /** Guarda la lista que se está viendo (filtros y orden) para anterior/siguiente en la ficha. */
  function rememberList() {
    const filter = [
      site === "all" ? null : SITE_META[site].label,
      readiness === "all" ? null : readiness === "lista" ? "Listas para publicar" : readiness === "casi" ? "Casi listas" : "Les falta algo",
      aiFilter === "all" ? null : AI_FILTERS.find((f) => f.id === aiFilter)?.label,
    ]
      .filter(Boolean)
      .join(" · ");
    saveRevisorNav({
      filter: filter || "Todas las pendientes",
      items: visible.map((i) => ({ href: i.editHref, title: i.title, label: `${SITE_META[i.site].label} · ${TYPE_LABEL[i.type]}` })),
    });
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
    const res = await postJson<{ published: { type: string; id: string }[]; skipped: { type: string; id: string; reason: string }[] }>("/cms/review-agent/publish", {
      items: selectedItems.map((i) => ({ type: i.type, id: i.id })),
    });
    setPublishing(false);
    if (!res.ok || !res.data) {
      setNotice({ tone: "error", text: res.status === 403 ? "No tienes permiso para publicar." : res.status === 0 ? "Sin conexión con el servidor." : "No se pudo publicar. Intenta de nuevo." });
      return;
    }
    const data = res.data;
    const done = new Set(data.published.map(keyOf));
    const titleOf = (k: string) => queue.find((i) => keyOf(i) === k)?.title ?? k;
    setQueue((prev) => prev.filter((i) => !done.has(keyOf(i))));
    setSelected(new Set());
    setNotice({
      tone: data.skipped.length ? "warn" : "ok",
      text: `${data.published.length} ${data.published.length === 1 ? "pieza publicada" : "piezas publicadas"} ✓ · ya se ven en los sitios${data.skipped.length ? ` · ${data.skipped.length} no se publicaron` : ""}`,
      details: data.skipped.map((s) => `«${titleOf(keyOf(s))}»: ${s.reason}`),
    });
  }

  if (!initialQueue) {
    return (
      <div className="p-[26px]">
        <p className="rounded-[12px] border border-border bg-card p-6 text-[13px] text-ink-soft">No se pudo cargar la cola de revisión. Recarga la página en un momento.</p>
      </div>
    );
  }

  const total = bySite.length || 1;

  const filterButton = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
      active ? "bg-ink-solid font-semibold text-white" : "text-ink-soft hover:bg-hover hover:text-ink"
    }`;

  return (
    <div className="mx-auto max-w-[1440px] p-[26px] pb-[120px] lg:grid lg:grid-cols-[290px_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* Panel fijo a la izquierda: qué estoy viendo y qué hacer con la cola */}
      <aside className="mb-4 flex flex-col gap-3 lg:sticky lg:top-4 lg:mb-0 lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto lg:pr-1">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Revisor</h1>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-ink-soft">
            Revisa antes de publicar: imagen, largo, idioma, si encaja en su sitio y si cita fuente. La IA opina cuando se lo pides. Nada se publica solo.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-0.5 rounded-[12px] border border-border bg-background p-0.5" role="group" aria-label="Sitio">
          {(
            [
              ["all", "Ambos", null],
              ["la-mira", "La Mira", SITE_META["la-mira"].color],
              ["planazo", "Planazo", SITE_META.planazo.color],
            ] as const
          ).map(([id, label, color]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSite(id)}
              aria-pressed={site === id}
              className={`flex items-center justify-center gap-1.5 rounded-[10px] px-2 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                site === id ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
              }`}
            >
              {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />}
              {label}
            </button>
          ))}
        </div>

        <section className="rounded-[14px] border border-border bg-card p-3" aria-label="Estado de la cola">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[12.5px] font-semibold text-ink">
              {bySite.length} pendientes
            </p>
            {readiness !== "all" && (
              <button type="button" onClick={() => setReadiness("all")} className="text-[11.5px] font-medium text-ink-faint hover:text-ink">
                Ver todas
              </button>
            )}
          </div>
          <div className="mb-2.5 flex h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden>
            {(["lista", "casi", "falta"] as const).map((r) => (
              <span key={r} className={`${READINESS[r].bar} transition-[width] duration-500 ease-out`} style={{ width: `${(counts[r] / total) * 100}%` }} />
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {(["lista", "casi", "falta"] as const).map((r) => {
              const active = readiness === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReadiness(active ? "all" : r)}
                  aria-pressed={active}
                  title={READINESS[r].hint}
                  className={`flex items-center gap-2.5 rounded-[10px] border px-2.5 py-2 text-left transition-colors ${
                    active ? "border-ink-faint bg-background" : "border-transparent hover:bg-background"
                  }`}
                >
                  <span className={`size-2 flex-none rounded-full ${READINESS[r].bar}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-ink">{r === "lista" ? "Listas para publicar" : r === "casi" ? "Casi listas" : "Les falta algo"}</span>
                    <span className="block text-[11px] text-ink-faint">{READINESS[r].hint}</span>
                  </span>
                  <span className="text-[18px] font-semibold tracking-tight text-ink tabular-nums">{counts[r]}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-3" aria-label="Revisión con IA">
          <div className="flex items-center justify-between gap-2" role="group" aria-label="Proveedor de IA">
            <span className="text-[12.5px] font-semibold text-ink">Revisar con</span>
            <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
              {providers.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChosenProvider(p)}
                  disabled={!!batch}
                  aria-pressed={provider === p}
                  title={noQuota(p) ? `${PROVIDER_LABEL[p]} se quedó sin uso disponible` : settings?.defaultProvider === p ? "Predeterminado en Configuración" : undefined}
                  className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
                    provider === p ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
                  } ${noQuota(p) ? "line-through decoration-negative/60" : ""}`}
                >
                  {PROVIDER_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
          {batch ? (
            <div className="rounded-[10px] bg-accent px-3 py-2 text-[12px] font-semibold text-accent-fg">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {PROVIDER_LABEL[provider]} revisando {batch.done}/{batch.total}…
                </span>
                <button type="button" onClick={() => (cancelBatch.current = true)} className="text-[11.5px] font-medium text-ink-soft hover:text-ink">
                  Detener
                </button>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-card">
                <span className="block h-full bg-brand transition-[width] duration-300" style={{ width: `${(batch.done / batch.total) * 100}%` }} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={analyzeBatch}
              disabled={!pendingAi.length}
              title={`Una segunda opinión de la IA para cada pieza de esta vista (hasta ${BATCH_LIMIT} a la vez)`}
              className="rounded-[10px] border border-brand/40 bg-card px-3 py-2 text-[12.5px] font-semibold text-accent-fg transition-colors hover:border-brand disabled:cursor-default disabled:opacity-50"
            >
              {pendingAi.length ? `✨ Revisar ${pendingAi.length} de esta vista` : "Todo revisado por la IA"}
            </button>
          )}
        </section>
        <section className="rounded-[14px] border border-border bg-card p-3" aria-label="Opinión de la IA">
          <p className="mb-1.5 text-[12.5px] font-semibold text-ink">Opinión de la IA</p>
          <div className="flex flex-col gap-0.5">
            {AI_FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setAiFilter(f.id)} aria-pressed={aiFilter === f.id} className={filterButton(aiFilter === f.id)}>
                <span className="flex-1">{f.label}</span>
                <span className="tabular-nums opacity-70">{aiCounts[f.id]}</span>
              </button>
            ))}
          </div>
        </section>

      </aside>

      <div className="min-w-0">
      {/* Barra de selección, pegada arriba de la lista */}
      <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-soft bg-background/95 px-1 py-2.5 backdrop-blur-sm">
        <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={!selectableVisible.length} className="size-4 rounded border-border accent-brand" />
          Las {selectableVisible.length} publicables
        </label>
        <button
          type="button"
          onClick={() => setSelected(new Set(perfectVisible.map(keyOf)))}
          disabled={!perfectVisible.length}
          title="Marca solo las que cumplen todos los criterios (100/100) y que la IA no haya descartado; desmarca las demás"
          className="rounded-full border border-positive/30 bg-positive/10 px-2.5 py-0.5 text-[12px] font-semibold text-positive transition-colors hover:border-positive/60 disabled:cursor-default disabled:opacity-40"
        >
          ✓ Solo las de 100 ({perfectVisible.length})
        </button>
        <span className="flex-1" />
        <span className="text-[12px] text-ink-faint">
          Mostrando <span className="font-semibold text-ink tabular-nums">{visible.length}</span> de {bySite.length}
        </span>
      </div>

      {notice && (
        <div
          role="status"
          className={`mb-3 flex flex-wrap items-start gap-2 rounded-[12px] border px-3.5 py-2.5 text-[12.5px] ${
            notice.tone === "ok" ? "border-positive/30 bg-positive/10 text-positive" : notice.tone === "warn" ? "border-warning/30 bg-warning/10 text-ink" : "border-negative/30 bg-negative/10 text-negative"
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {notice.text}
              {notice.link && (
                <Link href={notice.link.href} className="ml-2 underline">
                  {notice.link.label}
                </Link>
              )}
            </p>
            {notice.details && notice.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-ink-soft">
                {notice.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" onClick={() => setNotice(null)} className="flex-none text-[12px] font-medium opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-card p-10 text-center text-[13px] text-ink-soft">
          {queue.length === 0 ? "No hay borradores ni piezas en revisión. Todo al día." : "Nada con estos filtros."}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((item) => {
            const k = keyOf(item);
            const state = ai[k];
            return (
              <ReviewCard
                key={k}
                item={item}
                selected={selected.has(k)}
                aiState={isAiReview(state) ? state : undefined}
                aiLoading={!!aiLoading[k]}
                aiError={aiErrors[k]}
                fixingCheck={fixing[k]}
                fixNote={fixNotes[k]}
                busy={!!batch || !!acting[k]}
                publishing={!!acting[k]}
                providerLabel={PROVIDER_LABEL[provider]}
                actions={{
                  onToggleSelect: () => toggle(item),
                  onFix: (checkId) => fix(item, checkId),
                  onAnalyze: () => analyze(item),
                  onOpenCorrections: () => setCorrectingFor(k),
                  onDiscard: () => discard(item),
                  onSuggestMove: () => suggestMove(item),
                  onMove: (suggestion) => movePiece(item, suggestion),
                  onPublish: () => publishOne(item),
                  onOpen: rememberList,
                }}
                correctionsSlot={
                  correctingFor === k && (
                    <CorrectionsPanel
                      item={item}
                      provider={provider}
                      providerLabel={PROVIDER_LABEL[provider]}
                      onClose={() => setCorrectingFor(null)}
                      onApplied={(updated, message) => {
                        replaceItem(k, updated);
                        setFixNotes((prev) => ({ ...prev, [k]: { tone: "ok", text: `✓ ${message}` } }));
                        setCorrectingFor(null);
                      }}
                    />
                  )
                }
              />
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
          <span className="text-[12px] text-ink-faint">
            {(["la-mira", "planazo"] as const)
              .map((s) => [SITE_META[s].label, selectedItems.filter((i) => i.site === s).length] as const)
              .filter(([, n]) => n > 0)
              .map(([label, n]) => `${n} en ${label}`)
              .join(" · ")}
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

      </div>

      <dialog
        ref={confirmRef}
        aria-labelledby="publish-confirm-title"
        className="m-auto w-[min(480px,calc(100vw-32px))] rounded-[14px] border border-border bg-card p-0 text-ink shadow-[0_24px_60px_-20px_rgba(23,20,17,.45)] backdrop:bg-ink-solid/40 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-5">
          <h2 id="publish-confirm-title" className="text-[15px] font-semibold tracking-tight">
            ¿Publicar {selectedItems.length} {selectedItems.length === 1 ? "pieza" : "piezas"}?
          </h2>
          <p className="text-[12.5px] leading-[1.5] text-ink-soft">
            Se publican ya en su sitio; las noticias y reportajes salen con la fecha de hoy. Antes de publicar se vuelven a revisar: las que no cumplan algo bloqueante se saltan.
          </p>
          {selectedItems.some((i) => {
            const saved = aiOf(i);
            return saved && saved.review.veredicto !== "publicar";
          }) && <p className="rounded-lg bg-warning/10 px-3 py-2 text-[12px] text-ink">△ La IA sugirió corregir o no publicar alguna de las seleccionadas.</p>}
          {(["la-mira", "planazo"] as const).map((s) => {
            const items = selectedItems.filter((i) => i.site === s);
            if (!items.length) return null;
            return (
              <div key={s}>
                <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: SITE_META[s].color }}>
                  <span className="size-1.5 rounded-full" style={{ background: SITE_META[s].color }} aria-hidden />
                  {SITE_META[s].label} · {items.length}
                </p>
                <ul className="flex flex-col gap-0.5 text-[12.5px] text-ink">
                  {items.slice(0, 10).map((i) => (
                    <li key={keyOf(i)} className="truncate">
                      · {i.title}
                    </li>
                  ))}
                  {items.length > 10 && <li className="text-ink-faint">…y {items.length - 10} más</li>}
                </ul>
              </div>
            );
          })}
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
