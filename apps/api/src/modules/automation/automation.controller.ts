import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutomationRulesService } from './automation-rules.service';
import { AutomationRunnerService } from './automation-runner.service';
import { automationRuleSchema, updateAutomationRuleSchema } from './dto/automation-rule.dto';

@UseGuards(JwtAuthGuard)
@Controller('cms/automation')
export class AutomationController {
  constructor(
    private readonly rules: AutomationRulesService,
    private readonly runner: AutomationRunnerService,
  ) {}

  @Get('rules')
  findAllRules() {
    return this.rules.findAll();
  }

  @Post('rules')
  createRule(@Body() body: unknown) {
    return this.rules.create(automationRuleSchema.parse(body));
  }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() body: unknown) {
    return this.rules.update(id, updateAutomationRuleSchema.parse(body));
  }

  @Delete('rules/:id')
  removeRule(@Param('id') id: string) {
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
      isRunning: this.runner.isRunning,
    };
  }

  // "Ejecutar ahora" en la pantalla de Automatizaciones — misma lógica exacta
  // que la corrida automática del interval (ver AutomationRunnerService.run).
  @Post('run-now')
  runNow() {
    return this.runner.run();
  }

  // Cola pendiente para el Dashboard — temas de hoy sin evaluar todavía, sin
  // gastar llamadas de IA (ver AutomationRunnerService.getQueueStatus).
  @Get('queue')
  getQueue() {
    return this.runner.getQueueStatus();
  }
}
