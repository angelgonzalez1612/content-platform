import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProviderHealthService } from '../ai/provider-health';
import { AutomationRulesService } from '../automation/automation-rules.service';
import { AutomationRunnerService } from '../automation/automation-runner.service';
import { buildNotifications } from './build-notifications';

// Campanita del topbar del CMS. Solo lee estado (DB + memoria), nunca llama a
// la IA — el CMS la consulta cada minuto.
@UseGuards(JwtAuthGuard)
@Controller('cms/notifications')
export class NotificationsController {
  constructor(
    private readonly providerHealth: ProviderHealthService,
    private readonly rules: AutomationRulesService,
    private readonly runner: AutomationRunnerService,
  ) {}

  @Get()
  async list() {
    const [activeRules, lastCheckedAt, isRunLocked, recentRunErrors] = await Promise.all([
      this.rules.findActive(),
      this.rules.getLastCheckedAt(),
      this.rules.isRunLocked(),
      this.rules.findRecentErrors(),
    ]);
    return buildNotifications({
      now: new Date(),
      providerHealth: this.providerHealth.getAll(),
      providerEvents: this.providerHealth.getEvents(),
      activeRulesCount: activeRules.length,
      isRunning: this.runner.isRunning || isRunLocked,
      lastCheckedAt,
      recentRunErrors,
    });
  }
}
