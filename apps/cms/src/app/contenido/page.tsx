import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getCmsPlaces, getCmsLamiraContent, getCmsEvents, getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { StatusBadge } from "@/components/cms/status-badge";
import { SiteTabs } from "@/components/cms/site-tabs";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

const LAMIRA_TYPE_LABEL: Record<string, string> = {
  noticia: "Noticia",
  alerta: "Alerta",
  guia: "Guía",
  evento: "Evento",
  lugar: "Lugar",
  reportaje: "Reportaje",
};

export default async function ContenidoPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { site } = await searchParams;
  const isLamira = site === "lamira";

  if (isLamira) {
    const rows = await getCmsLamiraContent();
    return (
      <CmsShell user={session} title="Contenido">
        <div className="p-[26px] pb-[60px]">
          <SiteTabs site="lamira" basePath="/contenido" />
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h1 className="mb-1 text-[22px] font-semibold tracking-tight">La Mira</h1>
              <p className="text-[13.5px] text-ink-soft">
                {rows.length} {rows.length === 1 ? "elemento" : "elementos"} · noticias, alertas, guías, eventos,
                lugares y reportajes.
              </p>
            </div>
            <Link
              href="/crear?site=lamira"
              className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
            >
              + Crear
            </Link>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="grid grid-cols-[100px_1fr_140px_120px_110px] gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
              <span>Tipo</span>
              <span>Título</span>
              <span>Categoría</span>
              <span>Estado</span>
              <span className="text-right">Fecha</span>
            </div>

            {rows.length === 0 ? (
              <p className="p-8 text-center text-[13.5px] text-ink-soft">
                Todavía no hay contenido de la-mira. Créalo con el botón de arriba.
              </p>
            ) : (
              rows.map((row) => (
                <Link
                  key={`${row.type}-${row.id}`}
                  href={`/contenido/lamira/${row.type}/${row.id}`}
                  className="grid grid-cols-[100px_1fr_140px_120px_110px] items-center gap-0 border-b border-border-soft px-4 py-3 transition-colors last:border-b-0 hover:bg-[#FEFCFA]"
                >
                  <span className="text-[11.5px] text-ink-faint">{LAMIRA_TYPE_LABEL[row.type]}</span>
                  <span className="min-w-0 truncate pr-3 text-[13.5px] font-medium tracking-tight">{row.title}</span>
                  <span className="text-[12.5px] text-ink-soft">{row.categoryName}</span>
                  <span className="font-mono text-[10px] text-ink-faint">{row.status}</span>
                  <span className="text-right font-mono text-[11px] text-ink-faint">{formatDate(row.date)}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </CmsShell>
    );
  }

  const [places, events, planazoCategories] = await Promise.all([getCmsPlaces(), getCmsEvents(), getCmsCategories("planazo")]);
  const categoryNameById = new Map(planazoCategories.map((c) => [c.id, c.name]));

  return (
    <CmsShell user={session} title="Contenido">
      <div className="p-[26px] pb-[60px]">
        <SiteTabs site="planazo" basePath="/contenido" />
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Lugares</h1>
            <p className="text-[13.5px] text-ink-soft">
              {places.length} {places.length === 1 ? "lugar" : "lugares"} · borrador, en revisión y publicado.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          <div className="grid grid-cols-[1fr_140px_120px_110px] gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
            <span>Nombre</span>
            <span>Categoría</span>
            <span>Estado</span>
            <span className="text-right">Actualizado</span>
          </div>

          {places.length === 0 ? (
            <p className="p-8 text-center text-[13.5px] text-ink-soft">
              Todavía no hay lugares. Corre <code className="font-mono text-[12px]">pnpm db:seed:places</code> en
              planazo_backend para tener datos de prueba.
            </p>
          ) : (
            places.map((place) => (
              <Link
                key={place.id}
                href={`/contenido/${place.id}`}
                className="grid grid-cols-[1fr_140px_120px_110px] items-center gap-0 border-b border-border-soft px-4 py-3 transition-colors last:border-b-0 hover:bg-[#FEFCFA]"
              >
                <div className="min-w-0 pr-3">
                  <span className="block truncate text-[13.5px] font-medium tracking-tight">{place.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-faint">{place.address}</span>
                </div>
                <span className="text-[12.5px] text-ink-soft">{place.categories[0]?.name ?? "—"}</span>
                <span>
                  <StatusBadge status={place.status} />
                </span>
                <span className="text-right font-mono text-[11px] text-ink-faint">{formatDate(place.updatedAt)}</span>
              </Link>
            ))
          )}
        </div>

        <div className="mt-8 mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="mb-1 text-[22px] font-semibold tracking-tight">Eventos</h2>
            <p className="text-[13.5px] text-ink-soft">
              {events.length} {events.length === 1 ? "evento" : "eventos"} — recomendaciones de plan, no cobertura noticiosa.
            </p>
          </div>
          <Link
            href="/centro-ia?site=planazo&type=evento-planazo"
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
          >
            + Crear
          </Link>
        </div>

        <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          <div className="grid grid-cols-[1fr_140px_120px_110px] gap-0 border-b border-border-soft px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
            <span>Nombre</span>
            <span>Categoría</span>
            <span>Estado</span>
            <span className="text-right">Inicia</span>
          </div>

          {events.length === 0 ? (
            <p className="p-8 text-center text-[13.5px] text-ink-soft">
              Todavía no hay eventos. Créalos con el botón de arriba.
            </p>
          ) : (
            events.map((event) => (
              <Link
                key={event.id}
                href={`/contenido/planazo-evento/${event.id}`}
                className="grid grid-cols-[1fr_140px_120px_110px] items-center gap-0 border-b border-border-soft px-4 py-3 transition-colors last:border-b-0 hover:bg-[#FEFCFA]"
              >
                <div className="min-w-0 pr-3">
                  <span className="block truncate text-[13.5px] font-medium tracking-tight">{event.name}</span>
                  {event.locationName && <span className="block truncate text-[11.5px] text-ink-faint">{event.locationName}</span>}
                </div>
                <span className="text-[12.5px] text-ink-soft">{(event.categoryId && categoryNameById.get(event.categoryId)) ?? "—"}</span>
                <span>
                  <StatusBadge status={event.status} />
                </span>
                <span className="text-right font-mono text-[11px] text-ink-faint">{formatDate(event.startDate)}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </CmsShell>
  );
}
