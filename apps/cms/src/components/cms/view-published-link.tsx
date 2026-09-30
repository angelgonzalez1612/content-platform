import { siteConfig } from "@planazo/config";
import Link from "next/link";
import { Tooltip } from "@/components/cms/tooltip";
import { OpenPreviewButton } from "@/components/cms/open-preview-button";

const ARROW_PATH = "M7 17L17 7M7 7h10v10";

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * "Ver en prod" (el sitio público, solo si ya está publicada) + "Vista
 * previa" (cómo quedaría, armada dentro del CMS — no necesita los sitios
 * corriendo en local). `path` es la ruta dentro del sitio (p.ej.
 * "noticias/mi-slug"). En el encabezado de la pieza la vista previa se abre
 * ahí mismo; en la tabla de Contenido (`compact`), `previewHref` lleva a la
 * pieza con la vista previa ya abierta.
 */
export function ViewPublishedLinks({
  site,
  path,
  available,
  compact = false,
  previewHref,
}: {
  site: "la-mira" | "planazo";
  path: string;
  available: boolean;
  compact?: boolean;
  /** Solo en `compact`: ruta de edición de la pieza (se le agrega ?preview=1). */
  previewHref?: string;
}) {
  const env = siteConfig.environments[site];
  const prodUrl = `${env.prod}/${path}`;
  const prodHint = `Sitio público · ${hostOf(env.prod)}`;

  if (compact) {
    return (
      <span className="inline-flex gap-1">
        {available ? (
          <Tooltip label={prodHint}>
            <a
              href={prodUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ver en prod: ${prodHint}`}
              className="rounded-md border border-brand/30 px-1.5 py-0.5 text-[10.5px] font-semibold text-accent-fg transition-colors hover:border-brand hover:bg-accent"
            >
              Prod
            </a>
          </Tooltip>
        ) : (
          <Tooltip label="Se podrá ver en el sitio una vez publicado">
            <span className="rounded-md border border-border-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-faint/60">Prod</span>
          </Tooltip>
        )}
        {previewHref && (
          <Tooltip label="Vista previa: cómo quedaría en el sitio">
            <Link
              href={`${previewHref}?preview=1`}
              aria-label="Vista previa: cómo quedaría en el sitio"
              className="rounded-md border border-border px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
            >
              Vista
            </Link>
          </Tooltip>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {available ? (
        <Tooltip label={prodHint}>
          <a
            href={prodUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-accent px-2.5 py-[3px] text-[11.5px] font-medium whitespace-nowrap text-accent-fg transition-colors hover:border-brand"
          >
            Ver en prod
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ARROW_PATH} />
            </svg>
          </a>
        </Tooltip>
      ) : (
        <span className="text-[11.5px] text-ink-faint">Aún no se ve en el sitio</span>
      )}
      <OpenPreviewButton />
    </span>
  );
}

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
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
    >
      Ver publicación
      {icon}
    </a>
  );
}
