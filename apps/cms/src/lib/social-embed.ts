// Publicaciones de redes incrustadas en el cuerpo (ContentBlock.embeds) — la
// red se detecta de la URL, con el mismo criterio que el sitio
// (la-mira/src/components/article/SocialEmbed.tsx).

export type SocialNetwork = "instagram" | "facebook" | "x" | "tiktok";

export const NETWORK_LABEL: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  tiktok: "TikTok",
};

export function detectNetwork(url: string): SocialNetwork | null {
  let host: string;
  try {
    host = new URL(url.trim()).hostname.replace(/^(www|m|mobile)\./, "");
  } catch {
    return null;
  }
  if (host === "instagram.com") return "instagram";
  if (host === "facebook.com" || host === "fb.watch" || host === "fb.com") return "facebook";
  if (host === "x.com" || host === "twitter.com") return "x";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  return null;
}
