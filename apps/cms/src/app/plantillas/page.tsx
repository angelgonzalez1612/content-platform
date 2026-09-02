import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { TemplateTypePicker } from "@/components/cms/template-type-picker";
import { CONTENT_TEMPLATES } from "@/data/templates";

export default async function PlantillasPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { site } = await searchParams;
  const isLamira = site === "lamira";
  const siteKey = isLamira ? "la-mira" : "planazo";

  const categories = await getCmsCategories(siteKey);
  const templates = CONTENT_TEMPLATES.filter((t) => t.site === siteKey);

  return (
    <CmsShell user={session} title="Plantillas">
      <div className="p-[26px] pb-[60px]">
        <h1 className="mb-5 text-[22px] font-semibold tracking-tight">Plantillas</h1>
        <TemplateTypePicker site={isLamira ? "lamira" : "planazo"} templates={templates} categories={categories} />
      </div>
    </CmsShell>
  );
}
