import { buildLamiraPayload, dekFrom, type TransferSource } from './build-lamira-payload';

const source: TransferSource = {
  title: 'Registran en video dos peleas en el Metro',
  description: 'Un video de MILENIO muestra dos peleas. El material circula en redes.\n\nSegundo párrafo de contexto.',
  content: [{ heading: 'Qué observar', paragraphs: ['Pon atención al ambiente.'] }],
  imageUrl: 'https://img/x.jpg',
  imageCredit: 'Foto: MILENIO',
  imagePosition: '50% 20%',
  youtubeId: 'N75cbjmv1xs',
  sourceUrl: 'https://www.youtube.com/watch?v=N75cbjmv1xs',
  seo: { title: 'Dos peleas en el Metro', description: 'desc' },
};

describe('buildLamiraPayload', () => {
  it('noticia: bajada = primera oración, descripción como primer bloque, en revisión, con foto/video/fuente', () => {
    const p = buildLamiraPayload(source, 'noticia', 'cat-1');
    expect(p).toMatchObject({
      title: source.title,
      dek: 'Un video de MILENIO muestra dos peleas.',
      categoryId: 'cat-1',
      status: 'in_review',
      youtubeId: 'N75cbjmv1xs',
      imagePosition: '50% 20%',
      sourceUrl: source.sourceUrl,
    });
    expect(p.content).toEqual([
      { heading: null, paragraphs: ['Un video de MILENIO muestra dos peleas. El material circula en redes.', 'Segundo párrafo de contexto.'] },
      { heading: 'Qué observar', paragraphs: ['Pon atención al ambiente.'] },
    ]);
    expect(p.toc).toEqual([{ id: 'que-observar', label: 'Qué observar' }]);
  });

  it('reportaje: agrega etiquetas y pie de foto', () => {
    expect(buildLamiraPayload(source, 'reportaje', null)).toMatchObject({ tags: ['Reportaje'], imageCaption: 'Foto: MILENIO' });
  });

  it('alerta: usa la descripción completa y queda activa', () => {
    expect(buildLamiraPayload(source, 'alerta', null)).toMatchObject({ alertaStatus: 'activa', description: source.description });
  });
});

describe('dekFrom', () => {
  it('recorta oraciones muy largas en una palabra completa', () => {
    const long = 'palabra '.repeat(60).trim() + '.';
    const dek = dekFrom(long, 'x');
    expect(dek.length).toBeLessThanOrEqual(221);
    expect(dek.endsWith('…')).toBe(true);
  });
});
