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
