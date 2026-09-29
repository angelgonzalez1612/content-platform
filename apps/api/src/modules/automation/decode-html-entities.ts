// Los titulares de los feeds RSS (content-radar, Google News) llegan con
// entidades HTML sin decodificar ("Bears&#39; Tyson", "&quot;Superpeso&quot;").
// El título crudo se conserva como llave de deduplicación; esto solo se aplica
// a lo que termina visible (p.ej. el nombre de un lugar creado desde el tema).
const NAMED: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED[entity.toLowerCase()] ?? match;
  });
}
