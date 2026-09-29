import Link from "next/link";
import type { ReviewSite } from "@/lib/review-queue";

/**
 * Aviso de piezas "En revisión" en Contenido. La acción principal entra al
 * modo revisión (abre la más reciente, con flechas anterior/siguiente — ver
 * ReviewBar); la secundaria solo filtra la tabla, como antes.
 */
export function ReviewBanner({ count, site, onShowInTable }: { count: number; site: ReviewSite; onShowInTable: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[10px] border border-warning/30 bg-warning/10 px-4 py-3">
      <p className="min-w-0 flex-1 text-[13px] leading-[1.45] text-warning">
        <span aria-hidden>⏳ </span>
        <span className="font-semibold">
          {count} {count === 1 ? "elemento" : "elementos"} en revisión
        </span>{" "}
        — no salieron publicados solos porque no pasaron algún check automático (longitud, SEO, foto…). Revísalos antes de publicarlos.
      </p>
      <div className="flex flex-none items-center gap-2">
        <button
          type="button"
          onClick={onShowInTable}
          className="rounded-[9px] px-3 py-1.5 text-[12.5px] font-medium text-warning transition-colors hover:bg-warning/10"
        >
          Ver en la tabla
        </button>
        <Link
          href={`/contenido/revision?site=${site}`}
          className="rounded-[9px] bg-warning px-3.5 py-1.5 text-[12.5px] font-semibold text-card transition-opacity hover:opacity-90"
        >
          Revisar una por una →
        </Link>
      </div>
    </div>
  );
}
