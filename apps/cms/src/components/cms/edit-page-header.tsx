import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Encabezado fijo (sticky) de las fichas de edición de Contenido — compacto a
 * propósito: una sola franja con tipo, título y acciones, para que el
 * formulario ocupe la mayor parte de la pantalla. El historial de versiones
 * va en el cuerpo de la página (ver las páginas de /contenido/.../[id]), no
 * aquí, así se va con el scroll.
 *
 * El contenedor con scroll es el `overflow-y-auto` de CmsShell, así que
 * `sticky top-0` en un hijo directo se pega ahí solo.
 */
export function EditPageHeader({
  kicker,
  title,
  subtitle,
  actions,
  review,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Barra del modo revisión (ver ReviewBar), si se entró desde la cola. */
  review?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-border-soft bg-background/95 px-[26px] py-3 backdrop-blur-sm">
      {review && <div className="mb-2.5">{review}</div>}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            <Link href="/contenido" className="font-medium text-ink-soft transition-colors hover:text-brand">
              ← Contenido
            </Link>
            <span aria-hidden>·</span>
            <span className="font-mono text-[10px] font-medium tracking-[.1em] uppercase">{kicker}</span>
          </p>
          <h1 className="mt-0.5 truncate text-[18px] leading-[1.3] font-semibold tracking-tight" title={title}>
            {title}
            {subtitle && <span className="ml-2 text-[12.5px] font-normal text-ink-faint">{subtitle}</span>}
          </h1>
        </div>
        {actions && <div className="flex-none">{actions}</div>}
      </div>
    </div>
  );
}
