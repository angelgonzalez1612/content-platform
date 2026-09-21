import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ProviderRegistry } from './provider-registry.service';
import type { GenerateSeoDto } from './dto/generate-seo.dto';

// Mismos límites que seoShape en AiDraftService.draft/improveLamiraContent —
// holgados a propósito (el límite real de 60 / 120-160 se exige como check
// bloqueante aparte, no aquí, para no repetir el crash que causaba una
// versión anterior con min/max exactos + reintentos agotados en claude-cli).
const seoSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(90)
    .describe(
      'Título SEO — máximo 60 caracteres (cuenta los caracteres, es un límite real de Google). Atractivo para clic, con ángulo propio — no una copia literal del título/nombre.',
    ),
  description: z
    .string()
    .min(60)
    .max(220)
    .describe(
      'Meta descripción SEO — entre 120 y 160 caracteres (cuenta los caracteres). Atractiva y concreta, sin repetir el título palabra por palabra.',
    ),
});

@Injectable()
export class SeoGenerateService {
  constructor(private readonly providers: ProviderRegistry) {}

  async generateSeo(dto: GenerateSeoDto): Promise<{ title: string; description: string }> {
    const systemPrompt =
      'Eres un editor SEO. A partir del título/nombre de una pieza de contenido (y contexto opcional), escribes un título SEO y una meta descripción atractivos, en español neutro, sin inventar datos verificables (cifras, direcciones, fechas, nombres) que no estén ya en el contexto.';

    const userPrompt = [
      `Título/nombre: ${dto.contentTitle}`,
      dto.contentContext ? `Contexto adicional: ${dto.contentContext}` : '',
      dto.instructions ? `Instrucción del editor: ${dto.instructions}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return this.providers.generateWithFallback(dto.provider, {
      systemPrompt,
      userPrompt,
      schema: seoSchema,
      schemaName: 'seo_generate',
    });
  }
}
