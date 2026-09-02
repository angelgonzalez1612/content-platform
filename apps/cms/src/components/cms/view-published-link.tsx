import { Tooltip } from "@/components/cms/tooltip";

// Botón "Ver publicación" — abre el contenido tal como está en vivo en el
// sitio real (La Mira o Planazo), en pestaña nueva. Cuando el contenido
// todavía no es visible ahí (borrador/en revisión, ver `available`), se
// muestra un aviso en su lugar en vez de un link que llevaría a un 404.
//
// `compact`: variante de solo-ícono para filas de tabla (ver /contenido) —
// mismo componente, mismo estado deshabilitado, con un Tooltip visible (no
// solo el `title` nativo, que tarda ~1s y no todos lo notan) explicando qué
// hace el botón sin necesitar el texto largo, que no cabe en una columna angosta.
export function ViewPublishedLink({ href, available, compact = false }: { href: string; available: boolean; compact?: boolean }) {
  const icon = (
    <svg width={compact ? 13 : 11} height={compact ? 13 : 11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7M7 7h10v10" />
    </svg>
  );

  if (!available) {
    if (compact) {
      return (
        <Tooltip label="Se podrá ver en el sitio una vez publicado">
          <span className="inline-flex size-7 items-center justify-center rounded-lg text-ink-faint/50">{icon}</span>
        </Tooltip>
      );
    }
    return <span className="text-[11.5px] text-ink-faint">Se podrá ver en el sitio una vez publicado</span>;
  }

  if (compact) {
    return (
      <Tooltip label="Ver publicación">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex size-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-accent hover:text-brand"
        >
          {icon}
        </a>
      </Tooltip>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
    >
      Ver publicación
      {icon}
    </a>
  );
}
