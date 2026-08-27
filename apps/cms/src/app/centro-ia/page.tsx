import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { GeneratePlaceFlow } from "@/components/cms/generate-place-flow";
import { GenerateLamiraContentFlow } from "@/components/cms/lamira/generate-lamira-content-flow";
import { PublishDestinationPicker } from "@/components/cms/lamira/publish-destination-picker";
import { SiteTabs } from "@/components/cms/site-tabs";

const LAMIRA_TYPES = new Set(["noticia", "alerta", "guia", "evento", "lugar", "reportaje"]);

export default async function CentroIaPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; type?: string; name?: string; hints?: string; step?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { site, type: rawType, name, hints, step } = await searchParams;

  // El botón Publicar de Content Radar manda directo a un tema (?name=) sin
  // preguntar sitio/tipo — antes eso arrancaba de una en "La Mira / Noticia"
  // ya decidido. Si viene un tema y todavía no se confirmó (?step=form), se
  // pregunta primero — site/type de la URL solo quedan como sugerencia.
  if (name && step !== "form") {
    return (
      <CmsShell user={session} title="Centro IA">
        <PublishDestinationPicker name={name} hints={hints ?? ""} initialSite={site ?? "lamira"} initialType={rawType ?? "noticia"} />
      </CmsShell>
    );
  }

  const isLamira = site === "lamira";
  const type = rawType && LAMIRA_TYPES.has(rawType) ? rawType : "noticia";

  const categories = await getCmsCategories(isLamira ? "la-mira" : "planazo");

  return (
    <CmsShell user={session} title="Centro IA">
      <div className="mx-auto max-w-[680px] px-[26px] pt-[26px]">
        <SiteTabs site={isLamira ? "lamira" : "planazo"} basePath="/centro-ia" />
      </div>
      {isLamira ? (
        <GenerateLamiraContentFlow type={type} categories={categories} initialName={name} initialHints={hints} />
      ) : (
        <GeneratePlaceFlow categories={categories} />
      )}
    </CmsShell>
  );
}
