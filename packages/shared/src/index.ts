export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function formatPriceLevel(priceLevel: number | null): string {
  if (!priceLevel) return '';
  return '$'.repeat(Math.min(Math.max(priceLevel, 1), 4));
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? '';
}
