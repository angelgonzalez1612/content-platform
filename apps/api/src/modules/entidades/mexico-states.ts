// Los 32 estados de México con su código ISO 3166-2:MX en minúsculas — mismo
// código que usa el paquete @svg-maps/mexico como `id` de cada <path> en el
// CMS (agu/bcn/.../zac), así que el backend y el mapa comparten un solo
// identificador sin necesitar una tabla de traducción aparte.
export interface MexicoState {
  code: string;
  name: string;
}

export const MEXICO_STATES: MexicoState[] = [
  { code: 'agu', name: 'Aguascalientes' },
  { code: 'bcn', name: 'Baja California' },
  { code: 'bcs', name: 'Baja California Sur' },
  { code: 'cam', name: 'Campeche' },
  { code: 'chp', name: 'Chiapas' },
  { code: 'chh', name: 'Chihuahua' },
  { code: 'coa', name: 'Coahuila' },
  { code: 'col', name: 'Colima' },
  { code: 'dur', name: 'Durango' },
  { code: 'gua', name: 'Guanajuato' },
  { code: 'gro', name: 'Guerrero' },
  { code: 'hid', name: 'Hidalgo' },
  { code: 'jal', name: 'Jalisco' },
  { code: 'cmx', name: 'Ciudad de México' },
  { code: 'mex', name: 'Estado de México' },
  { code: 'mic', name: 'Michoacán' },
  { code: 'mor', name: 'Morelos' },
  { code: 'nay', name: 'Nayarit' },
  { code: 'nle', name: 'Nuevo León' },
  { code: 'oax', name: 'Oaxaca' },
  { code: 'pue', name: 'Puebla' },
  { code: 'que', name: 'Querétaro' },
  { code: 'roo', name: 'Quintana Roo' },
  { code: 'slp', name: 'San Luis Potosí' },
  { code: 'sin', name: 'Sinaloa' },
  { code: 'son', name: 'Sonora' },
  { code: 'tab', name: 'Tabasco' },
  { code: 'tam', name: 'Tamaulipas' },
  { code: 'tla', name: 'Tlaxcala' },
  { code: 'ver', name: 'Veracruz' },
  { code: 'yuc', name: 'Yucatán' },
  { code: 'zac', name: 'Zacatecas' },
];

const STATE_BY_CODE = new Map(MEXICO_STATES.map((s) => [s.code, s]));

// Google Trends devuelve el nombre OFICIAL completo (a veces en inglés según
// el endpoint), distinto del nombre corto que usamos en el mapa — ej.
// "Michoacán de Ocampo", "Veracruz de Ignacio de la Llave", "State of
// Mexico", "Coahuila de Zaragoza". Sin este mapeo, esos estados nunca
// coinciden con ninguno de los 32 y el mapa los muestra como "sin datos"
// aunque Trends sí haya devuelto un valor real para ellos.
const GEO_NAME_ALIASES: Record<string, string> = {
  'mexico city': 'cmx',
  'ciudad de méxico': 'cmx',
  'distrito federal': 'cmx',
  mexico: 'mex',
  méxico: 'mex',
  'state of mexico': 'mex',
  'estado de méxico': 'mex',
  'michoacán de ocampo': 'mic',
  'michoacan de ocampo': 'mic',
  'veracruz de ignacio de la llave': 'ver',
  'coahuila de zaragoza': 'coa',
  coahuila: 'coa',
};

export function findStateCodeByGeoName(geoName: string): string | null {
  const normalized = geoName.trim().toLowerCase();
  if (GEO_NAME_ALIASES[normalized]) return GEO_NAME_ALIASES[normalized];
  const direct = MEXICO_STATES.find((s) => s.name.toLowerCase() === normalized);
  if (direct) return direct.code;
  // Última opción: coincidencia parcial (ej. Trends devuelve "Veracruz" a
  // secas para el estado que nosotros llamamos igual — ya cubierto arriba,
  // pero por si acaso Trends cambia el formato de algún nombre).
  const partial = MEXICO_STATES.find(
    (s) =>
      normalized.startsWith(s.name.toLowerCase()) ||
      s.name.toLowerCase().startsWith(normalized),
  );
  return partial?.code ?? null;
}

export function getStateByCode(code: string): MexicoState | undefined {
  return STATE_BY_CODE.get(code);
}
