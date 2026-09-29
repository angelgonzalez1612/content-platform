import { Tooltip } from "@/components/cms/tooltip";

/** Celda "Fuente" de las tablas de Contenido: abre la nota original de la que salió la pieza. */
export function SourceLink({ url }: { url: string | null | undefined }) {
  if (!url) return <span className="text-[11px] text-ink-faint">—</span>;
  return (
    <Tooltip label="Ver fuente original">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ver fuente original"
        className="inline-flex size-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-accent hover:text-brand"
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17L17 7M7 7h10v10" />
        </svg>
      </a>
    </Tooltip>
  );
}
