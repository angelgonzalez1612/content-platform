import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard, type RequestWithSession } from '../auth/jwt-auth.guard';
import { ReviewAgentService } from './review-agent.service';
import { AI_PROVIDER_IDS } from '../ai/provider-registry.service';

const TYPES = ['noticia', 'reportaje', 'guia', 'place', 'evento-planazo', 'planazo-guia'] as const;
const itemSchema = z.object({ type: z.enum(TYPES), id: z.string().min(1) });
// Proveedor elegido en el Revisor; 'default' = el de Configuración (con su respaldo).
const providerSchema = z.enum([...AI_PROVIDER_IDS, 'default']).default('default');

@UseGuards(JwtAuthGuard)
@Controller('cms/review-agent')
export class ReviewAgentController {
  constructor(private readonly reviewAgent: ReviewAgentService) {}

  /** Cola de borradores/en revisión con su revisión automática. */
  @Get('queue')
  queue() {
    return this.reviewAgent.queue();
  }

  /** Segunda opinión con IA de una pieza. */
  @Post('analyze')
  analyze(@Req() req: RequestWithSession, @Body() body: unknown) {
    const dto = itemSchema.extend({ provider: providerSchema }).parse(body);
    return this.reviewAgent.analyze(dto.type, dto.id, req.session?.sub, dto.provider);
  }

  /** "Arreglar" un criterio que falló (SEO, imagen, largo, secciones, título, bajada). */
  @Post('fix')
  fix(@Req() req: RequestWithSession, @Body() body: unknown) {
    const dto = itemSchema.extend({ check: z.enum(['seo', 'imagen', 'longitud', 'estructura', 'titulo', 'bajada']), provider: providerSchema }).parse(body);
    return this.reviewAgent.fix(dto.type, dto.id, dto.check, req.session?.sub, dto.provider);
  }

  /** "Aplicar correcciones": la IA propone la pieza corregida según su revisión (no guarda). */
  @Post('corrections')
  corrections(@Body() body: unknown) {
    const dto = itemSchema.extend({ provider: providerSchema }).parse(body);
    return this.reviewAgent.proposeCorrections(dto.type, dto.id, dto.provider);
  }

  /** Guarda las correcciones que el editor aceptó. */
  @Post('corrections/apply')
  applyCorrections(@Body() body: unknown) {
    const block = z.object({ heading: z.string().nullable(), paragraphs: z.array(z.string()) });
    const dto = itemSchema
      .extend({ title: z.string().optional(), summary: z.string().optional(), content: z.array(block).max(40).optional() })
      .parse(body);
    return this.reviewAgent.applyCorrections(dto.type, dto.id, dto);
  }

  /** Publica las piezas elegidas (se saltan las que no cumplen lo bloqueante). */
  @Post('publish')
  publish(@Body() body: unknown) {
    const dto = z.object({ items: z.array(itemSchema).min(1).max(50) }).parse(body);
    return this.reviewAgent.publish(dto.items);
  }
}
