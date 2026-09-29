import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { contenidoHref, getReviewQueue, isReviewSite, reviewHref } from "@/lib/review-queue";

// Entrada del modo revisión (aviso ⏳ de Contenido): abre la pieza en
// revisión más reciente del sitio, con la barra de anterior/siguiente.
export default async function RevisionPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { site } = await searchParams;
  const reviewSite = isReviewSite(site) ? site : "lamira";
  const queue = await getReviewQueue(reviewSite);
  if (queue.length === 0) redirect(contenidoHref(reviewSite));
  redirect(reviewHref(queue[0].href, reviewSite));
}
