// Alcaldías de CDMX + municipios conurbados del Edomex (Zona Metropolitana del
// Valle de México) — mismos slugs y nombres que usa el sitio público de La
// Mira (repo separado, ver src/data/mock/alcaldias.ts y municipios.ts allá) y
// que el clasificador de apps/content-radar/src/geo.ts. Los tres SIEMPRE deben
// tener los mismos slugs para el mismo lugar — si aquí un editor elige
// "coacalco", en La Mira debe existir /edomex/coacalco con ese slug exacto.
export interface LocationOption {
  slug: string;
  name: string;
}

export const ALCALDIAS: LocationOption[] = [
  { slug: "alvaro-obregon", name: "Álvaro Obregón" },
  { slug: "azcapotzalco", name: "Azcapotzalco" },
  { slug: "benito-juarez", name: "Benito Juárez" },
  { slug: "coyoacan", name: "Coyoacán" },
  { slug: "cuajimalpa-de-morelos", name: "Cuajimalpa de Morelos" },
  { slug: "cuauhtemoc", name: "Cuauhtémoc" },
  { slug: "gustavo-a-madero", name: "Gustavo A. Madero" },
  { slug: "iztacalco", name: "Iztacalco" },
  { slug: "iztapalapa", name: "Iztapalapa" },
  { slug: "magdalena-contreras", name: "La Magdalena Contreras" },
  { slug: "miguel-hidalgo", name: "Miguel Hidalgo" },
  { slug: "milpa-alta", name: "Milpa Alta" },
  { slug: "tlahuac", name: "Tláhuac" },
  { slug: "tlalpan", name: "Tlalpan" },
  { slug: "venustiano-carranza", name: "Venustiano Carranza" },
  { slug: "xochimilco", name: "Xochimilco" },
];

export const MUNICIPIOS: LocationOption[] = [
  { slug: "ecatepec", name: "Ecatepec" },
  { slug: "nezahualcoyotl", name: "Nezahualcóyotl" },
  { slug: "naucalpan", name: "Naucalpan" },
  { slug: "tlalnepantla", name: "Tlalnepantla" },
  { slug: "chimalhuacan", name: "Chimalhuacán" },
  { slug: "cuautitlan-izcalli", name: "Cuautitlán Izcalli" },
  { slug: "coacalco", name: "Coacalco" },
  { slug: "atizapan-de-zaragoza", name: "Atizapán de Zaragoza" },
  { slug: "tultitlan", name: "Tultitlán" },
  { slug: "ixtapaluca", name: "Ixtapaluca" },
  { slug: "chalco", name: "Chalco" },
  { slug: "huixquilucan", name: "Huixquilucan" },
  { slug: "nicolas-romero", name: "Nicolás Romero" },
  { slug: "texcoco", name: "Texcoco" },
  { slug: "chicoloapan", name: "Chicoloapan" },
  { slug: "cuautitlan", name: "Cuautitlán" },
  { slug: "tecamac", name: "Tecámac" },
  { slug: "zumpango", name: "Zumpango" },
  { slug: "valle-de-chalco-solidaridad", name: "Valle de Chalco Solidaridad" },
];

export function getLocationNameBySlug(slug: string | undefined | null): string | undefined {
  if (!slug) return undefined;
  return ALCALDIAS.find((l) => l.slug === slug)?.name ?? MUNICIPIOS.find((l) => l.slug === slug)?.name;
}
