import { looksLikeSameStory, normalizeTitle, resolvedTopicWasHandled } from './topic-deduplication';

describe('topic deduplication', () => {
  it('normalizes whitespace and casing', () => {
    expect(normalizeTitle('  Metro   CDMX HOY ')).toBe('metro cdmx hoy');
  });

  it('recognizes two headlines about the same story', () => {
    expect(
      looksLikeSameStory(
        'Scorpions cancela concierto en CDMX y anuncia nueva fecha',
        'Scorpions anuncia nueva fecha tras cancelar concierto de CDMX',
      ),
    ).toBe(true);
  });

  it('rechecks a search phrase after Google News resolves its headline', () => {
    expect(
      resolvedTopicWasHandled({
        sourceKey: 'noticias del metro hoy',
        resolvedTitle: 'Metro CDMX cierra estaciones por trabajos de mantenimiento',
        alreadyPublished: new Set(['metro cdmx cierra estaciones por trabajos de mantenimiento']),
        alreadyEvaluated: new Set(),
        createdTitles: [],
      }),
    ).toBe(true);
  });

  it('does not reject a title that was not handled', () => {
    expect(
      resolvedTopicWasHandled({
        sourceKey: 'planes este fin de semana',
        resolvedTitle: 'Festival cultural gratuito llega a Coyoacán',
        alreadyPublished: new Set(),
        alreadyEvaluated: new Set(),
        createdTitles: [],
      }),
    ).toBe(false);
  });
});
