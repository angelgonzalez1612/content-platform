import { AUTOMATABLE_CONTENT_TYPES } from './dto/automation-rule.dto';

type AutomatableType = (typeof AUTOMATABLE_CONTENT_TYPES)[number];

/**
 * Prefiltro barato: gatea qué reglas consideran candidato a un tema, solo por
 * sitio. Una regla sin sitio (ambos) o un tema sin sitio conocido (ej. "Lo más
 * caliente", cruza categorías) siempre pasa — no hay con qué prefiltrarlo. La
 * decisión fina (tipo/categoría) la hace ruleAccepts contra el borrador ya
 * clasificado.
 */
export function ruleCouldMatch(
  rule: { site: string | null | undefined },
  topic: { sites: string[] },
): boolean {
  if (!rule.site) return true;
  if (topic.sites.length === 0) return true;
  return topic.sites.includes(rule.site);
}

/**
 * Validación fina: la regla acepta este borrador ya clasificado (sitio, tipo
 * automatizable, tipo permitido por la regla, categoría permitida por la
 * regla). Lista vacía de tipos/categorías = "cualquiera". Chequeo puro para
 * reusarlo contra varias reglas candidatas con el mismo resultado.
 */
export function ruleAccepts(
  rule: { site: string | null | undefined; contentTypes: string[]; categorySlugs: string[] },
  result: { site: string; contentType: string },
  category: { slug: string },
): boolean {
  if (rule.site && result.site !== rule.site) return false;
  if (!AUTOMATABLE_CONTENT_TYPES.includes(result.contentType as AutomatableType)) return false;
  if (rule.contentTypes.length && !rule.contentTypes.includes(result.contentType)) return false;
  if (rule.categorySlugs.length && !rule.categorySlugs.includes(category.slug)) return false;
  return true;
}
