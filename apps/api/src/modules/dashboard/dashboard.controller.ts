import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { VercelDeploymentsService } from './vercel-deployments.service';

@UseGuards(JwtAuthGuard)
@Controller('cms/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly vercelDeployments: VercelDeploymentsService,
  ) {}

  @Get('stats')
  getStats() {
    return this.dashboard.getStats();
  }

  @Get('deploys')
  getDeploys() {
    return this.vercelDeployments.getLastDeploys();
  }

  @Post('deploys/:project')
  triggerDeploy(@Param('project') project: string) {
    return this.vercelDeployments.triggerDeploy(project);
  }
}
