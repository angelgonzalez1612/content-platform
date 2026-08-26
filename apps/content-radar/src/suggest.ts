// Autocompletado real de Google (mismo que ves al escribir en la barra de búsqueda):
// a diferencia de Trending Now (temas virales) o Google News (titulares), esto son
// las frases completas que la gente de verdad teclea a partir de una intención — "qué
// hacer en...", "mejores planes en...", etc. Sin API key.
async function fetchSuggestions(seed: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=es-419&gl=MX&q=${encodeURIComponent(seed)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (content-radar CLI)" },
  });
  if (!res.ok) {
    throw new Error(`Google Suggest respondió ${res.status} para "${seed}"`);
  }
  const data = (await res.json()) as [string, string[], ...unknown[]];
  return data[1] ?? [];
}

export async function getSearchPhrases(seeds: string[]): Promise<string[]> {
  const results = await Promise.all(
    seeds.map((seed) => fetchSuggestions(seed).catch(() => []))
  );

  const seen = new Set<string>();
  const combined: string[] = [];
  for (const list of results) {
    for (const phrase of list) {
      const key = phrase.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(phrase);
      }
    }
  }
  return combined;
}

export interface WeightedPhrase {
  phrase: string;
  // Peso relativo (%) derivado de la posición en el autocompletado de Google, NO es
  // volumen de búsquedas real — Google no lo expone vía este endpoint. Es una
  // aproximación honesta: la 1ra sugerencia pesa más que la 10ma, nada más.
  weightPct: number;
}

export async function getWeightedSearchPhrases(seed: string): Promise<WeightedPhrase[]> {
  const suggestions = await fetchSuggestions(seed).catch(() => []);
  const n = suggestions.length;
  if (n === 0) return [];

  const rankSum = (n * (n + 1)) / 2; // 1ra sugerencia = peso n, última = peso 1
  return suggestions.map((phrase, i) => ({
    phrase,
    weightPct: Math.round(((n - i) / rankSum) * 100),
  }));
}

export interface CategoryPhrases {
  category: string;
  phrases: WeightedPhrase[];
}

export async function getCategorySearchPhrases(
  categories: { slug: string; searchSeed?: string }[]
): Promise<CategoryPhrases[]> {
  const withSeed = categories.filter((c): c is { slug: string; searchSeed: string } => Boolean(c.searchSeed));

  return Promise.all(
    withSeed.map(async ({ slug, searchSeed }) => ({
      category: slug,
      phrases: await getWeightedSearchPhrases(searchSeed),
    }))
  );
}
