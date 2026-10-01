import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard, type RequestWithSession } from '../auth/jwt-auth.guard';
import { ReviewAgentService } from './review-agent.service';

const TYPES = ['noticia', 'reportaje', 'guia', 'place', 'evento-planazo', 'planazo-guia'] as const;
const itemSchema = z.object({ type: z.enum(TYPES), id: z.string().min(1) });

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
    const dto = itemSchema.parse(body);
    return this.reviewAgent.analyze(dto.type, dto.id, req.session?.sub);
  }

  /** Publica las piezas elegidas (se saltan las que no cumplen lo bloqueante). */
  @Post('publish')
  publish(@Body() body: unknown) {
    const dto = z.object({ items: z.array(itemSchema).min(1).max(50) }).parse(body);
    return this.reviewAgent.publish(dto.items);
  }
}
