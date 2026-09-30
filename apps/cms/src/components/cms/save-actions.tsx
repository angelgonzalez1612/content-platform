"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";

type Status = string;

const PRIMARY_CLASS =
  "rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-brand-pressed hover:shadow-[0_10px_24px_-10px_rgba(253,105,13,.55)] disabled:translate-y-0 disabled:cursor-default disabled:opacity-60 disabled:shadow-none";
const PUBLISH_CLASS =
  "rounded-[10px] border border-positive/30 bg-positive/10 px-4 py-2.5 text-[13.5px] font-semibold text-positive transition-colors hover:bg-positive/15 disabled:cursor-default disabled:opacity-60";
// Sin cambios: el botón principal se ve apagado (no invita a hacer clic).
const IDLE_CLASS = "rounded-[10px] border border-border bg-background px-4 py-2.5 text-[13.5px] font-semibold text-ink-faint cursor-default";
const QUIET_CLASS =
  "rounded-[10px] px-3 py-2.5 text-[13px] font-medium text-ink-faint transition-colors hover:bg-negative/10 hover:text-negative disabled:cursor-default disabled:opacity-60";

/** Texto del botón principal: guarda sin cambiar el estado de la pieza. */
function primaryLabel(saved: Status | null): string {
  if (saved === "published") return "Guardar actualizaciones";
  if (saved === "in_review") return "Guardar (sigue en revisión)";
  if (saved === "draft") return "Guardar borrador";
  return "Guardar cambios";
}

/** Confirmación tras guardar, según de dónde a dónde cambió el estado. */
function savedMessage(before: Status | null, after: Status, siteLabel: string): string {
  if (after === "published") {
    return before === "published" ? `Publicación actualizada ✓ · ya se ve en ${siteLabel}` : `Publicado ✓ · ya se ve en ${siteLabel}`;
  }
  if (before === "published") return `Despublicado ✓ · ya no se ve en ${siteLabel}`;
  if (after === "in_review") return "Guardado ✓ · sigue en revisión";
  if (after === "draft") return "Guardado como borrador ✓";
  return "Guardado ✓";
}

export interface DeleteConfig {
  /** Endpoint DELETE de la pieza (ruta del CMS, ej. /cms/places/123). */
  path: string;
  /** A dónde volver tras eliminar. */
  redirectTo: string;
  /** Cómo se llama la pieza en el modal (su título). */
  itemTitle: string;
}

/** Modal de confirmación para eliminar (dialog nativo: foco atrapado y Esc para cerrar). */
function DeleteDialog({ config, siteLabel, dialogRef }: { config: DeleteConfig; siteLabel: string; dialogRef: React.RefObject<HTMLDialogElement | null> }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.clientBaseUrl}${config.path}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(res.status === 403 ? "Solo un administrador puede eliminar contenido." : (body?.message ?? "No se pudo eliminar."));
        setDeleting(false);
        return;
      }
      dialogRef.current?.close();
      router.push(config.redirectTo);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
      setDeleting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-dialog-title"
      onClose={() => setError("")}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-[14px] border border-border bg-card p-0 text-ink shadow-[0_24px_60px_-20px_rgba(23,20,17,.45)] backdrop:bg-ink-solid/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 flex-none place-items-center rounded-full bg-negative/12 text-negative" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="delete-dialog-title" className="text-[15px] font-semibold tracking-tight">
              ¿Eliminar esta pieza?
            </h2>
            <p className="mt-1 line-clamp-2 text-[13px] font-medium text-ink-soft">«{config.itemTitle}»</p>
          </div>
        </div>
        <p className="text-[12.5px] leading-[1.5] text-ink-soft">
          Se borra del CMS y deja de verse en {siteLabel}. No se puede deshacer desde aquí; queda una copia en el historial de versiones por si hay que
          recuperarla a mano.
        </p>
        {error && <p className="rounded-lg bg-negative/10 px-3 py-2 text-[12.5px] font-medium text-negative">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-border-soft bg-background px-5 py-3">
        <button
          type="button"
          autoFocus
          onClick={() => dialogRef.current?.close()}
          disabled={deleting}
          className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink-faint disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmDelete}
          disabled={deleting}
          className="rounded-[10px] bg-negative px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-60"
        >
          {deleting ? "Eliminando…" : "Sí, eliminar"}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Barra de acciones de los formularios de contenido, fija abajo mientras se
 * edita. El botón principal guarda sin cambiar el estado; "Publicar" y
 * "Despublicar" lo cambian (opcionales: alerta/evento/lugar de La Mira no
 * tienen estado, siempre están publicados); "Eliminar" pide confirmación.
 * La confirmación de guardado dice qué pasó en el sitio.
 */
export function SaveActions({
  isEdit,
  saving,
  createLabel,
  savedStatus,
  savedAt,
  onPublish,
  onUnpublish,
  siteLabel,
  deleteConfig,
  dirty = true,
}: {
  isEdit: boolean;
  saving: boolean;
  createLabel: string;
  /** Estado que tiene la pieza en la base (null si todavía no existe). */
  savedStatus: Status | null;
  savedAt: number | null;
  onPublish?: () => void;
  /** Regresa la pieza a borrador (deja de verse en el sitio). */
  onUnpublish?: () => void;
  /** Dónde se ve publicada, p.ej. "lamira.mx". */
  siteLabel: string;
  /** Si se pasa (y la pieza ya existe), aparece "Eliminar" con confirmación. */
  deleteConfig?: DeleteConfig;
  /** ¿Hay cambios sin guardar? Sin cambios, el botón principal queda apagado (ver useDirty). */
  dirty?: boolean;
}) {
  // Estado antes del último guardado — para decir "Publicado" vs "Publicación actualizada".
  const [statusBeforeSave, setStatusBeforeSave] = useState<Status | null>(savedStatus);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isPublished = savedStatus === "published";
  const showPublish = isEdit && !isPublished && !!onPublish;
  const showUnpublish = isEdit && isPublished && !!onUnpublish;
  const idle = isEdit && !dirty && !saving;

  return (
    <div className="sticky bottom-3 z-20 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] border border-border bg-card/95 px-3 py-2.5 shadow-[0_12px_32px_-14px_rgba(23,20,17,.35)] backdrop-blur-sm">
      <button
        type="submit"
        disabled={saving || idle}
        onClick={() => setStatusBeforeSave(savedStatus)}
        title={idle ? "No hay cambios por guardar" : undefined}
        className={idle ? IDLE_CLASS : PRIMARY_CLASS}
      >
        {saving ? "Guardando…" : idle ? "Sin cambios" : isEdit ? primaryLabel(savedStatus) : createLabel}
      </button>
      {showPublish && (
        <button
          type="button"
          onClick={() => {
            setStatusBeforeSave(savedStatus);
            onPublish?.();
          }}
          disabled={saving}
          className={PUBLISH_CLASS}
        >
          Publicar
        </button>
      )}

      <span role="status" className="min-w-0 flex-1 truncate text-[12px]">
        {isEdit && dirty && !saving ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-warning">
            <span aria-hidden className="size-1.5 rounded-full bg-warning" />
            Cambios sin guardar{isPublished ? ` · aún no se ven en ${siteLabel}` : ""}
          </span>
        ) : savedAt && savedStatus ? (
          <span className="font-mono text-positive">{savedMessage(statusBeforeSave, savedStatus, siteLabel)}</span>
        ) : isEdit ? (
          <span className="text-ink-faint">{isPublished ? `Publicado en ${siteLabel}` : `Sin publicar · no se ve en ${siteLabel}`}</span>
        ) : null}
      </span>

      {(showUnpublish || (isEdit && deleteConfig)) && (
        <span className="flex flex-none items-center gap-1 border-l border-border-soft pl-2">
          {showUnpublish && (
            <button
              type="button"
              onClick={() => {
                setStatusBeforeSave(savedStatus);
                onUnpublish?.();
              }}
              disabled={saving}
              title={`Regresa la pieza a borrador: deja de verse en ${siteLabel}`}
              className={QUIET_CLASS}
            >
              Despublicar
            </button>
          )}
          {isEdit && deleteConfig && (
            <button type="button" onClick={() => dialogRef.current?.showModal()} disabled={saving} className={QUIET_CLASS}>
              Eliminar
            </button>
          )}
        </span>
      )}

      {isEdit && deleteConfig && <DeleteDialog config={deleteConfig} siteLabel={siteLabel} dialogRef={dialogRef} />}
    </div>
  );
}
