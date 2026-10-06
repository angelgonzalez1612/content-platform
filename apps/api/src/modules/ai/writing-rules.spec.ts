import { WRITING_RULES, assessDraftQuality, fillerCount, proseText } from './writing-rules';

const words = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');

describe('proseText', () => {
  it('cuenta bajada, cuerpo, secciones y FAQ pero no SEO ni etiquetas', () => {
    const text = proseText({
      dek: 'bajada',
      content: [{ heading: 'Sección', paragraphs: ['uno', 'dos'] }],
      sections: [{ heading: 'Parada', body: 'cuerpo' }],
      faq: [{ question: 'pregunta', answer: 'respuesta' }],
      seo: { title: 'seo-titulo', description: 'seo-descripcion' },
      suggestedTags: ['etiqueta'],
    });
    expect(text).toContain('bajada');
    expect(text).toContain('cuerpo');
    expect(text).toContain('respuesta');
    expect(text).not.toContain('seo-titulo');
    expect(text).not.toContain('etiqueta');
  });
});

describe('assessDraftQuality', () => {
  it(`rechaza un borrador debajo de ${WRITING_RULES.minWords} palabras`, () => {
    const result = assessDraftQuality({ description: words(110) });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('110 palabras');
  });

  it('acepta descripción + secciones que juntas pasan el mínimo', () => {
    const result = assessDraftQuality({ description: words(150), content: [{ heading: 'Qué esperar', paragraphs: [words(200)] }] });
    expect(result.ok).toBe(true);
  });

  it('rechaza un borrador largo con frases de relleno', () => {
    const result = assessDraftQuality({ description: `${words(400)}. No se proporcionaron horarios ni rutas.` });
    expect(result.ok).toBe(false);
    expect(result.fillers).toBe(1);
  });
});

describe('fillerCount', () => {
  it('detecta texto que deja ver el proceso de redacción', () => {
    expect(fillerCount('El tema identificado por el editor advierte sobre marchas.')).toBe(2);
    expect(fillerCount('La marcha sale del Ángel a las 10:00 y llega al Zócalo.')).toBe(0);
  });
});
