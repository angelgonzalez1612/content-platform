import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import {
  CATEGORY_SLUGS,
  type ContentProvider,
  type PlaceDraftInput,
  type PlaceDraftOutput,
} from '../content-provider.interface';

const draftSchema = z.object({
  description: z
    .string()
    .describe('80-120 word editorial description in Spanish (Mexico), written for a CDMX city guide.'),
  suggestedCategory: z.enum(CATEGORY_SLUGS),
  suggestedTags: z.array(z.string()).min(1).max(5),
});

const SYSTEM_PROMPT = `Eres redactor editorial de Planazo, una guía de planes y lugares de la Ciudad de México.

Reglas estrictas:
- Solo escribes con la información que te da el editor (nombre + notas). NUNCA inventes dirección, teléfono, precios, horarios ni datos verificables que no te dieron — eso lo completa un humano después.
- El tono es directo y útil, como alguien que ya fue y te está recomendando, no como un anuncio.
- Responde siempre en español de México.`;

@Injectable()
export class OpenAiProvider implements ContentProvider {
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  // Built lazily — constructing the SDK client eagerly would throw at app
  // boot (crashing the whole API, not just this feature) whenever the key
  // isn't set yet, e.g. on a fresh clone before .env is filled in.
  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY no está configurada en el backend. Agrégala a apps/api/.env.',
      );
    }

    this.client = new OpenAI({ apiKey });
    return this.client;
  }

  async generatePlaceDraft(input: PlaceDraftInput): Promise<PlaceDraftOutput> {
    const client = this.getClient();

    const userPrompt = [
      `Nombre del lugar: ${input.name}`,
      input.hints ? `Notas del editor: ${input.hints}` : 'Notas del editor: (ninguna)',
      '',
      `Elige la categoría más adecuada de esta lista exacta: ${CATEGORY_SLUGS.join(', ')}.`,
      'Sugiere entre 1 y 5 etiquetas cortas y descriptivas (ej. "Pet friendly", "Para trabajar", "Con amigos").',
    ].join('\n');

    const completion = await client.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(draftSchema, 'place_draft'),
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new InternalServerErrorException('OpenAI no devolvió una respuesta válida.');
    }

    return parsed;
  }
}
