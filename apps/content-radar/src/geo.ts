import type { TrendTopic } from "./trends.js";
import { containsKeyword, normalize } from "./relevance.js";

export interface GeoClassification {
  entidad: string | null;
  municipio: string | null;
}

interface StateEntry {
  code: string;
  name: string;
  keywords: string[];
}

// Los 32 estados. Keywords = nombre del estado + capital/ciudades grandes (las notas
// casi siempre mencionan la ciudad, no "el estado de X"). Heurística, no dato oficial.
const STATES: StateEntry[] = [
  { code: "AGU", name: "Aguascalientes", keywords: ["aguascalientes"] },
  { code: "BCN", name: "Baja California", keywords: ["baja california", "tijuana", "mexicali", "ensenada"] },
  { code: "BCS", name: "Baja California Sur", keywords: ["baja california sur", "los cabos", "la paz bcs"] },
  { code: "CAM", name: "Campeche", keywords: ["campeche"] },
  {
    code: "CHP",
    name: "Chiapas",
    keywords: ["chiapas", "tuxtla gutierrez", "tuxtla gutiérrez", "san cristobal de las casas", "san cristóbal de las casas"],
  },
  { code: "CHH", name: "Chihuahua", keywords: ["chihuahua", "ciudad juarez", "ciudad juárez"] },
  { code: "CMX", name: "Ciudad de México", keywords: ["cdmx", "ciudad de mexico", "ciudad de méxico"] },
  { code: "COA", name: "Coahuila", keywords: ["coahuila", "saltillo", "torreon", "torreón"] },
  { code: "COL", name: "Colima", keywords: ["colima", "manzanillo"] },
  { code: "DUR", name: "Durango", keywords: ["durango"] },
  { code: "GUA", name: "Guanajuato", keywords: ["guanajuato", "irapuato", "celaya"] },
  { code: "GRO", name: "Guerrero", keywords: ["guerrero", "acapulco", "chilpancingo", "taxco"] },
  { code: "HID", name: "Hidalgo", keywords: ["hidalgo", "pachuca"] },
  { code: "JAL", name: "Jalisco", keywords: ["jalisco", "guadalajara", "zapopan", "puerto vallarta"] },
  {
    code: "MEX",
    name: "Estado de México",
    keywords: ["estado de mexico", "estado de méxico", "edomex", "mexiquense", "toluca"],
  },
  { code: "MIC", name: "Michoacán", keywords: ["michoacan", "michoacán", "morelia", "uruapan"] },
  { code: "MOR", name: "Morelos", keywords: ["morelos", "cuernavaca"] },
  { code: "NAY", name: "Nayarit", keywords: ["nayarit", "tepic"] },
  { code: "NLE", name: "Nuevo León", keywords: ["nuevo leon", "nuevo león", "monterrey"] },
  { code: "OAX", name: "Oaxaca", keywords: ["oaxaca"] },
  { code: "PUE", name: "Puebla", keywords: ["puebla"] },
  { code: "QUE", name: "Querétaro", keywords: ["queretaro", "querétaro"] },
  { code: "ROO", name: "Quintana Roo", keywords: ["quintana roo", "cancun", "cancún", "playa del carmen", "tulum"] },
  { code: "SLP", name: "San Luis Potosí", keywords: ["san luis potosi", "san luis potosí"] },
  { code: "SIN", name: "Sinaloa", keywords: ["sinaloa", "culiacan", "culiacán", "mazatlan", "mazatlán"] },
  { code: "SON", name: "Sonora", keywords: ["sonora", "hermosillo", "nogales"] },
  { code: "TAB", name: "Tabasco", keywords: ["tabasco", "villahermosa"] },
  { code: "TAM", name: "Tamaulipas", keywords: ["tamaulipas", "tampico", "reynosa", "matamoros", "nuevo laredo"] },
  { code: "TLA", name: "Tlaxcala", keywords: ["tlaxcala"] },
  { code: "VER", name: "Veracruz", keywords: ["veracruz", "xalapa", "coatzacoalcos"] },
  { code: "YUC", name: "Yucatán", keywords: ["yucatan", "yucatán", "merida", "mérida"] },
  { code: "ZAC", name: "Zacatecas", keywords: ["zacatecas"] },
];

interface MunicipioEntry {
  name: string;
  stateCode: string;
  keywords: string[];
}

// Zona Metropolitana del Valle de México: las 16 alcaldías de CDMX + los municipios
// conurbados del Edomex. Ordenado de más a menos específico se maneja abajo (la
// keyword más larga gana) para que "Cuautitlán Izcalli" no se etiquete como "Cuautitlán".
const ZMVM_MUNICIPIOS: MunicipioEntry[] = [
  { name: "Álvaro Obregón", stateCode: "CMX", keywords: ["alvaro obregon", "álvaro obregón"] },
  { name: "Azcapotzalco", stateCode: "CMX", keywords: ["azcapotzalco"] },
  { name: "Benito Juárez", stateCode: "CMX", keywords: ["benito juarez", "benito juárez"] },
  { name: "Coyoacán", stateCode: "CMX", keywords: ["coyoacan", "coyoacán"] },
  { name: "Cuajimalpa", stateCode: "CMX", keywords: ["cuajimalpa"] },
  { name: "Cuauhtémoc", stateCode: "CMX", keywords: ["cuauhtemoc", "cuauhtémoc"] },
  { name: "Gustavo A. Madero", stateCode: "CMX", keywords: ["gustavo a. madero", "gustavo a madero"] },
  { name: "Iztacalco", stateCode: "CMX", keywords: ["iztacalco"] },
  { name: "Iztapalapa", stateCode: "CMX", keywords: ["iztapalapa"] },
  { name: "Magdalena Contreras", stateCode: "CMX", keywords: ["magdalena contreras"] },
  { name: "Miguel Hidalgo", stateCode: "CMX", keywords: ["miguel hidalgo"] },
  { name: "Milpa Alta", stateCode: "CMX", keywords: ["milpa alta"] },
  { name: "Tláhuac", stateCode: "CMX", keywords: ["tlahuac", "tláhuac"] },
  { name: "Tlalpan", stateCode: "CMX", keywords: ["tlalpan"] },
  { name: "Venustiano Carranza", stateCode: "CMX", keywords: ["venustiano carranza"] },
  { name: "Xochimilco", stateCode: "CMX", keywords: ["xochimilco"] },
  { name: "Ecatepec", stateCode: "MEX", keywords: ["ecatepec"] },
  { name: "Nezahualcóyotl", stateCode: "MEX", keywords: ["nezahualcoyotl", "nezahualcóyotl"] },
  { name: "Naucalpan", stateCode: "MEX", keywords: ["naucalpan"] },
  { name: "Tlalnepantla", stateCode: "MEX", keywords: ["tlalnepantla"] },
  { name: "Chimalhuacán", stateCode: "MEX", keywords: ["chimalhuacan", "chimalhuacán"] },
  { name: "Cuautitlán Izcalli", stateCode: "MEX", keywords: ["cuautitlan izcalli", "cuautitlán izcalli"] },
  { name: "Coacalco", stateCode: "MEX", keywords: ["coacalco"] },
  { name: "Atizapán de Zaragoza", stateCode: "MEX", keywords: ["atizapan de zaragoza", "atizapán de zaragoza", "atizapan", "atizapán"] },
  { name: "Tultitlán", stateCode: "MEX", keywords: ["tultitlan", "tultitlán"] },
  { name: "Ixtapaluca", stateCode: "MEX", keywords: ["ixtapaluca"] },
  { name: "Chalco", stateCode: "MEX", keywords: ["chalco"] },
  { name: "Huixquilucan", stateCode: "MEX", keywords: ["huixquilucan"] },
  { name: "Nicolás Romero", stateCode: "MEX", keywords: ["nicolas romero", "nicolás romero"] },
  { name: "Texcoco", stateCode: "MEX", keywords: ["texcoco"] },
  { name: "Chicoloapan", stateCode: "MEX", keywords: ["chicoloapan"] },
  { name: "Cuautitlán", stateCode: "MEX", keywords: ["cuautitlan", "cuautitlán"] },
  { name: "Tecámac", stateCode: "MEX", keywords: ["tecamac", "tecámac"] },
  { name: "Zumpango", stateCode: "MEX", keywords: ["zumpango"] },
  { name: "Valle de Chalco Solidaridad", stateCode: "MEX", keywords: ["valle de chalco"] },
];

// Los municipios con keyword más larga primero, para que "Cuautitlán Izcalli" no se
// clasifique por accidente como solo "Cuautitlán".
const MUNICIPIOS_BY_SPECIFICITY = [...ZMVM_MUNICIPIOS].sort(
  (a, b) => Math.max(...b.keywords.map((k) => k.length)) - Math.max(...a.keywords.map((k) => k.length))
);

function stateName(code: string): string | null {
  return STATES.find((s) => s.code === code)?.name ?? null;
}

// Heurística por keywords, igual que classifyOrigin — no es geolocalización real.
// Municipio solo se detecta dentro de la Zona Metropolitana del Valle de México
// (CDMX + conurbados de Edomex); fuera de ahí solo se resuelve hasta el estado.
// Núcleo compartido entre classifyGeo (por tema, con más texto disponible) y
// classifyGeoFromTitle (por nota individual, ver report.ts) — misma heurística,
// distinta cantidad de texto de entrada.
function classifyGeoText(haystack: string): GeoClassification {
  for (const m of MUNICIPIOS_BY_SPECIFICITY) {
    if (m.keywords.some((kw) => containsKeyword(haystack, kw))) {
      return { entidad: stateName(m.stateCode), municipio: m.name };
    }
  }

  for (const s of STATES) {
    if (s.keywords.some((kw) => containsKeyword(haystack, kw))) {
      return { entidad: s.name, municipio: null };
    }
  }

  return { entidad: null, municipio: null };
}

export function classifyGeo(topic: TrendTopic): GeoClassification {
  const haystack = normalize(
    [topic.title, ...topic.newsItems.flatMap((n) => [n.title, n.snippet ?? ""])].join(" ")
  );
  return classifyGeoText(haystack);
}

// Para una nota individual (Google News CDMX, "De la fuente", YouTube) — solo se
// tiene el título, no un snippet extra, así que clasifica peor que classifyGeo
// (menos texto = más "sin ubicación"), pero sigue siendo la misma heurística.
export function classifyGeoFromTitle(title: string): GeoClassification {
  return classifyGeoText(normalize(title));
}
