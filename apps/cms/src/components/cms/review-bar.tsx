import Link from "next/link";
import { contenidoHref, reviewHref, type ReviewItem, type ReviewSite } from "@/lib/review-queue";

const NAV_CLASS =
  "inline-flex items-center gap-1 rounded-lg border border-warning/30 bg-card px-2.5 py-1 text-[12px] font-semibold text-ink transition-colors hover:border-warning hover:text-warning";
const NAV_DISABLED_CLASS = "inline-flex items-center gap-1 rounded-lg border border-border-soft px-2.5 py-1 text-[12px] font-semibold text-ink-faint/60";

function NavLink({ item, site, children, label }: { item: ReviewItem | undefined; site: ReviewSite; children: React.ReactNode; label: string }) {
  if (!item) return <span className={NAV_DISABLED_CLASS}>{children}</span>;
  return (
    <Link href={reviewHref(item.href, site)} className={NAV_CLASS} title={`${label}: ${item.typeLabel} · ${item.title}`}>
      {children}
    </Link>
  );
}

/**
 * Barra del modo revisión en la ficha de edición: posición en la cola de
 * piezas "En revisión" y flechas para pasar a la anterior/siguiente sin
 * regresar a la tabla. Si la pieza actual ya salió de la cola (se publicó o
 * despublicó), ofrece seguir con la siguiente que queda.
 */
export function ReviewBar({ site, queue, currentHref }: { site: ReviewSite; queue: ReviewItem[]; currentHref: string }) {
  const index = queue.findIndex((item) => item.href === currentHref);
  const tableHref = contenidoHref(site, "estado=en_revision");

  let status: React.ReactNode;
  let prev: ReviewItem | undefined;
  let next: ReviewItem | undefined;

  if (index >= 0) {
    prev = queue[index - 1];
    next = queue[index + 1];
    status = (
      <>
        En revisión · <span className="tabular-nums">{index + 1}</span> de <span className="tabular-nums">{queue.length}</span>
      </>
    );
  } else if (queue.length > 0) {
    next = queue[0];
    status = (
      <>
        ✓ Esta pieza ya salió de revisión · quedan <span className="tabular-nums">{queue.length}</span>
      </>
    );
  } else {
    status = "✓ No quedan piezas en revisión";
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-warning/25 bg-warning/10 px-3 py-1.5">
      <span className="text-[12.5px] font-semibold text-warning">
        <span aria-hidden>⏳ </span>
        {status}
      </span>
      <span className="flex items-center gap-1.5">
        {index >= 0 && (
          <NavLink item={prev} site={site} label="Anterior">
            <span aria-hidden>‹</span> Anterior
          </NavLink>
        )}
        <NavLink item={next} site={site} label="Siguiente">
          Siguiente <span aria-hidden>›</span>
        </NavLink>
      </span>
      <span className="ml-auto flex items-center gap-3 text-[12px]">
        <Link href={tableHref} className="font-medium text-ink-soft hover:text-brand">
          Ver todas en la tabla
        </Link>
        <Link href={currentHref} className="font-medium text-ink-faint hover:text-ink" title="Quitar la barra de revisión">
          Salir
        </Link>
      </span>
    </div>
  );
}
