import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";

// content-radar corre como su propio server Express (apps/content-radar,
// puerto 4310 en dev) — no es una página Next.js, así que se embebe por
// iframe en vez de importarlo. Sigue siendo parte del monorepo (Fase
// "fusiona content-radar a content-platform") y arranca junto con api+cms
// vía `pnpm dev` en la raíz; esto solo le da un lugar visible en el CMS.
const CONTENT_RADAR_URL = process.env.NEXT_PUBLIC_CONTENT_RADAR_URL ?? "http://localhost:4310";

export default async function ContentRadarPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <CmsShell user={session} title="Content Radar">
      <div className="flex h-full flex-col">
        <div className="flex flex-none items-center justify-between border-b border-border-soft bg-white px-[26px] py-3">
          <p className="text-[13px] text-ink-soft">
            Google Trends, YouTube y frases de búsqueda sobre CDMX — corre todos los días a las 7am. Usa un tema de
            aquí como contexto en{" "}
            <a href="/centro-ia" className="font-medium text-brand hover:underline">
              Centro IA
            </a>
            .
          </p>
          <a
            href={CONTENT_RADAR_URL}
            target="_blank"
            rel="noreferrer"
            className="flex-none text-[12.5px] font-medium text-ink-soft hover:text-brand"
          >
            Abrir en pestaña nueva ↗
          </a>
        </div>
        <iframe
          src={CONTENT_RADAR_URL}
          title="Content Radar"
          className="min-h-0 flex-1 border-0"
        />
      </div>
    </CmsShell>
  );
}
