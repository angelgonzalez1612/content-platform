"use client";

/** Evento que abre la vista previa a pantalla completa de EditPreviewLayout. */
export const OPEN_FULL_PREVIEW_EVENT = "cms:open-full-preview";

/**
 * "Vista previa" en el encabezado de la pieza: abre, dentro del CMS, cómo
 * quedaría en el sitio — con lo que hay en el formulario aunque no esté
 * guardado, y sin necesitar los sitios corriendo en local.
 */
export function OpenPreviewButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_FULL_PREVIEW_EVENT))}
      title="Cómo quedaría en el sitio, con los cambios sin guardar"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-[3px] text-[11.5px] font-medium whitespace-nowrap text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
    >
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      Vista previa
    </button>
  );
}
