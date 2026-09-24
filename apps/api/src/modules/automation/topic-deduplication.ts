const TITLE_STOPWORDS = new Set([
  'de',
  'la',
  'el',
  'en',
  'y',
  'a',
  'que',
  'un',
  'una',
  'los',
  'las',
  'del',
  'al',
  'su',
  'con',
  'por',
  'para',
  'se',
  'es',
  'lo',
  'ya',
  'más',
  'tras',
  'no',
  'le',
  'sus',
  'como',
  'entre',
  'este',
  'esta',
]);

export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

function significantWords(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(/[^a-záéíóúñ0-9]+/i)
      .filter((word) => word.length >= 4 && !TITLE_STOPWORDS.has(word)),
  );
}

export function looksLikeSameStory(a: string, b: string): boolean {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;
  return shared / Math.min(wordsA.size, wordsB.size) >= 0.5;
}

export function resolvedTopicWasHandled(input: {
  sourceKey: string;
  resolvedTitle: string;
  alreadyPublished: Set<string>;
  alreadyEvaluated: Set<string>;
  createdTitles: string[];
}): boolean {
  const sourceKey = normalizeTitle(input.sourceKey);
  const resolvedKey = normalizeTitle(input.resolvedTitle);
  if (resolvedKey === sourceKey) return false;
  return (
    input.alreadyPublished.has(resolvedKey) ||
    input.alreadyEvaluated.has(resolvedKey) ||
    input.createdTitles.some((title) => looksLikeSameStory(input.resolvedTitle, title)) ||
    [...input.alreadyPublished].some((title) => looksLikeSameStory(input.resolvedTitle, title))
  );
}
