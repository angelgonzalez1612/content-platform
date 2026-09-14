import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ProviderRegistry } from './provider-registry.service';
import type { ImproveBlockDto } from './dto/improve-block.dto';

const rewriteSchema = z.object({
  heading: z
    .string()
    .nullable()
    .optional()
    .describe('Encabezado del bloque, mejorado si hacía falta — null si el bloque no tiene encabezado.'),
  paragraphs: z
    .array(z.string().min(1))
    .min(1)
    .describe('Los mismos párrafos del bloque, reescritos/corregidos — mismos hechos, sin agregar párrafos nuevos ni inventar información.'),
});

const expandSchema = z.object({
  paragraphs: z
    .array(z.string().min(1))
    .min(1)
    .max(3)
    .describe('Párrafos NUEVOS para agregar al final de este bloque — nunca repite lo que ya dicen los párrafos existentes, nunca inventa cifras, fechas, direcciones ni otros datos verificables que no estén ya en el texto.'),
});

// Igual principio que AiDraftService.improveContent (mejorar nunca
// sobreescribe directo, el humano decide si aplica el resultado), pero
// acotado a UN bloque del cuerpo en vez de a todo el contenido — no se
// registra en content_audit_log porque no hay un contentId real detrás
// (este botón también vive en las pantallas de "generar" ANTES de crear).
@Injectable()
export class BlockImproveService {
  constructor(private readonly providers: ProviderRegistry) {}

  async improveBlock(dto: ImproveBlockDto): Promise<{ heading: string | null; paragraphs: string[] }> {
    const existingText = dto.paragraphs.map((p, i) => `${i + 1}. ${p}`).join('\n');

    const systemPrompt =
      dto.mode === 'expand'
        ? 'Eres un editor que agrega contenido nuevo a un bloque (párrafos) de un artículo. Escribes en español neutro, periodístico, sin inventar datos verificables (cifras, direcciones, fechas, nombres) que no estén ya en el texto que te dan.'
        : 'Eres un editor que corrige y mejora la redacción de un bloque (párrafos) de un artículo. Mantienes los mismos hechos, solo mejoras claridad, gramática y estilo — nunca inventas ni quitas información verificable, y nunca agregas párrafos nuevos.';

    const userPrompt = [
      dto.articleTitle ? `Artículo: ${dto.articleTitle}` : '',
      dto.heading ? `Encabezado de este bloque: ${dto.heading}` : '',
      `Párrafos actuales de este bloque:\n${existingText}`,
      dto.instructions ? `Instrucción del editor: ${dto.instructions}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (dto.mode === 'expand') {
      const output = await this.providers.get(dto.provider).generateStructured({
        systemPrompt,
        userPrompt,
        schema: expandSchema,
        schemaName: 'block_expand',
      });
      return { heading: dto.heading ?? null, paragraphs: output.paragraphs };
    }

    const output = await this.providers.get(dto.provider).generateStructured({
      systemPrompt,
      userPrompt,
      schema: rewriteSchema,
      schemaName: 'block_rewrite',
    });
    return { heading: output.heading ?? dto.heading ?? null, paragraphs: output.paragraphs };
  }
}
