import { ruleAccepts, ruleCouldMatch } from './rule-matching';

describe('ruleCouldMatch (prefiltro por sitio)', () => {
  it('una regla sin sitio (ambos) siempre es candidata', () => {
    expect(ruleCouldMatch({ site: null }, { sites: ['la-mira'] })).toBe(true);
  });

  it('un tema sin sitio conocido siempre pasa', () => {
    expect(ruleCouldMatch({ site: 'planazo' }, { sites: [] })).toBe(true);
  });

  it('acepta cuando el sitio de la regla está entre los del tema', () => {
    expect(ruleCouldMatch({ site: 'la-mira' }, { sites: ['la-mira', 'planazo'] })).toBe(true);
  });

  it('descarta cuando el sitio del tema no incluye el de la regla', () => {
    expect(ruleCouldMatch({ site: 'la-mira' }, { sites: ['planazo'] })).toBe(false);
  });
});

describe('ruleAccepts (validación fina del borrador ya clasificado)', () => {
  const laMiraNoticia = { site: 'la-mira', contentType: 'noticia' };
  const seguridad = { slug: 'seguridad' };

  it('acepta cuando la regla no filtra por tipo ni categoría', () => {
    expect(ruleAccepts({ site: null, contentTypes: [], categorySlugs: [] }, laMiraNoticia, seguridad)).toBe(true);
  });

  it('rechaza si el sitio del borrador no coincide con el de la regla', () => {
    expect(ruleAccepts({ site: 'planazo', contentTypes: [], categorySlugs: [] }, laMiraNoticia, seguridad)).toBe(false);
  });

  it('rechaza un tipo de contenido no automatizable', () => {
    expect(
      ruleAccepts({ site: null, contentTypes: [], categorySlugs: [] }, { site: 'la-mira', contentType: 'guia' }, seguridad),
    ).toBe(false);
  });

  it('respeta el filtro de tipos de la regla', () => {
    expect(ruleAccepts({ site: null, contentTypes: ['alerta'], categorySlugs: [] }, laMiraNoticia, seguridad)).toBe(false);
    expect(ruleAccepts({ site: null, contentTypes: ['noticia'], categorySlugs: [] }, laMiraNoticia, seguridad)).toBe(true);
  });

  it('respeta el filtro de categorías de la regla', () => {
    expect(ruleAccepts({ site: null, contentTypes: [], categorySlugs: ['clima'] }, laMiraNoticia, seguridad)).toBe(false);
    expect(ruleAccepts({ site: null, contentTypes: [], categorySlugs: ['seguridad'] }, laMiraNoticia, seguridad)).toBe(true);
  });
});
