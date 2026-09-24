import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { AutomationRulesService } from './automation-rules.service';
import { AutomationRunnerService } from './automation-runner.service';
import { SearchPhrasesService } from './search-phrases.service';
import { automationRuleSchema, updateAutomationRuleSchema } from './dto/automation-rule.dto';

const useSearchPhraseSchema = z.object({ url: z.string().min(1) });

@UseGuards(JwtAuthGuard)
@Controller('cms/automation')
export class AutomationController {
  constructor(
    private readonly rules: AutomationRulesService,
    private readonly runner: AutomationRunnerService,
    private readonly searchPhrases: SearchPhrasesService,
  ) {}

  @Get('rules')
  findAllRules() {
    return this.rules.findAll();
  }

  @Post('rules')
  createRule(@Req() req: RequestWithSession, @Body() body: unknown) {
    assertAdmin(req);
    return this.rules.create(automationRuleSchema.parse(body));
  }

  @Patch('rules/:id')
  updateRule(@Req() req: RequestWithSession, @Param('id') id: string, @Body() body: unknown) {
    assertAdmin(req);
    return this.rules.update(id, updateAutomationRuleSchema.parse(body));
  }

  @Delete('rules/:id')
  removeRule(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    return this.rules.remove(id);
  }

  @Get('runs')
  findRecentRuns() {
    return this.rules.findRecentRuns();
  }

  // "Última revisión: hace X min" en la pantalla — se actualiza en cada tick
  // del interval (ver AutomationRunnerService), no solo cuando publica algo.
  // activeRulesCount/isRunning alimentan el badge del topbar y la tarjeta de
  // "Automatizaciones en tiempo real" del Dashboard.
  @Get('status')
  async getStatus() {
    const activeRules = await this.rules.findActive();
    return {
      lastCheckedAt: await this.rules.getLastCheckedAt(),
      checkIntervalMinutes: 15,
      activeRulesCount: activeRules.length,
      isRunning: this.runner.isRunning || (await this.rules.isRunLocked()),
    };
  }

  // "Ejecutar ahora" en la pantalla de Automatizaciones — misma lógica exacta
  // que la corrida automática del interval (ver AutomationRunnerService.run).
  @Post('run-now')
  runNow(@Req() req: RequestWithSession) {
    assertAdmin(req);
    return this.runner.run();
  }

  // Cola pendiente para el Dashboard — temas de hoy sin evaluar todavía, sin
  // gastar llamadas de IA (ver AutomationRunnerService.getQueueStatus).
  @Get('queue')
  getQueue() {
    return this.runner.getQueueStatus();
  }

  // Frases guardadas de verdad (ver SearchPhrasesService) — a diferencia de
  // `queue` arriba (recalculada del reporte del día, para la cola general),
  // esta lista persiste entre días y acumula ligas de búsqueda web por frase.
  @Get('search-phrases')
  findAllSearchPhrases() {
    return this.searchPhrases.findAll();
  }

  @Post('search-phrases/:id/research')
  researchSearchPhrase(@Param('id') id: string) {
    return this.searchPhrases.research(id);
  }

  @Post('search-phrases/:id/use')
  async useSearchPhrase(@Param('id') id: string, @Body() body: unknown) {
    const dto = useSearchPhraseSchema.parse(body);
    await this.searchPhrases.markUsed(id, dto.url);
    return { ok: true };
  }

  @Post('search-phrases/:id/discard')
  async discardSearchPhrase(@Param('id') id: string) {
    await this.searchPhrases.discard(id);
    return { ok: true };
  }
}
