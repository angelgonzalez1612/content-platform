import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getCmsPlaces, getCmsLamiraContent, getCmsEvents, getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { SiteTabs } from "@/components/cms/site-tabs";
import { LamiraContenidoView } from "./lamira-contenido-view";
import { PlanazoContenidoView } from "./planazo-contenido-view";

export default async function ContenidoPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { site } = await searchParams;
  const isLamira = site === "lamira";

  if (isLamira) {
    const [rows, categories] = await Promise.all([getCmsLamiraContent(), getCmsCategories("la-mira")]);
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

          <LamiraContenidoView rows={rows} categories={categories} />
        </div>
      </CmsShell>
    );
  }

  const [places, events, planazoCategories] = await Promise.all([getCmsPlaces(), getCmsEvents(), getCmsCategories("planazo")]);

  return (
    <CmsShell user={session} title="Contenido">
      <div className="p-[26px] pb-[60px]">
        <SiteTabs site="planazo" basePath="/contenido" />
        <PlanazoContenidoView places={places} events={events} categories={planazoCategories} />
      </div>
    </CmsShell>
  );
}
