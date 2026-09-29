import { decodeHtmlEntities } from './decode-html-entities';

describe('decodeHtmlEntities', () => {
  it('decodifica entidades numéricas y con nombre de los feeds', () => {
    expect(decodeHtmlEntities('Bears&#39; Tyson Bagent')).toBe("Bears' Tyson Bagent");
    expect(decodeHtmlEntities('&quot;Superpeso&quot;, atrapado')).toBe('"Superpeso", atrapado');
    expect(decodeHtmlEntities('Fuzz &amp; Brew')).toBe('Fuzz & Brew');
    expect(decodeHtmlEntities('Caf&#xE9; &#233;')).toBe('Café é');
  });

  it('deja intacto lo que no es una entidad conocida', () => {
    expect(decodeHtmlEntities('Tom & Jerry &foo; 100%')).toBe('Tom & Jerry &foo; 100%');
  });
});
