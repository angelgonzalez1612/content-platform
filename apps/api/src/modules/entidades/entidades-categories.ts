// Categorías editoriales fijas para "Entidades" — cubren tanto La Mira
// (noticias/alertas) como Planazo (qué hacer/eventos), sin nombre de ciudad
// (a diferencia de las frases de /automatizaciones/frases, que sí lo llevan
// porque hoy solo cubren CDMX) para que el mismo keyword tenga sentido
// consultado en cualquiera de los 32 estados.
export interface EntidadCategory {
  id: string;
  label: string;
  keyword: string;
}

export const ENTIDADES_CATEGORIES: EntidadCategory[] = [
  { id: 'noticias', label: 'Noticias', keyword: 'noticias' },
  { id: 'que-hacer', label: 'Qué hacer', keyword: 'qué hacer' },
  { id: 'eventos', label: 'Eventos', keyword: 'eventos' },
  { id: 'clima', label: 'Clima', keyword: 'clima' },
  { id: 'trafico', label: 'Tráfico', keyword: 'tráfico' },
];

export function getCategoryKeyword(categoryId: string): string {
  return (
    ENTIDADES_CATEGORIES.find((c) => c.id === categoryId)?.keyword ??
    ENTIDADES_CATEGORIES[0].keyword
  );
}
