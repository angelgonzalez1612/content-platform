"use server";

import { redirect } from "next/navigation";
import { runAndSave } from "@planazo/content-radar/run";
import { DEFAULT_SITE_ID } from "@planazo/content-radar/sites";

// Reemplaza el POST /s/:siteId/actualizar que antes atendía el server Express
// aparte de content-radar — ahora corre directo dentro del proceso del CMS
// (import de librería, no una llamada HTTP a otro server).
export async function refreshContentRadar(formData: FormData) {
  const geo = typeof formData.get("geo") === "string" && (formData.get("geo") as string).trim()
    ? (formData.get("geo") as string).trim()
    : "MX";

  const { fileName } = await runAndSave(DEFAULT_SITE_ID, geo);
  redirect(`/content-radar?file=${encodeURIComponent(fileName)}`);
}
