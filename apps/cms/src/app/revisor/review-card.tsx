"use client";

import { useState } from "react";
import Link from "next/link";
import { siteConfig } from "@planazo/config";
import type { AiReview, Readiness, ReviewQueueItem, ReviewableType } from "@/lib/review-agent-types";

export const TYPE_LABEL: Record<ReviewableType, string> = {
  noticia: "Noticia",
  reportaje: "Reportaje",
  guia: "Guía",
  place: "Lugar",
  "evento-planazo": "Evento",
  "planazo-guia": "Guía",
};

// Identidad de cada sitio (mismos colores que sus portadas): rojo La Mira, naranja Planazo.
export const SITE_META: Record<ReviewQueueItem["site"], { label: string; color: string; envKey: "la-mira" | "planazo" }> = {
  "la-mira": { label: "La Mira", color: "#dc2626", envKey: "la-mira" },
  planazo: { label: "Planazo", color: "#ff5a00", envKey: "planazo" },
};

const PATH_BY_TYPE: Record<ReviewableType, string> = {
  noticia: "noticias",
  reportaje: "reportajes",
  guia: "guias",
  place: "lugares",
  "evento-planazo": "eventos",
  "planazo-guia": "guias",
};

export const READINESS: Record<Readiness, { label: string; hint: string; tone: string; bar: string }> = {
  lista: { label: "Lista", hint: "Cumple todo lo importante", tone: "text-positive bg-positive/12", bar: "bg-positive" },
  casi: { label: "Casi", hint: "Publicable, con detalles por mejorar", tone: "text-warning bg-warning/14", bar: "bg-warning" },
  falta: { label: "Le falta", hint: "No cumple algo bloqueante", tone: "text-negative bg-negative/10", bar: "bg-negative" },
};

const VERDICT: Record<AiReview["veredicto"], { title: string; icon: string; box: string; text: string }> = {
  publicar: { title: "Lista para publicar", icon: "✓", box: "border-positive/25 bg-positive/[.06]", text: "text-positive" },
  corregir: { title: "Corregir antes de publicar", icon: "✎", box: "border-warning/25 bg-warning/[.07]", text: "text-warning" },
  descartar: { title: "No publicar", icon: "✕", box: "border-negative/25 bg-negative/[.05]", text: "text-negative" },
};

export interface SavedAi {
  review: AiReview;
  reviewedAt: string;
  /** La pieza cambió después de esta revisión. */
  stale: boolean;
}

export function timeAgo(iso: string): string {
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
    return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** Dónde se va a ver la pieza cuando se publique (host de prod + ruta del tipo). */
export function publicUrl(item: ReviewQueueItem): { href: string; label: string } {
  const host = siteConfig.environments[SITE_META[item.site].envKey].prod.replace(/\/$/, "");
  const path = `${PATH_BY_TYPE[item.type]}/${item.slug}`;
  return { href: `${host}/${path}`, label: `${host.replace(/^https?:\/\/(www\.)?/, "")}/${path}` };
}

export function SiteBadge({ site }: { site: ReviewQueueItem["site"] }) {
  const meta = SITE_META[site];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: `${meta.color}40`, color: meta.color, background: `${meta.color}0f` }}>
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

/** Calificación como anillo: se lee de un vistazo, el número da el detalle. */
function ScoreRing({ score, readiness }: { score: number; readiness: Readiness }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const stroke = readiness === "lista" ? "var(--color-positive)" : readiness === "casi" ? "var(--color-warning)" : "var(--color-negative)";
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="flex-none" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3.5" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 20 20)" />
      <text x="20" y="24" textAnchor="middle" className="fill-ink text-[11px] font-semibold tabular-nums">
        {score}
      </text>
    </svg>
  );
}

export interface CardActions {
  onToggleSelect: () => void;
  onFix: (checkId: string) => void;
  onAnalyze: () => void;
  onOpenCorrections: () => void;
  onDiscard: () => void;
  onMoveToLamira: () => void;
}

/**
 * Una pieza de la cola, en tres capas que se leen de arriba abajo:
 * 1) qué es y a dónde va (sitio, tipo, dirección pública) y su calificación;
 * 2) criterios automáticos que fallan, con su botón de arreglar;
 * 3) la opinión de la IA y qué hacer con ella.
 */
export function ReviewCard({
  item,
  selected,
  aiState,
  aiLoading,
  aiError,
  fixingCheck,
  fixNote,
  busy,
  providerLabel,
  correctionsSlot,
  actions,
}: {
  item: ReviewQueueItem;
  selected: boolean;
  aiState: SavedAi | undefined;
  aiLoading: boolean;
  aiError: string | undefined;
  fixingCheck: string | undefined;
  fixNote: { tone: "ok" | "error"; text: string } | undefined;
  /** Hay un lote corriendo o una acción de esta pieza en curso. */
  busy: boolean;
  providerLabel: string;
  correctionsSlot: React.ReactNode;
  actions: CardActions;
}) {
  const [showChecks, setShowChecks] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const failed = item.checks.filter((c) => !c.passed);
  const passedCount = item.checks.length - failed.length;
  const canPublish = item.checks.every((c) => !c.blocking || c.passed);
  const url = publicUrl(item);
  const review = aiState?.review;
  const verdict = review ? VERDICT[review.veredicto] : null;
  const ownSite = item.site === "la-mira" ? "la-mira" : "planazo";
  const fitsElsewhere = review && review.encaja !== ownSite;
  // "Corregida": hubo un arreglo/corrección después de la última revisión con IA (o sin revisión).
  const correctedAfterReview = !!item.lastFix && (!aiState || new Date(item.lastFix.at) > new Date(aiState.reviewedAt));

  return (
    <li className={`rounded-[14px] border bg-card transition-shadow ${selected ? "border-brand/50 shadow-[0_0_0_3px_rgba(253,105,13,.12)]" : "border-border"}`}>
      {/* 1 · Qué es, a dónde va y cómo va */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={actions.onToggleSelect}
          disabled={!canPublish}
          title={canPublish ? "Seleccionar para publicar" : "No se puede publicar: le falta algo bloqueante"}
          aria-label={`Seleccionar «${item.title}»`}
          className="mt-1 size-4 flex-none rounded border-border accent-brand disabled:opacity-30"
        />
        <div className="h-[60px] w-[88px] flex-none overflow-hidden rounded-[10px] bg-hover">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen externa, dominio variable por fuente
            <img src={item.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-[10.5px] font-medium text-ink-faint">Sin imagen</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-faint">
            <SiteBadge site={item.site} />
            <span className="font-medium text-ink-soft">{TYPE_LABEL[item.type]}</span>
            {item.categoryName && <span>· {item.categoryName}</span>}
            <span>· {item.status === "draft" ? "Borrador" : "En revisión"}</span>
            {item.createdAt && <span>· {formatDate(item.createdAt)}</span>}
          </div>
          <Link href={item.editHref} className="mt-1 line-clamp-2 block text-[15px] leading-snug font-semibold tracking-tight text-ink hover:text-brand">
            {item.title}
          </Link>
          <p className="mt-1 flex min-w-0 items-center gap-1 text-[11.5px] text-ink-faint">
            <span className="flex-none">Se publicará en</span>
            <span className="truncate font-mono text-[11px] text-ink-soft" title={url.href}>
              {url.label}
            </span>
            <span className="flex-none">· {item.words} palabras</span>
          </p>
        </div>
        <div className="flex flex-none flex-col items-center gap-1" title={READINESS[item.readiness].hint}>
          <ScoreRing score={item.score} readiness={item.readiness} />
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${READINESS[item.readiness].tone}`}>{READINESS[item.readiness].label}</span>
        </div>
      </div>

      {correctedAfterReview && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-positive/25 bg-positive/[.07] px-3 py-2 text-[12px]">
          <span className="font-semibold text-positive" suppressHydrationWarning>✓ Corregida {timeAgo(item.lastFix!.at)}</span>
          <span className="min-w-0 flex-1 truncate text-ink-soft" title={item.lastFix!.message}>
            {item.lastFix!.message}
          </span>
          <button type="button" onClick={actions.onAnalyze} disabled={busy || aiLoading} className="flex-none text-[12px] font-semibold text-accent-fg hover:underline disabled:opacity-50">
            {aiLoading ? "Revisando…" : `Que ${providerLabel} la vuelva a revisar →`}
          </button>
        </div>
      )}

      {/* 2 · Criterios automáticos */}
      <div className="border-t border-border-soft px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-ink">
            Criterios <span className="font-normal text-ink-faint tabular-nums">{passedCount}/{item.checks.length}</span>
            {failed.length === 0 && <span className="ml-1.5 font-medium text-positive">· todo en orden</span>}
          </p>
          <button type="button" onClick={() => setShowChecks((v) => !v)} className="text-[11.5px] font-medium text-ink-faint hover:text-ink" aria-expanded={showChecks}>
            {showChecks ? "Ocultar" : "Ver todos"}
          </button>
        </div>
        {failed.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {failed.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-[12.5px]">
                <span className={`grid size-4 flex-none place-items-center rounded-full text-[9px] font-bold text-white ${c.blocking ? "bg-negative" : "bg-warning"}`} aria-hidden>
                  {c.blocking ? "✕" : "!"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{c.label}</span>
                  {c.detail && <span className="text-ink-faint"> — {c.detail}</span>}
                </span>
                {c.fix ? (
                  <button
                    type="button"
                    onClick={() => actions.onFix(c.id)}
                    disabled={!!fixingCheck || busy}
                    className="flex-none rounded-full border border-border bg-background px-2.5 py-0.5 text-[11.5px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                  >
                    {fixingCheck === c.id ? "Arreglando…" : `🔧 ${c.fix}`}
                  </button>
                ) : c.id === "encaje" ? (
                  <button type="button" onClick={actions.onMoveToLamira} disabled={busy} className="flex-none rounded-full border border-border bg-background px-2.5 py-0.5 text-[11.5px] font-semibold text-ink hover:border-brand hover:text-brand disabled:opacity-50">
                    Mover a La Mira
                  </button>
                ) : (
                  <Link href={item.editHref} className="flex-none text-[11.5px] font-medium text-accent-fg hover:underline">
                    Corregir en la pieza →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {showChecks && (
          <ul className="mt-2 flex flex-col gap-1 rounded-[10px] bg-background px-3 py-2">
            {item.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[12px]">
                <span className={c.passed ? "text-positive" : c.blocking ? "text-negative" : "text-warning"}>{c.passed ? "✓" : c.blocking ? "✕" : "!"}</span>
                <span className="text-ink-soft">
                  {c.label}
                  {c.detail && <span className="text-ink-faint"> — {c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {fixNote && <p className={`mt-2 text-[12px] font-medium ${fixNote.tone === "ok" ? "text-positive" : "text-negative"}`}>{fixNote.text}</p>}
      </div>

      {/* 3 · Opinión de la IA y qué hacer */}
      <div className="border-t border-border-soft px-4 py-3">
        {!review ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-[12px] text-ink-faint">La IA todavía no la revisa: tema, coherencia, datos dudosos y si encaja en su sitio.</p>
            <button
              type="button"
              onClick={actions.onAnalyze}
              disabled={busy || aiLoading}
              className="flex-none rounded-[10px] border border-brand/40 bg-card px-3 py-1.5 text-[12px] font-semibold text-accent-fg transition-colors hover:border-brand disabled:opacity-50"
            >
              {aiLoading ? `${providerLabel} está revisando…` : `✨ Revisar con ${providerLabel}`}
            </button>
          </div>
        ) : (
          <div className={`rounded-[12px] border p-3 ${verdict!.box} ${aiState?.stale && !correctedAfterReview ? "opacity-75" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`grid size-5 place-items-center rounded-full text-[11px] font-bold text-white ${review.veredicto === "publicar" ? "bg-positive" : review.veredicto === "corregir" ? "bg-warning" : "bg-negative"}`} aria-hidden>
                {verdict!.icon}
              </span>
              <span className={`text-[13px] font-semibold ${verdict!.text}`}>IA: {verdict!.title}</span>
              <span className="text-[11px] text-ink-faint" suppressHydrationWarning>
                · revisada {timeAgo(aiState!.reviewedAt)}
              </span>
            </div>

            {/* Dónde encaja, siempre explícito */}
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-soft">
              <span className="font-medium text-ink">Su lugar:</span>
              {review.encaja === "ninguno" ? (
                <span className="font-semibold text-negative">ninguno de los dos sitios</span>
              ) : (
                <SiteBadge site={review.encaja} />
              )}
              {fitsElsewhere && review.encaja !== "ninguno" && <span className="text-ink-faint">(hoy está en {SITE_META[item.site].label})</span>}
            </p>

            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-ink">{review.resumen}</p>

            {aiState?.stale && !correctedAfterReview && <p className="mt-1.5 text-[11.5px] font-medium text-ink-soft">△ La pieza cambió después de esta revisión.</p>}

            {review.problemas.length > 0 && (
              <div className="mt-2">
                <button type="button" onClick={() => setShowProblems((v) => !v)} className="text-[12px] font-semibold text-ink-soft hover:text-ink" aria-expanded={showProblems}>
                  {showProblems ? "▾" : "▸"} {review.problemas.length} {review.problemas.length === 1 ? "cosa por corregir" : "cosas por corregir"}
                </button>
                {showProblems && (
                  <ol className="mt-1.5 flex list-decimal flex-col gap-1 pl-5 text-[12px] leading-[1.5] text-ink-soft">
                    {review.problemas.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {/* Qué hacer, según el veredicto */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {review.veredicto === "descartar" ? (
                <>
                  <span className="text-[12px] font-medium text-ink">¿Qué hacer con ella?</span>
                  {item.site === "planazo" && review.encaja === "la-mira" && (
                    <ActionButton onClick={actions.onMoveToLamira} disabled={busy} primary>
                      Mover a La Mira
                    </ActionButton>
                  )}
                  <ActionButton onClick={actions.onDiscard} disabled={busy} danger>
                    Archivar (no publicar)
                  </ActionButton>
                  {review.problemas.length > 0 && (
                    <ActionButton onClick={actions.onOpenCorrections} disabled={busy}>
                      Intentar corregirla
                    </ActionButton>
                  )}
                </>
              ) : review.veredicto === "corregir" ? (
                <>
                  {review.problemas.length > 0 && (
                    <ActionButton onClick={actions.onOpenCorrections} disabled={busy} primary>
                      ✨ Aplicar correcciones
                    </ActionButton>
                  )}
                  {item.site === "planazo" && review.encaja === "la-mira" && (
                    <ActionButton onClick={actions.onMoveToLamira} disabled={busy}>
                      Mover a La Mira
                    </ActionButton>
                  )}
                </>
              ) : (
                canPublish && (
                  <span className="text-[12px] font-medium text-positive">{selected ? "✓ Seleccionada para publicar" : "Márcala para publicarla ↑"}</span>
                )
              )}
              <span className="flex-1" />
              <button type="button" onClick={actions.onAnalyze} disabled={busy || aiLoading} className="text-[11.5px] font-medium text-ink-faint hover:text-ink disabled:opacity-50">
                {aiLoading ? "Revisando…" : "↻ Revisar de nuevo"}
              </button>
            </div>
          </div>
        )}
        {aiError && (
          <p className="mt-2 text-[12px] text-negative">
            {review ? "No se pudo volver a revisar (se conserva la revisión anterior): " : ""}
            {aiError}
          </p>
        )}
        {correctionsSlot}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border-soft px-4 py-2">
        <a href={url.href} target="_blank" rel="noopener noreferrer" className="text-[11.5px] font-medium text-ink-faint hover:text-ink" title="Solo funciona una vez publicada">
          Ver en el sitio ↗
        </a>
        <Link href={item.editHref} className="text-[12px] font-semibold text-ink hover:text-brand">
          Abrir y editar →
        </Link>
      </div>
    </li>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary = false,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
        primary
          ? "bg-brand text-white hover:bg-brand-pressed"
          : danger
            ? "border border-negative/30 bg-card text-negative hover:bg-negative/10"
            : "border border-border bg-card text-ink hover:border-ink-faint"
      }`}
    >
      {children}
    </button>
  );
}
