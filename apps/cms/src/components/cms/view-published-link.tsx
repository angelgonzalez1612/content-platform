import { siteConfig } from "@planazo/config";
import { Tooltip } from "@/components/cms/tooltip";

const ARROW_PATH = "M7 17L17 7M7 7h10v10";

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/**
 * "Ver publicación" en producción y en desarrollo a la vez — en Contenido,
 * para comparar lo que ve el público contra el sitio que corre en esta
 * máquina. `path` es la ruta dentro del sitio (p.ej. "noticias/mi-slug").
 * Dev solo abre si el sitio local está corriendo (localhost).
 */
export function ViewPublishedLinks({
  site,
  path,
  available,
  compact = false,
}: {
  site: "la-mira" | "planazo";
  path: string;
  available: boolean;
  compact?: boolean;
}) {
  const env = siteConfig.environments[site];
  const links = [
    { key: "prod", label: "Prod", long: "Ver en prod", url: `${env.prod}/${path}`, hint: `Sitio público · ${hostOf(env.prod)}` },
    { key: "dev", label: "Dev", long: "Ver en dev", url: `${env.dev}/${path}`, hint: `Tu servidor local · ${hostOf(env.dev)}` },
  ];

  if (!available) {
    return compact ? (
      <Tooltip label="Se podrá ver en el sitio una vez publicado">
        <span className="inline-flex gap-1">
          {links.map((l) => (
            <span key={l.key} className="rounded-md border border-border-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-faint/60">
              {l.label}
            </span>
          ))}
        </span>
      </Tooltip>
    ) : (
      <span className="text-[11.5px] text-ink-faint">Se podrá ver en el sitio una vez publicado</span>
    );
  }

  if (compact) {
    return (
      <span className="inline-flex gap-1">
        {links.map((l) => (
          <Tooltip key={l.key} label={l.hint}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${l.long}: ${l.hint}`}
              className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold transition-colors ${
                l.key === "prod"
                  ? "border-brand/30 text-accent-fg hover:border-brand hover:bg-accent"
                  : "border-border text-ink-soft hover:border-ink-faint hover:text-ink"
              }`}
            >
              {l.label}
            </a>
          </Tooltip>
        ))}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {links.map((l) => (
        <Tooltip key={l.key} label={l.hint}>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[11.5px] font-medium whitespace-nowrap transition-colors ${
              l.key === "prod"
                ? "border-brand/30 bg-accent text-accent-fg hover:border-brand"
                : "border-border bg-card text-ink-soft hover:border-ink-faint hover:text-ink"
            }`}
          >
            {l.long}
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ARROW_PATH} />
            </svg>
          </a>
        </Tooltip>
      ))}
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
