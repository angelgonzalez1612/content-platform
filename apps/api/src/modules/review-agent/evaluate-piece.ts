import { MIN_WORDS_BY_TYPE, DEFAULT_MIN_WORDS } from '../ai/checks.service';

/** Tipos con flujo de revisión (los demás de La Mira siempre están publicados). */
export type ReviewableType = 'noticia' | 'reportaje' | 'guia' | 'place' | 'evento-planazo' | 'planazo-guia';

/** Lo que el revisor necesita de una pieza, igual para los 6 tipos. */
export interface ReviewPiece {
  type: ReviewableType;
  site: 'la-mira' | 'planazo';
  id: string;
  title: string;
  /** Bajada (dek) o descripción corta. */
  summary: string;
  /** Párrafos del cuerpo (incluye la descripción larga en tipos sin bloques). */
  paragraphs: string[];
  headings: string[];
  imageUrl: string | null;
  categoryName: string | null;
  sourceUrl: string | null;
  /** "Con información de …" (solo noticia). */
  externalSource: string | null;
  seo: { title?: string; description?: string } | null;
  status: string;
  updatedAt: string | null;
}

export interface ReviewCheck {
  id: string;
  label: string;
  passed: boolean;
  /** Bloqueante: sin esto no debería publicarse. */
  blocking: boolean;
  detail?: string;
  /** Si el Revisor sabe arreglarlo solo: etiqueta del botón "Arreglar". */
  fix?: string;
}

export type Readiness = 'lista' | 'casi' | 'falta';

export interface ReviewEvaluation {
  checks: ReviewCheck[];
  readiness: Readiness;
  words: number;
  /** 0-100: proporción de checks aprobados (los bloqueantes pesan doble). */
  score: number;
}

/**
 * Huella del contenido revisable (FNV-1a): si cambia, una revisión con IA
 * guardada ya no corresponde a lo que hay ahora.
 */
export function contentHash(piece: ReviewPiece): string {
  const text = [piece.title, piece.summary, ...piece.headings, ...piece.paragraphs, piece.imageUrl ?? '', piece.categoryName ?? ''].join('\u0001');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const countWords = (text: string) => (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;

// Frases de relleno típicas de la IA cuando no tiene datos: dicen que no se
// sabe algo en vez de informar. Una puede ser honesta; varias son una nota vacía.
const FILLER_PATTERNS = [
  /la informaci[oó]n disponible no (precisa|detalla|incluye|permite)/i,
  /no es posible (establecer|confirmar|determinar|precisar)/i,
  /debe(n)? tomarse con cautela/i,
  /no se cuenta con (detalles|informaci[oó]n)/i,
  /sin (informaci[oó]n|detalles) adicional(es)?/i,
  /no (se )?(ha(n)? )?(detallado|precisado|confirmado) (qui[eé]n|cu[aá]ndo|d[oó]nde|c[oó]mo)/i,
  /conviene (esperar|consultar) (los )?(reportes|informaci[oó]n|publicaciones)/i,
  /sin atribuir causas que no est[aá]n confirmadas/i,
];

const ES_WORDS = /\b(el|la|los|las|del|que|en|y|por|para|con|una|es|se|su|al|como|más)\b/gi;
const PT_WORDS = /\b(não|você|são|também|uma|com|do|da|dos|das|em|no|na|ao|pelo|pela|mais|muito|está|foi|isso)\b/gi;
const PT_CHARS = /[ãõç]/gi;
const EN_WORDS = /\b(the|and|of|is|with|for|that|this|are|was|from|on)\b/gi;

// Títulos que suenan a nota informativa, no a un plan/lugar para visitar —
// en Planazo casi siempre son temas que la automatización clasificó mal.
const NEWS_TITLE = new RegExp(
  [
    'senado', 'diputad', 'congreso', 'iniciativa', 'aprueba', 'decreto', '\\bley\\b', 'operativo', 'polic[ií]a', 'detien', 'detenid',
    'asesin', '\\bmuere', 'muert[oa]s?\\b', 'accidente', 'choque', 'balacera', 'hoy no circula', 'contingencia', 'hurac[aá]n', 'sismo',
    'gobierno', 'secretar[ií]a', 'recaudaci[oó]n', 'impuesto', '\\bisr\\b', 'ingresos', '\\bd[oó]lar', 'inflaci[oó]n', 'elecci', 'candidat',
    '\\bmorena\\b', '\\bpvem\\b', 'fiscal[ií]a', '\\bsat\\b', 'administraci[oó]n tributaria', '\\bvs\\.?\\b', 'selecci[oó]n', 'liga mx',
    '\\bgoles?\\b', 'expropia', 'proponen', 'se moviliza', 'huelga', 'bloqueo', 'ma[ñn]anera', '\\binegi\\b', '\\bmdp\\b',
    'fraude', 'desaparecid', 'captura', 'arresto', '\\bmulta', 'brugada', 'sheinbaum', '\\bfgj\\b', 'inundaci', 'licitaci',
    'remodelaci', '\\brechaza', '\\badmiten', 'destinar[aá]n', '\\basignan', '\\bmanager\\b', 'copa (africana|mundial|del mundo)',
  ].join('|'),
  'i',
);
const HASHTAG_OR_EMOJI = /#\w|\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const PT_TITLE = /[ãõç]|\b(não|você|notícias|seleção|também|incendeia|em vídeo)\b/i;
const EN_TITLE = /\b(how to|watch|the|and|with|set to|new|first|over|says)\b/i;
// "corea del sur - ecuador", "finlandia vs": un tema suelto (en minúsculas o
// un marcador "A - B" / "A v B"), no un título escrito.
const TOPIC_NOT_TITLE = /^[^A-ZÁÉÍÓÚÑ]*$|^[\p{L} .]+ (-|v|vs\.?) [\p{L} .]+$/u;

/** Idioma aproximado del texto (heurística de palabras frecuentes, sin IA). */
export function detectLanguage(text: string): 'es' | 'pt' | 'en' | 'desconocido' {
  const sample = ` ${text.slice(0, 4000)} `;
  const es = (sample.match(ES_WORDS) ?? []).length;
  const pt = (sample.match(PT_WORDS) ?? []).length + (sample.match(PT_CHARS) ?? []).length;
  const en = (sample.match(EN_WORDS) ?? []).length;
  if (es + pt + en < 5) return 'desconocido';
  // Palabras como "do", "no", "com" existen en ambos: el portugués tiene que ganar claramente.
  if (pt > es * 0.6 && pt > en) return 'pt';
  if (en > es && en > pt) return 'en';
  return 'es';
}

// Piezas largas con bajada y secciones; lugares y eventos son notas cortas
// donde la descripción ES el texto principal.
const LONG_FORM: ReviewableType[] = ['noticia', 'reportaje', 'guia', 'planazo-guia'];
const WITH_DEK: ReviewableType[] = ['noticia', 'reportaje', 'guia'];

/**
 * Revisión determinística de una pieza en borrador/revisión: lo que se puede
 * medir sin IA (imagen, longitud, idioma, categoría, fuente, SEO, relleno).
 * Rápida y gratis, para correrla sobre toda la cola.
 */
export function evaluatePiece(piece: ReviewPiece): ReviewEvaluation {
  const body = piece.paragraphs.join('\n');
  const words = countWords(`${piece.summary}\n${body}`);
  const minWords = MIN_WORDS_BY_TYPE[piece.type] ?? DEFAULT_MIN_WORDS;
  const bodyLanguage = detectLanguage(`${piece.title}. ${piece.summary}\n${body}`);
  // El título se revisa aparte: a veces el cuerpo quedó en español pero el título no.
  const titleEnglishWords = (piece.title.match(new RegExp(EN_TITLE.source, 'gi')) ?? []).length;
  const language =
    bodyLanguage === 'es' && PT_TITLE.test(piece.title) ? 'pt' : bodyLanguage === 'es' && titleEnglishWords >= 2 ? 'en' : bodyLanguage;
  const topicNotTitle = TOPIC_NOT_TITLE.test(piece.title.trim());
  const cleanTitle = !HASHTAG_OR_EMOJI.test(piece.title);
  // Texto que termina a media frase (la IA se cortó o se pegó incompleto).
  const lastText = (piece.paragraphs.filter((p) => p.trim()).at(-1) ?? piece.summary).trim();
  const truncated = [piece.summary.trim(), lastText].some((t) => t.length > 40 && !/[.!?…"”»)\]*_]$/.test(t));
  const looksLikeNews = piece.site === 'planazo' && NEWS_TITLE.test(piece.title);
  const fillers = FILLER_PATTERNS.filter((re) => re.test(body)).length;
  const titleLength = piece.title.trim().length;
  const summaryLength = piece.summary.trim().length;
  const seoTitle = piece.seo?.title?.trim().length ?? 0;
  const seoDescription = piece.seo?.description?.trim().length ?? 0;
  const needsSource = piece.site === 'la-mira';
  const LANGUAGE_NAME = { pt: 'portugués', en: 'inglés', desconocido: 'no identificado', es: 'español' } as const;

  const checks: ReviewCheck[] = [
    {
      id: 'imagen',
      label: 'Tiene imagen principal',
      passed: !!piece.imageUrl,
      blocking: true,
      detail: piece.imageUrl ? undefined : 'Sin imagen: en portada se ve un recuadro vacío.',
    },
    {
      id: 'longitud',
      label: `Largo suficiente (mín. ${minWords} palabras)`,
      passed: words >= minWords,
      blocking: true,
      detail: `${words} palabras${words < minWords ? ` — le faltan ~${minWords - words}` : ''}.`,
    },
    {
      id: 'idioma',
      label: 'Escrita en español',
      passed: language === 'es' || language === 'desconocido',
      blocking: true,
      detail: language === 'es' ? undefined : `Parece estar en ${LANGUAGE_NAME[language]}.`,
    },
    ...(piece.site === 'planazo'
      ? [
          {
            id: 'encaje',
            label: 'Es un plan o lugar (no una noticia)',
            passed: !looksLikeNews,
            blocking: true,
            detail: looksLikeNews ? 'El título suena a noticia: quizá va en La Mira ("Mover a La Mira" en la pieza).' : undefined,
          },
        ]
      : []),
    {
      id: 'categoria',
      label: 'Tiene categoría',
      passed: !!piece.categoryName,
      blocking: true,
      detail: piece.categoryName ?? 'Sin categoría: no aparece en su sección del sitio.',
    },
    {
      id: 'completo',
      label: 'Sin texto cortado',
      passed: !truncated,
      blocking: false,
      detail: truncated ? 'La descripción o el último párrafo termina a media frase.' : undefined,
    },
    {
      id: 'relleno',
      label: 'Sin texto de relleno',
      passed: fillers < 2,
      blocking: false,
      detail: fillers ? `${fillers} frase(s) tipo "la información disponible no precisa…".` : undefined,
    },
    {
      id: 'titulo',
      label: 'Título limpio (20-100 caracteres, sin hashtags)',
      passed: titleLength >= 20 && titleLength <= 100 && cleanTitle && !topicNotTitle,
      blocking: false,
      detail: !cleanTitle
        ? 'Tiene hashtags o emojis: parece copiado de una red social.'
        : topicNotTitle
          ? 'Parece un tema suelto ("a - b", todo en minúsculas), no un título.'
          : `${titleLength} caracteres.`,
    },
    ...(WITH_DEK.includes(piece.type)
      ? [
          {
            id: 'bajada',
            label: 'Bajada de buen largo (60-240 caracteres)',
            passed: summaryLength >= 60 && summaryLength <= 240,
            blocking: false,
            detail: summaryLength ? `${summaryLength} caracteres.` : 'Vacía.',
          },
        ]
      : []),
    ...(LONG_FORM.includes(piece.type)
      ? [
          {
            id: 'estructura',
            label: 'Cuerpo con secciones (2+ subtítulos)',
            passed: piece.headings.length >= 2,
            blocking: false,
            detail: `${piece.headings.length} subtítulo(s).`,
          },
        ]
      : []),
    ...(needsSource
      ? [
          {
            id: 'fuente',
            label: 'Cita su fuente',
            passed: !!(piece.sourceUrl || piece.externalSource),
            blocking: false,
            detail: piece.sourceUrl || piece.externalSource ? undefined : 'Sin fuente: al pie solo dirá "Redacción: La Mira".',
          },
        ]
      : []),
    {
      id: 'seo',
      label: 'SEO completo',
      passed: seoTitle >= 20 && seoTitle <= 65 && seoDescription >= 100 && seoDescription <= 170,
      blocking: false,
      detail: seoTitle || seoDescription ? `Título ${seoTitle}/60 · descripción ${seoDescription}/160.` : 'Sin SEO (se genera al guardar).',
    },
  ];

  const blockingFailed = checks.some((c) => c.blocking && !c.passed);
  // "lista" = nada bloqueante y, de lo opcional, a lo mucho el SEO (se puede generar después).
  const optionalFailed = checks.filter((c) => !c.blocking && !c.passed);
  const readiness: Readiness = blockingFailed
    ? 'falta'
    : optionalFailed.length > 1 || optionalFailed.some((c) => c.id !== 'seo')
      ? 'casi'
      : 'lista';
  const weight = (c: ReviewCheck) => (c.blocking ? 2 : 1);
  const total = checks.reduce((n, c) => n + weight(c), 0);
  const passed = checks.filter((c) => c.passed).reduce((n, c) => n + weight(c), 0);

  return { checks, readiness, words, score: Math.round((passed / total) * 100) };
}
