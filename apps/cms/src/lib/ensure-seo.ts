import { apiConfig } from "@planazo/config";
import type { Seo } from "@planazo/types";

/** Si título/descripción SEO están vacíos al momento de guardar, los genera
 * automáticamente (mismo endpoint que el botón "Generar SEO" del SeoPanel)
 * — así ninguna publicación se crea sin SEO, sin depender de que el editor
 * se acuerde de darle clic al botón a mano. Best-effort: si la generación
 * falla (sin proveedor de IA configurado, sin red, etc.) deja lo que había
 * y el guardado sigue su curso normal — nunca lo bloquea. */
export async function ensureSeo(seo: Seo | null | undefined, contentTitle: string, contentContext?: string): Promise<Seo> {
  const current = { title: seo?.title ?? "", description: seo?.description ?? "" };
  if (current.title.trim() && current.description.trim()) return current;
  if (!contentTitle.trim()) return current;

  try {
    const settingsRes = await fetch(`${apiConfig.clientBaseUrl}/cms/settings/ai`, { credentials: "include" });
    const settings = settingsRes.ok ? ((await settingsRes.json()) as { openaiApiKeySet?: boolean }) : { openaiApiKeySet: false };
    const provider = settings.openaiApiKeySet ? "openai" : "claude-cli";

    const res = await fetch(`${apiConfig.clientBaseUrl}/cms/ai/generate-seo`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, contentTitle, contentContext: contentContext || undefined }),
    });
    if (!res.ok) return current;
    const generated = (await res.json()) as Seo;
    return {
      title: current.title.trim() || generated.title,
      description: current.description.trim() || generated.description,
    };
  } catch {
    return current;
  }
}
