export interface TmdbItem {
  title: string;
  mediaType: "movie" | "tv";
  url: string;
  releaseDate: string;
}

// Trending semanal (películas + series combinadas) vía TMDB — autoservicio gratis,
// sin aprobación. La API v3 no filtra /trending por región; language=es-MX localiza
// títulos y fechas para audiencia mexicana. Sin TMDB_API_KEY, regresa [] silenciosamente.
export async function getTmdbTrending(limit = 10): Promise<TmdbItem[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}&language=es-MX`
    );
    if (!res.ok) {
      throw new Error(`TMDB respondió ${res.status}`);
    }
    const data = await res.json();
    const items = (data?.results ?? []).slice(0, limit);

    return items.map((item: any): TmdbItem => {
      const mediaType = item.media_type === "tv" ? "tv" : "movie";
      const title = mediaType === "tv" ? item.name : item.title;
      const releaseDate = mediaType === "tv" ? item.first_air_date : item.release_date;
      return {
        title: title ?? "",
        mediaType,
        url: `https://www.themoviedb.org/${mediaType}/${item.id}`,
        releaseDate: releaseDate ?? "",
      };
    });
  } catch {
    return [];
  }
}
