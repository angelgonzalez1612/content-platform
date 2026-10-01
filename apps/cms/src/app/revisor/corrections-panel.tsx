"use client";

import { useState } from "react";
import { apiConfig } from "@planazo/config";
import { TASK_LABEL_HEADER } from "@/components/cms/global-activity";
import type { ReviewQueueItem } from "@/lib/review-agent-types";
import { BlockSelectionList, blockStatus, useBlockSelection } from "@/components/cms/lamira/block-selection";
import type { ContentBlockValue } from "@/components/cms/content-blocks-field";

interface Proposal {
  problems: string[];
  current: { title: string; summary: string; content: ContentBlockValue[] };
  proposed: { title: string; summary: string; content: ContentBlockValue[] };
  bodyEditable: boolean;
  note: string;
}

/**
 * "Aplicar correcciones": la IA reescribe la pieza siguiendo los problemas de
 * su revisión y aquí se muestra el antes/después. Nada se guarda hasta
 * "Guardar lo marcado" (queda en el historial de versiones; sigue en revisión).
 */
export function CorrectionsPanel({
  item,
  provider,
  providerLabel,
  onApplied,
  onClose,
}: {
  item: ReviewQueueItem;
  provider: string;
  providerLabel: string;
  onApplied: (item: ReviewQueueItem, message: string) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [useTitle, setUseTitle] = useState(true);
  const [useSummary, setUseSummary] = useState(true);
  const selection = useBlockSelection(proposal?.proposed.content ?? [], proposal);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/review-agent/corrections`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", [TASK_LABEL_HEADER]: `Proponer correcciones · ${item.title}` },
        body: JSON.stringify({ type: item.type, id: item.id, provider }),
      });
      const body = (await res.json().catch(() => null)) as (Proposal & { message?: string }) | null;
      if (!res.ok || !body?.proposed) {
        setError(body?.message ?? "La IA no pudo proponer correcciones.");
        return;
      }
      setProposal(body);
      setUseTitle(body.proposed.title !== body.current.title);
      setUseSummary(body.proposed.summary !== body.current.summary);
    } catch {
      setError("Sin conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!proposal) return;
    setSaving(true);
    setError("");
    const titleChanged = useTitle && proposal.proposed.title !== proposal.current.title;
    const summaryChanged = useSummary && proposal.proposed.summary !== proposal.current.summary;
    const content = proposal.bodyEditable && selection.selected > 0 ? selection.selectedBlocks() : undefined;
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}/cms/review-agent/corrections/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", [TASK_LABEL_HEADER]: `Guardar correcciones · ${item.title}` },
        body: JSON.stringify({
          type: item.type,
          id: item.id,
          ...(titleChanged && { title: proposal.proposed.title }),
          ...(summaryChanged && { summary: proposal.proposed.summary }),
          ...(content && { content: content.map((b) => ({ heading: b.heading, paragraphs: b.paragraphs })) }),
        }),
      });
      const body = (await res.json().catch(() => null)) as { item?: ReviewQueueItem; message?: string } | null;
      if (!res.ok || !body?.item) {
        setError(body?.message ?? "No se pudieron guardar las correcciones.");
        return;
      }
      onApplied(body.item, body.message ?? "Correcciones guardadas.");
    } catch {
      setError("Sin conexión con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  const nothing =
    !!proposal &&
    !(useTitle && proposal.proposed.title !== proposal.current.title) &&
    !(useSummary && proposal.proposed.summary !== proposal.current.summary) &&
    !(proposal.bodyEditable && selection.selected > 0);

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-[10px] border border-brand/40 bg-accent/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12.5px] font-semibold text-ink">Aplicar correcciones con IA</p>
          <p className="text-[11.5px] text-ink-soft">
            {providerLabel} reescribe la pieza siguiendo la lista de problemas, sin inventar datos: lo que no puede verificar lo quita o lo suaviza. Tú eliges qué guardar.
          </p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} className="flex-none rounded-md px-1.5 text-[12px] text-ink-soft hover:text-ink">
          Cerrar
        </button>
      </div>

      {!proposal && (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="flex w-fit items-center gap-1.5 rounded-[10px] bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:opacity-70"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""} aria-hidden>
            <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" />
          </svg>
          {loading ? `${providerLabel} está corrigiendo… (puede tardar 1 min)` : "Proponer correcciones"}
        </button>
      )}

      {error && <p className="rounded-lg bg-negative/10 px-3 py-2 text-[12px] font-medium text-negative">{error}</p>}

      {proposal && (
        <>
          {proposal.note && <p className="rounded-lg bg-card px-3 py-2 text-[12px] text-ink-soft">💬 {proposal.note}</p>}

          {(["title", "summary"] as const).map((field) => {
            const before = proposal.current[field];
            const after = proposal.proposed[field];
            const on = field === "title" ? useTitle : useSummary;
            const setOn = field === "title" ? setUseTitle : setUseSummary;
            const label = field === "title" ? "Título" : item.type === "place" || item.type === "evento-planazo" ? "Descripción" : "Bajada";
            if (before === after) {
              return (
                <p key={field} className="text-[11.5px] text-ink-faint">
                  {label}: sin cambios.
                </p>
              );
            }
            return (
              <label key={field} className="flex cursor-pointer gap-2.5 rounded-[10px] border border-border bg-card p-2.5">
                <input type="checkbox" checked={on} onChange={() => setOn(!on)} className="mt-0.5 size-4 flex-none rounded border-border accent-brand" />
                <span className="grid min-w-0 flex-1 grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-2">
                  <span>
                    <span className="block font-mono text-[10px] tracking-[.1em] text-ink-faint uppercase">{label} actual</span>
                    <span className="text-ink-soft">{before || "(vacío)"}</span>
                  </span>
                  <span>
                    <span className="block font-mono text-[10px] tracking-[.1em] text-accent-fg uppercase">{label} corregido</span>
                    <span className={on ? "text-ink" : "text-ink-faint line-through"}>{after}</span>
                  </span>
                </span>
              </label>
            );
          })}

          {proposal.bodyEditable ? (
            proposal.proposed.content.length > 0 && (
              <div className="rounded-[10px] bg-card p-2.5">
                <BlockSelectionList
                  selection={selection}
                  statuses={proposal.proposed.content.map((b) => blockStatus(b, proposal.current.content))}
                  title="Cuerpo corregido"
                  hint="Lo marcado reemplaza al cuerpo actual. Quita lo que no quieras."
                />
              </div>
            )
          ) : (
            <p className="text-[11.5px] text-ink-faint">En las guías de Planazo las secciones son lugares reales: el cuerpo se corrige a mano.</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={saving || nothing}
              className="rounded-[10px] bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-pressed disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar lo marcado"}
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={loading || saving}
              className="rounded-[10px] border border-border bg-card px-3.5 py-2 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
            >
              {loading ? "Corrigiendo…" : "Proponer otra vez"}
            </button>
            <span className="text-[11px] text-ink-faint">Se guarda en la pieza (sigue en revisión) y queda en su historial de versiones.</span>
          </div>
        </>
      )}
    </div>
  );
}
