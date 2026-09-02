// Insignia de estado EDITORIAL para la tabla de /contenido (La Mira) — solo
// noticia/guía/reportaje tienen flujo de borrador real (ContentStatus).
// Alerta/evento/lugar se publican de inmediato al crearse (ver
// AiDraftService) — para esos, la columna "Estado" siempre debe decir
// "Publicado" (ver PUBLISHED_BADGE más abajo), nunca su estado de situación
// real (activa/próximo/etc, que es información distinta — ver
// DOMAIN_STATUS_LABEL). Mismo lenguaje visual que StatusBadge (Planazo).
const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: "Borrador", bg: "#F3F0EC", fg: "#5C564F" },
  in_review: { label: "En revisión", bg: "#FEF6E7", fg: "#9A6B12" },
  scheduled: { label: "Programado", bg: "#EAF1FE", fg: "#2A5FB8" },
  published: { label: "Publicado", bg: "#EAF7EF", fg: "#2E9E5B" },
  archived: { label: "Archivado", bg: "#FDECEA", fg: "#C4453A" },
};

export function LamiraStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.published;
  return (
    <span
      className="inline-flex items-center rounded-md font-mono text-[10px] font-medium tracking-[.03em]"
      style={{ background: s.bg, color: s.fg, padding: "3px 7px" }}
    >
      {s.label}
    </span>
  );
}

// Alerta/evento/lugar no tienen borrador — siempre están publicados, así que
// la columna "Estado" no necesita mirar su campo `status` en absoluto.
export function PublishedBadge() {
  return <LamiraStatusBadge status="published" />;
}

// Situación real de alerta/evento — información distinta a "¿está
// publicado?", se muestra aparte (subtítulo bajo el título), no como badge
// de estado. "lugar" no tiene equivalente, no aparece aquí.
const DOMAIN_STATUS_LABEL: Record<string, string> = {
  activa: "Activa",
  "en-seguimiento": "En seguimiento",
  resuelta: "Resuelta",
  proximo: "Próximo",
  "en-curso": "En curso",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export function domainStatusLabel(status: string): string | null {
  return DOMAIN_STATUS_LABEL[status] ?? null;
}
