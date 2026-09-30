import { extractYoutubeId, findEmbeddedYoutubeId } from './youtube';

describe('extractYoutubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=N75cbjmv1xs', 'N75cbjmv1xs'],
    ['https://youtube.com/watch?feature=share&v=N75cbjmv1xs&t=10', 'N75cbjmv1xs'],
    ['https://youtu.be/N75cbjmv1xs?si=abc', 'N75cbjmv1xs'],
    ['https://www.youtube.com/shorts/N75cbjmv1xs', 'N75cbjmv1xs'],
    ['https://www.youtube-nocookie.com/embed/N75cbjmv1xs', 'N75cbjmv1xs'],
    ['https://www.youtube.com/live/N75cbjmv1xs', 'N75cbjmv1xs'],
  ])('%s', (url, id) => {
    expect(extractYoutubeId(url)).toBe(id);
  });

  it('no confunde otros links', () => {
    expect(extractYoutubeId('https://www.milenio.com/politica/nota')).toBeNull();
    expect(extractYoutubeId(null)).toBeNull();
  });
});

describe('findEmbeddedYoutubeId', () => {
  it('encuentra un iframe incrustado en una nota', () => {
    const html = '<p>texto</p><iframe width="560" src="https://www.youtube.com/embed/N75cbjmv1xs?rel=0"></iframe>';
    expect(findEmbeddedYoutubeId(html)).toBe('N75cbjmv1xs');
  });

  it('null si la nota no trae video', () => {
    expect(findEmbeddedYoutubeId('<p>sin video</p><img src="a.jpg">')).toBeNull();
  });
});
