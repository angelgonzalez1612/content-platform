import { planazoNeedsExpansion } from './expand-policy';

const words = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');

describe('planazoNeedsExpansion', () => {
  it('un lugar con descripción corta (100 palabras) necesita más contenido', () => {
    expect(planazoNeedsExpansion('place', words(100), [])).toBe(true);
  });

  it('cuenta también las secciones extra', () => {
    expect(planazoNeedsExpansion('evento-planazo', words(100), [{ heading: 'Ambiente', paragraphs: [words(160)] }])).toBe(false);
  });

  it('no aplica a tipos de La Mira (usan su propio check de longitud)', () => {
    expect(planazoNeedsExpansion('noticia', words(10), [])).toBe(false);
  });
});
