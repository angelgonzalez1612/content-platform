import type { Place } from "@planazo/types";

const STATUS_STYLE: Record<Place["status"], { label: string; bg: string; fg: string }> = {
  draft: { label: "Borrador", bg: "#F3F0EC", fg: "#5C564F" },
  in_review: { label: "En revisión", bg: "#FEF6E7", fg: "#9A6B12" },
  published: { label: "Publicado", bg: "#EAF7EF", fg: "#2E9E5B" },
  archived: { label: "Archivado", bg: "#FDECEA", fg: "#C4453A" },
};

export function StatusBadge({ status }: { status: Place["status"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center rounded-md font-mono text-[10px] font-medium tracking-[.03em]"
      style={{ background: s.bg, color: s.fg, padding: "3px 7px" }}
    >
      {s.label}
    </span>
  );
}
