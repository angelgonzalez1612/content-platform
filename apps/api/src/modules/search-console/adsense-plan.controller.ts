import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdsensePlanService } from './adsense-plan.service';

@UseGuards(JwtAuthGuard)
@Controller('cms/adsense-plan')
export class AdsensePlanController {
  constructor(private readonly plan: AdsensePlanService) {}

  /** Criterios automáticos y tareas manuales del camino a AdSense. */
  @Get()
  get() {
    return this.plan.get();
  }

  /** Marca o desmarca una tarea manual. */
  @Patch('tasks/:id')
  setTask(@Param('id') id: string, @Body() body: unknown) {
    const dto = z.object({ done: z.boolean() }).parse(body);
    return this.plan.setTask(id, dto.done);
  }
}
