import type { ContentBlockValue } from "@/components/cms/content-blocks-field";

/** Kebab-case simple, local a este archivo — no vale la pena una dependencia
 * de workspace nueva (@planazo/shared) solo por esto. */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** El `toc` (tabla de contenidos) se deriva de los headings de los bloques al
 * guardar — no se edita a mano, igual que en el modelo original (Noticia,
 * Reportaje, Guía siempre calcularon su índice a partir de sus secciones). */
export function buildToc(blocks: ContentBlockValue[]): { id: string; label: string }[] {
  return blocks
    .filter((b) => b.heading && b.heading.trim())
    .map((b) => ({ id: slugify(b.heading as string), label: (b.heading as string).trim() }));
}

/** Para Guía, `content[].id` es requerido (a diferencia de Noticia/Reportaje) —
 * se deriva del heading (siempre presente ahí) al guardar. */
export function withBlockIds(blocks: ContentBlockValue[]): { id: string; heading: string; paragraphs: string[]; image?: { url: string; credit: string } | null }[] {
  const seen = new Map<string, number>();
  return blocks.map((b) => {
    const base = slugify(b.heading ?? "") || "seccion";
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { id: count > 1 ? `${base}-${count}` : base, heading: b.heading ?? "", paragraphs: b.paragraphs, image: b.image };
  });
}

/** Resumen corto para la vista de antes/después de "Mejorar con IA" — no
 * tiene sentido mostrar bloques completos en una tarjeta de 2 columnas. */
export function summarizeBlocks(blocks: ContentBlockValue[]): string {
  if (blocks.length === 0) return "";
  const words = blocks.reduce((n, b) => n + b.paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length, 0);
  return `${blocks.length} ${blocks.length === 1 ? "bloque" : "bloques"}, ~${words} palabras — ${blocks[0].paragraphs[0]?.slice(0, 140) ?? ""}${(blocks[0].paragraphs[0]?.length ?? 0) > 140 ? "…" : ""}`;
}
