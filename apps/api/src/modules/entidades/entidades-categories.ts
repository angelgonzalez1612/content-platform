// Categorías editoriales fijas para "Entidades" — cubren tanto La Mira
// (noticias/alertas) como Planazo (qué hacer/eventos), sin nombre de ciudad
// (a diferencia de las frases de /automatizaciones/frases, que sí lo llevan
// porque hoy solo cubren CDMX) para que el mismo keyword tenga sentido
// consultado en cualquiera de los 32 estados.
export interface EntidadCategory {
  id: string;
  label: string;
  keyword: string;
  // Términos para el modo "Búsquedas locales" (LocalSearchService) — a
  // diferencia de `keyword` (que solo sirve para Trends, un término genérico
  // por categoría), esta lista se manda completa como OR a un buscador real
  // (Google Custom Search) junto con el nombre del municipio/alcaldía, así
  // que puede — y debe — cubrir varios sucesos distintos por categoría, no
  // solo uno. Ej. "noticias" no se queda en accidentes/tráfico: también
  // incendios, balaceras, bloqueos, manifestaciones.
  localKeywords: string[];
}

export const ENTIDADES_CATEGORIES: EntidadCategory[] = [
  {
    id: 'noticias',
    label: 'Noticias',
    keyword: 'noticias',
    localKeywords: [
      'accidente',
      'choque',
      'incendio',
      'balacera',
      'bloqueo',
      'manifestación',
      'inseguridad',
      'obra pública',
    ],
  },
  {
    id: 'que-hacer',
    label: 'Qué hacer',
    keyword: 'qué hacer',
    localKeywords: [
      'qué hacer',
      'planes',
      'actividades',
      'recomendaciones',
      'para visitar',
      'para comer',
    ],
  },
  {
    id: 'eventos',
    label: 'Eventos',
    keyword: 'eventos',
    localKeywords: [
      'evento',
      'festival',
      'feria',
      'concierto',
      'exposición',
      'kermés',
    ],
  },
  {
    id: 'clima',
    label: 'Clima',
    keyword: 'clima',
    localKeywords: [
      'lluvia',
      'granizo',
      'inundación',
      'alerta meteorológica',
      'tormenta',
      'encharcamiento',
    ],
  },
  {
    id: 'trafico',
    label: 'Tráfico',
    keyword: 'tráfico',
    localKeywords: [
      'tráfico',
      'bloqueo',
      'accidente',
      'choque',
      'manifestación',
      'corte vial',
      'obra vial',
    ],
  },
];

export function getCategoryKeyword(categoryId: string): string {
  return (
    ENTIDADES_CATEGORIES.find((c) => c.id === categoryId)?.keyword ??
    ENTIDADES_CATEGORIES[0].keyword
  );
}

export function getCategoryLocalKeywords(categoryId: string): string[] {
  return (
    ENTIDADES_CATEGORIES.find((c) => c.id === categoryId)?.localKeywords ??
    ENTIDADES_CATEGORIES[0].localKeywords
  );
}
