import { repairJsonObject } from './claude-cli-provider';

const parse = (s: string) => JSON.parse(repairJsonObject(s)!);

describe('repairJsonObject', () => {
  it('escapa comillas rectas dentro de un texto', () => {
    const raw = '{"title":"Clásicos como "I Ran" y más","n":1}';
    expect(parse(raw)).toEqual({ title: 'Clásicos como "I Ran" y más', n: 1 });
  });

  it('ignora texto o un segundo objeto después del JSON', () => {
    expect(parse('Aquí está:\n{"a":"x"}\n\n{"a":"y"}')).toEqual({ a: 'x' });
  });

  it('respeta escapes y estructuras anidadas', () => {
    const raw = '{"content":[{"heading":null,"paragraphs":["dice \\"hola\\"","b"]}],"note":"ok"}';
    expect(parse(raw)).toEqual({ content: [{ heading: null, paragraphs: ['dice "hola"', 'b'] }], note: 'ok' });
  });

  it('null si no hay objeto', () => {
    expect(repairJsonObject('sin json')).toBeNull();
  });
});
