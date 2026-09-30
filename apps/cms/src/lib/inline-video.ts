// Video de la pieza dentro del cuerpo (ContentBlock.videoAfter) — misma regla
// que el sitio (la-mira/src/components/article/ParagraphsWithVideo.tsx):
// cuenta el primer bloque que lo tenga; sin ninguno, el video va arriba.

interface VideoPlaceable {
  paragraphs: string[];
  videoAfter?: number | null;
}

export function hasInlineVideo(content: VideoPlaceable[]): boolean {
  return content.some((b) => b.videoAfter != null);
}

/** Después de qué párrafo del bloque `i` va el video (-1 = antes del primero), o null. */
export function videoSlot(content: VideoPlaceable[], i: number): number | null {
  const first = content.findIndex((b) => b.videoAfter != null);
  if (first !== i) return null;
  return Math.min(content[i].videoAfter!, content[i].paragraphs.length - 1);
}

/** Todas las posiciones posibles, en orden de lectura: [bloque, después del párrafo]. */
export function videoPositions(content: VideoPlaceable[]): [number, number][] {
  return content.flatMap((b, bi) => [-1, ...b.paragraphs.map((_, pi) => pi)].map((pi): [number, number] => [bi, pi]));
}

/** Coloca el video en [bloque, párrafo] (o lo regresa arriba con null), quitándolo de cualquier otro bloque. */
export function placeVideo<T extends VideoPlaceable>(content: T[], at: [number, number] | null): T[] {
  return content.map((b, bi) => {
    const videoAfter = at && at[0] === bi ? at[1] : null;
    if ((b.videoAfter ?? null) === videoAfter) return b;
    const next = { ...b };
    if (videoAfter == null) delete next.videoAfter;
    else next.videoAfter = videoAfter;
    return next;
  });
}

// ── Publicaciones de redes (ContentBlock.embeds) ─────────────────────────────

interface EmbedPlaceable extends VideoPlaceable {
  embeds?: { url: string; after: number }[] | null;
}

/** Hueco real de una publicación (un párrafo borrado la manda al último). */
export function embedSlot(block: EmbedPlaceable, after: number): number {
  return Math.min(after, block.paragraphs.length - 1);
}

function setEmbeds<T extends EmbedPlaceable>(block: T, embeds: { url: string; after: number }[]): T {
  const next = { ...block };
  if (embeds.length) next.embeds = embeds;
  else delete next.embeds;
  return next;
}

/** Agrega una publicación al final del bloque `bi`. */
export function addEmbed<T extends EmbedPlaceable>(content: T[], bi: number, url: string): T[] {
  return content.map((b, i) => (i === bi ? setEmbeds(b, [...(b.embeds ?? []), { url, after: b.paragraphs.length - 1 }]) : b));
}

export function removeEmbed<T extends EmbedPlaceable>(content: T[], bi: number, ei: number): T[] {
  return content.map((b, i) => (i === bi ? setEmbeds(b, (b.embeds ?? []).filter((_, j) => j !== ei)) : b));
}

/** Mueve la publicación `ei` del bloque `bi` un hueco arriba/abajo, cruzando bloques si hace falta. */
export function moveEmbed<T extends EmbedPlaceable>(content: T[], bi: number, ei: number, dir: -1 | 1): T[] {
  const embed = content[bi]?.embeds?.[ei];
  if (!embed) return content;
  const positions = videoPositions(content);
  const idx = positions.findIndex(([b, p]) => b === bi && p === embedSlot(content[bi], embed.after));
  const target = positions[idx + dir];
  if (!target) return content;
  const [tb, tp] = target;
  return content.map((b, i) => {
    let embeds = b.embeds ?? [];
    if (i === bi) embeds = embeds.filter((_, j) => j !== ei);
    if (i === tb) embeds = [...embeds, { url: embed.url, after: tp }];
    return i === bi || i === tb ? setEmbeds(b, embeds) : b;
  });
}
