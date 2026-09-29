"use client";

import { useState } from "react";

type Status = string;

const PRIMARY_CLASS =
  "rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-60 disabled:shadow-none";
const PUBLISH_CLASS =
  "rounded-[10px] border border-positive/30 bg-positive/10 px-4 py-2.5 text-[13.5px] font-semibold text-positive transition-colors hover:bg-positive/15 disabled:cursor-default disabled:opacity-60";

/** Texto del botón principal según lo que va a pasar al guardar. */
function primaryLabel(saved: Status | null, selected: Status): string {
  const wasPublished = saved === "published";
  const willPublish = selected === "published";
  if (wasPublished && willPublish) return "Actualizar publicación";
  if (wasPublished && !willPublish) return "Guardar y despublicar";
  if (willPublish) return "Guardar y publicar";
  if (selected === "draft") return "Guardar borrador";
  if (selected === "in_review") return "Guardar (en revisión)";
  return "Guardar cambios";
}

/** Confirmación tras guardar, según de dónde a dónde cambió el estado. */
function savedMessage(before: Status | null, after: Status, siteLabel: string): string {
  if (after === "published") {
    return before === "published" ? `Publicación actualizada ✓ · ${siteLabel} se actualiza en ~1 min` : `Publicado ✓ · ya se ve en ${siteLabel}`;
  }
  if (before === "published") return `Despublicado ✓ · ya no se ve en ${siteLabel}`;
  if (after === "in_review") return "Guardado ✓ · sigue en revisión";
  if (after === "draft") return "Guardado como borrador ✓";
  return "Guardado ✓";
}

/**
 * Botones de guardar/publicar de los formularios con estado (noticia,
 * reportaje, guía, lugar, evento…). El botón dice lo que va a pasar
 * ("Actualizar publicación", "Guardar y publicar"…) según el estado ya guardado
 * y el elegido en el selector, y la confirmación dice qué pasó en el sitio.
 */
export function SaveActions({
  isEdit,
  saving,
  createLabel,
  savedStatus,
  selectedStatus,
  savedAt,
  onPublish,
  siteLabel,
}: {
  isEdit: boolean;
  saving: boolean;
  createLabel: string;
  /** Estado que tiene la pieza en la base (null si todavía no existe). */
  savedStatus: Status | null;
  /** Estado elegido en el selector del formulario. */
  selectedStatus: Status;
  savedAt: number | null;
  onPublish: () => void;
  /** Dónde se ve publicada, p.ej. "lamira.mx". */
  siteLabel: string;
}) {
  // Estado antes del último guardado — para decir "Publicado" vs "Publicación actualizada".
  const [statusBeforeSave, setStatusBeforeSave] = useState<Status | null>(savedStatus);
  const isPublished = savedStatus === "published";
  const showPublish = isEdit && !isPublished && selectedStatus !== "published";

  return (
    <div className="flex flex-col gap-2 border-t border-border-soft pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} onClick={() => setStatusBeforeSave(savedStatus)} className={PRIMARY_CLASS}>
          {saving ? "Guardando…" : isEdit ? primaryLabel(savedStatus, selectedStatus) : createLabel}
        </button>
        {showPublish && (
          <button
            type="button"
            onClick={() => {
              setStatusBeforeSave(savedStatus);
              onPublish();
            }}
            disabled={saving}
            className={PUBLISH_CLASS}
          >
            Publicar
          </button>
        )}
        {savedAt && savedStatus && (
          <span role="status" className="font-mono text-[12px] text-positive">
            {savedMessage(statusBeforeSave, savedStatus, siteLabel)}
          </span>
        )}
      </div>
      {isEdit && !savedAt && (
        <p className="text-[12px] text-ink-faint">
          {isPublished
            ? `Publicado · lo que guardes se refleja en ${siteLabel} en ~1 min.`
            : `Sin publicar · no se ve en ${siteLabel} hasta que lo publiques.`}
        </p>
      )}
    </div>
  );
}
