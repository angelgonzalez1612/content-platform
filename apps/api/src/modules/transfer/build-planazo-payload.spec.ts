import { buildPlanazoPayload, type LamiraTransferSource } from './build-planazo-payload';

const source: LamiraTransferSource = {
  title: 'Café, vinilos y ambiente japonés: visita Fuzz & Brew',
  dek: 'Un café de especialidad con discos en la Roma.',
  content: [
    { heading: null, paragraphs: ['Abre todos los días.', 'Tienen cold brew.'] },
    { heading: 'Qué pedir', paragraphs: ['Flat white.'], image: { url: 'https://x/b.jpg', credit: 'Foto' } },
  ],
  imageUrl: 'https://x/a.jpg',
  imageCredit: 'Foto: Medio',
  imagePosition: '50% 30%',
  youtubeId: null,
  sourceUrl: 'https://medio.mx/nota',
  seo: { title: 'Fuzz & Brew', description: 'Café en la Roma' },
};

describe('buildPlanazoPayload', () => {
  it('lugar: la bajada y el primer bloque sin título forman la descripción; foto como portada', () => {
    const p = buildPlanazoPayload(source, 'place', { id: 'c1', slug: 'cafes' });
    expect(p.name).toBe(source.title);
    expect(p.description).toBe('Un café de especialidad con discos en la Roma.\n\nAbre todos los días.\n\nTienen cold brew.');
    expect(p.content).toEqual([source.content[1]]);
    expect(p.categorySlug).toBe('cafes');
    expect(p.photo).toEqual({ url: 'https://x/a.jpg', credit: 'Foto: Medio' });
    expect(p.status).toBe('in_review');
  });

  it('evento: categoría por id e imagen en sus campos', () => {
    const p = buildPlanazoPayload(source, 'evento-planazo', { id: 'c2', slug: 'musica' });
    expect(p.categoryId).toBe('c2');
    expect(p.imageUrl).toBe('https://x/a.jpg');
    expect(p.imagePosition).toBe('50% 30%');
  });

  it('si el cuerpo empieza con sección titulada, se conserva completo', () => {
    const p = buildPlanazoPayload({ ...source, content: [source.content[1]] }, 'place', { id: 'c1', slug: 'cafes' });
    expect(p.description).toBe(source.dek);
    expect(p.content).toEqual([source.content[1]]);
  });
});
