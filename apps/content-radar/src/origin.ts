import type { TrendTopic } from "./trends.js";
import { normalize } from "./relevance.js";

export type Origin = "nacional" | "internacional";

// Medios mexicanos que no llevan "méxico" en el nombre (para los que sí lo llevan,
// como "ESPN México" o "El Sol de México", basta con el hint genérico de abajo).
const MEXICAN_SOURCE_HINTS = [
  "mexico",
  " mx",
  "milenio",
  "reforma",
  "la jornada",
  "excelsior",
  "proceso",
  "el universal",
  "el financiero",
  "el economista",
  "el heraldo",
  "mvs",
  "n+",
  "unotv",
  "chilango",
  "telediario",
  "elgrafico",
  "adn40",
  "once noticias",
  "grupo formula",
  "tv azteca",
  "televisa",
  "w radio",
  "publimetro",
  "la razon",
  "la cronica",
  "sinembargo",
  "animal politico",
  "aristegui",
  "expansion",
  "el informador",
  "infobae",
];

// Entidades claramente mexicanas — si aparecen en el título, es nacional aunque las
// fuentes asociadas sean agencias/medios extranjeros cubriendo la nota.
const MEXICAN_TITLE_HINTS = [
  "mexico",
  "cdmx",
  "cruz azul",
  "pumas",
  "chivas",
  "america",
  "liga mx",
  "monterrey",
  "tigres",
  "toluca",
  "pachuca",
  "santos",
  "necaxa",
  "atlas",
  "queretaro",
  "sheinbaum",
  "brugada",
];

function isMexicanDomain(url: string): boolean {
  try {
    // Cubre .mx, .com.mx, .gob.mx, etc. — cualquier medio local, no solo los grandes.
    return new URL(url).hostname.toLowerCase().endsWith(".mx");
  } catch {
    return false;
  }
}

function isMexicanNewsItem(item: { source: string; url: string }): boolean {
  return isMexicanDomain(item.url) || MEXICAN_SOURCE_HINTS.some((hint) => normalize(item.source).includes(hint));
}

// Heurística, no un dato oficial: título con entidad mexicana -> nacional; si no,
// se decide por mayoría (dominio .mx o nombre de medio conocido) entre las noticias
// asociadas al tema.
export function classifyOrigin(topic: TrendTopic): Origin {
  const title = normalize(topic.title);
  if (MEXICAN_TITLE_HINTS.some((hint) => title.includes(hint))) return "nacional";

  if (topic.newsItems.length === 0) return "internacional";
  const mexicanCount = topic.newsItems.filter(isMexicanNewsItem).length;
  return mexicanCount * 2 >= topic.newsItems.length ? "nacional" : "internacional";
}
