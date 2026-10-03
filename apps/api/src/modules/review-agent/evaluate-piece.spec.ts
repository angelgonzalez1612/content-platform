import { detectLanguage, evaluatePiece, type ReviewPiece } from './evaluate-piece';

const long = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');

const base: ReviewPiece = {
  type: 'noticia',
  site: 'la-mira',
  id: '1',
  slug: 'queretaro-sorprende-a-chivas',
  title: 'Querétaro sorprende a Chivas y se impone 2-0 en la Liga MX',
  summary: 'El Guadalajara perdió ante Querétaro en la Jornada 10 del Apertura 2026, en un partido disputado el 26 de septiembre.',
  paragraphs: [`El equipo de la ciudad jugó en casa y la afición llenó el estadio para ver el partido. ${long(320)}.`],
  headings: ['Qué pasó', 'Qué sigue'],
  imageUrl: 'https://x/y.jpg',
  categoryName: 'Deportes',
  sourceUrl: 'https://www.jornada.com.mx/nota',
  externalSource: null,
  seo: { title: 'Chivas cae 0-2 ante Querétaro en la Jornada 10', description: 'Querétaro derrotó 0-2 a Chivas en la Jornada 10 del Apertura 2026 de la Liga MX, disputada el 26 de septiembre en el estadio.' },
  status: 'in_review',
  updatedAt: null,
};

describe('evaluatePiece', () => {
  it('marca lista una pieza completa', () => {
    const r = evaluatePiece(base);
    expect(r.readiness).toBe('lista');
    expect(r.checks.every((c) => c.passed)).toBe(true);
    expect(r.score).toBe(100);
  });

  it('sin imagen o corta = falta (bloqueante)', () => {
    expect(evaluatePiece({ ...base, imageUrl: null }).readiness).toBe('falta');
    const short = evaluatePiece({ ...base, paragraphs: ['El equipo ganó el partido en casa.'] });
    expect(short.readiness).toBe('falta');
    expect(short.checks.find((c) => c.id === 'longitud')?.passed).toBe(false);
  });

  it('detecta relleno de IA', () => {
    const r = evaluatePiece({
      ...base,
      paragraphs: [
        ...base.paragraphs,
        'La información disponible no detalla quiénes marcaron los goles.',
        'No es posible establecer el motivo; cualquier interpretación debe tomarse con cautela.',
      ],
    });
    expect(r.checks.find((c) => c.id === 'relleno')?.passed).toBe(false);
  });

  it('detecta texto cortado a media frase', () => {
    const r = evaluatePiece({ ...base, summary: 'Un café con vinilos y ambiente japonés en la Roma, ideal para sacar pendientes con' });
    expect(r.checks.find((c) => c.id === 'completo')?.passed).toBe(false);
  });

  it('Planazo con el mismo estándar que La Mira: 300 palabras y secciones', () => {
    const corto = evaluatePiece({ ...base, type: 'place', site: 'planazo', paragraphs: ['Un café en la Roma con buen ambiente.'], headings: [] });
    expect(corto.checks.find((c) => c.id === 'longitud')?.passed).toBe(false);
    expect(corto.checks.find((c) => c.id === 'estructura')?.passed).toBe(false);
    const evento = evaluatePiece({ ...base, type: 'evento-planazo', site: 'planazo' });
    expect(evento.checks.find((c) => c.id === 'longitud')?.passed).toBe(true);
    expect(evento.checks.some((c) => c.id === 'estructura')).toBe(true);
  });

  it('solo pide fuente en La Mira', () => {
    const planazo = evaluatePiece({ ...base, type: 'place', site: 'planazo', sourceUrl: null });
    expect(planazo.checks.some((c) => c.id === 'fuente')).toBe(false);
  });
});

describe('encaje y título', () => {
  const planazo = { ...base, type: 'place' as const, site: 'planazo' as const, title: 'Café Avellaneda: el mejor café de especialidad en Coyoacán' };
  it('un plan real encaja; una noticia en Planazo no', () => {
    expect(evaluatePiece(planazo).checks.find((c) => c.id === 'encaje')?.passed).toBe(true);
    const news = evaluatePiece({ ...planazo, title: 'Senado aprueba Ley de Bienestar Animal para garantizar un trato digno' });
    expect(news.checks.find((c) => c.id === 'encaje')?.passed).toBe(false);
    expect(news.readiness).toBe('falta');
    expect(evaluatePiece({ ...planazo, title: 'Hoy No Circula miércoles 30 de septiembre de 2026' }).readiness).toBe('falta');
  });
  it('hashtags en el título = casi; título en portugués = falta', () => {
    expect(evaluatePiece({ ...base, title: '📍 Eurostars Zona Rosa Suites la mejor recomendación #viajes #cdmx' }).readiness).toBe('casi');
    expect(evaluatePiece({ ...base, title: 'Pedro Morisco será titular da seleção brasileira contra a India' }).readiness).toBe('falta');
    expect(evaluatePiece({ ...base, title: 'Sabalenka reveals the worst part of being a tennis player' }).readiness).toBe('falta');
    expect(evaluatePiece({ ...base, title: 'Queens of the Stone Age e Interpol en México: lanzan mapa y precios en el Estadio' }).checks.find((c) => c.id === 'idioma')?.passed).toBe(true);
    expect(evaluatePiece({ ...base, title: 'Del mole a los zombies: la agenda de octubre que adelanta el Día de Muertos' }).checks.find((c) => c.id === 'idioma')?.passed).toBe(true);
  });
});

describe('detectLanguage', () => {
  it('distingue español, portugués e inglés', () => {
    expect(detectLanguage('El equipo de la ciudad ganó el partido y los aficionados celebraron en las calles del centro.')).toBe('es');
    expect(detectLanguage('Notícias do Coritiba hoje: Ancelotti confirma estreia de joia do Coritiba na seleção, não é isso que a torcida esperava com a mudança.')).toBe('pt');
    expect(detectLanguage('The team won the match and the fans celebrated with the players on the streets of the city.')).toBe('en');
  });
});
